import type { Root } from "../types";

// Core morphology helpers for building Huntspeak verb forms.
// All helpers are pure and side‑effect free so UI components can safely memoize them.

/**
 * Build a finite verb from a triliteral root using the template:
 * C1 + subj vowel + C2 + tense vowel + C3
 * Example: k-l-b with 1sg(ɪ) present(a) => kɪlaʙ
 */
export function buildFinite(r: Root, subjV: string, tenseV: string) {
  return `${r.c1}${subjV}${r.c2}${tenseV}${r.c3}`;
}
/**
 * Progressive: geminate C2 before the final (tense) vowel cluster.
 * Operates on a built finite form: …C2 + Vtense + C3
 * We reinsert C2 right before the last two codepoints (assumes vowel+C3 final).
 */
export function withProgressive(form: string, r: Root) {
  const lastTwo = form.slice(-2);
  const stem = form.slice(0, -2);
  return `${stem}${r.c2}${lastTwo}`;
}
/** Habitual: add -ar suffix. */
export function withHabitual(form: string) { return `${form}ar`; }

/**
 * Negation prefix: naaq-; but assimilates to naq- before dorsal stops (k/g/q).
 * Simple heuristic based on the first letter of the phonological word.
 */
export function withNegation(form: string) { return /^(k|g|q)/i.test(form) ? `naq${form}` : `naaq${form}`; }

/**
 * Try to locate a root whose English gloss/synonyms match a token.
 * First attempts exact token match against semi‑tokenized gloss; falls back to substring.
 */
export function findRootByEnglish(roots: Root[], token: string): Root | null {
  const t = token.toLowerCase();
  for (const r of roots) {
    const spaceGloss = `${r.gloss}; ${(r.synonyms||[]).join('; ')}`.toLowerCase();
    for (const g of spaceGloss.split(/[,;]/).map(s => s.trim())) {
      if (!g) continue;
      if (g === t) return r;
    }
  }
  for (const r of roots) {
    const g = `${r.gloss} ${(r.synonyms||[]).join(' ')}`.toLowerCase();
    if (g.includes(t)) return r;
  }
  return null;
}
