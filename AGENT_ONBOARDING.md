# Agent Onboarding — Moontalk (Consolidated)

This onboarding is now streamlined. The canonical rules and workflow live in `AGENTS.md`. Keep that file open as your source of truth.

## Quick Runbook
- Validate gate: `npm run codex`
- Cache intent and validate: `npm run codex -- -m "type(scope): concise intent"`
- If the gate fails: fix the code, stage the fixes, and rerun `npm run codex` (do not supply a new `-m`). Use `--rebind` only if prompted that staged content changed and the scope is still the same feature.
- Do not use `--amend` during fix iterations. After everything is green, you may use `--amend` for a tiny clarification.
- After success: push with `npm run codex -- --push` (independent step; sets upstream if missing). Avoid `git pull --rebase` unless a push is rejected as non‑fast‑forward.
- Dev server: `npm run dev` · Build: `npm run build` · Lint: `npm run lint`
- Playbook: `npm run codex -- --help` (usage, exit codes with next steps, intent cache)

## Quick Orientation (15 min)
1) Skim `src/MoontalkApp.tsx` for shell, modals, and theme handling.
2) Read `src/components/TalkPad.tsx` for sentence composition and toggles.
3) Read `src/components/FreeTranslator.tsx` for copula/existential/locative/possession flows.
4) Review `src/lib/morphology.ts` and `src/lib/translator2/*` for core logic.
5) Open `src/components/editors/*` for Roots/Nouns persistence and filtering.
6) Review `src/index.css` for theme classes used by the shell.
7) Read `src/pages/WhatIsThis.tsx` for the player-facing guide.

## Where to find details
- Rules, workflow, and tips: see `AGENTS.md` (Agent Ruleset, Codex Helper, Translator 2.0 Tips).
- Hooks and auto-push: `.githooks/post-commit` (respects `NO_AUTO_PUSH=1`).


If anything is unclear or missing, update `AGENTS.md` first; keep this file minimal.

Tip: The helper may auto‑rebind staged tree after quick fix‑and‑restage cycles when it’s safe (same branch, recent intent, and path subset/superset). If it refuses, it will show which paths changed and ask for `--rebind`.
