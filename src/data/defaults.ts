import type { Root, Noun } from "../types";
import { SEED_ROOTS, SEED_NOUNS } from "./userSeeds";

const uid = () => Math.random().toString(36).slice(2, 10);

// Seed data to make the app useful on first load and to demonstrate
// expected shapes for roots and nouns.
// Merge built-in starter roots with user seeds; deduplicate by signature
const R0 = [
  { c1: "k", c2: "l", c3: "b", gloss: "track; hunt", synonyms: ["hunt", "track", "stalk"] },
  { c1: "χ", c2: "r", c3: "q", gloss: "smell; catch scent", synonyms: ["smell", "scent"] },
  { c1: "s", c2: "r", c3: "q", gloss: "hide; lie in wait", synonyms: ["hide", "ambush", "wait"] },
  { c1: "d", c2: "r", c3: "k", gloss: "strike; bring down", synonyms: ["strike", "hit", "kill"] },
  { c1: "q", c2: "r", c3: "b", gloss: "draw near; approach", synonyms: ["approach", "near", "come"] },
  { c1: "t", c2: "r", c3: "f", gloss: "hear; detect", synonyms: ["hear", "detect", "listen"] },
  { c1: "k", c2: "r", c3: "n", gloss: "be; exist", synonyms: ["be", "exist", "copula"] },
  { c1: "f", c2: "th", c3: "h", gloss: "live; dwell", synonyms: ["live", "dwell", "reside"] },
] as const;
const mergeRoots = [...SEED_ROOTS, ...R0];
const seenR = new Set<string>();
export const DEFAULT_ROOTS: Root[] = mergeRoots.filter(r => {
  const k = `${r.c1.toLowerCase()}-${r.c2.toLowerCase()}-${r.c3.toLowerCase()}`;
  if (!r.c1 || !r.c2 || !r.c3) return false;
  if (seenR.has(k)) return false; seenR.add(k); return true;
}).map(r => ({ id: uid(), c1: r.c1, c2: r.c2, c3: r.c3, gloss: r.gloss, synonyms: r.synonyms ? Array.from(r.synonyms) : [] }));

const N0 = [
  { word: "kalāb", gloss: "hunter", synonyms: [] },
  { word: "kalis", gloss: "scent trail", synonyms: [] },
] as const;
const mergeNouns = [...SEED_NOUNS, ...N0];
const seenN = new Set<string>();
export const DEFAULT_NOUNS: Noun[] = mergeNouns.filter(n => {
  const k = (n.word || '').toLowerCase();
  if (!k) return false;
  if (seenN.has(k)) return false; seenN.add(k); return true;
}).map(n => ({ id: uid(), word: n.word, gloss: n.gloss || '', synonyms: n.synonyms ? Array.from(n.synonyms) : [] }));
