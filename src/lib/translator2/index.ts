import type { Root, Noun } from "../../types";
import { buildFinite, withHabitual, withNegation, withProgressive } from "../morphology";
import type { T2SemanticFrame, T2Options, T2Result } from "./types";
import { buildFrameFromTokens } from "./frames";
import { hsSubjectFor, conjFinite } from "./realize";
import { findNounByTokens } from "./match";

export type { T2SemanticFrame, T2Options, T2Result };

export function translate(input: string, roots: Root[], nouns: Noun[], opts?: T2Options): T2Result {
  const ns = nouns.map(n=>({ id:n.id, word:n.word, gloss:n.gloss||'', synonyms:(n.synonyms||[]) as string[] }));

  const PART_DEF = { WITH:'ri', TO:'ith', FROM:'ʌs', IN_AT:'la' } as const;
  const partMap = { ...PART_DEF, ...(opts?.particles||{}) } as Record<'WITH'|'TO'|'FROM'|'IN_AT', string>;
  const PREP: Record<string,string> = { with:partMap.WITH, to:partMap.TO, from:partMap.FROM, in:partMap.IN_AT, at:partMap.IN_AT };
  const COORD_DEF = { AND:'ʋa', OR:'ra', NOR:'ra', BUT:'ma' } as const;
  const coords = { ...COORD_DEF, ...(opts?.coordinators||{}) } as Record<'AND'|'OR'|'NOR'|'BUT', string>;

  const built = buildFrameFromTokens(input, roots, nouns, PREP);
  const frame = built.frame;
  const clause = built.clause;
  const tokens = built.tokens;
  const words = built.words;

  const parts: string[] = [] as string[];
  const variants: string[] = [];
  const sj = hsSubjectFor(frame.subject);
  const verbRoot = frame.verbRootId ? roots.find(r=>r.id===frame.verbRootId) : null;
  if(clause==='existential'){
    const copR = verbRoot || null; if(copR){ parts.push(conjFinite(copR, {form:'se',subjV:'e'}, frame.tense, {prog:false,hab:frame.hab,neg:frame.neg}, true, buildFinite, withProgressive, withHabitual, withNegation)); }
    if(frame.objects[0]){ const n = ns.find(n=>n.id===frame.objects[0]); if(n) parts.push(n.word); }
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

  if (opts?.flags?.enableCoordination ?? true){
    const splitPoints: Array<{ idx:number; type:'AND'|'OR'|'NOR'|'BUT' }> = [];
    for (let i=0;i<words.length;i++){
      const w = words[i];
      if (w==='and') splitPoints.push({ idx:i, type:'AND' });
      else if (w==='or') splitPoints.push({ idx:i, type:'OR' });
      else if (w==='nor') splitPoints.push({ idx:i, type:'NOR' });
      else if (w==='but') splitPoints.push({ idx:i, type:'BUT' });
    }
    if (splitPoints.length){
      const spans: Array<{ start:number; end:number; type?: 'AND'|'OR'|'NOR'|'BUT' }> = [];
      let start = 0;
      for (const s of splitPoints){ spans.push({ start, end: s.idx, type: s.type }); start = s.idx+1; }
      spans.push({ start, end: tokens.length });
      // Translate each segment with coordination disabled to avoid re-splitting
      const segs = spans.map(sp => {
        const segTokens = tokens.slice(sp.start, sp.end);
        const inputSeg = segTokens.map(t=>t.text).join(' ');
        return { out: translate(inputSeg, roots, nouns, { ...opts, flags: { ...(opts?.flags||{}), enableCoordination: false } }), type: sp.type };
      });
      // Subject elision on the right based on the first segment's subject
      const subjForm = (s: string|undefined)=> s==='I'?'ɪ':s==='we'?'tɪ':s==='you'?'su':s==='they'?'te':'se';
      const lFrame = (segs[0].out.analysis?.frame as unknown) as { subject?: string } | undefined;
      const baseSubj = subjForm(lFrame?.subject);
      const pieces: string[] = [];
      pieces.push(segs[0].out.surface);
      for (let i=1;i<segs.length;i++){
        const join = coords[segs[i-1].type || 'AND'];
        let surf = segs[i].out.surface;
        if (baseSubj && (surf===baseSubj || surf.startsWith(baseSubj+' '))){ surf = surf.slice(baseSubj.length).trimStart(); }
        pieces.push(join, surf);
      }
      surface = pieces.join(' ');
    }
  }

  return { surface, variants, analysis, warnings };
}
