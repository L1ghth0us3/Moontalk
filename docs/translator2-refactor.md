# Translator 2.0 — Refactor Plan

Status: in progress (branch `refactor/translator2`)

## Phase 1 — Stabilize API & Wiring
- [x] Single source: keep intake → match → frame → realize in `src/lib/translator2.ts`.
- [x] Wire component: `src/components/Translator2.tsx` calls `translate()` and renders `surface` + `analysis`.
- [ ] Options: add `opts` to `translate(input, roots, nouns, opts)`
  - particles: map for WITH/TO/FROM/IN_AT (defaults, overridable by UI settings)
  - coordinators: AND/OR/NOR/BUT strings
  - flags: behavior toggles (e.g., enableExistential, enableCoordination)
- [x] Tests: expand Vitest to lock current behavior (PP order, coordination, particles, fuzzy guards).

## Phase 2 — Modularize Library
Split `src/lib/translator2.ts` into smaller modules under `src/lib/translator2/`:
- `tokens.ts`: normalize/tokenize, pronoun detection, be‑forms, plural trimming, 3sg -s stemmer.
- `match.ts`: verb/noun resolution (exact → synonyms → gloss → fuzzy≥5) + consumed‑span tracking.
- `frames.ts`: build semantic frame (tense/neg/prog/hab/question), clause type.
- `realize.ts`: subject forms, conjugation, PP ordering, subject elision on coordination.
- `types.ts`: shared internal types for frames/results.
- `index.ts`: export `translate()`; glue options and analysis logs.

## Phase 3 — Features & Cleanup
- Coordination
  - Support multiple joiners (and/or/nor/but), keep per‑clause tense/aspect
  - Improve NP/VP list detection and join using options.mappings
- Existential expletive (optional)
  - Proper parse + generator; add tests and re‑enable in Dev modal
- Analysis
  - Standardize `resolutionLog` messages; include particle→noun pairs
- Cleanup
  - Remove duplicate matching/generation helpers from the component (UI stays thin)

## Phase 4 — Tests & Docs
- Vitest coverage additions
  - More particles (plurals, synonyms), copula edge cases, multi‑PP ordering, more coordination paths
- Dev modal
  - “Copy inputs”, re‑run failing only, show particle pairs in details
- Docs
  - Update README Version Overview once merged to `1.6-dev`

## Process & Cadence
- Work on `refactor/translator2` (or short‑lived feature branches off it).
- After each scoped change: `npm run codex` (build+lint gate), then commit with focused Conventional Commits.
- Keep tests green; add tests before changing behavior.

## Acceptance Criteria
- Translator 2.0 component is a UI shell; all logic lives in lib.
- Behavior equals or improves current tests and Dev checks.
- Options allow UI mapping overrides without code changes.
- Code is modular, typed, and easily testable.

