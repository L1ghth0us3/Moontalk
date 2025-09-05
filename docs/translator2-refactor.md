# Translator 2.0 — Refactor Plan

Status: in progress (branch `refactor/translator2`)

## Phase 1 — Stabilize API & Wiring
- [x] Single source: keep intake → match → frame → realize in `src/lib/translator2` (public API in `index.ts`).
- [x] Wire component: `src/components/Translator2.tsx` calls `translate()` and renders `surface` + `analysis`.
- [x] Options: add `opts` to `translate(input, roots, nouns, opts)`
  - particles: map for WITH/TO/FROM/IN_AT (defaults, overridable by UI settings)
  - coordinators: AND/OR/NOR/BUT strings
  - flags: behavior toggles (e.g., enableCoordination)
- [x] Tests: expand Vitest to lock current behavior (PP order, coordination, particles, fuzzy guards).

## Phase 2 — Modularize Library
Split the translator into smaller modules under `src/lib/translator2/`:
- [x] `tokens.ts`: normalize/tokenize, pronoun detection, be‑forms, plural trimming, 3sg -s stemmer.
- [x] `match.ts`: verb/noun resolution (exact → synonyms → gloss → fuzzy≥5) + consumed‑span tracking.
- [x] `frames.ts`: build semantic frame (tense/neg/prog/hab/question), clause type.
- [x] `realize.ts`: subject forms, conjugation, PP ordering, subject elision on coordination.
- [x] `types.ts`: shared internal types for frames/results.
- [x] `index.ts`: public API — `translate()` composes modules; legacy monolith removed.

## Phase 3 — Features & Cleanup
- Coordination
  - [x] Support multiple joiners (and/or/nor/but); joiners configurable via options.
  - [x] NP list detection in direct objects and PP complements; subject elision across coordinated clauses.
  - [ ] Optional tightening: only split clauses on coordinators when both sides contain a verb (heuristic).
- Analysis & Logging
  - [x] Include particle→noun pairs in `analysis.particlePairs`.
  - [ ] Add `analysis.unknownTokens` computed from intake (skips PRON/SPECIAL/PREP/coordinators; excludes matched spans).
  - [ ] Standardize `resolutionLog` messages and `via` tags for verbs/nouns/particles.
- UI Cleanup
  - [ ] Remove duplicate tokenizer/matcher/generator from `src/components/Translator2.tsx`; rely solely on library output.
- Deferred (out of scope for now)
  - Existential expletive (“there is/are …”): parser/generator/tests intentionally postponed.

## Phase 4 — Tests & Docs
- Vitest coverage additions (no existential yet)
  - Particles (plurals, synonyms), copula edge cases, multi‑PP ordering, coordination joiners and NP lists.
- Dev modal / Debug
  - Show `resolutionLog`, `particlePairs`, and unknown tokens from lib; support copy inputs.
- Docs
  - Update README Version Overview once merged to `1.6-dev`.
  - Keep this plan in sync with implementation status (checkboxes reflect current state).

## Process & Cadence
- Work on `refactor/translator2` (or short‑lived feature branches off it).
- After each scoped change: `npm run codex` (build+lint gate), then commit with focused Conventional Commits.
- Keep tests green; add tests before changing behavior.

## Acceptance Criteria
- Translator 2.0 component is a thin UI; all logic lives in lib.
- Behavior equals or improves current tests and Dev checks.
- Options allow UI mapping overrides without code changes.
- Code is modular, typed, and easily testable; analysis data is consistent and useful for debugging.
