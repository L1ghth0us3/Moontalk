# Changelog

All notable changes to this project will be documented in this file.

## [1.6.0-next] - Unreleased
- UI: Translator 2.0 shows pronouns in parentheses when they occur at the start of a clause or immediately after a coordinator (cosmetic hint; library surface unchanged).
- Translator 2.0 (lib): expose `analysis.unknownTokens` (skips helpers/particles/pronouns/be/coordinators); UI displays unknowns with quick add-as Noun/Verb actions.
- Translator 2.0 (lib): tighten clause coordination splitting — only split on AND/OR/NOR/BUT when both sides contain a verb-like token; still handles repeated prepositions inside PP lists (e.g., “with X or with Y”).
- Translator 2.0 (lib): standardized analysis.resolutionLog formats:
  - verb: "verb:token 'hunt' -> root 'klb' via synonym-exact"; phrase matches use "verb:phrase ... via phrase-exact".
  - noun: "noun:token 'hunter' -> word 'kalāb' via word-exact" (or phrase).
  - particle: "particle:en 'with' -> code 'ri' + noun 'kalāb'".
- Docs: test docs enforcement flow (example entry).
- Docs: broaden docs enforcement heuristics (src/workflow/build changes now require docs).
- Dev: expanded in‑app Dev test runner (grouped scenarios, expected vs got, details panel with clause/frame/tokens/logs).
- Tests: broadened Vitest coverage across particles, PP order, and simple coordination; added queen/with and shroud+traps cases.
- Translator 2.0 (lib): major logic fixes and refactor groundwork → public API moved to `src/lib/translator2/index.ts`
  - Matching: prevent short fuzzy collisions (sit↔shit, move↔love, cave↔crave); skip verb tokens when collecting nouns; strict copula by k–r–n.
  - Forms: handle 3sg -s verb stemming (e.g., sits → sit).
  - Particles: resolve complements via word/synonyms/gloss (+ safe fuzzy≥5), and preserve PP order in surface.
  - Coordination: simple AND split with subject elision on right; configurable joiner.
  - Options: `translate(input, roots, nouns, opts)` accepts particles/coordinators/flags.
  - Modularization: extracted `tokens.ts`, `match.ts`, `frames.ts`, `realize.ts`, `types.ts`; component calls the lib `translate()`.
  - Public API: moved `translate()` to `src/lib/translator2/index.ts`; removed legacy `src/lib/translator2.ts`; imports updated.
  - Coordination (Phase 3 start): multi‑clause split on AND/OR/NOR/BUT with configurable joiners and right‑side subject elision; preserved PP order.
  - Pronoun fix: map 3pl `they` → `te` for correct finite forms.
  - Tests: added multiple‑AND and OR coordination cases; suite now at 25 green tests.
- Defaults: added verb root for “live; dwell” (f–th–h) to resolve “live” from built-ins.
 - Workflow helper: codex-workflow overhaul for agents and humans
   - Intent cache: repo‑local JSON at `.git/.codex_intent.json` with `{ main, secondary[], createdAT, branch, stagedTree, paths[] }`.
   - Gate: runs build → lint → test; order configurable via `--order build,lint,test`.
   - Exit codes: distinct codes with one‑line next steps (0 OK, 10 E_NO_STAGED, 11 E_CHECK_FAIL, 12 E_TREE_MISMATCH, 13 E_PUSH_REJECTED, 2 E_MAIN_PROTECTED).
   - Commit safety: staged‑only commits; single‑line guidance for every failure; smarter staged‑tree guard (auto‑rebind when safe: same branch, intent < 4h, staged paths subset/superset; otherwise show new/removed paths and require `--rebind`).
   - Push: decoupled from commit; independent `--push` (sets upstream if missing). On non‑fast‑forward, exits E_PUSH_REJECTED with fetch/rebase guidance.
   - Amend: guarded — only honored on a green commit; ignored during failing runs with a gentle notice.
   - Docs enforcement: requires docs updates before committing when warranted (e.g., workflow or feature changes); adds a `docs:` note in the commit footer when docs are updated.
   - Message composition: tidy “Secondary changes” footer — at most one bullet per category (build, lint, test, meta), ordered and deduped; omitted entirely if empty.
   - Ergonomics: `--verbose`, `--dry-run`, `--clear`, `--rebind`; expanded `--help` (copy‑paste playbook, exit codes, intent cache) and a 20‑second header briefing.
   - Cleanups: removed legacy `--wip`/`--finalize` flow; docs updated across README and AGENTS.md; merged onboarding into AGENTS.md (Onboarding & Guidance section).

## [1.5.0] - 2025-09-04
- Workflow: introduce Codex helper (`npm run codex`) and `.githooks/post-commit` auto‑push. Gate = build + lint + status, with optional commit/push.
- Dev Tools: add “Dev: Live Tests” popup with live translator checks; show expected vs got and copyable summary.
- Tests: add Vitest config and baseline Translator 2.0 API tests.
- UI Utils: context‑menu provider + clipboard helpers; toast provider for ephemeral notifications.
- Data: refresh seeds and defaults for roots and nouns.
- Build Fix: lazy‑load the Dev test runner to satisfy strict TS build (no `require` in TSX).
- Docs: update `AGENT_ONBOARDING.md` and README for workflow, branching, and testing.

## [1.4.0] - 2025-09-03
 - Rebrand: app name is now Moontalk (the language remains Huntspeak). Updated titles, header, info page, and docs; reverted any language mentions that were incorrectly changed to Night‑tongue back to Huntspeak.
 - Experimental: Translator 2.0 — added third tab with a fresh translator surface. Defines internal contracts (LexiconEntryVerb/Noun, SemanticFrame, Result), two‑panel layout, and a stub Translate action that echoes inputs and shows a JSON analysis.

## [1.3.0] - 2025-09-03

- Rebrand: app shell renamed to Night‑tongue; added top‑nav “What is this” page with TL;DR, basics, copula/existential/possession patterns, derivations, examples, and notes.
- Particles: UI and translator now use ri (with) and ith (to); ʌs (from), la (in/at) unchanged.
- Translator: implement copula k–r–n (regular root) with zero‑copula present equatives; add existential/locative/possession mappings; ignore progressive for copula; allow habitual; add `forceCopula` flag; expand negation detection (isn't/aren't/wasn't/weren't).
- Root matching: stricter English→root matching avoids short‑token collisions; prefers exact/whole‑word.
- Noun lexing: shared `lexNoun` used by Talk Pad and Translator; Talk Pad “to/from” now translate like dropdown nouns.
- Unknown tokens: show as red, clickable with tooltip; clicking opens add‑as‑Noun/Verb dialog (prefills English). Implemented in Talk Pad and Translator; hover underline added.
- Derivations: info page cheat‑sheet expanded to match in‑app patterns with friendlier explanations.

## [1.2.0] - 2025-09-02

- Roots/Nouns editors: expand (⛶) modal now wider, responsive, and scrollable; quick filter + persistent search in compact view; double-click list to expand
- Roots expanded: Edit below list (left), Finite Forms and Derivations integrated on right; Derivations in 4×2 layout on large screens
- Derivations: click a card to save as noun (word/gloss/synonyms); theme-aware hover; themed popover; click-off to close
- Talk Pad: searchable dropdowns (fuzzy) for Verb, Object, and With; Object uses noun dropdown; qa? question suffix
- Morphology: progressive uses C2' (apostrophe); shared Neg/Prog/Hab sync and clickable badge
- Data: import/export + Hard Reset in Data popup with red danger styling

## [1.1.0] - 2025-09-02

- Talk Pad: noun dropdown for Object; qa? question; pronoun labels include English; particle hints (fi, ga/ʌs)
- Shared morph toggles (Neg/Prog/Hab) with optional sync between Talk Pad and Finite Forms; clickable Sync badge with tooltip
- Progressive morphology: C2' progressive form (apostrophe) instead of plain gemination
- Root/Noun editors: expand (⛶) modal with pop-in animation; persistent search toggle; fuzzy filter; double-click list to expand
- Data popup: Import/Export and Hard Reset moved from Settings; Hard Reset as distinct red button with confirmation
- Theme labels: Dracula/Light with Auto default; selected item highlights refined

## [1.0.0] - 2025-09-02

- Sticky composer with tabs for Talk Pad and Free Translator
- Outside-click-to-close for Settings and Data modals
- Import/Export JSON for roots and nouns
- Danger Zone: Reset localStorage with confirmation
- Two-way sync between Verb Roots selection and Talk Pad Verb
- Theme labels updated (Dracula/Light) and Auto as default
- Selected Root/Noun highlight adjustments per theme
- Finite Forms: dynamic spacing and denser layout
- Code comments and structure cleanup
