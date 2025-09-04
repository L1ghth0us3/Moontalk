# Translator 2.0 Library

Public API and internal module layout for the English → Huntspeak translator.

## Public API
- Entry: `src/lib/translator2/index.ts`
- Function: `translate(input: string, roots: Root[], nouns: Noun[], opts?: T2Options): T2Result`
- Types: `T2Options`, `T2Result`, `T2SemanticFrame` (re-exported from `index.ts`)

### Options (`T2Options`)
- `particles`: override particle mapping
  - keys: `WITH | TO | FROM | IN_AT` (defaults: `ri | ith | ʌs | la`)
- `coordinators`: override joiners
  - keys: `AND | OR | NOR | BUT` (defaults: `ʋa | ra | ra | ma`)
- `flags.enableCoordination` (default: true)

### Behavior Highlights
- PP order preserved: particles are emitted in token order.
- Matching discipline:
  - Prevent short fuzzy collisions (tokens < 5 chars do not fuzzy-match).
  - Do not reuse verb tokens when collecting nouns.
  - Copula strictly by signature k–r–n.
  - Verb 3sg `-s` stem handled (e.g., sits → sit).
- Coordination: simple `and` split with right-side subject elision; joiner configurable.

## Internal Modules
- `tokens.ts`: normalize/tokenize, `splitItems`, `edit1`, `stemVerb`
- `match.ts`: verb/noun resolution and consumed-span helpers
- `frames.ts`: builds `T2SemanticFrame` + clause type from tokens
- `realize.ts`: subject forms + conjugation (`conjFinite`, `hsSubjectFor`)
- `types.ts`: internal types
- `index.ts`: public API (`translate`) — composes the above; prefer importing from here

## Usage
- In components:
  ```ts
  import { translate } from '../lib/translator2/index';
  const out = translate('I hunt with the queen', roots, nouns, {
    particles: { WITH: 'ri' },
    coordinators: { AND: 'ʋa' },
  });
  console.log(out.surface); // ɪ kɪlab ri kin
  ```
- In tests:
  ```ts
  import { translate } from '../src/lib/translator2/index';
  ```

## Notes
- The Translator 2.0 UI (`src/components/Translator2.tsx`) is wired to this library and renders `surface` + `analysis`.
- Dev “Live Tests” modal also uses this API and shows `analysis.resolutionLog` for debugging.

## Roadmap (Phase 3)
- Multiple joiners (and/or/nor/but) across clauses; better NP/VP list joins.
- Optional existential “there is/are …” support (parser + generator) with tests.
- Enrich `analysis` with particle→noun pairs and standardized resolution messages.

