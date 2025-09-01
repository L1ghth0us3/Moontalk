# Repository Guidelines

## Project Structure & Module Organization
- Source: `src/` (entry `src/main.tsx`, app shell `src/App.tsx`).
- UI: `src/HuntspeakTalkPad.tsx` (core logic + subcomponents), styles in `src/index.css` (Tailwind v4 via `@tailwindcss/vite`).
- Assets: `src/assets/`.
- Build config: `vite.config.ts`, TypeScript configs: `tsconfig.*.json`.

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
- No test framework is configured yet. Prefer adding Vitest + React Testing Library.
- Suggested naming: `*.test.ts` / `*.test.tsx` colocated under `src/`.
- Minimum coverage target (suggested): exercise core morphology helpers and key UI flows in `HuntspeakTalkPad`.
- Until tests land, verify via: `npm run build` and smoke-run `npm run dev`.

## Commit & Pull Request Guidelines
- Commits: Use concise, present-tense messages. Recommended Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `perf:`.
- PRs: Include summary, rationale, and screenshots/gifs for UI changes; link issues; list manual test steps (dev server, build, lint).
- Keep PRs focused; update docs when changing commands or structure.

## Security & Configuration Tips
- Client-only app; do not commit secrets. Avoid adding `.env` values unless needed; prefer `import.meta.env` with Vite prefixes if introduced.
- App persists data in `localStorage` (`huntspeak_*` keys). When changing storage shape, provide migration or a safe reset path.
- Validate user-provided JSON on import (already present); keep it strict when extending.

