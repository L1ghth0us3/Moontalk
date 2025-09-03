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
  // Replace the original C2 (right before the final vowel+C3) with C2' (geminated with apostrophe)
  // Avoid producing triple consonants by removing that original C2 from the stem first.
  const stemWithoutC2 = stem.slice(0, -1);
  return `${stemWithoutC2}${r.c2}'${r.c2}${lastTwo}`;
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
  const t = token.toLowerCase().trim();
  if (!t) return null;

  // 1) Exact token match against semicolon/comma-separated items (preferred)
  for (const r of roots) {
    const items = `${r.gloss}; ${(r.synonyms || []).join('; ')}`
      .toLowerCase()
      .split(/[,;]/)
      .map(s => s.trim())
      .filter(Boolean);
    if (items.includes(t)) return r;
  }

  const textOf = (r: Root) => `${r.gloss} ${(r.synonyms || []).join(' ')}`.toLowerCase();
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // 2) Multi-word: require whole-phrase word-boundary match
  if (t.includes(' ')) {
    const re = new RegExp(`\\b${esc(t)}\\b`);
    for (const r of roots) { if (re.test(textOf(r))) return r; }
    return null;
  }

  // 3) Short tokens (<= 2 chars): do not attempt fuzzy/substring matching to avoid collisions (e.g., "am" vs "ambush")
  if (t.length <= 2) return null;

  // 4) Fallback: prefix-of-word match (less permissive than arbitrary substring)
  const rePrefix = new RegExp(`\\b${esc(t)}`);
  for (const r of roots) { if (rePrefix.test(textOf(r))) return r; }
  return null;
}
