import type { Root, Noun } from "../types";
import { buildFinite, withHabitual, withNegation, withProgressive } from "./morphology";
import type { T2SemanticFrame, T2Options, T2Result } from "./translator2/types";
import { buildFrameFromTokens } from "./translator2/frames";
import { hsSubjectFor, conjFinite } from "./translator2/realize";
import { findNounByTokens } from "./translator2/match";

export type { T2SemanticFrame, T2Options, T2Result };

export function translate(input: string, roots: Root[], nouns: Noun[], opts?: T2Options): T2Result {
  // Lex maps
  const ns = nouns.map(n=>({ id:n.id, word:n.word, gloss:n.gloss||'', synonyms:(n.synonyms||[]) as string[] }));

  const PART_DEF = { WITH:'ri', TO:'ith', FROM:'ʌs', IN_AT:'la' } as const;
  const partMap = { ...PART_DEF, ...(opts?.particles||{}) } as Record<'WITH'|'TO'|'FROM'|'IN_AT', string>;
  const PREP: Record<string,string> = { with:partMap.WITH, to:partMap.TO, from:partMap.FROM, in:partMap.IN_AT, at:partMap.IN_AT };
  const COORD_DEF = { AND:'ʋa', OR:'ra', NOR:'ra', BUT:'ma' } as const;
  const coords = { ...COORD_DEF, ...(opts?.coordinators||{}) } as Record<'AND'|'OR'|'NOR'|'BUT', string>;
  // (moved into frames.ts)

  const built = buildFrameFromTokens(input, roots, nouns, PREP);
  const frame = built.frame;
  const clause = built.clause;
  const tokens = built.tokens;
  const words = built.words;

  // generate
  const parts: string[] = [] as string[];
  const variants: string[] = [];
  const sj = hsSubjectFor(frame.subject);
  const verbRoot = frame.verbRootId ? roots.find(r=>r.id===frame.verbRootId) : null;
  if(clause==='existential'){
    const copR = verbRoot || null; if(copR){ parts.push(conjFinite(copR, {form:'se',subjV:'e'}, frame.tense, {prog:false,hab:frame.hab,neg:frame.neg}, true, buildFinite, withProgressive, withHabitual, withNegation)); }
    if(frame.objects[0]){ const n = ns.find(n=>n.id===frame.objects[0]); if(n) parts.push(n.word); }
    // crude place pairing: if another object exists, attach la to it
    if(frame.objects[1]){ const n = ns.find(n=>n.id===frame.objects[1]); if(n){ parts.push('la'); parts.push(n.word); } }
  } else if (clause==='copular'){
    const zero = frame.tense==='present' && !frame.neg;
    if(!zero) parts.push(sj.form);
    const copR = verbRoot; if(!zero && copR) parts.push(conjFinite(copR, sj, frame.tense, {prog:false,hab:frame.hab,neg:frame.neg}, true, buildFinite, withProgressive, withHabitual, withNegation));
    if(frame.objects[0]){ const n = ns.find(n=>n.id===frame.objects[0]); if(n) parts.push(n.word); }
    if(zero && copR){ const n = frame.objects[0]? ns.find(n=>n.id===frame.objects[0])?.word : undefined; variants.push([sj.form, copR?conjFinite(copR, sj, frame.tense, {prog:false,hab:frame.hab,neg:frame.neg}, true, buildFinite, withProgressive, withHabitual, withNegation):'', n||''].filter(Boolean).join(' ')); parts.length=0; parts.push(sj.form); if(n) parts.push(n); }
  } else {
    if(sj.form) parts.push(sj.form);
    if(verbRoot) parts.push(conjFinite(verbRoot, sj, frame.tense, {prog:frame.prog,hab:frame.hab,neg:frame.neg}, false, buildFinite, withProgressive, withHabitual, withNegation));
    if(frame.objects[0]){ const n = ns.find(n=>n.id===frame.objects[0]); if(n) parts.push(n.word); }
    // basic preps: scan tokens in order to preserve PP order
    for (let i=0;i<tokens.length;i++){
      const w = tokens[i].text;
      const part = PREP[w];
      if (!part) continue;
      const w2 = tokens[i+1]?.text; if (!w2) continue;
      const found = findNounByTokens(ns, w2, tokens[i+2]?.text);
      const n = found.noun;
      if(n){ parts.push(part); parts.push(n.word); }
    }
  }
  if(frame.question) parts.push('qa?');

  let surface = parts.join(' ').trim();
  const analysis = { frame, intake: { input, tokens, tokensFlat: tokens.map(t=>t.text) }, clause, resolutionLog: built.resolutionLog };
  const warnings: string[] = [];
  if(!frame.verbRootId) warnings.push('Unknown verb');

  // Simple clause coordination for 'and': split tokens once and join translations with ʋa, drop repeated subject on right
  const andIdx = words.indexOf('and');
  if ((opts?.flags?.enableCoordination ?? true) && andIdx > 0 && andIdx < tokens.length-1){
    const leftTokens = tokens.slice(0, andIdx);
    const rightTokens = tokens.slice(andIdx+1);
    const leftInput = leftTokens.map(t=>t.text).join(' ');
    const rightInput = rightTokens.map(t=>t.text).join(' ');
    const left = translate(leftInput, roots, nouns, opts);
    const right = translate(rightInput, roots, nouns, opts);
    // If right starts with same subject as left, drop it
    const subjForm = (s: string|undefined)=> s==='I'?'ɪ':s==='we'?'tɪ':s==='you'?'su':s==='they'?'te':'se';
    const lFrame = (left.analysis?.frame as unknown) as { subject?: string } | undefined;
    const lSubj = lFrame?.subject;
    const sf = subjForm(lSubj);
    let rSurf = right.surface;
    if (sf && (rSurf===sf || rSurf.startsWith(sf+' '))){ rSurf = rSurf.slice(sf.length).trimStart(); }
    surface = [left.surface, coords.AND, rSurf].join(' ');
  }

  return { surface, variants, analysis, warnings };
}
