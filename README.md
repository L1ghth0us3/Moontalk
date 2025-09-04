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

## Version Overview
- 1.5‑dev (current): modular context‑menu (provider + clipboard utils); type tightening; stricter import validation.
- 1.4.0 (next): introduces experimental Translator 2.0 surface; rebrand to “Moontalk”; info page refreshed.
- 1.3.0: particles WITH→ri, TO→ith, FROM→ʌs, IN/AT→la; copula handling incl. zero‑copula; stricter EN→root matching; shared noun lexing; red unknown‑token add flow; “What is this” page.
- 1.2.0: expanded editors (responsive modals, search); derivations save‑as‑noun; searchable dropdowns; progressive C2’.
- 1.1.0: Talk Pad object noun, question marker, shared morph toggles with optional sync; Data popup (Import/Export, Hard Reset); themes.
- 1.0.0: initial app shell with tabs, local persistence, finite forms, and base styling.

## Notes
- Client‑only: do not paste secrets; all data is stored locally.
- Exports are plain JSON; when schema changes, the app attempts a minimal migration or provides a safe reset.
