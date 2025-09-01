export interface Root {
  id: string;
  c1: string;
  c2: string;
  c3: string;
  gloss: string;
  synonyms?: string[];
}

export interface Noun {
  id: string;
  word: string;
  gloss: string;
  synonyms?: string[];
}

export const PRONOUNS = [
  { label: "1sg (ɪ)", form: "ɪ", subjV: "ɪ" },
  { label: "2sg (su)", form: "su", subjV: "u" },
  { label: "3sg (se)", form: "se", subjV: "e" },
  { label: "1pl (tɪ)", form: "tɪ", subjV: "ɪ" },
  { label: "2pl (tu)", form: "tu", subjV: "u" },
  { label: "3pl (te)", form: "te", subjV: "e" },
];

export const TENSES = [
  { key: "prs", label: "present", vowel: "a" },
  { key: "pst", label: "past", vowel: "e" },
  { key: "fut", label: "future", vowel: "ʌ" },
];

