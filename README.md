# Moontalk — RP‑ready Huntspeak app

Moontalk is a small, client‑only web app for composing role‑play friendly sentences in a conlang nicknamed “Huntspeak.” It ships a guided Talk Pad, a simple Free Translator, a conjugation grid, and quick editors for your verb roots and nouns. Everything persists locally in your browser — no backend, no accounts.

## How It Works
- App shell (`MoontalkApp`) renders panels for Talk Pad, Free Translator, Finite Forms, Derivations, and the Roots/Nouns editors.
- Data lives in `localStorage` under `huntspeak_*` keys; Import/Export lets you back up or share.
- Morphology is triliteral: finite forms are built as `C1 + V(pron) + C2 + V(tense) + C3` with optional Progressive (geminate C2), Habitual `-ar`, and Negation `naaq-/naq-`.
- Copula k–r–n (“be; exist”) behaves like a regular root. Present non‑negated equatives may drop the verb (zero‑copula).

## Features
- Talk Pad: pick pronoun/root/tense and optional Neg/Prog/Hab; add object + with/to/from; one‑click copy.
- Free Translator: naive EN→HS for single‑verb clauses; recognizes pronouns, will/did/not, with/to/from; copula/existential/locative/possession rules.
- Finite Forms: pronoun × tense grid for a selected root.
- Derivations: binyanim‑style patterns (agent/place/instrument/etc.); click to save as a noun.
- Editors: Roots and Nouns with fuzzy search, expanded modal, and duplicate/collision helpers.
- Unknown tokens: show in red with tooltip; click to add as Noun or Verb (prefilled).
- Theming: Auto/Dark/Plain/Fantasy; right‑click context menus for copy (theme‑aware).
- Data tools: Import/Export JSON and “Hard Reset” (clears app data only).

## Quick Start
- Dev server: `npm run dev`
- Build: `npm run build`
- Preview prod: `npm run preview`
- Lint: `npm run lint`
- Gate (build+lint+tests): `npm run codex`

## Workflow Helper (codex)
- First run (stage, then set intent): `npm run codex -- -m "feat(scope): concise intent"`
- Fix iteration (no new message): `npm run codex`
- Rebind only when prompted (same scope): `npm run codex -- --rebind`
- Amend only after green (tiny polish): `npm run codex -- --amend`
- Push as a separate step: `npm run codex -- --push` (sets upstream if missing)
- More details: `npm run codex -- --help` (usage, exit codes, intent cache)

## Version Overview
- 1.6‑dev (current): expanded Dev test runner (grouped scenarios), ongoing test coverage; lazy‑loaded Dev runner; general hardening.
- 1.5.0: Codex workflow helper + auto‑push hook; context‑menu provider and clipboard utils; toast provider; Dev “Live Tests” popup; Vitest config and baseline API tests; seeds/defaults refresh.
- 1.4.0: introduces experimental Translator 2.0 surface; rebrand to “Moontalk”; info page refreshed.
- 1.3.0: particles WITH→ri, TO→ith, FROM→ʌs, IN/AT→la; copula handling incl. zero‑copula; stricter EN→root matching; shared noun lexing; red unknown‑token add flow; “What is this” page.
- 1.2.0: expanded editors (responsive modals, search); derivations save‑as‑noun; searchable dropdowns; progressive C2’.
- 1.1.0: Talk Pad object noun, question marker, shared morph toggles with optional sync; Data popup (Import/Export, Hard Reset); themes.
- 1.0.0: initial app shell with tabs, local persistence, finite forms, and base styling.

## Notes
- Client‑only: do not paste secrets; all data is stored locally.
- Exports are plain JSON; when schema changes, the app attempts a minimal migration or provides a safe reset.

## Auto‑Push Hook
- This repo includes a `post-commit` hook in `.githooks/` that auto‑pushes your branch (and any tags on that commit). The helper also supports a manual `--push` step; use it when you prefer explicit control.
- Enabled by config: `git config core.hooksPath .githooks` (already set in this repo). Run the same after fresh clones.
- Temporarily disable: set `NO_AUTO_PUSH=1` for that commit, e.g. `NO_AUTO_PUSH=1 git commit -m "wip"`.
- Permanently disable: `git config --unset core.hooksPath` (or remove/rename `.githooks`).
