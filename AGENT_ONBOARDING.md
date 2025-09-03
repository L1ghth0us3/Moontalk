# Agent Onboarding — Moontalk

Use this file to get productive fast. It summarizes the architecture, where to make changes, and how to verify work. Keep this close when adding features or refactoring.

## Runbook
- `npm run dev`: Start Vite dev server with HMR.
- `npm run build`: Type-check then build for production.
- `npm run preview`: Preview the production build.
- `npm run lint`: ESLint across the project.

## Architecture
- Entry: `src/main.tsx` → `src/App.tsx` (simple pathname switch) → `src/MoontalkApp.tsx` (app shell)
- UI Panels:
  - `components/TalkPad.tsx`: guided sentence builder.
  - `components/FreeTranslator.tsx`: simple English→Huntspeak (1‑verb lines) with copula/existential handling.
  - `components/FiniteForms.tsx`: pronoun×tense grid for a root.
  - `components/Derivations.tsx`: binyanim‑style lexical derivations (click to save as noun).
  - Editors: `components/editors/{RootEditor,NounEditor}.tsx`.
- Info Page:
  - `pages/WhatIsThis.tsx`: route `/what-is-this`; same theme; single‑column article + sticky mini‑TOC.
- Data & helpers:
  - `lib/morphology.ts`: finite building + progressive/habitual/negation.
  - `lib/lex.ts`: shared noun lex + normalization for Talk Pad and Translator.
  - `lib/storage.ts`: localStorage keys + hook.
  - `types.ts`: `Root`, `Noun`, `PRONOUNS`, `TENSES`.
  - `data/defaults.ts`: seed Roots/Nouns.
- Styling: Tailwind via `@tailwindcss/vite` + themed CSS in `src/index.css`.

## State & Persistence
- All persisted keys live in `LS_KEYS` (see `src/lib/storage.ts`).
  - Examples: `huntspeak_roots`, `huntspeak_nouns`, `huntspeak_talkpad`, `huntspeak_morph_*`, `huntspeak_theme`.
- Use `useLocalStorageState(LS_KEYS.key, initial)` to keep UI/data in sync with localStorage.
- Changing storage shapes? Add minimal migration or provide a clear reset path. The “Data” popup includes Import/Export + “Hard Reset”.

## Recent Behavior (v1.3)
- Particles in UI/Translator: `ri` (with/instrument), `ith` (to/goal), `ʌs` (from), `la` (in/at).
- Copula (to be): treat k–r–n “be; exist” as a normal root.
  - Equatives: present + non‑negated + not habitual → zero‑copula (SUBJ + NP). Otherwise include conjugated copula and apply regular negation.
  - Existential: “there is/are NP (in/at PLACE)” → 3sg copula + NP (+ la + PLACE); present non‑negated may drop copula.
  - Locative: “SUBJ (is) in/at PLACE” → SUBJ (+ copula unless present non‑negated) + la + PLACE.
  - Possession: “SUBJ has NP” → 3sg copula + NP + ith + SUBJ; present non‑negated may drop copula.
  - Progressive ignored for copula; habitual `-ar` allowed. `forceCopula` prop forces showing the copula.
- Stricter English→root matching avoids short‑token collisions (e.g., “am” ≠ “ambush”) and prefers exact/whole‑word hits.
- Shared noun lex (`lexNoun`) translates Talk Pad “to/from” and Translator objects/places by word/gloss/synonyms (accepts simple plurals).
- Unknown tokens render red with a tooltip; click to add as Noun/Verb (prefills English). Implemented in both Talk Pad and Translator.
- New page “What is this” at `/what-is-this` with a player‑friendly guide.

## Morphology Cheatsheet
- Finite form: `C1 + V(subj) + C2 + V(tense) + C3` via `buildFinite`.
- Progressive: geminate C2 as `C2'` before the final vowel → `withProgressive`.
- Habitual: add `-ar` → `withHabitual`.
- Negation: `naaq-` (or `naq-` before k/g/q) → `withNegation`.
- Pronouns/Tenses with their vowels in `src/types.ts`.
 - Copula in Translator: present + non‑negated equatives may omit the verb (“zero‑copula”); otherwise conjugate k–r–n and apply negation normally. Existential/locative/possession map as above.

## Common Tasks
- Add a root or noun field → update type in `types.ts` and editors; validate in Import/Export (see `HuntspeakTalkPad.importData`).
- Change morphology → update `lib/morphology.ts` and any UI copy in Talk Pad/Finite Forms.
- Update theme or styles → prefer Tailwind utilities in components; shared theme rules live in `src/index.css`.
- Add a new toggle shared by Talk Pad and Finite Forms → extend `LS_KEYS.morphToggles` object shape and plumb through both components (see how Neg/Prog/Hab are wired with `syncMorph`).

## Git & Branching
- Active development happens on a `*-dev` branch (e.g., `1.3-dev`).
- Tags mark releases (e.g., `v1.2.0`).
- Keep changes focused; use Conventional Commit prefixes (feat/fix/chore/docs...).

### Commit Discipline (imperative)
- Always work on the current `*-dev` branch (e.g., `1.4-dev`). If unsure, create/switch to the latest `*-dev` branch.
- Commit after every instruction/task step with a clear, Conventional Commit message. Keep commits small and logically scoped to enable easy reverts.
- Include any file moves/renames in the same commit (use `git add -A`).
- Treat this as a professional local dev workflow: no uncommitted work between steps; prefer incremental, revertible commits.

## Validation
- No test runner configured yet. Prefer adding Vitest + React Testing Library.
- Until tests: `npm run build` for type safety and spin `npm run dev` for a smoke run.

## Guardrails
- Client-only app. Do not add secrets. Prefer `import.meta.env` if needed.
- Validate user JSON on import (see `importData`): arrays only, required fields present, sanitize unknowns.
- i18n/UX: favor short labels; keep forms and cards light; support keyboard nav where feasible.

## Quick Orientation (15 min)
1) Skim `MoontalkApp.tsx` for wiring, modals, and theme handling.
2) Open `components/TalkPad.tsx` to see sentence composition and toggles.
3) Open `lib/morphology.ts` to understand how forms are built.
4) Explore `editors/` for how Roots/Nouns persist and filter.
5) Review `index.css` for theme class names used by the shell.
6) Check `components/FreeTranslator.tsx` for copula/existential/locative/possession rules and red‑token add flows.
7) Open `pages/WhatIsThis.tsx` for the player‑facing guide and TOC.

## Adding Tests (suggested)
- Install Vitest + RTL; add `src/lib/morphology.test.ts` to cover the helpers.
- Add simple render tests for Talk Pad and Finite Forms’ toggle interactions.

## Contact Points in Code
- Theme key: `LS_KEYS.theme` used by `MoontalkApp`.
- Shared morph state: `LS_KEYS.morphToggles`/`LS_KEYS.morphSync`.
- Translator: see copula and mapping logic in `FreeTranslator.tsx`.

Happy hunting!
