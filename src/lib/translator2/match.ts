import { norm, splitItems, edit1, stemVerb } from './tokens';

export type LexVerb = { id:string; c1:string; c2:string; c3:string; gloss:string; synonyms:string[] };
export type LexNoun = { id:string; word:string; gloss:string; synonyms:string[] };

export function findVerbByPhrase(verbs: LexVerb[], phrase: string): LexVerb | null {
  const p = norm(phrase);
  const exact = verbs.find(v=> splitItems(v.gloss).includes(p) || v.synonyms.map(norm).includes(p) );
  return exact || null;
}

export function findVerbByToken(verbs: LexVerb[], token: string, allowFuzzy = true): LexVerb | null {
  const base = norm(stemVerb(token));
  let hit = verbs.find(v=> v.synonyms.map(norm).includes(base) );
  if (hit) return hit;
  hit = verbs.find(v=> splitItems(v.gloss).includes(base) );
  if (hit) return hit;
  if (allowFuzzy && base.length >= 5){
    hit = verbs.find(v=> v.synonyms.map(norm).some(s=>edit1(base,s)) )
       || verbs.find(v=> splitItems(v.gloss).some(s=>edit1(base,s)) );
    if (hit) return hit;
  }
  return null;
}

export function findNounByTokens(nouns: LexNoun[], w1: string, w2?: string | undefined): { noun: LexNoun | null; span: 1|2 }{
  const b1 = norm(w1.endsWith('s')&&w1.length>3&&!w1.endsWith('ss')? w1.slice(0,-1): w1);
  const b2 = w2 ? `${b1} ${norm(w2.endsWith('s')&&w2.length>3&&!w2.endsWith('ss')? w2.slice(0,-1): w2)}` : undefined;
  // synonyms/gloss exact prefer phrase then token
  if (b2){
    const nPhrase = nouns.find(x=> (x.synonyms||[]).map(norm).includes(b2) ) || nouns.find(x=> splitItems(x.gloss).includes(b2) );
    if (nPhrase) return { noun: nPhrase, span: 2 };
  }
  const n0 = nouns.find(n=> norm(n.word)===b1 )
    || nouns.find(n=> (n.synonyms||[]).map(norm).includes(b1) )
    || nouns.find(n=> splitItems(n.gloss).includes(b1) );
  if (n0) return { noun: n0, span: 1 };
  if (b1.length >= 5){
    if (b2){
      const n2 = nouns.find(n=> edit1(b2, norm(n.word)))
        || nouns.find(n=> (n.synonyms||[]).map(norm).some(s=>edit1(b2,s)))
        || nouns.find(n=> splitItems(n.gloss).some(s=>edit1(b2,s)));
      if (n2) return { noun: n2, span: 2 };
    }
    const n1 = nouns.find(n=> edit1(b1, norm(n.word)))
      || nouns.find(n=> (n.synonyms||[]).map(norm).some(s=>edit1(b1,s)))
      || nouns.find(n=> splitItems(n.gloss).some(s=>edit1(b1,s)));
    if (n1) return { noun: n1, span: 1 };
  }
  return { noun: null, span: 1 };
}
