#!/usr/bin/env node
// Moontalk Codex Workflow Helper
// -----------------------------------------------------------------------------
// Purpose
// - Single entry point for build/lint/test and intent caching → safe, repeatable
//   workflow for Codex agents and humans. It only commits when all checks pass.
//
// 20‑second Briefing (don’t skip)
// - Stage intentionally before first run (use `git add -p`).
// - On failure: fix → stage → rerun (no new -m).
// - Use --rebind only if scope is unchanged (same feature surface).
// - Use --amend only after green to polish the same commit.
// - Use --push after success; only rebase if push was rejected.
//
// Usage (examples)
// - Validate and cache intent:
//   node scripts/codex-workflow.mjs -m "feat: add X"
// - Re-run after fixes (do not change message):
//   node scripts/codex-workflow.mjs
// - Amend the eventual commit:
//   node scripts/codex-workflow.mjs --amend
// - Rebind staged tree to current index (when staged content changed intentionally):
//   node scripts/codex-workflow.mjs --rebind
// - Clear intent cache:
//   node scripts/codex-workflow.mjs --clear
// - Verbose logging for agents:
//   node scripts/codex-workflow.mjs --verbose
//
// Contract
// - Never commit unless all checks pass (build → lint → test).
// - Commit message = cached main line plus optional "Secondary changes:" bullets
//   from concise failure notes collected across runs.
//
// Cache
// - Path: .git/.codex_intent.json
// - Fields: { main, secondary[], createdAT, branch, stagedTree }
// - Agents: on non‑zero exit, fix issues, restage, and rerun without changing
//   the main message (-m). Use --rebind if staged content legitimately changed.
//
// What this script does
// 1) Prints Git context (branch, last commit, remotes).
// 2) Validates via gate steps in order (configurable): build → lint → test.
//    Use --verbose (or CODEX_VERBOSE=1) to show each command + exit code.
// 3) Shows Git status + diffstat.
// 4) If intent exists and staged matches cache (or --rebind), composes and
//    creates a commit (honors --amend only on green commit). Then clears cache.
//
// Flags / Env
// - --commit "msg", -m "msg"  Cache commit intent message
// - --amend                    Apply --amend on commit (only on green commit)
// - --rebind                   Update intent.stagedTree to current index
// - --clear                    Delete cache and exit
// - --order a,b,c              Pipeline order (default build,lint,test)
// - --push                     Push after commit (respects upstream)
// - --verbose                  Verbose command logging
// - --dry-run                  Print actions; skip mutating commands
// - --allow-main               Allow operating on main (otherwise blocked)
// - --help, -h                 Show help
//
// Exit codes
// - 0  success (gate passed; commit may or may not be created)
// - 2  refused to operate on main without --allow-main
// - 3  no staged changes (script stops early)
// - >0 step/commit/push failure

import { spawnSync } from 'node:child_process';
import { EOL } from 'node:os';
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';

let VERBOSE = String(process.env.CODEX_VERBOSE||'').trim() === '1';
let DRY_RUN = String(process.env.CODEX_DRY_RUN||'').trim() === '1';

function run(cmd, args, opts={}, label){
  const full = [cmd, ...(args||[])].join(' ');
  if (VERBOSE){
    console.log(`>> ${label?label+': ':''}${full}`);
  }
  if (DRY_RUN && isMutatingCommand(cmd, args)){
    if (VERBOSE) console.log(`.. DRY-RUN: skipped mutating command`);
    return { code: 0, out: '' };
  }
  const p = spawnSync(cmd, args, { stdio: 'pipe', encoding: 'utf8', ...opts });
  const code = p.status ?? 0;
  if (VERBOSE){
    console.log(`<< exit ${code}`);
  }
  return { code, out: (p.stdout||'')+(p.stderr||'') };
}

function isMutatingCommand(cmd, args){
  const s = `${cmd} ${(args||[]).join(' ')}`;
  // Heuristic: treat these as mutating
  return /\b(git\s+(add|commit|push|reset)|npm\s+run\s+build)\b/.test(s);
}

function printSection(title){
  const line = '-'.repeat(Math.max(8, title.length));
  console.log(`\n${title}\n${line}`);
}
const sym = { ok: '✅', fail: '❌', info: 'ℹ️', warn: '⚠️' };
// Distinct exit codes for clear failure modes
const EXIT = {
  OK: 0,
  E_NO_STAGED: 10,
  E_CHECK_FAIL: 11,
  E_TREE_MISMATCH: 12,
  E_PUSH_REJECTED: 13,
  E_DOCS_REQUIRED: 14,
  E_MAIN_PROTECTED: 2,
  E_MISC: 1,
};

function parseArgs(argv){
  const args = { commitMsg: null, push: false, allowMain: false, verbose: false, dryRun: false, order: null, rebind: false, clear: false, amend: false };
  for (let i=2;i<argv.length;i++){
    const a = argv[i];
    if (a === '--help' || a === '-h'){ args.help = true; }
    else if (a === '--push'){ args.push = true; }
    else if (a === '--allow-main'){ args.allowMain = true; }
    else if (a === '--verbose'){ args.verbose = true; }
    else if (a === '--dry-run'){ args.dryRun = true; }
    else if (a === '--order'){ args.order = (argv[++i]||'').split(',').map(s=>s.trim()).filter(Boolean); }
    else if (a === '--rebind'){ args.rebind = true; }
    else if (a === '--clear'){ args.clear = true; }
    else if (a === '--amend'){ args.amend = true; }
    else if (a === '--commit'){ args.commitMsg = argv[++i] || ''; }
    else if (a === '-m'){ args.commitMsg = argv[++i] || ''; }
    else { (args._ ||= []).push(a); }
  }
  return args;
}

function showHelp(){
  console.log(`Moontalk Codex Workflow\n\n`+
`Purpose: single entry for build/lint/test with intent caching. Commits only when all checks pass.\n\n`+
`Pipeline (default order):\n`+
`  1) npm run build   — type-check + Vite build\n`+
`  2) npm run lint    — ESLint (errors fail gate)\n`+
`  3) npm run test    — Vitest suite (failures fail gate)\n`+
`  4) git status/diff — summary + diffstat\n`+
`  5) commit (if intent cached & staged matches)\n\n`+
`Usage (copy/paste):\n`+
`  First run (stage then set intent):\n`+
`    node scripts/codex-workflow.mjs -m \"feat(scope): concise intent\"\n`+
`  Fix iteration (no new message):\n`+
`    node scripts/codex-workflow.mjs\n`+
`  Rebind (only when prompted, same scope):\n`+
`    node scripts/codex-workflow.mjs --rebind\n`+
`  Amend (only after green to clarify):\n`+
`    node scripts/codex-workflow.mjs --amend\n`+
`  Push current branch (independent step):\n`+
`    node scripts/codex-workflow.mjs --push\n\n`+
`Intent cache:\n`+
`  Path: .git/.codex_intent.json\n`+
`  Fields: { main, secondary[], createdAT, branch, stagedTree, paths[] }\n`+
`  Meaning: caches your main commit line and the exact staged surface for safety.\n\n`+
`Exit codes (and what to do):\n`+
`  0   OK                 — Gate passed. If commit created, run --push.\n`+
`  10  E_NO_STAGED        — Stage changes (git add ...) or set intent (-m).\n`+
`  11  E_CHECK_FAIL       — Fix issues, stage fixes, then rerun (no new -m).\n`+
`  12  E_TREE_MISMATCH    — If scope unchanged, rerun with --rebind; otherwise clear intent or restage.\n`+
`  13  E_PUSH_REJECTED    — Fetch, rebase onto origin/<branch>, resolve, rerun checks, then --push again.\n`+
`  14  E_DOCS_REQUIRED    — Update docs (CHANGELOG/AGENTS/README), stage, then rerun.\n`
`  2   E_MAIN_PROTECTED   — Switch to a *-dev branch or pass --allow-main.\n\n`+
`Notes hygiene:\n`+
`  Commit footer keeps at most one bullet per category (build, lint, test, meta),\n`+
`  ordered and deduped; omitted entirely if no notes.\n`);
}

async function main(){
  const args = parseArgs(process.argv);
  VERBOSE = VERBOSE || !!args.verbose;
  DRY_RUN = DRY_RUN || !!args.dryRun;
  if (args.help){ showHelp(); process.exit(0); }
  const INTENT_JSON = '.git/.codex_intent.json';

  // Ensure hooksPath is set to .githooks (non-fatal)
  const hooksGet = run('git', ['config','--get','core.hooksPath'], {}, 'git config hooksPath');
  if ((hooksGet.out||'').trim() !== '.githooks'){
    run('git', ['config','core.hooksPath','.githooks'], {}, 'git config set hooksPath');
  }

  // Git context
  const branch = run('git',['branch','--show-current'], {}, 'git branch --show-current').out.trim() || 'HEAD';
  const remotes = run('git',['remote','-v'], {}, 'git remote -v').out.trim();
  const last = run('git',['--no-pager','log','-1','--pretty=oneline'], {}, 'git log -1').out.trim();
  printSection('Git Context');
  console.log(`Branch: ${branch}`);
  console.log(`Last:   ${last || '—'}`);
  console.log(`Remotes:\n${remotes || '(none)'}`);
  if (!args.allowMain && (branch === 'main' || branch === 'master')){
    return exitOneLine(EXIT.E_MAIN_PROTECTED, "Switch to a *-dev branch or pass --allow-main.");
  }

  // --clear: remove intent cache and exit cleanly
  if (args.clear){
    try { if (existsSync(INTENT_JSON)) { unlinkSync(INTENT_JSON); console.log(`${sym.ok} Cleared intent cache.`); } else { console.log(`${sym.info} No intent cache to clear.`); } }
    catch (e) { console.error(`${sym.warn} Failed to clear intent cache: ${e && e.message ? e.message : String(e)}`); process.exit(5); }
    process.exit(0);
  }

  // Standalone push mode: allow pushing without staged changes or intent
  // Runs before any staged-change guards or pipeline
  if (args.push && !args.commitMsg && !existsSync(INTENT_JSON)){
    printSection('Push');
    const res = pushCurrentBranch(branch);
    if (res.code !== 0){
      return exitOneLine(EXIT.E_PUSH_REJECTED, 'Push was rejected (non-fast-forward). Run git fetch, git rebase origin/'+branch+', resolve conflicts, re-run the script (checks), then --push again');
    }
    console.log(`${sym.ok} Push completed.`);
    return nextAndExit(EXIT.OK, 'Branch pushed.');
  }

  // Intent cache: create/overwrite on message; otherwise reuse if present
  // NOTE: We require staged changes before creating/modifying the cache (except --clear above)

  // Early guard: require staged changes for caching/updating intent and for commit path
  const staged = run('git',['diff','--name-only','--cached'], {}, 'git diff --cached').out.trim();
  if (!staged && args.commitMsg == null && !existsSync(INTENT_JSON)){
    return exitOneLine(EXIT.E_NO_STAGED, 'Stage changes (git add ...) or provide a message to set intent.');
  }

  // With staged changes, now handle cache create/update/reuse
  if (args.commitMsg != null){
    try {
      if (!existsSync('.git')) mkdirSync('.git', { recursive: true });
      const stagedTree = run('git',['write-tree'], {}, 'git write-tree').out.trim();
      const stagedPaths = getStagedPaths();
      const intent = { main: String(args.commitMsg), secondary: [], createdAT: new Date().toISOString(), branch, stagedTree, paths: stagedPaths };
      writeFileSync(INTENT_JSON, JSON.stringify(intent, null, 2), 'utf8');
      if (VERBOSE) console.log(`${sym.info} Intent cached at ${INTENT_JSON}`);
    } catch (e) {
      console.error(`${sym.warn} Failed to write intent cache: ${e && e.message ? e.message : String(e)}`);
    }
  } else if (existsSync(INTENT_JSON)){
    if (args.rebind){
      try {
        const j = loadIntentJSON() || {};
        j.stagedTree = run('git',['write-tree'], {}, 'git write-tree (rebind)').out.trim();
        j.paths = getStagedPaths();
        writeFileSync(INTENT_JSON, JSON.stringify(j, null, 2), 'utf8');
        if (VERBOSE) console.log(`${sym.info} Rebound intent.stagedTree to current index.`);
      } catch {}
    }
    if (VERBOSE) { try { const j=loadIntentJSON(); if (j) console.log(`${sym.info} Using cached intent: ${j.main||'(empty)'}`); } catch {} }
  } else {
    console.log(`${sym.info} Provide a commit message to set intent or stage changes and rerun.`);
  }

  // Pipeline (default build -> lint -> test); configurable via --order build,lint,test
  const order = Array.isArray(args.order) && args.order.length ? args.order : ['build','lint','test'];
  for (const step of order){
    if (step === 'build'){
      printSection('STEP: Build (npm run build)');
      const res = run('npm',['run','build'], {}, 'npm run build');
      process.stdout.write(res.out);
      if (res.code !== 0){ appendSecondaryNote(summarizeBuild(res.out, res.code)); return exitOneLine(EXIT.E_CHECK_FAIL, args.amend ? "'--amend' is only applied on a green commit; continue fixing and rerun." : 'fix issues, stage fixes, then rerun (no new message).'); }
      console.log(`\n${sym.ok} Build succeeded.`);
    } else if (step === 'lint'){
      printSection('STEP: Lint (npm run lint)');
      const res = run('npm',['run','lint'], {}, 'npm run lint');
      process.stdout.write(res.out);
      if (res.code !== 0){ appendSecondaryNote(summarizeLint(res.out)); return exitOneLine(EXIT.E_CHECK_FAIL, args.amend ? "'--amend' is only applied on a green commit; continue fixing and rerun." : 'fix issues, stage fixes, then rerun (no new message).'); }
      const summaryLine = (res.out.split(/\r?\n/).reverse().find(l=>/problems \(\d+ errors?, \d+ warnings?\)/.test(l))||'').trim(); if (summaryLine) console.log(`\n${sym.info} ESLint summary: ${summaryLine}`);
      console.log(`\n${sym.ok} Lint completed.`);
    } else if (step === 'test'){
      printSection('STEP: Tests (npm run test)');
      const res = run('npm',['run','test'], {}, 'npm run test');
      process.stdout.write(res.out);
      if (res.code !== 0){ appendSecondaryNote(summarizeTest(res.out)); return exitOneLine(EXIT.E_CHECK_FAIL, args.amend ? "'--amend' is only applied on a green commit; continue fixing and rerun." : 'fix issues, stage fixes, then rerun (no new message).'); }
      console.log(`\n${sym.ok} Tests passed.`);
    }
  }

  // 3) Status + diffstat
  printSection('STEP 4: Git Status');
  const status = run('git',['status','-sb'], {}, 'git status -sb');
  process.stdout.write(status.out || '(clean)'+EOL);
  printSection('Diffstat');
  const diffstat = run('git',['--no-pager','diff','--stat'], {}, 'git diff --stat');
  process.stdout.write(diffstat.out || '(no changes)'+EOL);
  const untracked = run('git',['ls-files','-m','-o','--exclude-standard'], {}, 'git ls-files').out.trim();
  if (untracked) { console.log('\nUntracked/modified files:\n'+untracked); }

  // 5) Commit using cached intent (JSON)
  const intentObj = loadIntentJSON();
  const intent = intentObj?.main || '';
  if (intent){
    printSection('STEP 5: Commit');
    // Respect staged-only policy: do not auto-add; commit only what's staged
    const stagedNow = run('git',['diff','--name-only','--cached'], {}, 'git diff --cached (pre-commit)').out.trim();
    if (!stagedNow){ return exitOneLine(EXIT.E_NO_STAGED, 'Stage changes (git add ...) or provide a message to set intent.'); }
    // Guard: staged tree mismatch unless --rebind
    const stagedTreeNow = run('git',['write-tree'], {}, 'git write-tree (pre-commit)').out.trim();
    if (intentObj && intentObj.stagedTree && intentObj.stagedTree !== stagedTreeNow){
      if (!args.rebind){
        // Attempt safe auto-rebind when branch unchanged, cache is fresh, and paths are subset/superset
        const nowPaths = new Set(getStagedPaths());
        const cachedPaths = new Set(Array.isArray(intentObj.paths)? intentObj.paths : []);
        const hasCachedPaths = cachedPaths.size > 0;
        const branchSame = (intentObj.branch || '') === branch;
        const fresh = intentObj.createdAT ? isYoungerThanHours(intentObj.createdAT, 4) : false;
        const subset = hasCachedPaths && isSubsetOf(nowPaths, cachedPaths);
        const superset = hasCachedPaths && isSubsetOf(cachedPaths, nowPaths);
        if (branchSame && fresh && hasCachedPaths && (subset || superset)){
          try {
            const j = loadIntentJSON() || { main:intent, secondary:[], createdAT:new Date().toISOString(), branch, stagedTree:'' };
            j.stagedTree = stagedTreeNow;
            j.paths = Array.from(nowPaths).sort();
            writeFileSync(INTENT_JSON, JSON.stringify(j, null, 2), 'utf8');
            appendSecondaryNote('meta: rebind after fixes');
            if (VERBOSE) console.log(`${sym.info} Auto-rebound intent.stagedTree to current index (subset/superset within 4h).`);
          } catch {}
        } else {
          // Explain which paths changed and require explicit --rebind
          const added = [...nowPaths].filter(p=>!cachedPaths.has(p));
          const removed = [...cachedPaths].filter(p=>!nowPaths.has(p));
          if (added.length) console.log('New staged paths:\n- ' + added.join('\n- '));
          if (removed.length) console.log('Removed staged paths:\n- ' + removed.join('\n- '));
          return exitOneLine(EXIT.E_TREE_MISMATCH, 'if scope unchanged, rerun with --rebind; otherwise clear intent or restage');
        }
      } else {
        try {
          const j = loadIntentJSON() || { main:intent, secondary:[], createdAT:new Date().toISOString(), branch, stagedTree:'' };
          j.stagedTree = stagedTreeNow;
          j.paths = getStagedPaths();
          writeFileSync(INTENT_JSON, JSON.stringify(j, null, 2), 'utf8');
          if (VERBOSE) console.log(`${sym.info} Rebound intent.stagedTree to current index.`);
        } catch {}
      }
    }
    // Docs enforcement: require docs updates when warranted (before composing message)
    const stagedListNow = getStagedPaths();
    const docsCheck = checkDocsRequirement(intent, stagedListNow);
    if (docsCheck.requires && !docsCheck.hasDocs){
      if (docsCheck.suggested && docsCheck.suggested.length){
        console.log('Consider updating docs files: '+docsCheck.suggested.join(', '));
      }
      return exitOneLine(EXIT.E_DOCS_REQUIRED, 'Docs required: update docs (CHANGELOG/AGENTS/README), stage changes, then rerun.');
    }
    if (docsCheck.hasDocs){ appendSecondaryNote('docs: update documentation'); }

    // Compose message: main + optional Secondary changes
    const composed = composeCommitMessage(intentObj || { main:intent, secondary:[] });
    const commitArgs = ['commit','-m', composed].concat(args.amend ? ['--amend'] : []);
    const commit = run('git', commitArgs, {}, 'git commit');
    process.stdout.write(commit.out);
    if (commit.code !== 0){ console.error('Commit failed.'); return nextAndExit(commit.code||1, 'Resolve git error and rerun'); }
    console.log(`${sym.ok} Commit created.`);
    try { unlinkSync(INTENT_JSON); } catch {}
    console.log(`\n${sym.info} To push this branch, run with --push (separate step).`);
    return nextAndExit(0, 'Gate passed; commit created. Now run --push or open a PR.');
  } else {
    console.log(`${sym.info} No intent cached. Skipping commit.`);
    return nextAndExit(0, 'Gate passed; stage changes and run with -m to commit, or --clear');
  }
}

function loadIntentJSON(){
  try {
    if (!existsSync('.git/.codex_intent.json')) return null;
    const raw = readFileSync('.git/.codex_intent.json','utf8');
    return JSON.parse(raw);
  } catch { return null; }
}

function getIntentMain(){ const j = loadIntentJSON(); return j && typeof j.main==='string' ? j.main : ''; }

function composeCommitMessage(j){
  const lines = [String(j.main||'').trim()];
  const notes = Array.isArray(j.secondary) ? j.secondary.filter(s=>String(s).trim()) : [];
  // Coalesce to at most one per category with priority: build -> lint -> test -> meta
  const order = ['build','lint','test','docs','meta'];
  const pick = new Map();
  for (let i=notes.length-1;i>=0;i--){
    const n = String(notes[i]);
    const cat = categorizeNote(n);
    if (order.includes(cat) && !pick.has(cat)) pick.set(cat, formatNote(cat, n));
  }
  const finalNotes = [];
  for (const cat of order){ if (pick.has(cat)) finalNotes.push(pick.get(cat)); }
  if (finalNotes.length){
    lines.push('', 'Secondary changes:');
    for (const n of finalNotes){ lines.push(`- ${n}`); }
  }
  return lines.join('\n');
}

main().catch(err=>{ console.error(err); process.exit(1); });

function nextAndExit(code, nextMsg){
  const ok = code === 0;
  const tag = ok ? sym.ok : sym.fail;
  console.log(`\n${tag} NEXT: ${nextMsg}`);
  process.exit(code);
}

// Output exactly one guidance line, then exit with the given code.
function exitOneLine(code, msg){
  console.log(String(msg).trim());
  process.exit(Number(code)||1);
}

function getStagedPaths(){
  const out = run('git',['diff','--name-only','--cached'], {}, 'git diff --name-only --cached').out;
  return out.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).sort();
}

function isSubsetOf(aSet, bSet){
  for (const v of aSet){ if (!bSet.has(v)) return false; }
  return true;
}

function isYoungerThanHours(iso, hours){
  try { const t = new Date(iso).getTime(); if (!isFinite(t)) return false; return (Date.now() - t) < (hours*3600*1000); } catch { return false; }
}

function pushCurrentBranch(branch){
  const upstream = run('git',['rev-parse','--abbrev-ref','--symbolic-full-name','@{u}'], {}, 'git rev-parse @{u}');
  let push;
  if (upstream.code === 0){ push = run('git',['push'], {}, 'git push'); }
  else { push = run('git',['push','-u','origin', branch], {}, 'git push -u'); }
  process.stdout.write(push.out);
  return { code: push.code };
}

function checkDocsRequirement(intent, stagedPaths){
  const docsPaths = stagedPaths.filter(isDocPath);
  const nonDocs = stagedPaths.filter(p=>!isDocPath(p));
  const { type, scope } = parseConventional(intent||'');
  const onlyTests = nonDocs.length>0 && nonDocs.every(isTestPath);

  // Broad heuristic: require docs for most user-visible or workflow-impacting changes
  let requires = false;
  if (nonDocs.length === 0){
    requires = false;
  } else if (onlyTests && (type === 'test' || type === 'chore')){
    requires = false;
  } else if (nonDocs.some(isWorkflowPath)){
    requires = true;
  } else if (nonDocs.some(isUserFacingPath)){
    requires = true;
  } else if (['feat','fix','refactor','perf','build','chore','ci'].includes(type)){
    requires = true;
  } else if (scope && /(codex|workflow|translator|ui|docs)/i.test(scope)){
    requires = true;
  }

  const suggested = suggestDocsFiles(stagedPaths);
  return { requires, hasDocs: docsPaths.length>0, suggested };
}
function isDocPath(p){ return p === 'README.md' || p === 'AGENTS.md' || p === 'CHANGELOG.md' || (/^docs\/.+\.md$/i).test(p); }
function isTestPath(p){ return /^tests\//.test(p) || /\.test\.(t|j)sx?$/.test(p); }
function isUserFacingPath(p){ return /^src\//.test(p) || /^public\//.test(p) || /^assets\//.test(p) || /^pages\//.test(p) || /^components\//.test(p) || /^data\//.test(p); }
function isWorkflowPath(p){
  return /^scripts\//.test(p)
    || p === 'vite.config.ts'
    || p === 'eslint.config.js'
    || p === 'vitest.config.ts'
    || /^tsconfig(\..+)?\.json$/.test(p)
    || /^package(-lock)?\.json$/.test(p)
    || /^\.githooks\//.test(p)
    || /^\.github\//.test(p);
}
function parseConventional(s){
  const m = String(s).match(/^(\w+)(?:\(([^)]+)\))?:/);
  return { type: m ? m[1] : '', scope: m ? m[2] : '' };
}
function suggestDocsFiles(staged){
  const list = new Set();
  const anyWorkflow = staged.some(isWorkflowPath);
  const anyUserFacing = staged.some(isUserFacingPath);
  if (anyWorkflow){ list.add('AGENTS.md'); list.add('README.md'); }
  if (anyUserFacing){ list.add('README.md'); }
  list.add('CHANGELOG.md');
  return Array.from(list);
}

// ===== Failure note helpers =====
function appendSecondaryNote(note){
  try {
    const j = loadIntentJSON();
    if (!j) return; // no cache → nothing to append
    if (!Array.isArray(j.secondary)) j.secondary = [];
    const msg = String(note);
    if (!j.secondary.includes(msg)) j.secondary.push(msg);
    writeFileSync('.git/.codex_intent.json', JSON.stringify(j, null, 2), 'utf8');
    if (VERBOSE) console.log(`${sym.info} Appended note to intent: ${note}`);
  } catch {}
}
function summarizeBuild(out, exitCode){
  const codes = Array.from(new Set((out.match(/TS\d{3,5}/g)||[]))).slice(0,3);
  if (codes.length) return `build: resolve ${codes[0]}`;
  return 'build: resolve errors';
}
function summarizeLint(out){
  const summary = out.match(/problems\s*\((\d+)\s*errors?,\s*(\d+)\s*warnings?\)/i);
  let err = summary ? Number(summary[1]) : null;
  let warn = summary ? Number(summary[2]) : null;
  if (err==null){ err = (out.match(/\berror\b/gi)||[]).length; if (err===0) err = null; }
  if (warn==null){ warn = (out.match(/\bwarning\b/gi)||[]).length; if (warn===0) warn = null; }
  const firstRuleLine = (out.split(/\r?\n/).find(l=>/\berror\b/.test(l) && /\s[a-z0-9-]+$/.test(l))||'').trim();
  const m = firstRuleLine.match(/([a-z0-9-]+)$/);
  const rule = m ? m[1] : null;
  if (rule) return `lint: fix ${rule}`;
  return err!=null ? 'lint: fix lint errors' : 'lint: address warnings';
}
function summarizeTest(out){
  const m = out.match(/Tests\s+(\d+)\s+failed/i);
  const n = m ? Number(m[1]) : null;
  return n ? `test: ${n} failing tests` : 'test: failing tests';
}

function categorizeNote(note){
  const s = String(note).toLowerCase();
  if (s.startsWith('build:')) return 'build';
  if (s.startsWith('lint:')) return 'lint';
  if (s.startsWith('test:')) return 'test';
  if (s.startsWith('docs:')) return 'docs';
  if (s.startsWith('meta:')) return 'meta';
  return 'meta';
}
function formatNote(cat, note){
  const s = String(note).trim();
  // Already prefixed consistently; return as-is
  return s;
}
