#!/usr/bin/env node
// Moontalk Codex Workflow Helper
// One-shot script to: show git context, run build, run lint, summarize results,
// and (optionally) commit and push.
// Usage:
//   node scripts/codex-workflow.mjs [--commit|-m "msg"] [--push] [--allow-main]
//   node scripts/codex-workflow.mjs --help

import { spawnSync } from 'node:child_process';
import { EOL } from 'node:os';

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
  const args = { commitMsg: null, push: false, allowMain: false };
  for (let i=2;i<argv.length;i++){
    const a = argv[i];
    if (a === '--help' || a === '-h'){ args.help = true; }
    else if (a === '--push'){ args.push = true; }
    else if (a === '--allow-main'){ args.allowMain = true; }
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

  // 1) Build
  printSection('STEP 1: Build (npm run build)');
  const build = run('npm',['run','build']);
  process.stdout.write(build.out);
  if (build.code !== 0){
    console.error(`\n${sym.fail} Build failed with exit ${build.code}. Fix errors above and rerun.`);
    process.exit(build.code);
  }
  console.log(`\n${sym.ok} Build succeeded.`);

  // 2) Lint
  printSection('STEP 2: Lint (npm run lint)');
  const lint = run('npm',['run','lint']);
  process.stdout.write(lint.out);
  if (lint.code !== 0){
    console.error(`\n${sym.fail} Lint failed with exit ${lint.code}. Fix errors above and rerun.`);
    process.exit(lint.code);
  }
  // Extract summary if present
  const summaryLine = (lint.out.split(/\r?\n/).reverse().find(l=>/problems \(\d+ errors?, \d+ warnings?\)/.test(l))||'').trim();
  if (summaryLine) console.log(`\n${sym.info} ESLint summary: ${summaryLine}`);
  console.log(`\n${sym.ok} Lint completed.`);

  // 3) Status + diffstat
  printSection('STEP 3: Git Status');
  const status = run('git',['status','-sb']);
  process.stdout.write(status.out || '(clean)'+EOL);
  printSection('Diffstat');
  const diffstat = run('git',['--no-pager','diff','--stat']);
  process.stdout.write(diffstat.out || '(no changes)'+EOL);
  const untracked = run('git',['ls-files','-m','-o','--exclude-standard']).out.trim();
  if (untracked) { console.log('\nUntracked/modified files:\n'+untracked); }

  // 4) Optional commit + push
  if (args.commitMsg != null){
    const msg = String(args.commitMsg).trim();
    if (!msg){ console.error('Commit message is empty. Aborting commit.'); process.exit(3); }
    printSection('STEP 4: Commit');
    const add = run('git',['add','-A']);
    if (add.code !== 0){ console.error(add.out); process.exit(add.code); }
    const commit = run('git',['commit','-m', msg]);
    process.stdout.write(commit.out);
    if (commit.code !== 0){ console.error('Commit failed.'); process.exit(commit.code); }
    console.log(`${sym.ok} Commit created.`);

    // Push (auto via hook, but also push here as safety)
    if (args.push){
      printSection('STEP 5: Push');
      // Ensure upstream exists
      const upstream = run('git',['rev-parse','--abbrev-ref','--symbolic-full-name','@{u}']);
      let push;
      if (upstream.code === 0){
        push = run('git',['push']);
      } else {
        push = run('git',['push','-u','origin', branch]);
      }
      process.stdout.write(push.out);
      console.log(`${sym.ok} Push completed.`);
    } else {
      console.log(`\n${sym.info} Note: Auto-push hook may push this commit. To force push here, re-run with --push.`);
    }
  }

  printSection('Done');
  console.log(`${sym.ok} Build+Lint gate passed. Review status above.`);
}

main().catch(err=>{ console.error(err); process.exit(1); });
