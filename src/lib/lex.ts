import type { Noun } from "../types";

// Lightweight normalization helpers shared across translator and Talk Pad
export function norm(s: string) { return s.toLowerCase().replace(/[()]/g, "").replace(/\s+/g, " ").trim(); }
export function stripArticles(s: string) { return s.replace(/^(a|an|the)\s+/, ""); }

/**
 * Best‑effort noun lookup against word/gloss/synonyms; fallback to the raw phrase
 * (optionally singularized by naive -s strip) when nothing matches.
 */
export function lexNoun(nouns: Noun[], phrase: string){
  const p0 = norm(stripArticles(phrase));
  const pSing = p0.replace(/s$/, "");
  let probe = p0; let returned = phrase.trim();
  if (pSing !== p0) { probe = pSing; returned = pSing; }
  for (const n of nouns){
    const w = norm(n.word);
    const g = norm(n.gloss);
    if (probe === w || probe === g || g.includes(probe)) return n.word;
    if (n.synonyms && n.synonyms.some(s=> norm(s) === probe)) return n.word;
  }
  return returned;
}

