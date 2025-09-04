# Agent Onboarding — Moontalk

Use this file to get productive fast. It summarizes the architecture, where to make changes, and how to verify work. Keep this close when adding features or refactoring.

## Runbook
- `npm run codex`: One-shot build → lint → status/diff. Optional commit/push.
  - Examples:
    - Validate only: `npm run codex`
    - Commit + push: `npm run codex -- -m "feat: add X" --push`
    - On `main` (discouraged): `npm run codex -- --allow-main -m "hotfix: …" --push`
- `npm run dev`: Start Vite dev server with HMR.
- `npm run build`: Type-check then build for production.
- `npm run preview`: Preview the production build.
- `npm run lint`: ESLint across the project.

> Mandatory workflow for Codex agents (do not skip):
> Prefer `npm run codex` for a single, precise gate:
> 1) `npm run codex` — runs build and lint; shows status and diff.
> 2) Fix any build errors (blocking) and relevant lint issues; re-run.
> 3) When green, COMMIT IMMEDIATELY using the helper (safety rule):
>    `npm run codex -- -m "<type(scope): message>" --push`
>    This performs `git add -A`, `git commit`, and push (sets upstream if needed).
> This replaces the manual build → lint → commit cycle after each instruction. Always commit after a green gate unless the user explicitly asks to hold.
> You can still run `npm run build` and `npm run lint` directly if needed.

### Codex Helper Script Notes
- Location: `scripts/codex-workflow.mjs`; npm alias: `npm run codex`.
- Output: prints clear STEP lines and ✅/❌ for success/failure for Build, Lint, Status, Commit, Push.
- Safety: blocks on `main` unless `--allow-main` is passed.
- Hooks: ensures `core.hooksPath` is `.githooks`; post-commit auto‑push may still push after your commit.
- Disable auto‑push locally per-commit: `NO_AUTO_PUSH=1 npm run codex -- -m "wip"`.
- Commit policy: After every instruction/tasklet and a green gate, create a small, scoped commit via the helper; keep diffs focused and revertible.

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
  - Translator 2.0 library: see `src/lib/translator2/README.md` for public API and internals. Use `src/lib/translator2/index.ts` to import `translate()` and types.
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

#### Pre-commit Gate (must pass before every commit)
- Run: `npm run build` to type-check and build. Fix all errors.
- Then run: `npm run lint`. Fix all lint issues relevant to your change.
- Optional but encouraged: quick `npm run dev` smoke (open app, quick clickthrough).
- Only after a clean build and lint: `git add -A && git commit -m "<type(scope): message>"`.

### Example Local Git Workflow (professional)
1) Sync and branch
   - `git fetch --all --tags`
   - `git switch 1.4-dev` (or the current `*-dev` branch). If missing, create it from `main`: `git switch -c 1.4-dev origin/main`.
2) Implement a small, focused change
   - Edit code.
   - Run `npm run codex` (build+lint). Fix issues until green.
   - Validate behavior quickly in `npm run dev` if UI/logic changed.
3) Stage and commit immediately when the step is complete
   - `npm run codex -- -m "feat: add Translator 2.0 intake tokenizer" --push`
4) Iterate in small steps
   - Repeat implement → validate → commit after each instruction/tasklet.
5) Push dev branch as needed (optional for collaboration/review)
   - `git push -u origin 1.4-dev`
6) Release flow (never work directly on `main`)
   - Ensure `1.4-dev` is green and ready.
   - `git switch main && git pull`
   - `git merge --no-ff 1.4-dev -m "chore(release): merge 1.4-dev"`
   - Tag release if applicable: `git tag -a v1.4.0 -m "v1.4.0" && git push --tags`
   - Immediately create the next dev branch from `main` and switch to it (keep continuous dev unblocked):
     - `git switch -c 1.5-dev`
     - `git push -u origin 1.5-dev`
   - Continue new work only on the latest `*-dev` branch.

### Commit Message Rules
- Use Conventional Commit prefixes:
  - `feat:` new feature; `fix:` bug fix; `chore:` tooling/infra; `docs:` documentation; `refactor:` non‑behavioral code changes; `perf:` performance.
- Scope (optional) in parentheses: `feat(translator2): ...`.
- Present tense, imperative mood; keep subject concise; body optional but helpful for rationale.
- One logical change per commit; avoid mixing unrelated changes.

### Branching Rules
- Never work directly on `main`.
- All active work happens on the latest `*-dev` branch.
- After merging `*-dev` into `main`, immediately create the next `*-dev` branch with the incremented version and switch to it.
- Keep branches focused; prefer short‑lived feature branches off `*-dev` when needed, then merge back into `*-dev`.

### Reverting and Safety
- Because commits are small and per‑instruction, reverts are easy: `git revert <sha>`.
- If an instruction causes regressions, revert that commit and re‑attempt with a new commit.
- When moving/renaming files, commit moves atomically to preserve history.

## Validation
- No test runner configured yet. Prefer adding Vitest + React Testing Library.
- Until tests: `npm run build` for type safety and spin `npm run dev` for a smoke run.

## Practical Recipes and Gotchas (from prior work)

### UI Styling: List Rows and Theme Safety
- Avoid bright “default” borders on dark/fantasy themes. Prefer a theme-scoped class (e.g., `.list-item`) and define faint borders + soft hover per theme in `index.css`.
  - Fantasy: subtle border + soft hover background.
  - Dark: faint border + soft hover background.
  - Plain: neutral-200 border + light hover.
- Keep list rows strictly one line:
  - Container: `flex items-center min-w-0 flex-nowrap whitespace-nowrap` (or grid with `[1fr auto]`).
  - Left label (C‑C‑C / noun): `shrink-0`.
  - Gloss: `flex-1 min-w-0 truncate text-right`.
  - Copy control: small, borderless, `inline-flex` with `role="button"`; do not use themed `<button>` if it brings heavy styles.
- Selected/validation borders should override faint defaults (blue/red/amber).

### React State Discipline
- Never update parent state from inside a child’s render path or within a state updater that runs during render. This triggers React warnings and unstable updates.
  - Example fix: On delete in `NounEditor`, update only the local list. Let the parent (e.g., `Translator2`/`MoontalkApp`) reconcile selection via effects.

### Duplicate and Collision Detection
- Fuzzy gloss duplicates (nouns/roots):
  - Strip anything in parentheses; split on `,` and `;`.
  - Lowercase, remove non‑letters, collapse spaces; remove stopwords (`the, a, an, to`).
  - Deduplicate terms within one gloss, then group across items and show clickable chips.
- Verb‑form ↔ noun collisions (on demand in NounEditor):
  - Build all finite forms (pronoun × tense) with `buildFinite`; compare to noun words.
  - Show a concise toast when none; on collisions, show a detailed per‑noun panel that auto‑refreshes after list changes.

### Translator 2.0 Settings and Analysis
- Keep Translator 2.0 settings local to the Translator 2.0 UI (popup):
  - Coordinator Mapping (AND/OR/NOR/BUT).
  - Particles Mapping (EN roles → HS particle): WITH→ri, TO→ith, FROM→ʌs, IN/AT→la.
  - Analysis should invert the EN→HS mapping to show friendly EN labels.
  - Keep “no‑collision” results as ephemeral toasts; only render a persistent panel when there are collisions.

### Git Workflow Tips
- If a revert/merge is in progress and blocks branch switches: use `git revert --quit` (or resolve) before switching branches.
- Release flow recap:
  - Merge `*-dev` into `main` with a merge commit (`chore(release): merge 1.x-dev`).
  - Tag main (e.g., `v1.4.0`) with an annotated tag.
  - Create and switch to next `*-dev` (e.g., `1.5-dev`) immediately and continue work there.

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
