import type { Root, Noun } from "../types";

const uid = () => Math.random().toString(36).slice(2, 10);

export const DEFAULT_ROOTS: Root[] = [
  { id: uid(), c1: "k", c2: "l", c3: "b", gloss: "track; hunt", synonyms: ["hunt", "track", "stalk"] },
  { id: uid(), c1: "χ", c2: "r", c3: "q", gloss: "smell; catch scent", synonyms: ["smell", "scent"] },
  { id: uid(), c1: "s", c2: "r", c3: "q", gloss: "hide; lie in wait", synonyms: ["hide", "ambush", "wait"] },
  { id: uid(), c1: "d", c2: "r", c3: "k", gloss: "strike; bring down", synonyms: ["strike", "hit", "kill"] },
  { id: uid(), c1: "q", c2: "r", c3: "b", gloss: "draw near; approach", synonyms: ["approach", "near", "come"] },
  { id: uid(), c1: "t", c2: "r", c3: "f", gloss: "hear; detect", synonyms: ["hear", "detect", "listen"] },
];

export const DEFAULT_NOUNS: Noun[] = [
  { id: uid(), word: "mallūb", gloss: "trap, snare" },
  { id: uid(), word: "kalāb", gloss: "hunter" },
  { id: uid(), word: "kalis", gloss: "scent trail" },
  { id: uid(), word: "Shroud", gloss: "the Shroud (place)" },
  { id: uid(), word: "prey", gloss: "prey" },
];
