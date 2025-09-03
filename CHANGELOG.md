# Changelog

All notable changes to this project will be documented in this file.

## [1.4.0-next] - Unreleased

## [1.3.0] - 2025-09-03

- Rebrand: app shell renamed to Night‑tongue; added top‑nav “What is this” page with TL;DR, basics, copula/existential/possession patterns, derivations, examples, and notes.
- Particles: UI and translator now use ri (with) and ith (to); ʌs (from), la (in/at) unchanged.
- Translator: implement copula k–r–n (regular root) with zero‑copula present equatives; add existential/locative/possession mappings; ignore progressive for copula; allow habitual; add `forceCopula` flag; expand negation detection (isn't/aren't/wasn't/weren't).
- Root matching: stricter English→root matching avoids short‑token collisions; prefers exact/whole‑word.
- Noun lexing: shared `lexNoun` used by Talk Pad and Translator; Talk Pad “to/from” now translate like dropdown nouns.
- Unknown tokens: show as red, clickable with tooltip; clicking opens add‑as‑Noun/Verb dialog (prefills English). Implemented in Talk Pad and Translator; hover underline added.
- Derivations: info page cheat‑sheet expanded to match in‑app patterns with friendlier explanations.

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

## [1.2.0] - 2025-09-02

- Roots/Nouns editors: expand (⛶) modal now wider, responsive, and scrollable; quick filter + persistent search in compact view; double-click list to expand
- Roots expanded: Edit below list (left), Finite Forms and Derivations integrated on right; Derivations in 4×2 layout on large screens
- Derivations: click a card to save as noun (word/gloss/synonyms); theme-aware hover; themed popover; click-off to close
- Talk Pad: searchable dropdowns (fuzzy) for Verb, Object, and With; Object uses noun dropdown; qa? question suffix
- Morphology: progressive uses C2' (apostrophe); shared Neg/Prog/Hab sync and clickable badge
- Data: import/export + Hard Reset in Data popup with red danger styling
