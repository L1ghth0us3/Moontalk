import type { Root, Noun } from "../../types";
import type { T2SemanticFrame } from "./types";
import { tokenize } from "./tokens";
import { findVerbByPhrase, findVerbByTokenDetailed, findNounByTokensDetailed, type LexVerb, type LexNoun } from "./match";

export function buildFrameFromTokens(input: string, roots: Root[], nouns: Noun[], PREP: Record<string,string>){
  const tokens = tokenize(input||'');
  const words = tokens.map(t=>t.text);

  const SPECIAL = new Set(['will','did','not','never','there','used']);
  const PRON = new Set(['i','you','he','she','we','they']);
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
  for(let i=0;i<tokens.length;i++){ if(tokens[i].text==='used' && tokens[i+1]?.text==='to'){ frame.hab=true; break; } }
  for(const k of Object.keys(PREP)){ if(words.includes(k)) frame.particles.push(PREP[k]); }

  // copula strictly k–r–n
  const cop = roots.find(r => (r.c1||'').toLowerCase()==='k' && (r.c2||'').toLowerCase()==='r' && (r.c3||'').toLowerCase()==='n') || null;
  const isBe = (w:string)=> ['be','am','is','are','was','were','been','being'].includes(w);

  // Lex views
  const verbsLex: LexVerb[] = roots.map(r=>({ id:r.id, c1:r.c1, c2:r.c2, c3:r.c3, gloss:r.gloss||'', synonyms:(r.synonyms||[]) as string[] }));
  const nounsLex: LexNoun[] = nouns.map(n=>({ id:n.id, word:n.word, gloss:n.gloss||'', synonyms:(n.synonyms||[]) as string[] }));

  // verb match
  let verb: { id:string } | null = null;
  for(let i=0;i<tokens.length;i++){
    const w=tokens[i].text; if(w==='?'||PRON.has(w)||SPECIAL.has(w)||PREP[w]||isBe(w)) continue;
    const two = tokens[i+1]?.text ? `${w} ${tokens[i+1].text}` : '';
    if(two){
      const exact = findVerbByPhrase(verbsLex, two);
      if(exact){ verb=exact; resLog.push(`verb:phrase '${two}' -> root '${exact.c1}${exact.c2}${exact.c3}' via phrase-exact`); break; }
    }
    const det = findVerbByTokenDetailed(verbsLex, w, true);
    if(det.verb){ verb=det.verb; const via = det.via!; resLog.push(`verb:token '${w}' -> root '${det.verb.c1}${det.verb.c2}${det.verb.c3}' via ${via}`); break; }
  }

  // objects (skip nouns governed by preps; avoid reusing verb span)
  let matchedVerbStart = -1; let matchedVerbSpan = 0;
  if (verb){
    for (let i=0;i<tokens.length;i++){
      const w=tokens[i].text; if(w==='?'||PRON.has(w)||SPECIAL.has(w)||PREP[w]||isBe(w)) continue;
      const two = tokens[i+1]?.text ? `${w} ${tokens[i+1].text}` : '';
      if (two){ const exact = findVerbByPhrase(verbsLex, two); if (exact && exact.id===verb.id){ matchedVerbStart=i; matchedVerbSpan=2; break; } }
      const hit = findVerbByTokenDetailed(verbsLex, w, true).verb;
      if (hit && hit.id===verb.id){ matchedVerbStart=i; matchedVerbSpan=1; break; }
    }
  }
  for(let i=0;i<tokens.length;i++){
    const w=tokens[i].text; if(w==='?'||PRON.has(w)||SPECIAL.has(w)||PREP[w]||isBe(w)) continue;
    if (matchedVerbStart >= 0 && i >= matchedVerbStart && i < matchedVerbStart + matchedVerbSpan) continue;
    const prev=i>0?tokens[i-1].text:''; if(prev && PREP[prev]) continue;
    const mn = findNounByTokensDetailed(nounsLex, w, tokens[i+1]?.text);
    if (mn.noun){
      frame.objects.push(mn.noun.id);
      const via = mn.via!;
      const surface = mn.noun.word;
      const src = (mn.span===2 && tokens[i+1]) ? `${w} ${tokens[i+1].text}` : w;
      resLog.push(`noun:${mn.span===2?'phrase':'token'} '${src}' -> word '${surface}' via ${via}`);
      if (mn.span===2) i++;
    }
  }

  const clause: 'copular'|'existential'|'transitive' = words[0]==='there' ? 'existential' : (!verb && frame.objects.length>0 ? 'copular' : 'transitive');
  frame.verbRootId = (clause==='copular'||clause==='existential') ? (cop?.id || null) : (verb?.id || null);

  return { frame, clause, tokens, words, resolutionLog: resLog };
}
