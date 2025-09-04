# Repository Guidelines

## Project Structure & Module Organization
- Source: `src/` (entry `src/main.tsx`, app shell `src/App.tsx`).
- UI: `src/MoontalkApp.tsx` (core logic + subcomponents), styles in `src/index.css` (Tailwind v4 via `@tailwindcss/vite`).
- Assets: `src/assets/`.
- Build config: `vite.config.ts`, TypeScript configs: `tsconfig.*.json`.

## Architecture Map
- Entry: `src/main.tsx` → `src/App.tsx` → `src/MoontalkApp.tsx` (shell, modals, theme).
- Panels: `components/TalkPad.tsx`, `components/FreeTranslator.tsx`, `components/FiniteForms.tsx`, `components/Derivations.tsx`, `components/Translator2.tsx`.
- Editors: `components/editors/{RootEditor,NounEditor}.tsx`.
- Info page: `pages/WhatIsThis.tsx`.
- Lib: `lib/morphology.ts`, `lib/lex.ts`, `lib/translator2/*`, `lib/storage.ts`, `types.ts`, `data/*`.

## Build, Test, and Development Commands
- `npm run dev`: Start Vite dev server with HMR.
- `npm run build`: Type-check (`tsc -b`) then production build via Vite.
- `npm run preview`: Preview the production build locally.
- `npm run lint`: Run ESLint on the project.

## Coding Style & Naming Conventions
- Language: TypeScript (strict). React function components.
- Indentation: 2 spaces; keep imports sorted logically.
- Components/Files: PascalCase for components (`HuntspeakTalkPad.tsx`), camelCase for variables/functions.
- CSS: Tailwind utility-first in JSX; global CSS lives in `src/index.css`.
- Linting: ESLint (`eslint.config.js`) with `@eslint/js`, `typescript-eslint`, `react-hooks`, and `react-refresh` presets.

## Testing Guidelines
- Vitest is configured. Use `npm run test` / `test:watch` / `coverage`.
- Naming: `*.test.ts` / `*.test.tsx` colocated under `src/`.
- Aim to cover core morphology helpers and key UI flows (TalkPad, FiniteForms, Translator2).
- Quick validation: `npm run codex` (runs build, lint, tests) or `npm run build` for a smoke check.

## Commit & Pull Request Guidelines
- Commits: Use concise, present-tense messages. Recommended Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `perf:`.
- PRs: Include summary, rationale, and screenshots/gifs for UI changes; link issues; list manual test steps (dev server, build, lint).
- Keep PRs focused; update docs when changing commands or structure.

### Commit Message Style
- Conventional Commits types: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `perf:`, `test:`, `build:`, `ci:`, `revert:`.
- Scope (optional): `feat(translator2): …`, `fix(ui): …`.
- Subject: present tense, imperative mood, concise (<= 72 chars ideal).
- Body (optional): explain rationale or trade-offs; wrap at ~80 cols.
- One logical change per commit; avoid mixing unrelated changes.
- Examples:
  - `feat(talkpad): add habitual toggle to finite builder`
  - `fix(translator2): handle 3sg -s except 'ss'`
  - `docs: clarify codex --finalize behavior`

Instruction
- Before committing with intent, review the previous commit on your branch, confirm what changed, and ensure the commit message (subject/body) summarizes everything changed since that commit.

## Security & Configuration Tips
- Client-only app; do not commit secrets. Avoid adding `.env` values unless needed; prefer `import.meta.env` with Vite prefixes if introduced.
- App persists data in `localStorage` (`huntspeak_*` keys). When changing storage shape, provide migration or a safe reset path.
- Validate user-provided JSON on import (already present); keep it strict when extending.

## State & Persistence
- All persisted keys are under `LS_KEYS` (see `src/lib/storage.ts`).
- Typical keys: `huntspeak_roots`, `huntspeak_nouns`, `huntspeak_talkpad`, `huntspeak_morph_*`, `huntspeak_theme`.
- Use `useLocalStorageState(LS_KEYS.key, initial)` to sync UI/data with localStorage.
- If changing storage shapes, add a minimal migration or provide a safe reset path (Data popup has Import/Export + Hard Reset).

## Agent Ruleset
- Plan first: outline steps with the plan tool and keep it updated.
- Small, focused changes: keep diffs tight and reversible.
- Run the gate: prefer `npm run codex` to build, lint, test before committing.
- Branch discipline: work on `*-dev` branches; avoid committing on `main` unless explicitly allowed.
- Commit intent: pass `-m "<type(scope): message>"` to cache intent; commit only after a green gate.
- Use WIP mode when failing: add `--wip` to checkpoint progress while fixing gate failures.
- Finalize WIPs: once green, run `--finalize` to squash consecutive WIPs into the cached intent.
- No secrets: never add secrets or unvetted env files; prefer `import.meta.env` if needed.

### Branching and Reverts
- Never work directly on `main`; keep active work on the latest `*-dev` or short‑lived feature branches off it.
- After merging `*-dev` to `main`, immediately create the next `*-dev` and switch to it.
- Keep commits small; revert bad changes with `git revert <sha>` and reattempt cleanly.

## Agent Workflow (Codex Helper)
- Validate only: `npm run codex`
- Validate and cache intent: `npm run codex -- -m "feat(ui): tweak list rows"`
- WIP while fixing failures: `npm run codex -- -m "feat: add X" --wip`
- Finalize WIPs into intent: `npm run codex -- --finalize`
- Commit and push after green gate: `npm run codex -- -m "fix: correct copula detection" --push`
- On main (discouraged): `npm run codex -- --allow-main -m "hotfix: …" --push`

Notes
- Intent is stored at `.git/.codex_intent` and cleared after a successful commit.
- A post-commit hook may auto-push; set `NO_AUTO_PUSH=1` to disable.
- The helper prints clear STEP lines and ✅/❌ for each phase.

## Translator 2.0 Tips
- Avoid regex word boundaries with non‑ASCII (e.g., `ɪ`); prefer space/token anchors.
- Do not fuzzy‑match short tokens (< 5 chars) to avoid collisions.
- Detect copula strictly by the k–r–n signature, not gloss snippets.
- Strip simple trailing `s` (except `ss`) for 3sg forms before matching.
- Preserve particle order by scanning tokens left‑to‑right.
- When coordinating clauses, elide repeated right‑side subjects.
- Single source of truth: import `translate()` from `src/lib/translator2/index.ts`.

## Practical UI/Styling
- Theme‑safe list rows: faint borders and soft hover per theme in `index.css`.
- Keep rows one line: use `flex items-center min-w-0 whitespace-nowrap` and truncate glosses.
- Use small, borderless copy controls; avoid heavy themed buttons where not needed.
- Validation borders (blue/red/amber) should override faint defaults.
