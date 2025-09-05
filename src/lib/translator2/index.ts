import type { Root, Noun } from "../../types";
import { buildFinite, withHabitual, withNegation, withProgressive } from "../morphology";
import type { T2SemanticFrame, T2Options, T2Result } from "./types";
import { buildFrameFromTokens } from "./frames";
import { hsSubjectFor, conjFinite } from "./realize";
import { findNounByTokens, findNounByTokensDetailed, findVerbByTokenDetailed, type LexVerb } from "./match";

export type { T2SemanticFrame, T2Options, T2Result };

export function translate(input: string, roots: Root[], nouns: Noun[], opts?: T2Options): T2Result {
  const ns = nouns.map(n=>({ id:n.id, word:n.word, gloss:n.gloss||'', synonyms:(n.synonyms||[]) as string[] }));
  const vs: LexVerb[] = roots.map(r=>({ id:r.id, c1:r.c1, c2:r.c2, c3:r.c3, gloss:r.gloss||'', synonyms:(r.synonyms||[]) as string[] }));

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
  const wordAt = (i:number)=> tokens[i]?.text;

  const parts: string[] = [] as string[];
  const variants: string[] = [];
  const sj = hsSubjectFor(frame.subject);
  const verbRoot = frame.verbRootId ? roots.find(r=>r.id===frame.verbRootId) : null;

  // Helper: collect NP lists after an index, returning ids + type + end index.
  const collectNounList = (startIdx: number): { ids: string[]; type: 'AND'|'OR'|'NOR'|'BUT'; end: number } | null => {
    let i = startIdx; const ids: string[] = [];
    let either=false, neither=false, notOnly=false; let type: 'AND'|'OR'|'NOR'|'BUT' = 'AND';
    const readOne = (): boolean => {
      const w1 = wordAt(i); if(!w1) return false;
      const hit = findNounByTokens(ns, w1, wordAt(i+1));
      if (hit.noun){ ids.push(hit.noun.id); i += hit.span; return true; }
      return false;
    };
    // allow leading markers (either/neither/not only)
    while (true){ const w = wordAt(i); const w2 = wordAt(i+1);
      if (w==='either'){ either=true; i++; continue; }
      if (w==='neither'){ neither=true; i++; continue; }
      if (w==='not' && w2==='only'){ notOnly=true; i+=2; continue; }
      break;
    }
    if (!readOne()) return null;
    // read coordinator and next item(s)
    while(true){
      const w = wordAt(i);
      if (w==='and' || w==='or' || w==='nor' || w==='but' || (w==='as' && wordAt(i+1)==='well' && wordAt(i+2)==='as') || w==='plus'){
        if (w==='and' || w==='plus' || (w==='as' && wordAt(i+1)==='well' && wordAt(i+2)==='as')){ type = 'AND'; i += (w==='as'?3:1); }
        else if (w==='or'){ type = either ? 'OR' : 'OR'; i++; }
        else if (w==='nor'){ type = neither ? 'NOR' : 'NOR'; i++; }
        else if (w==='but'){ type = notOnly ? 'BUT' : 'BUT'; i++; }
        // optional 'also' after but
        if (wordAt(i)==='also') i++;
        // next item required
        if (!readOne()) break;
        continue;
      }
      break;
    }
    return { ids, type, end: i };
  };

  // Analysis: particle→noun pairs discovered from the intake tokens
  const analysisPairs: Array<{ part: string; nounId: string; noun?: string; en: string }> = [];
  {
    const seen = new Set<string>();
    for (let i=0;i<tokens.length;i++){
      const w = tokens[i].text;
      const part = PREP[w];
      if (!part) continue;
      const lst = collectNounList(i+1);
      if (lst && lst.ids.length>0){
        for (const id of lst.ids){
          const key = `${part}:${id}`; if (seen.has(key)) continue; seen.add(key);
          const noun = ns.find(n=>n.id===id)?.word;
          analysisPairs.push({ part, nounId: id, noun, en: w });
        }
        i = lst.end - 1;
        continue;
      }
      const found = findNounByTokens(ns, wordAt(i+1)||'', wordAt(i+2));
      if (found.noun){
        const key = `${part}:${found.noun.id}`; if (!seen.has(key)){
          seen.add(key);
          analysisPairs.push({ part, nounId: found.noun.id, noun: found.noun.word, en: w });
        }
      }
    }
  }
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
    // Direct object — support NP lists (A and B / either A or B / neither A nor B / not only A but B)
    const pushJoined = (ids: string[], join: 'AND'|'OR'|'NOR'|'BUT') => {
      const j = coords[join] || coords.AND;
      ids.forEach((id, idx) => { const w = ns.find(n=>n.id===id)?.word; if(!w) return; if(idx>0) parts.push(j); parts.push(w); });
    };

    if(frame.objects[0]){
      // find the first occurrence of the base object in token stream and attempt list collection
      let handledObj = false;
      for (let i=0;i<tokens.length;i++){
        const w = tokens[i]?.text; if(!w) continue;
        // skip prepositional nouns
        const prev = tokens[i-1]?.text; if (prev && PREP[prev]) continue;
        const found = findNounByTokens(ns, w, tokens[i+1]?.text);
        if (found.noun && found.noun.id===frame.objects[0]){
          const lst = collectNounList(i);
          if (lst && lst.ids.length>=2){ pushJoined(lst.ids, lst.type); handledObj = true; }
          break;
        }
      }
      if (!handledObj){ const n = ns.find(n=>n.id===frame.objects[0]); if(n) parts.push(n.word); }
    }
    for (let i=0;i<tokens.length;i++){
      const w = tokens[i].text;
      const part = PREP[w];
      if (!part) continue;
      // Support NP lists after a preposition
      const lst = collectNounList(i+1);
      if (lst && lst.ids.length>=1){
        parts.push(part);
        if (lst.ids.length>=2) {
          // analysis pairs already captured; emit joined nouns for surface
          pushJoined(lst.ids, lst.type);
        } else {
          const wId = lst.ids[0]; const w = ns.find(n=>n.id===wId)?.word; if (w) parts.push(w);
        }
        i = lst.end-1; continue;
      }
      const w2 = tokens[i+1]?.text; if (!w2) continue;
      const found = findNounByTokens(ns, w2, tokens[i+2]?.text);
      const n = found.noun;
      if(n){ parts.push(part); parts.push(n.word); }
    }
  }
  if(frame.question) parts.push('qa?');

  let surface = parts.join(' ').trim();
  const resLogExtended = [...built.resolutionLog];
  if (analysisPairs.length){
    for (const p of analysisPairs){
      const nounW = ns.find(n=>n.id===p.nounId)?.word || p.noun || p.nounId;
      resLogExtended.push(`particle '${p.en}' -> '${p.part}' with noun '${nounW}'`);
    }
  }
  // Unknown tokens (skip helpers, preps, pronouns, be-forms, and coordinators)
  const unknownTokens: string[] = (() => {
    const unk: string[] = [];
    const SPECIAL = new Set([ 'will','did','not','never','there','used' ]);
    const PRON = new Set(['i','you','he','she','we','they']);
    const COORD_BASE = new Set(['and','or','nor','but','plus']);
    const COORD_AUX = new Set(['either','neither','not','only','as','well','also']);
    const beSet = new Set(["be","am","is","are","was","were","been","being"]);
    const isBe = (w: string) => beSet.has(w);
    for (let i=0;i<tokens.length;i++){
      const w = tokens[i].text;
      if (w==='?') continue;
      if (PREP[w]) continue;
      if (SPECIAL.has(w) || PRON.has(w) || COORD_BASE.has(w) || COORD_AUX.has(w) || isBe(w)) continue;
      // known verb?
      const vHit = findVerbByTokenDetailed(vs, w, true).verb;
      if (vHit) continue;
      // known noun? prefer phrase first
      const w2 = tokens[i+1]?.text;
      const n2 = findNounByTokensDetailed(ns, w, w2);
      if (n2.noun){ if (n2.span===2) i++; continue; }
      // otherwise unknown
      if (!unk.includes(w)) unk.push(w);
    }
    return unk;
  })();

  const analysis = { frame, intake: { input, tokens, tokensFlat: tokens.map(t=>t.text) }, clause, resolutionLog: resLogExtended, particlePairs: analysisPairs, unknownTokens };
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
