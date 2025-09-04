#!/usr/bin/env node
// Moontalk Codex Workflow Helper
// One-shot script to: show git context, run build, run lint, summarize results,
// and (optionally) commit and push.
// Usage:
//   node scripts/codex-workflow.mjs [--commit|-m "msg"] [--push] [--allow-main]
//   node scripts/codex-workflow.mjs --help

import { spawnSync } from 'node:child_process';
import { EOL } from 'node:os';
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';

function run(cmd, args, opts={}){
  const p = spawnSync(cmd, args, { stdio: 'pipe', encoding: 'utf8', ...opts });
  return { code: p.status ?? 0, out: (p.stdout||'')+(p.stderr||'') };
}

function printSection(title){
  const line = '-'.repeat(Math.max(8, title.length));
  console.log(`\n${title}\n${line}`);
}
const sym = { ok: '✅', fail: '❌', info: 'ℹ️', warn: '⚠️' };

function parseArgs(argv){
  const args = { commitMsg: null, push: false, allowMain: false, wip: false, finalize: false };
  for (let i=2;i<argv.length;i++){
    const a = argv[i];
    if (a === '--help' || a === '-h'){ args.help = true; }
    else if (a === '--push'){ args.push = true; }
    else if (a === '--allow-main'){ args.allowMain = true; }
    else if (a === '--wip'){ args.wip = true; }
    else if (a === '--finalize'){ args.finalize = true; }
    else if (a === '--commit'){ args.commitMsg = argv[++i] || ''; }
    else if (a === '-m'){ args.commitMsg = argv[++i] || ''; }
    else { (args._ ||= []).push(a); }
  }
  return args;
}

function showHelp(){
  console.log(`Moontalk Codex Workflow\n\n`+
`Steps:\n`+
`  1) npm run build  — type-check + Vite build\n`+
`  2) npm run lint   — ESLint (errors fail)\n`+
`  3) git status/diff summary\n`+
`  4) (optional) commit + push\n\n`+
`Flags:\n`+
`  --commit \"msg\", -m \"msg\"  Commit all changes with message\n`+
`  --push                 Push after commit (also pushes tags pointing at HEAD)\n`+
`  --allow-main           Allow committing on main (otherwise blocked)\n`+
`  --help, -h            Show this help\n`);
}

async function main(){
  const args = parseArgs(process.argv);
  if (args.help){ showHelp(); process.exit(0); }
  const INTENT_PATH = '.git/.codex_intent';

  // Ensure hooksPath is set to .githooks (non-fatal)
  const hooksGet = run('git', ['config','--get','core.hooksPath']);
  if ((hooksGet.out||'').trim() !== '.githooks'){
    run('git', ['config','core.hooksPath','.githooks']);
  }

  // Git context
  const branch = run('git',['branch','--show-current']).out.trim() || 'HEAD';
  const remotes = run('git',['remote','-v']).out.trim();
  const last = run('git',['--no-pager','log','-1','--pretty=oneline']).out.trim();
  printSection('Git Context');
  console.log(`Branch: ${branch}`);
  console.log(`Last:   ${last || '—'}`);
  console.log(`Remotes:\n${remotes || '(none)'}`);
  if (!args.allowMain && (branch === 'main' || branch === 'master')){
    console.error(`\nERROR: Refusing to operate on '${branch}'. Switch to a *-dev branch or pass --allow-main.`);
    process.exit(2);
  }

  // If an explicit commit message was provided, cache intent early
  if (args.commitMsg != null){
    try {
      if (!existsSync('.git')) mkdirSync('.git', { recursive: true });
      writeFileSync(INTENT_PATH, String(args.commitMsg), 'utf8');
    } catch {}
  }

  // 1) Build
  printSection('STEP 1: Build (npm run build)');
  const build = run('npm',['run','build']);
  process.stdout.write(build.out);
  if (build.code !== 0){
    console.error(`\n${sym.fail} Build failed with exit ${build.code}. Fix errors above and rerun.`);
    if (args.wip){
      // Create a WIP commit capturing current work-in-progress
      const msg = `WIP: ${safeIntent(INTENT_PATH) || 'progress'}`;
      doWipCommit(msg, args.push);
    }
    process.exit(build.code);
  }
  console.log(`\n${sym.ok} Build succeeded.`);

  // 2) Lint
  printSection('STEP 2: Lint (npm run lint)');
  const lint = run('npm',['run','lint']);
  process.stdout.write(lint.out);
  if (lint.code !== 0){
    console.error(`\n${sym.fail} Lint failed with exit ${lint.code}. Fix errors above and rerun.`);
    if (args.wip){
      const msg = `WIP: ${safeIntent(INTENT_PATH) || 'progress'} (lint)`;
      doWipCommit(msg, args.push);
    }
    process.exit(lint.code);
  }
  // Extract summary if present
  const summaryLine = (lint.out.split(/\r?\n/).reverse().find(l=>/problems \(\d+ errors?, \d+ warnings?\)/.test(l))||'').trim();
  if (summaryLine) console.log(`\n${sym.info} ESLint summary: ${summaryLine}`);
  console.log(`\n${sym.ok} Lint completed.`);

  // 3) Tests
  printSection('STEP 3: Tests (npm run test)');
  const tests = run('npm',['run','test']);
  process.stdout.write(tests.out);
  if (tests.code !== 0){
    console.error(`\n${sym.fail} Tests failed with exit ${tests.code}. Fix errors above and rerun.`);
    if (args.wip){
      const msg = `WIP: ${safeIntent(INTENT_PATH) || 'progress'} (tests)`;
      doWipCommit(msg, args.push);
    }
    process.exit(tests.code);
  }
  console.log(`\n${sym.ok} Tests passed.`);

  // 3) Status + diffstat
  printSection('STEP 4: Git Status');
  const status = run('git',['status','-sb']);
  process.stdout.write(status.out || '(clean)'+EOL);
  printSection('Diffstat');
  const diffstat = run('git',['--no-pager','diff','--stat']);
  process.stdout.write(diffstat.out || '(no changes)'+EOL);
  const untracked = run('git',['ls-files','-m','-o','--exclude-standard']).out.trim();
  if (untracked) { console.log('\nUntracked/modified files:\n'+untracked); }

  // 5) Commit/finalize using cached intent
  const intent = safeIntent(INTENT_PATH);
  if (args.finalize){
    if (!intent){ console.error('No cached intent found; cannot finalize.'); process.exit(4); }
    printSection('STEP 5: Finalize');
    finalizeWip(intent, args.push, branch);
    try { unlinkSync(INTENT_PATH); } catch {}
  } else if (intent){
    printSection('STEP 5: Commit');
    const add = run('git',['add','-A']);
    if (add.code !== 0){ console.error(add.out); process.exit(add.code); }
    const commit = run('git',['commit','-m', intent]);
    process.stdout.write(commit.out);
    if (commit.code !== 0){ console.error('Commit failed.'); process.exit(commit.code); }
    console.log(`${sym.ok} Commit created.`);
    try { unlinkSync(INTENT_PATH); } catch {}
    if (args.push){
      printSection('STEP 6: Push');
      const upstream = run('git',['rev-parse','--abbrev-ref','--symbolic-full-name','@{u}']);
      let push;
      if (upstream.code === 0){ push = run('git',['push']); }
      else { push = run('git',['push','-u','origin', branch]); }
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

function safeIntent(path){
  try { if (existsSync(path)) return (readFileSync(path,'utf8')||'').trim(); } catch {}
  return '';
}

function doWipCommit(message, doPush){
  printSection('WIP Commit');
  const add = run('git',['add','-A']); if (add.code !== 0){ console.error(add.out); return; }
  const commit = run('git',['commit','-m', message]); process.stdout.write(commit.out);
  if (commit.code !== 0){ console.error('WIP commit failed.'); return; }
  if (doPush){ const push = run('git',['push']); process.stdout.write(push.out); }
}

function finalizeWip(finalMessage, doPush, branch){
  // Find consecutive WIP commits from HEAD backwards
  const log = run('git',['--no-pager','log','--pretty=%H%x09%s','-n','50']).out.trim().split(/\r?\n/).filter(Boolean);
  let count = 0; let oldestWip = '';
  for (const line of log){ const [hash, subj] = line.split('\t'); if (/^WIP:/i.test(subj||'')){ oldestWip = hash; count++; } else break; }
  if (count === 0){
    // No WIP range → plain commit
    const add = run('git',['add','-A']); if (add.code !== 0){ console.error(add.out); return; }
    const commit = run('git',['commit','-m', finalMessage]); process.stdout.write(commit.out);
    if (doPush){ const upstream = run('git',['rev-parse','--abbrev-ref','--symbolic-full-name','@{u}']); const push = upstream.code===0? run('git',['push']) : run('git',['push','-u','origin', branch]); process.stdout.write(push.out); }
    return;
  }
  // Reset soft to parent of oldest WIP, then commit with final message
  const parent = run('git',['rev-parse', `${oldestWip}^`]).out.trim();
  if (!parent){ console.error('Could not resolve parent of oldest WIP.'); return; }
  const reset = run('git',['reset','--soft', parent]); if (reset.code !== 0){ console.error(reset.out); return; }
  const commit = run('git',['commit','-m', finalMessage]); process.stdout.write(commit.out);
  if (doPush){ const upstream = run('git',['rev-parse','--abbrev-ref','--symbolic-full-name','@{u}']); const push = upstream.code===0? run('git',['push']) : run('git',['push','-u','origin', branch]); process.stdout.write(push.out); }
}

main().catch(err=>{ console.error(err); process.exit(1); });
