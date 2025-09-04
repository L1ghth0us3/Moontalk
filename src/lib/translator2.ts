import type { Root, Noun } from "../types";
import { buildFinite, withHabitual, withNegation, withProgressive } from "./morphology";

export type T2SemanticFrame = {
  subject: "I"|"you"|"he"|"she"|"we"|"they";
  verbRootId: string | null;
  tense: "present" | "past" | "future";
  neg: boolean; prog: boolean; hab: boolean; question: boolean;
  objects: string[]; // noun IDs
  particles: string[]; // mapped codes: ri/ith/ʌs/la
};
export type T2Result = {
  surface: string;
  variants: string[];
  analysis: Record<string, unknown>;
  warnings: string[];
};

function norm(s: string){ return s.toLowerCase().trim(); }
function isWordChar(ch: string){ return /[A-Za-z0-9]/.test(ch); }
function tokenize(s: string){
  const out: { text:string; start:number; end:number }[] = [];
  let i=0; const n=s.length;
  while(i<n){
    const ch=s[i];
    if (ch==='?'){ out.push({text:'?',start:i,end:i+1}); i++; continue; }
    if (!isWordChar(ch)&&ch!==' '){ i++; continue; }
    if (ch===' '){ i++; continue; }
    const st=i; while(i<n && isWordChar(s[i])) i++; const ed=i;
    const w = s.slice(st,ed).toLowerCase(); if (w==='a'||w==='an'||w==='the') continue; out.push({text:w,start:st,end:ed});
  }
  return out;
}
function edit1(a:string,b:string){ if(a===b)return true; const la=a.length,lb=b.length; if(Math.abs(la-lb)>1)return false; let i=0,j=0,d=0; while(i<la&&j<lb){ if(a[i]===b[j]){i++;j++;continue;} if(++d>1)return false; if(la>lb)i++; else if(lb>la)j++; else {i++;j++;} } return d+(la-i)+(lb-j)<=1; }
function splitItems(s:string){ return (s||'').split(/[;,]/).map(x=>norm(x)).filter(Boolean); }
function stemVerb(w:string){
  if (w.endsWith('ing') && w.length>4) return w.slice(0,-3);
  if (w.endsWith('ed') && w.length>3) return w.slice(0,-2);
  if (w.endsWith('s') && w.length>3 && !w.endsWith('ss')) return w.slice(0,-1);
  return w;
}

export function translate(input: string, roots: Root[], nouns: Noun[]): T2Result {
  // Lex maps
  const verbs = roots.map(r=>({ id:r.id,c1:r.c1,c2:r.c2,c3:r.c3,gloss:r.gloss||'',synonyms:(r.synonyms||[]) as string[] }));
  const ns = nouns.map(n=>({ id:n.id, word:n.word, gloss:n.gloss||'', synonyms:(n.synonyms||[]) as string[] }));

  const PREP: Record<string,string> = { with:'ri', to:'ith', from:'ʌs', in:'la', at:'la' };
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
      const exact = verbs.find(v=> splitItems(v.gloss).includes(two) || v.synonyms.map(norm).includes(norm(two)) );
      if(exact){ verb=exact; resLog.push(`verb '${two}' → '${exact.c1}${exact.c2}${exact.c3}' via phrase-exact`); break; }
    }
    const base = norm(stemVerb(w));
    // synonyms exact
    let hit = verbs.find(v=> v.synonyms.map(norm).includes(base) );
    if(hit){ verb=hit; resLog.push(`verb '${w}' → '${hit.c1}${hit.c2}${hit.c3}' via synonym-exact`); break; }
    // gloss exact
    hit = verbs.find(v=> splitItems(v.gloss).includes(base) );
    if(hit){ verb=hit; resLog.push(`verb '${w}' → '${hit.c1}${hit.c2}${hit.c3}' via gloss-exact`); break; }
    // fuzzy — restrict to reasonably long tokens to avoid short collisions
    if (base.length >= 5) {
      hit = verbs.find(v=> v.synonyms.map(norm).some(s=>edit1(base,s)) ) || verbs.find(v=> splitItems(v.gloss).some(s=>edit1(base,s)) );
    } else {
      hit = undefined;
    }
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
        const exact = verbs.find(v=> splitItems(v.gloss).includes(two) || v.synonyms.map(norm).includes(norm(two)) );
        if (exact && exact.id === verb.id){ matchedVerbStart = i; matchedVerbSpan = 2; break; }
      }
      const base = norm(stemVerb(w));
      let hit = verbs.find(v=> v.synonyms.map(norm).includes(base) ) || verbs.find(v=> splitItems(v.gloss).includes(base));
      if (!hit && base.length>=5){
        hit = verbs.find(v=> v.synonyms.map(norm).some(s=>edit1(base,s)) ) || verbs.find(v=> splitItems(v.gloss).some(s=>edit1(base,s)) );
      }
      if (hit && hit.id === verb.id){ matchedVerbStart = i; matchedVerbSpan = 1; break; }
    }
  }

  for(let i=0;i<tokens.length;i++){
    const w=tokens[i].text; if(w==='?'||PRON.has(w)||SPECIAL.has(w)||PREP[w]||isBe(w)) continue;
    if (matchedVerbStart >= 0 && i >= matchedVerbStart && i < matchedVerbStart + matchedVerbSpan) continue;
    const prev=i>0?tokens[i-1].text:''; if(prev && PREP[prev]) continue;
    const base1 = norm(w.endsWith('s')&&w.length>3&&!w.endsWith('ss')? w.slice(0,-1): w);
    // prefer exact word
    let n = ns.find(n=> norm(n.word)===base1 );
    if(!n){
      // synonyms/gloss exact
      n = ns.find(n=> (n.synonyms||[]).map(norm).includes(base1) ) || ns.find(n=> splitItems(n.gloss).includes(base1) );
    }
    if(!n){
      // fuzzy — restrict to reasonably long tokens to avoid short collisions (e.g., sit↔shit, move↔love, cave↔crave)
      if (base1.length >= 5){
        n = ns.find(n=> edit1(base1, norm(n.word)) ) || ns.find(n=> (n.synonyms||[]).map(norm).some(s=>edit1(base1,s)) ) || ns.find(n=> splitItems(n.gloss).some(s=>edit1(base1,s)) );
      }
      if(n) resLog.push(`noun '${w}' → '${n.word}' via fuzzy(≤1)`);
    }
    if(n) frame.objects.push(n.id);
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
  const parts: string[] = [];
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
    // basic preps: in token order
    for(const k of Object.keys(PREP)){
      if(!words.includes(k)) continue;
      const idx = words.indexOf(k);
      const w2 = words[idx+1]; if(!w2) continue;
      const n = ns.find(n=> norm(n.word)===norm(w2) ) || ns.find(n=> splitItems(n.gloss).includes(norm(w2)) );
      if(n){ parts.push(PREP[k]); parts.push(n.word); }
    }
  }
  if(frame.question) parts.push('qa?');

  const analysis = { frame, intake: { input, tokens, tokensFlat: tokens.map(t=>t.text) }, clause, resolutionLog: resLog };
  const warnings: string[] = [];
  if(!frame.verbRootId) warnings.push('Unknown verb');
  return { surface: parts.join(' ').trim(), variants, analysis, warnings };
}
