import type { Root } from "../types";

export function buildFinite(r: Root, subjV: string, tenseV: string) {
  return `${r.c1}${subjV}${r.c2}${tenseV}${r.c3}`;
}
export function withProgressive(form: string, r: Root) {
  const lastTwo = form.slice(-2);
  const stem = form.slice(0, -2);
  return `${stem}${r.c2}${lastTwo}`;
}
export function withHabitual(form: string) { return `${form}ar`; }
export function withNegation(form: string) { return /^(k|g|q)/i.test(form) ? `naq${form}` : `naaq${form}`; }

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
