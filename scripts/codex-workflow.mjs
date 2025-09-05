#!/usr/bin/env node
// Moontalk Codex Workflow Helper
// -----------------------------------------------------------------------------
// Purpose
// - Single entry point for build/lint/test and intent caching → safe, repeatable
//   workflow for Codex agents and humans. It only commits when all checks pass.
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
// - Fields: { main, secondary[], createdAT, branch, stagedTree, amend }
// - Agents: on non‑zero exit, fix issues, restage, and rerun without changing
//   the main message (-m). Use --rebind if staged content legitimately changed.
//
// What this script does
// 1) Prints Git context (branch, last commit, remotes).
// 2) Validates via gate steps in order (configurable): build → lint → test.
//    Use --verbose (or CODEX_VERBOSE=1) to show each command + exit code.
// 3) Shows Git status + diffstat.
// 4) If intent exists and staged matches cache (or --rebind), composes and
//    creates a commit (uses --amend if intent.amend=true). Then clears cache.
//
// Flags / Env
// - --commit "msg", -m "msg"  Cache commit intent message
// - --amend                    Mark cached intent to use --amend on commit
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

function parseArgs(argv){
  const args = { commitMsg: null, push: false, allowMain: false, wip: false, finalize: false, verbose: false, dryRun: false, order: null, rebind: false, clear: false, amend: false };
  for (let i=2;i<argv.length;i++){
    const a = argv[i];
    if (a === '--help' || a === '-h'){ args.help = true; }
    else if (a === '--push'){ args.push = true; }
    else if (a === '--allow-main'){ args.allowMain = true; }
    else if (a === '--wip'){ args.wip = true; }
    else if (a === '--finalize'){ args.finalize = true; }
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
`Usage examples:\n`+
`  node scripts/codex-workflow.mjs -m \"feat: add X\"\n`+
`  node scripts/codex-workflow.mjs                (rerun after fixes)\n`+
`  node scripts/codex-workflow.mjs --amend        (mark intent to amend)\n`+
`  node scripts/codex-workflow.mjs --rebind       (update stagedTree to current index)\n`+
`  node scripts/codex-workflow.mjs --clear        (delete intent cache)\n\n`+
`Flags:\n`+
`  --commit \"msg\", -m \"msg\"   Cache commit intent message\n`+
`  --amend                 Use --amend when committing the cached intent\n`+
`  --rebind                Update cache.stagedTree to current index\n`+
`  --clear                 Delete intent cache and exit\n`+
`  --order a,b,c           Pipeline order (default build,lint,test)\n`+
`  --push                  Push after commit (respects upstream)\n`+
`  --verbose               Verbose command logging\n`+
`  --dry-run               Log actions; skip mutating commands\n`+
`  --allow-main            Allow operating on main (otherwise blocked)\n`+
`  --help, -h              Show this help\n\n`+
`Contract:\n`+
`  • Never commit unless all checks pass.\n`+
`  • Cache lives at .git/.codex_intent.json (cleared after successful commit).\n`+
`  • On non-zero exit: fix issues, restage, and rerun without changing -m.\n`);
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
    console.error(`\nERROR: Refusing to operate on '${branch}'. Switch to a *-dev branch or pass --allow-main.`);
    process.exit(2);
  }

  // --clear: remove intent cache and exit cleanly
  if (args.clear){
    try { if (existsSync(INTENT_JSON)) { unlinkSync(INTENT_JSON); console.log(`${sym.ok} Cleared intent cache.`); } else { console.log(`${sym.info} No intent cache to clear.`); } }
    catch (e) { console.error(`${sym.warn} Failed to clear intent cache: ${e && e.message ? e.message : String(e)}`); process.exit(5); }
    process.exit(0);
  }

  // Intent cache: create/overwrite on message; otherwise reuse if present
  // NOTE: We require staged changes before creating/modifying the cache (except --clear above)

  // Early guard: require staged changes (prevents accidental blanket add/commit)
  const staged = run('git',['diff','--name-only','--cached'], {}, 'git diff --cached').out.trim();
  if (!staged){
    const hasIntent = existsSync(INTENT_JSON);
    const guide = hasIntent ? `Stage changes that correspond to this intent or clear with --clear.`
      : `Provide a commit message to set intent or stage changes and rerun.`;
    console.error(`\n${sym.fail} No staged changes detected. ${guide}\n`+
      `Tip: Use 'git status' to review and stage selectively.`);
    process.exit(3);
  }

  // With staged changes, now handle cache create/update/reuse
  if (args.commitMsg != null){
    try {
      if (!existsSync('.git')) mkdirSync('.git', { recursive: true });
      const stagedTree = run('git',['write-tree'], {}, 'git write-tree').out.trim();
      const intent = { main: String(args.commitMsg), secondary: [], createdAT: new Date().toISOString(), branch, stagedTree, amend: !!args.amend };
      writeFileSync(INTENT_JSON, JSON.stringify(intent, null, 2), 'utf8');
      if (VERBOSE) console.log(`${sym.info} Intent cached at ${INTENT_JSON}`);
    } catch (e) {
      console.error(`${sym.warn} Failed to write intent cache: ${e && e.message ? e.message : String(e)}`);
    }
  } else if (existsSync(INTENT_JSON)){
    if (args.amend){
      try { const j = loadIntentJSON() || {}; j.amend = true; writeFileSync(INTENT_JSON, JSON.stringify(j, null, 2), 'utf8'); if (VERBOSE) console.log(`${sym.info} Set intent.amend=true`); } catch {}
    }
    if (args.rebind){
      try { const j = loadIntentJSON() || {}; j.stagedTree = run('git',['write-tree'], {}, 'git write-tree (rebind)').out.trim(); writeFileSync(INTENT_JSON, JSON.stringify(j, null, 2), 'utf8'); if (VERBOSE) console.log(`${sym.info} Rebound intent.stagedTree to current index.`); } catch {}
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
      if (res.code !== 0){ appendSecondaryNote(summarizeBuild(res.out, res.code)); console.error(`\n${sym.fail} Build failed with exit ${res.code}.`); return nextAndExit(2, 'Fix build errors, restage, rerun codex (no new -m)'); }
      console.log(`\n${sym.ok} Build succeeded.`);
    } else if (step === 'lint'){
      printSection('STEP: Lint (npm run lint)');
      const res = run('npm',['run','lint'], {}, 'npm run lint');
      process.stdout.write(res.out);
      if (res.code !== 0){ appendSecondaryNote(summarizeLint(res.out)); console.error(`\n${sym.fail} Lint failed with exit ${res.code}.`); return nextAndExit(2, 'Fix lint errors, restage, rerun codex (no new -m)'); }
      const summaryLine = (res.out.split(/\r?\n/).reverse().find(l=>/problems \(\d+ errors?, \d+ warnings?\)/.test(l))||'').trim(); if (summaryLine) console.log(`\n${sym.info} ESLint summary: ${summaryLine}`);
      console.log(`\n${sym.ok} Lint completed.`);
    } else if (step === 'test'){
      printSection('STEP: Tests (npm run test)');
      const res = run('npm',['run','test'], {}, 'npm run test');
      process.stdout.write(res.out);
      if (res.code !== 0){ appendSecondaryNote(summarizeTest(res.out)); console.error(`\n${sym.fail} Tests failed with exit ${res.code}.`); return nextAndExit(2, 'Fix tests, restage, rerun codex (no new -m)'); }
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

  // 5) Commit/finalize using cached intent (JSON)
  const intentObj = loadIntentJSON();
  const intent = intentObj?.main || '';
  if (args.finalize){
    if (!intent){ console.error('No cached intent found; cannot finalize.'); return nextAndExit(4, 'Set intent (-m "...") then rerun with --finalize'); }
    printSection('STEP 5: Finalize');
    finalizeWip(intent, args.push, branch);
    try { unlinkSync(INTENT_JSON); } catch {}
  } else if (intent){
    printSection('STEP 5: Commit');
    // Respect staged-only policy: do not auto-add; commit only what's staged
    const stagedNow = run('git',['diff','--name-only','--cached'], {}, 'git diff --cached (pre-commit)').out.trim();
    if (!stagedNow){ console.error(`${sym.fail} No staged changes to commit. Stage files and rerun.`); return nextAndExit(1, 'Stage files to commit for this intent'); }
    // Guard: staged tree mismatch unless --rebind
    const stagedTreeNow = run('git',['write-tree'], {}, 'git write-tree (pre-commit)').out.trim();
    if (intentObj && intentObj.stagedTree && intentObj.stagedTree !== stagedTreeNow){
      if (!args.rebind){
        console.error(`${sym.fail} Staged content changed since intent was created. Aborting commit.\n`+
          `Use --rebind to update the intent's stagedTree to the current index and proceed.`);
        return nextAndExit(3, 'Review staged diff; rerun with --rebind to proceed');
      } else {
        try {
          const j = loadIntentJSON() || { main:intent, secondary:[], createdAT:new Date().toISOString(), branch, stagedTree:'', amend:false };
          j.stagedTree = stagedTreeNow;
          writeFileSync(INTENT_JSON, JSON.stringify(j, null, 2), 'utf8');
          if (VERBOSE) console.log(`${sym.info} Rebound intent.stagedTree to current index.`);
        } catch {}
      }
    }
    // Compose message: main + optional Secondary changes
    const composed = composeCommitMessage(intentObj || { main:intent, secondary:[] });
    const commit = run('git', ['commit', '-m', composed].concat(intentObj?.amend ? ['--amend'] : []), {}, 'git commit');
    process.stdout.write(commit.out);
    if (commit.code !== 0){ console.error('Commit failed.'); return nextAndExit(commit.code||1, 'Resolve git error and rerun'); }
    console.log(`${sym.ok} Commit created.`);
    try { unlinkSync(INTENT_JSON); } catch {}
    if (args.push){
      printSection('STEP 6: Push');
      const upstream = run('git',['rev-parse','--abbrev-ref','--symbolic-full-name','@{u}'], {}, 'git rev-parse @{u}');
      let push;
      if (upstream.code === 0){ push = run('git',['push'], {}, 'git push'); }
      else { push = run('git',['push','-u','origin', branch], {}, 'git push -u'); }
      process.stdout.write(push.out);
      console.log(`${sym.ok} Push completed.`);
    } else { console.log(`\n${sym.info} Note: Auto-push hook may push this commit. To force push here, re-run with --push.`); }
    return nextAndExit(0, 'Gate passed; commit created. Push or open a PR.');
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
  if (notes.length){
    lines.push('', 'Secondary changes:');
    for (const n of notes){ lines.push(`- ${n}`); }
  }
  return lines.join('\n');
}

function doWipCommit(message, doPush){
  printSection('WIP Commit');
  // Respect staged-only policy for WIP: do not auto-add; commit staged only
  const staged = run('git',['diff','--name-only','--cached'], {}, 'git diff --cached (WIP)').out.trim();
  if (!staged){ console.error('No staged changes to WIP-commit.'); return; }
  const commit = run('git',['commit','-m', message], {}, 'git commit (WIP)'); process.stdout.write(commit.out);
  if (commit.code !== 0){ console.error('WIP commit failed.'); return; }
  if (doPush){ const push = run('git',['push'], {}, 'git push (WIP)'); process.stdout.write(push.out); }
}

function finalizeWip(finalMessage, doPush, branch){
  // Find consecutive WIP commits from HEAD backwards
  const log = run('git',['--no-pager','log','--pretty=%H%x09%s','-n','50'], {}, 'git log (finalize)').out.trim().split(/\r?\n/).filter(Boolean);
  let count = 0; let oldestWip = '';
  for (const line of log){ const [hash, subj] = line.split('\t'); if (/^WIP:/i.test(subj||'')){ oldestWip = hash; count++; } else break; }
  if (count === 0){
    // No WIP range → plain commit
    const staged = run('git',['diff','--name-only','--cached'], {}, 'git diff --cached (finalize)').out.trim();
    if (!staged){ console.error('No staged changes to commit during finalize.'); return; }
    const commit = run('git',['commit','-m', finalMessage], {}, 'git commit (finalize)'); process.stdout.write(commit.out);
    if (doPush){ const upstream = run('git',['rev-parse','--abbrev-ref','--symbolic-full-name','@{u}'], {}, 'git rev-parse @{u}'); const push = upstream.code===0? run('git',['push'], {}, 'git push (finalize)') : run('git',['push','-u','origin', branch], {}, 'git push -u (finalize)'); process.stdout.write(push.out); }
    return;
  }
  // Reset soft to parent of oldest WIP, then commit with final message
  const parent = run('git',['rev-parse', `${oldestWip}^`], {}, 'git rev-parse parent (finalize)').out.trim();
  if (!parent){ console.error('Could not resolve parent of oldest WIP.'); return; }
  const reset = run('git',['reset','--soft', parent], {}, 'git reset --soft (finalize)'); if (reset.code !== 0){ console.error(reset.out); return; }
  const commit = run('git',['commit','-m', finalMessage], {}, 'git commit (finalize)'); process.stdout.write(commit.out);
  if (doPush){ const upstream = run('git',['rev-parse','--abbrev-ref','--symbolic-full-name','@{u}'], {}, 'git rev-parse @{u}'); const push = upstream.code===0? run('git',['push'], {}, 'git push (finalize)') : run('git',['push','-u','origin', branch], {}, 'git push -u (finalize)'); process.stdout.write(push.out); }
}

main().catch(err=>{ console.error(err); process.exit(1); });

function nextAndExit(code, nextMsg){
  const ok = code === 0;
  const tag = ok ? sym.ok : sym.fail;
  console.log(`\n${tag} NEXT: ${nextMsg}`);
  process.exit(code);
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
  const parts = [];
  if (codes.length) parts.push(codes.join(', '));
  if (typeof exitCode === 'number') parts.push(`exit ${exitCode}`);
  return parts.length ? `build: errors (${parts.join('; ')})` : 'build: errors';
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
  const bits = [];
  if (err!=null || warn!=null){ bits.push(`${err??0}e/${warn??0}w`); }
  if (rule) bits.push(rule);
  return bits.length ? `lint: ${bits.join(' ')}` : 'lint: errors';
}
function summarizeTest(out){
  const m = out.match(/Tests\s+(\d+)\s+failed/i);
  const n = m ? Number(m[1]) : null;
  return n ? `test: ${n} failed` : 'test: failures';
}
