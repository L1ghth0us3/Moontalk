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
- `npm run codex` (primary): Run the Codex workflow helper (build → lint → test → status), compose commit message from cached intent, and optionally push. Use flags after `--`.
  - Examples:
    - Validate + cache intent: `npm run codex -- -m "feat: <intent>"`
    - Rerun after fixes: `npm run codex`
    - Amend after green: `npm run codex -- --amend`
    - Rebind staged tree if scope changed: `npm run codex -- --rebind`
    - Clear cache: `npm run codex -- --clear`
    - Push after commit: `npm run codex -- --push`
- `npm run dev`: Start Vite dev server with HMR (for live development). Still commit via the helper.
- `npm run build` / `npm run lint` / `npm run test`: Allowed for local debugging, but do not use these to create commits. Always commit through `npm run codex`.
- `npm run preview`: Preview the production build locally.

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
  - `docs: clarify codex workflow`

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
- Gate + commit via helper: always use `npm run codex` as the primary tool for validation and commits.
- Branch discipline: work on `*-dev` branches; avoid committing on `main` unless explicitly allowed.
- Commit intent: pass `-m "<type(scope): message>"` to cache intent; the helper will commit only after a green gate.
- On non‑zero exit: do NOT create ad‑hoc commits. Fix issues, restage intentionally, and rerun `npm run codex` without changing the original `-m`.
- Amend sparingly: use `--amend` only to add small clarifications to the same change set after everything is green.
- Staged tree guard: if warned about staged tree mismatch, either restage to match the original scope or pass `--rebind` if the scope legitimately changed.
- No secrets: never add secrets or unvetted env files; prefer `import.meta.env` if needed.

### Branching and Reverts
- Never work directly on `main`; keep active work on the latest `*-dev` or short‑lived feature branches off it.
- After merging `*-dev` to `main`, immediately create the next `*-dev` and switch to it.
- Keep commits small; revert bad changes with `git revert <sha>` and reattempt cleanly.

## Agent Workflow (Codex Helper)
- Stage intentionally: add specific paths or use `git add -p`.
- Cache intent: `npm run codex -- -m "type(scope): concise intent"`.
- Gate + iterate: if the script fails (build/lint/test), fix the code, stage the fixes, then rerun `npm run codex` without a new `-m`.
- Rebind only when prompted: if the script says staged content changed but the scope is still the same feature, rerun with `--rebind`.
- No amend during fix iterations: do not use `--amend` while addressing failures. Use `--amend` only after everything is green to add a tiny clarification.
- After success: push with `npm run codex -- --push` (independent step; sets upstream if missing). Avoid `git pull --rebase` unless a push is rejected as non‑fast‑forward.
- Rebase rule: never run `git pull --rebase` unless a push was rejected as non‑fast‑forward.

Notes
- Intent is stored at `.git/.codex_intent.json` and cleared after a successful commit.
- A post-commit hook may auto-push; set `NO_AUTO_PUSH=1` to disable.
- The helper prints clear STEP lines and ✅/❌ for each phase.

### Auto‑Rebind & Notes Hygiene
- Auto‑rebind: when safe (same branch, intent < 4h old, and staged paths are a subset or superset of the original), the helper auto‑rebinds and proceeds. Otherwise it aborts with new/removed path lists and asks for `--rebind`.
- Commit notes: secondary notes are concise and tidy. The footer shows at most one bullet per category (build, lint, test, meta), ordered and deduped; omitted entirely if there are no notes.

### Using the codex-workflow helper (required for commits)
- Always stage intentionally: add specific paths or use `git add -p` to stage only what belongs in the commit.
- Start a task by caching intent with a clear Conventional Commit message:
  - `node scripts/codex-workflow.mjs -m "feat: <intent>"`
- If the script exits non‑zero, do NOT create ad‑hoc commits. Fix issues, restage, and rerun the helper without changing the original message (`-m`).
- Use `--amend` only after everything is green if you need to add small clarifications to the same change set.
- If warned about a staged tree mismatch, either restage to match the original scope or explicitly pass `--rebind` if the scope legitimately changed.

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
