import type { Root, Noun } from "../types";
import { buildFinite, withHabitual, withNegation, withProgressive } from "./morphology";
import type { T2SemanticFrame, T2Options, T2Result } from "./translator2/types";
import { tokenize } from "./translator2/tokens";
import { findVerbByPhrase, findVerbByToken, findNounByTokens } from "./translator2/match";

export type { T2SemanticFrame, T2Options, T2Result };

export function translate(input: string, roots: Root[], nouns: Noun[], opts?: T2Options): T2Result {
  // Lex maps
  const verbs = roots.map(r=>({ id:r.id,c1:r.c1,c2:r.c2,c3:r.c3,gloss:r.gloss||'',synonyms:(r.synonyms||[]) as string[] }));
  const ns = nouns.map(n=>({ id:n.id, word:n.word, gloss:n.gloss||'', synonyms:(n.synonyms||[]) as string[] }));

  const PART_DEF = { WITH:'ri', TO:'ith', FROM:'ʌs', IN_AT:'la' } as const;
  const partMap = { ...PART_DEF, ...(opts?.particles||{}) } as Record<'WITH'|'TO'|'FROM'|'IN_AT', string>;
  const PREP: Record<string,string> = { with:partMap.WITH, to:partMap.TO, from:partMap.FROM, in:partMap.IN_AT, at:partMap.IN_AT };
  const COORD_DEF = { AND:'ʋa', OR:'ra', NOR:'ra', BUT:'ma' } as const;
  const coords = { ...COORD_DEF, ...(opts?.coordinators||{}) } as Record<'AND'|'OR'|'NOR'|'BUT', string>;
  const SPECIAL = new Set(['will','did','not','never','there','used']);
  const PRON = new Set(['i','you','he','she','we','they']);
  const tokens = tokenize(input||'');
  const words = tokens.map(t=>t.text);
  const resLog: string[] = [];

  type LowerSubject = 'i'|'you'|'he'|'she'|'we'|'they';
  const lowerPron = words.find((w): w is LowerSubject => PRON.has(w));
  const pron: T2SemanticFrame['subject'] | undefined = lowerPron ? (lowerPron === 'i' ? 'I' : lowerPron) : undefined;
  const frame: T2SemanticFrame = {
    subject: pron || 'I', verbRootId: null,
    tense: words.includes('will') ? 'future' : (words.includes('did')||words.includes('was')||words.includes('were')) ? 'past' : 'present',
    neg: words.includes('not')||words.includes('never'), prog: words.some(w=>w.endsWith('ing')), hab: false, question: words.includes('?'),
    objects: [], particles: [],
  };
  // habitual
  for(let i=0;i<tokens.length;i++){ if(tokens[i].text==='used' && tokens[i+1]?.text==='to'){ frame.hab=true; break; } }
  // particles present
  for(const k of Object.keys(PREP)){ if(words.includes(k)) frame.particles.push(PREP[k]); }
  // copula
  // Identify copula strictly by signature k–r–n to avoid false positives such as
  // verbs whose gloss contains phrases like "be sorry".
  const cop = roots.find(r => (
    (r.c1||'').toLowerCase() === 'k' && (r.c2||'').toLowerCase() === 'r' && (r.c3||'').toLowerCase() === 'n'
  )) || undefined;
  const isBe = (w:string)=> ['be','am','is','are','was','were','been','being'].includes(w);

  // verb match (phrase then token with fuzzy)
  let verb: typeof verbs[number] | null = null;
  for(let i=0;i<tokens.length;i++){
    const w=tokens[i].text; if(w==='?'||PRON.has(w)||SPECIAL.has(w)||PREP[w]||isBe(w)) continue;
    const two = tokens[i+1]?.text ? `${w} ${tokens[i+1].text}` : '';
    if(two){
      const exact = findVerbByPhrase(verbs, two);
      if(exact){ verb=exact; resLog.push(`verb '${two}' → '${exact.c1}${exact.c2}${exact.c3}' via phrase-exact`); break; }
    }
    const hit = findVerbByToken(verbs, w, true);
    if(hit){ verb=hit; resLog.push(`verb '${w}' → '${hit.c1}${hit.c2}${hit.c3}' via fuzzy(≤1)`); break; }
  }
  // objects (skip nouns governed by preps)
  // Track consumed span for the matched verb to avoid reusing its tokens as nouns
  let matchedVerbStart = -1;
  let matchedVerbSpan = 0;
  if (verb){
    // Recompute start/span for clarity (phrase-first rules mirrored)
    for (let i=0;i<tokens.length;i++){
      const w = tokens[i].text;
      if (w==='?'||PRON.has(w)||SPECIAL.has(w)||PREP[w]||isBe(w)) continue;
      const two = tokens[i+1]?.text ? `${w} ${tokens[i+1].text}` : '';
      if (two){
        const exact = findVerbByPhrase(verbs, two);
        if (exact && exact.id === verb.id){ matchedVerbStart = i; matchedVerbSpan = 2; break; }
      }
      const hit = findVerbByToken(verbs, w, true);
      if (hit && hit.id === verb.id){ matchedVerbStart = i; matchedVerbSpan = 1; break; }
    }
  }

  for(let i=0;i<tokens.length;i++){
    const w=tokens[i].text; if(w==='?'||PRON.has(w)||SPECIAL.has(w)||PREP[w]||isBe(w)) continue;
    if (matchedVerbStart >= 0 && i >= matchedVerbStart && i < matchedVerbStart + matchedVerbSpan) continue;
    const prev=i>0?tokens[i-1].text:''; if(prev && PREP[prev]) continue;
    const mn = findNounByTokens(ns, w, tokens[i+1]?.text);
    if (mn.noun){ frame.objects.push(mn.noun.id); if (mn.span===2) i++; }
  }
  // clause and verb id
  const clause: 'copular'|'existential'|'transitive' = words[0]==='there' ? 'existential' : (!verb && frame.objects.length>0 ? 'copular' : 'transitive');
  frame.verbRootId = (clause==='copular'||clause==='existential') ? (cop?.id || null) : (verb?.id || null);

  // generate
  const subj = (s: T2SemanticFrame['subject']) => s==='I'?{form:'ɪ',v:'ɪ'}:s==='we'?{form:'tɪ',v:'ɪ'}:s==='you'?{form:'su',v:'u'}:s==='they'?{form:'te',v:'e'}:{form:'se',v:'e'};
  const tenseV = (t: T2SemanticFrame['tense']) => t==='present'?'a':t==='past'?'e':'ʌ';
  const conj = (r: Root, sj: ReturnType<typeof subj>, t:T2SemanticFrame['tense'], flags:{prog:boolean;hab:boolean;neg:boolean}, ignoreProg=false) => {
    let v = buildFinite(r, sj.v, tenseV(t));
    if(!ignoreProg && flags.prog) v = withProgressive(v, r);
    if(flags.hab) v = withHabitual(v);
    if(flags.neg) v = withNegation(v);
    return v;
  };
  const parts: string[] = [] as string[];
  const variants: string[] = [];
  const sj = subj(frame.subject);
  const verbRoot = frame.verbRootId ? roots.find(r=>r.id===frame.verbRootId) : null;
  if(clause==='existential'){
    const copR = cop || verbRoot || null; if(copR){ parts.push(conj(copR, {form:'se',v:'e'}, frame.tense, {prog:false,hab:frame.hab,neg:frame.neg}, true)); }
    if(frame.objects[0]){ const n = ns.find(n=>n.id===frame.objects[0]); if(n) parts.push(n.word); }
    // crude place pairing: if another object exists, attach la to it
    if(frame.objects[1]){ const n = ns.find(n=>n.id===frame.objects[1]); if(n){ parts.push('la'); parts.push(n.word); } }
  } else if (clause==='copular'){
    const zero = frame.tense==='present' && !frame.neg;
    if(!zero) parts.push(sj.form);
    const copR = cop || verbRoot; if(!zero && copR) parts.push(conj(copR, sj, frame.tense, {prog:false,hab:frame.hab,neg:frame.neg}, true));
    if(frame.objects[0]){ const n = ns.find(n=>n.id===frame.objects[0]); if(n) parts.push(n.word); }
    if(zero && copR){ const n = frame.objects[0]? ns.find(n=>n.id===frame.objects[0])?.word : undefined; variants.push([sj.form, copR?conj(copR, sj, frame.tense, {prog:false,hab:frame.hab,neg:frame.neg}, true):'', n||''].filter(Boolean).join(' ')); parts.length=0; parts.push(sj.form); if(n) parts.push(n); }
  } else {
    if(sj.form) parts.push(sj.form);
    if(verbRoot) parts.push(conj(verbRoot, sj, frame.tense, {prog:frame.prog,hab:frame.hab,neg:frame.neg}));
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
  const analysis = { frame, intake: { input, tokens, tokensFlat: tokens.map(t=>t.text) }, clause, resolutionLog: resLog };
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
