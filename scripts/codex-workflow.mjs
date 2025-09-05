#!/usr/bin/env node
// Moontalk Codex Workflow Helper
//
// What this script does (documented):
// 1) Prints Git context (branch, last commit, remotes).
// 2) Validates work via gate steps, in order:
//    2.1) Build → `npm run build` (type-check + Vite build)
//    2.2) Lint  → `npm run lint` (ESLint; warnings allowed, errors fail)
//    2.3) Test  → `npm run test` (Vitest; failures fail)
//    Each step's start/end and exit code can be printed with --verbose (or CODEX_VERBOSE=1).
// 3) Shows Git status + diffstat.
// 4) If a commit intent is cached (or provided via -m/--commit), attempts to commit and (optionally) push.
//    - By default, will create a normal commit with message = cached intent.
//    - With --finalize, collapses consecutive WIP commits into the cached intent.
//    - With --wip and a failing gate, creates a WIP commit.
//
// Important commit safety:
// - If there are NO STAGED CHANGES (`git diff --cached` is empty), the script exits early
//   with a clear message and non-zero exit code (unless --help). This prevents accidental
//   commits that stage everything automatically without review.
//
// Usage:
//   node scripts/codex-workflow.mjs [--commit|-m "msg"] [--push] [--allow-main] [--verbose] [--dry-run]
//   node scripts/codex-workflow.mjs --help
//
// Flags / Env:
//   --verbose or CODEX_VERBOSE=1  → Print each step + command start/end and exit codes
//   --dry-run  or CODEX_DRY_RUN=1 → Show what would run; skip mutating actions (commit/push/reset)
//   --commit "msg", -m "msg"      → Cache commit intent message for step 5
//   --wip                         → If a gate step fails, create a WIP commit with intent
//   --finalize                    → Squash consecutive WIPs into the cached intent
//   --push                        → Push after commit/finalize (respects upstream)
//   --allow-main                  → Allow operating on main (otherwise blocked)
//   --help, -h                    → Show help
//
// Exit codes:
//   0  success (gate passed; commit may or may not be created)
//   2  refused to operate on main without --allow-main
//   3  no staged changes (script stops early)
//   >0 any step failure (build/lint/test; or commit/push failure)

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
  const args = { commitMsg: null, push: false, allowMain: false, wip: false, finalize: false, verbose: false, dryRun: false, order: null };
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
    else if (a === '--commit'){ args.commitMsg = argv[++i] || ''; }
    else if (a === '-m'){ args.commitMsg = argv[++i] || ''; }
    else { (args._ ||= []).push(a); }
  }
  return args;
}

function showHelp(){
  console.log(`Moontalk Codex Workflow\n\n`+
`Gate steps (runs in order):\n`+
`  1) npm run build   — Type-check + Vite build\n`+
`  2) npm run lint    — ESLint (errors fail gate)\n`+
`  3) npm run test    — Vitest suite (errors fail gate)\n`+
`  4) git status/diff — Summary + diffstat\n`+
`  5) (optional) commit + push using cached intent\n\n`+
`Flags:\n`+
`  --commit \"msg\", -m \"msg\"   Cache commit intent message for step 5\n`+
`  --wip                   If a gate step fails, create a WIP commit with intent\n`+
`  --finalize              Squash consecutive WIP commits into the cached intent\n`+
`  --push                  Push after commit/finalize (respects upstream)\n`+
`  --allow-main            Allow operating on main (otherwise blocked)\n`+
`  --help, -h             Show this help\n\n`+
`Notes:\n`+
`  • Intent caching is stored in .git/.codex_intent.json and cleared on success.\n`+
`  • A post-commit hook may auto-push unless NO_AUTO_PUSH=1 is set.\n`+
`  • Use --finalize to collapse consecutive WIPs into one clean commit.\n`);
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

  // Intent cache: create/overwrite on message; otherwise reuse if present
  if (args.commitMsg != null){
    try {
      if (!existsSync('.git')) mkdirSync('.git', { recursive: true });
      const stagedTree = run('git',['write-tree'], {}, 'git write-tree').out.trim();
      const intent = { main: String(args.commitMsg), secondary: [], createdAT: new Date().toISOString(), branch, stagedTree, amend: false };
      writeFileSync(INTENT_JSON, JSON.stringify(intent, null, 2), 'utf8');
      if (VERBOSE) console.log(`${sym.info} Intent cached at ${INTENT_JSON}`);
    } catch (e) {
      console.error(`${sym.warn} Failed to write intent cache: ${e && e.message ? e.message : String(e)}`);
    }
  } else {
    if (!existsSync(INTENT_JSON)){
      console.log(`${sym.info} Provide a commit message to set intent or stage changes and rerun.`);
    } else if (VERBOSE) {
      try { const j = JSON.parse(readFileSync(INTENT_JSON,'utf8')); console.log(`${sym.info} Using cached intent: ${j.main||'(empty)'}`); } catch {}
    }
  }

  // Early guard: require staged changes (prevents accidental blanket add/commit)
  const staged = run('git',['diff','--name-only','--cached'], {}, 'git diff --cached').out.trim();
  if (!staged){
    console.error(`\n${sym.fail} No staged changes detected. Stage your intended changes (git add -p / files) and rerun.\n`+
      `Tip: Use 'git status' to review and stage selectively.`);
    process.exit(3);
  }

  // Pipeline (default build -> lint -> test); configurable via --order build,lint,test
  const order = Array.isArray(args.order) && args.order.length ? args.order : ['build','lint','test'];
  for (const step of order){
    if (step === 'build'){
      printSection('STEP: Build (npm run build)');
      const res = run('npm',['run','build'], {}, 'npm run build');
      process.stdout.write(res.out);
      if (res.code !== 0){ appendSecondaryNote(summarizeBuild(res.out)); console.error(`\n${sym.fail} Build failed with exit ${res.code}.`); process.exit(res.code || 1); }
      console.log(`\n${sym.ok} Build succeeded.`);
    } else if (step === 'lint'){
      printSection('STEP: Lint (npm run lint)');
      const res = run('npm',['run','lint'], {}, 'npm run lint');
      process.stdout.write(res.out);
      if (res.code !== 0){ appendSecondaryNote(summarizeLint(res.out)); console.error(`\n${sym.fail} Lint failed with exit ${res.code}.`); process.exit(res.code || 1); }
      const summaryLine = (res.out.split(/\r?\n/).reverse().find(l=>/problems \(\d+ errors?, \d+ warnings?\)/.test(l))||'').trim(); if (summaryLine) console.log(`\n${sym.info} ESLint summary: ${summaryLine}`);
      console.log(`\n${sym.ok} Lint completed.`);
    } else if (step === 'test'){
      printSection('STEP: Tests (npm run test)');
      const res = run('npm',['run','test'], {}, 'npm run test');
      process.stdout.write(res.out);
      if (res.code !== 0){ appendSecondaryNote(summarizeTest(res.out)); console.error(`\n${sym.fail} Tests failed with exit ${res.code}.`); process.exit(res.code || 1); }
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
  const intent = getIntentMain();
  if (args.finalize){
    if (!intent){ console.error('No cached intent found; cannot finalize.'); process.exit(4); }
    printSection('STEP 5: Finalize');
    finalizeWip(intent, args.push, branch);
    try { unlinkSync(INTENT_JSON); } catch {}
  } else if (intent){
    printSection('STEP 5: Commit');
    // Respect staged-only policy: do not auto-add; commit only what's staged
    const stagedNow = run('git',['diff','--name-only','--cached'], {}, 'git diff --cached (pre-commit)').out.trim();
    if (!stagedNow){
      console.error(`${sym.fail} No staged changes to commit. Stage files and rerun.`);
      process.exit(3);
    }
    const commit = run('git',['commit','-m', intent], {}, 'git commit');
    process.stdout.write(commit.out);
    if (commit.code !== 0){ console.error('Commit failed.'); process.exit(commit.code); }
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
    } else {
      console.log(`\n${sym.info} Note: Auto-push hook may push this commit. To force push here, re-run with --push.`);
    }
  } else {
    console.log(`${sym.info} No intent cached. Skipping commit.`);
  }

  printSection('Done');
  console.log(`${sym.ok} Build+Lint gate passed. Review status above.`);
}

function loadIntentJSON(){
  try {
    if (!existsSync('.git/.codex_intent.json')) return null;
    const raw = readFileSync('.git/.codex_intent.json','utf8');
    return JSON.parse(raw);
  } catch { return null; }
}

function getIntentMain(){ const j = loadIntentJSON(); return j && typeof j.main==='string' ? j.main : ''; }

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

// ===== Failure note helpers =====
function appendSecondaryNote(note){
  try {
    const j = loadIntentJSON();
    if (!j) return; // no cache → nothing to append
    if (!Array.isArray(j.secondary)) j.secondary = [];
    j.secondary.push(String(note));
    writeFileSync('.git/.codex_intent.json', JSON.stringify(j, null, 2), 'utf8');
    if (VERBOSE) console.log(`${sym.info} Appended note to intent: ${note}`);
  } catch {}
}
function summarizeBuild(out){
  const codes = Array.from(new Set((out.match(/TS\d{3,5}/g)||[]))).slice(0,3);
  return codes.length ? `build: resolve type errors (${codes.join(', ')})` : 'build: fix build errors';
}
function summarizeLint(out){
  const line = (out.split(/\r?\n/).find(l=>/\berror\b/.test(l) && /\s[a-z0-9-]+$/.test(l))||'').trim();
  const m = line.match(/([a-z0-9-]+)$/);
  const rule = m ? m[1] : null;
  return rule ? `lint: address ESLint violations (${rule})` : 'lint: address ESLint violations';
}
function summarizeTest(out){
  const m = out.match(/Tests\s+(\d+)\s+failed/i);
  const n = m ? Number(m[1]) : null;
  return n ? `test: fix failing tests (${n} failed)` : 'test: fix failing tests';
}
