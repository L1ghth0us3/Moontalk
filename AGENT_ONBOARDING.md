# Agent Onboarding — Moontalk (Consolidated)

This onboarding is now streamlined. The canonical rules and workflow live in `AGENTS.md`. Keep that file open as your source of truth.

## Quick Runbook
- Validate gate: `npm run codex`
- Cache intent and validate: `npm run codex -- -m "feat: add X"`
- WIP on failures: `npm run codex -- -m "feat: add X" --wip`
- Finalize WIPs: `npm run codex -- --finalize`
- Dev server: `npm run dev` · Build: `npm run build` · Lint: `npm run lint`

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

