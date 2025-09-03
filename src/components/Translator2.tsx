import { useMemo, useState } from "react";
import type { Root, Noun } from "../types";
import { buildFinite, withHabitual, withNegation, withProgressive } from "../lib/morphology";
import { useLocalStorageState, LS_KEYS } from "../lib/storage";

// Experimental Translator 2.0 — internal contracts
// These types are local to this module (no external deps).
export type LexiconEntryVerb = {
  id: string;
  c1: string; c2: string; c3: string;
  gloss: string;
  synonyms: string[];
};
export type LexiconEntryNoun = {
  id: string;
  word: string;
  gloss: string;
  synonyms: string[];
};

export type SemanticFrame = {
  subject: string; // e.g., "I", "you", "he", "she", "we", "you(pl)", "they"
  verbRootId: string | null;
  tense: "present" | "past" | "future";
  neg: boolean;
  prog: boolean;
  hab: boolean;
  question: boolean;
  objects: string[]; // noun IDs
  particles: string[]; // e.g., ["with","to","from","in"]
};

export type Result = {
  surface: string;
  variants: string[];
  analysis: Record<string, unknown>;
  warnings: string[];
};

export default function Translator2({ roots, nouns, onCreateNoun, onCreateRoot }: { roots: Root[]; nouns: Noun[]; onCreateNoun?: (n: { word: string; gloss?: string; synonyms?: string[] })=>void; onCreateRoot?: (r: { c1: string; c2: string; c3: string; gloss?: string; synonyms?: string[] })=>void; }){
  // Map app data into local lexicon entries (decoupled contract)
  const verbsLex: LexiconEntryVerb[] = useMemo(() => roots.map(r => ({
    id: r.id, c1: r.c1, c2: r.c2, c3: r.c3,
    gloss: r.gloss || "",
    synonyms: Array.isArray(r.synonyms) ? r.synonyms : [],
  })), [roots]);
  const nounsLex: LexiconEntryNoun[] = useMemo(() => nouns.map(n => ({
    id: n.id, word: n.word,
    gloss: n.gloss || "",
    synonyms: Array.isArray(n.synonyms) ? n.synonyms : [],
  })), [nouns]);

  // Persistent UI state for the frame + input
  const [ui, setUi] = useLocalStorageState(LS_KEYS.translator2UI, {
    subject: "I" as "I"|"you"|"he"|"she"|"we"|"they",
    verbRootId: verbsLex[0]?.id ?? null as string | null,
    tense: "present" as "present"|"past"|"future",
    neg: false, prog: false, hab: false, question: false,
    objPick: nounsLex[0]?.id ?? "",
    objects: [] as string[],
    particles: [] as string[],
    englishInput: ""
  });
  const subject = ui.subject; const setSubject = (v: any)=>setUi(s=>({...s, subject:v}));
  const verbRootId = ui.verbRootId; const setVerbRootId = (v: any)=>setUi(s=>({...s, verbRootId:v}));
  const tense = ui.tense; const setTense = (v: any)=>setUi(s=>({...s, tense:v}));
  const neg = ui.neg; const setNeg = (v: boolean)=>setUi(s=>({...s, neg:v}));
  const prog = ui.prog; const setProg = (v: boolean)=>setUi(s=>({...s, prog:v}));
  const hab = ui.hab; const setHab = (v: boolean)=>setUi(s=>({...s, hab:v}));
  const question = ui.question; const setQuestion = (v: boolean)=>setUi(s=>({...s, question:v}));
  const objPick = ui.objPick; const setObjPick = (v: string)=>setUi(s=>({...s, objPick:v}));
  const objects = ui.objects; const setObjects = (fn: (prev:string[])=>string[])=>setUi(s=>({...s, objects: fn(s.objects)}));
  const particles = ui.particles; const setParticles = (fn: (prev:string[])=>string[])=>setUi(s=>({...s, particles: fn(s.particles)}));

  const [result, setResult] = useState<Result | null>(null);
  const [history, setHistory] = useLocalStorageState<{id:string; input:string; surface:string; at:number}[]>(LS_KEYS.translator2History, []);
  const [faves, setFaves] = useLocalStorageState<{id:string; input:string; surface:string; at:number}[]>(LS_KEYS.translator2Faves, []);
  const [tests, setTests] = useState<null | { name: string; pass: boolean; expected: string; got: string; note?: string; lex?: string }[]>(null);
  const [testsOpen, setTestsOpen] = useState(false);
  const [showJSON, setShowJSON] = useState(false);

  // ===== English intake (normalizer + tokenizer) =====
  type IntakeToken = { text: string; start: number; end: number };
  const englishInput = ui.englishInput; const setEnglishInput = (v: string)=>setUi(s=>({...s, englishInput:v}));

  function isWordChar(ch: string){ return /[A-Za-z0-9]/.test(ch); }
  const ARTICLES = new Set(["a","an","the"]);
  function normalizeAndTokenize(raw: string): IntakeToken[] {
    const tokens: IntakeToken[] = [];
    const s = raw;
    const n = s.length;
    let i = 0;
    while (i < n){
      const ch = s[i];
      // Keep question mark as its own token
      if (ch === '?') {
        tokens.push({ text: '?', start: i, end: i+1 });
        i += 1; continue;
      }
      // Skip punctuation/quotes (strip)
      if (!isWordChar(ch) && ch !== ' '){ i += 1; continue; }
      // Skip/collapse spaces
      if (ch === ' '){ i += 1; continue; }
      // Consume a word
      const start = i;
      while (i < n && isWordChar(s[i])) i += 1;
      const end = i;
      const word = s.slice(start, end).toLowerCase();
      // Remove articles only when standalone (safe by construction)
      if (ARTICLES.has(word)) { continue; }
      tokens.push({ text: word, start, end });
    }
    return tokens;
  }

  function detectPronoun(tokens: IntakeToken[]): "I"|"you"|"he"|"she"|"we"|"they"|null {
    for (const t of tokens){
      switch (t.text){
        case 'i': return 'I';
        case 'you': return 'you';
        case 'he': return 'he';
        case 'she': return 'she';
        case 'we': return 'we';
        case 'they': return 'they';
      }
    }
    return null;
  }
  function lemmatizeBe(w: string): string {
    const be = new Set(["be","am","is","are","was","were","been","being"]);
    return be.has(w) ? "be" : w;
  }
  function stripPlural(w: string): string {
    // Very naive plural strip: trim trailing s except obvious double-s; keep short words
    if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
    return w;
  }

  const intakeTokens = useMemo(() => normalizeAndTokenize(englishInput), [englishInput]);
  const intakePronoun = useMemo(() => detectPronoun(intakeTokens), [intakeTokens]);
  const bePositions = useMemo(() => intakeTokens
    .map((t, idx) => ({ idx, token: t }))
    .filter(x => lemmatizeBe(x.token.text) === 'be')
    .map(x => x.idx), [intakeTokens]);
  // Shared constants/helpers for intake + generator
  const PREP_TO_PARTICLE: Record<string, string> = { with: 'ri', to: 'ith', from: 'ʌs', in: 'la', at: 'la' };
  const SPECIAL = new Set([ 'will','did','not','never','there','used' ]);
  const PREPS = new Set(Object.keys(PREP_TO_PARTICLE));
  const PRONOUNS = new Set(['i','you','he','she','we','they']);
  const isBe = (w: string) => lemmatizeBe(w) === 'be';
  // Coordinator words/phrases (normalize to canonical types)
  const COORD_BASE = new Set(['and','or','nor','but','plus']);
  const COORD_AUX = new Set(['either','neither','not','only','as','well','also']); // helpers for multiword patterns
  const unknownTokens = useMemo(() => {
    const unk: string[] = [];
    for (let i=0;i<intakeTokens.length;i++){
      const w = intakeTokens[i].text;
      if (w==='?' || PREPS.has(w) || SPECIAL.has(w) || PRONOUNS.has(w) || isBe(w) || COORD_BASE.has(w) || COORD_AUX.has(w)) continue;
      const next = intakeTokens[i+1]?.text;
      // Try verbs (one token) and nouns (two-token phrase first)
      const v = matchVerbByToken(w);
      const n2 = next ? matchNounByToken(w, next, englishInput) : { noun: null, span: 1 };
      const n1 = matchNounByToken(w, undefined, englishInput);
      const isKnown = !!v || !!n2.noun || !!n1.noun;
      if (!isKnown && !unk.includes(w)) unk.push(w);
      if (n2.noun) i++; // skip consumed phrase
    }
    return unk;
  }, [intakeTokens, englishInput]);

  // Detect coordination lists for NP and VP (supports either/or, neither/nor, not only/but, as well as, plus)
  type CoordType = 'AND'|'OR'|'NOR'|'BUT';
  function detectCoordination(tokens: IntakeToken[]): { lists: { type: CoordType; role: 'NP'|'VP'; items: Array<{ text: string; nounId?: string; verbId?: string }> }[]; markers: string[] }{
    const markersSet = new Set<string>();
    const lists: { type: CoordType; role: 'NP'|'VP'; items: Array<{ text: string; nounId?: string; verbId?: string }> }[] = [];
    function collect(role: 'NP'|'VP'){
      let pending: Array<{ text: string; nounId?: string; verbId?: string }> = [];
      let pendingType: CoordType | null = null;
      let eitherSeen = false, neitherSeen = false, notOnlySeen = false;
      for (let i=0;i<tokens.length;i++){
        const w = tokens[i].text;
        const next = tokens[i+1]?.text;
        // multiword helpers
        if (w === 'either') eitherSeen = true;
        if (w === 'neither') neitherSeen = true;
        if (w === 'not' && next === 'only') { notOnlySeen = true; i++; continue; }
        if (w === 'as' && next === 'well' && tokens[i+2]?.text === 'as') { markersSet.add('as well as'); pendingType = 'AND'; i+=2; continue; }
        if (w === 'plus') { markersSet.add('plus'); pendingType = 'AND'; continue; }

        // coordinator heads
        if (w === 'and' || w === 'or' || w === 'nor' || w === 'but'){
          if (w === 'or' && eitherSeen) { pendingType = 'OR'; markersSet.add('either … or'); }
          else if (w === 'nor' && neitherSeen) { pendingType = 'NOR'; markersSet.add('neither … nor'); }
          else if (w === 'but' && notOnlySeen) { pendingType = 'BUT'; markersSet.add('not only … but (also)'); }
          else if (w === 'and') { pendingType = 'AND'; markersSet.add('and'); }
          else if (w === 'or') { pendingType = 'OR'; markersSet.add('or'); }
          else if (w === 'nor') { pendingType = 'NOR'; markersSet.add('nor'); }
          else if (w === 'but') { pendingType = 'BUT'; markersSet.add('but'); }
          continue;
        }

        // skip function words
        if (w==='?' || PREPS.has(w) || SPECIAL.has(w) || PRONOUNS.has(w) || COORD_BASE.has(w) || COORD_AUX.has(w)) continue;

        if (role === 'NP'){
          const m2 = matchNounByToken(w, tokens[i+1]?.text, englishInput);
          const nounHit = m2.noun || matchNounByToken(w, undefined, englishInput).noun;
          if (nounHit){
            pending.push({ text: nounHit.word, nounId: nounHit.id });
            if (m2.noun && m2.span===2) i++;
          }
        } else {
          // VP: try phrase verb then token verb
          const two = tokens[i+1]?.text ? `${w} ${tokens[i+1].text}` : '';
          let vHit: LexiconEntryVerb | null = null;
          if (two){
            const exactPhrase = verbsLex.find(v => splitGlossItems(v.gloss).includes(normPhrase(two)) || (v.synonyms||[]).map(normPhrase).includes(normPhrase(two)));
            if (exactPhrase) { vHit = exactPhrase; }
          }
          if (!vHit) vHit = matchVerbByToken(w);
          if (vHit){
            pending.push({ text: vHit.gloss || `${vHit.c1}${vHit.c2}${vHit.c3}`, verbId: vHit.id });
            if (two && vHit && (splitGlossItems(vHit.gloss).includes(normPhrase(two)) || (vHit.synonyms||[]).map(normPhrase).includes(normPhrase(two)))) i++;
          }
        }

        if (pendingType && pending.length >= 2){
          lists.push({ type: pendingType, role, items: [...pending] });
          pending = [];
          pendingType = null;
          eitherSeen = neitherSeen = notOnlySeen = false;
        }
      }
    }
    collect('NP');
    collect('VP');
    return { lists, markers: Array.from(markersSet) };
  }

  // ===== Minimal English → SemanticFrame builder =====
  function findCopulaRootId(): string | null {
    // Heuristic: look for a verb whose gloss or synonyms include "be" (or "exist").
    const v = verbsLex.find(v =>
      (v.gloss || "").toLowerCase().includes("be") ||
      (v.gloss || "").toLowerCase().includes("exist") ||
      (v.synonyms || []).some(s => s.toLowerCase() === 'be')
    );
    return v?.id ?? null;
  }
  function headWords(s: string): string[] {
    return (s || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  }
  function normPhrase(s: string){ return s.toLowerCase().replace(/\s+/g,' ').trim(); }
  function splitGlossItems(s: string){ return (s||'').split(/[;,]/).map(x=>x.trim()).filter(Boolean).map(normPhrase); }
  function stemVerbish(w: string): string {
    if (w.endsWith('ing') && w.length > 4) return w.slice(0, -3);
    if (w.endsWith('ed') && w.length > 3) return w.slice(0, -2);
    return w;
  }
  function editDistLeq1(a: string, b: string): boolean {
    if (a === b) return true;
    const la = a.length, lb = b.length;
    if (Math.abs(la - lb) > 1) return false;
    let i=0,j=0,diffs=0;
    while (i<la && j<lb){
      if (a[i] === b[j]){ i++; j++; continue; }
      if (++diffs > 1) return false;
      if (la > lb) i++; // deletion in b
      else if (lb > la) j++; // insertion in b
      else { i++; j++; } // substitution
    }
    // tail chars count as one edit
    return diffs + (la-i) + (lb-j) <= 1;
  }
  // Proper noun preference: noun.word includes uppercase and raw contains exact case substring
  function hasProperCaseHit(raw: string, nounWord: string): boolean {
    if (nounWord.toLowerCase() === nounWord) return false;
    // naive word-boundary-ish check
    const idx = raw.indexOf(nounWord);
    if (idx < 0) return false;
    const before = idx>0 ? raw[idx-1] : ' ';
    const after = idx+nounWord.length < raw.length ? raw[idx+nounWord.length] : ' ';
    const isWord = (ch: string) => /[A-Za-z0-9]/.test(ch);
    return !isWord(before) && !isWord(after);
  }
  // Fuzzy lexeme resolvers with resolution logging
  function matchVerbByToken(w: string, log?: string[]): LexiconEntryVerb | null {
    const base = normPhrase(stemVerbish(w));
    for (const v of verbsLex){
      // synonyms exact (highest priority)
      if ((v.synonyms||[]).map(normPhrase).includes(base)) { log?.push(`verb '${w}' → '${v.c1}${v.c2}${v.c3}' via synonym-exact`); return v; }
      // gloss exact item
      if (splitGlossItems(v.gloss).includes(base)) { log?.push(`verb '${w}' → '${v.c1}${v.c2}${v.c3}' via gloss-exact`); return v; }
    }
    // fuzzy within edit distance 1 against synonyms then gloss items
    for (const v of verbsLex){
      const syns = (v.synonyms||[]).map(normPhrase);
      if (syns.some(s=>editDistLeq1(base, s))) { log?.push(`verb '${w}' → '${v.c1}${v.c2}${v.c3}' via synonym-fuzzy(≤1)`); return v; }
      const items = splitGlossItems(v.gloss);
      if (items.some(s=>editDistLeq1(base, s))) { log?.push(`verb '${w}' → '${v.c1}${v.c2}${v.c3}' via gloss-fuzzy(≤1)`); return v; }
    }
    return null;
  }
  function matchNounByToken(w: string, next?: string, raw?: string, log?: string[]): { noun: LexiconEntryNoun | null; span: number } {
    const base1 = stripPlural(normPhrase(w));
    const base2 = next ? normPhrase(`${w} ${next}`) : '';
    // 1) proper noun preference (exact case hit in raw)
    if (raw){
      for (const n of nounsLex){
        if (hasProperCaseHit(raw, n.word)) { log?.push(`noun prefers proper '${n.word}' via proper-exact in text`); return { noun: n, span: 1 }; }
      }
    }
    // 2) synonyms exact, 2-word then 1-word
    for (const n of nounsLex){ if (next && (n.synonyms||[]).map(normPhrase).includes(base2)) { log?.push(`noun '${base2}' → '${n.word}' via synonym-exact`); return { noun: n, span: 2 }; } }
    for (const n of nounsLex){ if ((n.synonyms||[]).map(normPhrase).includes(base1)) { log?.push(`noun '${w}' → '${n.word}' via synonym-exact`); return { noun: n, span: 1 }; } }
    // 3) gloss exact item match
    for (const n of nounsLex){ if (next && splitGlossItems(n.gloss).includes(base2)) { log?.push(`noun '${base2}' → '${n.word}' via gloss-exact`); return { noun: n, span: 2 }; } }
    for (const n of nounsLex){ if (splitGlossItems(n.gloss).includes(base1)) { log?.push(`noun '${w}' → '${n.word}' via gloss-exact`); return { noun: n, span: 1 }; } }
    // 4) word exact (with plural strip), try 2-word then 1-word
    for (const n of nounsLex){ if (next && normPhrase(n.word) === base2) { log?.push(`noun '${base2}' → '${n.word}' via word-exact`); return { noun: n, span: 2 }; } }
    for (const n of nounsLex){ if (normPhrase(n.word) === base1) { log?.push(`noun '${w}' → '${n.word}' via word-exact`); return { noun: n, span: 1 }; } }
    // 5) fuzzy ≤1 against synonyms/word/gloss
    for (const n of nounsLex){
      const syns = (n.synonyms||[]).map(normPhrase);
      if (syns.some(s=>editDistLeq1(base1, s))) { log?.push(`noun '${w}' → '${n.word}' via synonym-fuzzy(≤1)`); return { noun: n, span: 1 }; }
      const items = splitGlossItems(n.gloss);
      if (items.some(s=>editDistLeq1(base1, s))) { log?.push(`noun '${w}' → '${n.word}' via gloss-fuzzy(≤1)`); return { noun: n, span: 1 }; }
      if (editDistLeq1(base1, normPhrase(n.word))) { log?.push(`noun '${w}' → '${n.word}' via word-fuzzy(≤1)`); return { noun: n, span: 1 }; }
    }
    return { noun: null, span: 1 };
  }
  // (constants moved above unknownTokens to avoid TDZ issues)

  function buildFrameFromEnglish(tokens: IntakeToken[]): { frame: SemanticFrame; warnings: string[]; clauseType: 'copular'|'existential'|'transitive', resolutionLog: string[] }{
    const words = tokens.map(t=>t.text);
    const hasQ = words.includes('?');
    const pron = detectPronoun(tokens);
    const subj = pron ?? subject; // fall back to UI subject if unknown
    const negFlag = words.includes('not') || words.includes('never');
    const progFlag = words.some(w => w.endsWith('ing'));
    const resLog: string[] = [];
    let tense: 'present'|'past'|'future' = 'present';
    if (words.includes('will')) tense = 'future';
    else if (words.includes('did') || words.includes('was') || words.includes('were')) tense = 'past';

    // Habitual cue: "used to"
    let habFlag = false;
    for (let i=0;i<tokens.length;i++){
      if (tokens[i].text === 'used' && tokens[i+1]?.text === 'to') { habFlag = true; break; }
    }

    // Detect particles
    const particles: string[] = [];
    for (const p of Object.keys(PREP_TO_PARTICLE)){
      if (words.includes(p)) particles.push(PREP_TO_PARTICLE[p]);
    }

    const copulaId = findCopulaRootId();
    const hasBeToken = words.some(isBe);

    // Candidate main verb (non-copula)
    let matchedVerb: LexiconEntryVerb | null = null;
    for (let i=0;i<tokens.length;i++){
      const w = tokens[i].text;
      if (w === '?' || PRONOUNS.has(w) || SPECIAL.has(w) || PREPS.has(w) || isBe(w)) continue;
      // try 2-word phrase first for verbs
      const two = tokens[i+1]?.text ? `${w} ${tokens[i+1].text}` : '';
      const mv2 = two ? verbsLex.find(v => splitGlossItems(v.gloss).includes(normPhrase(two)) || (v.synonyms||[]).map(normPhrase).includes(normPhrase(two))) : null;
      if (mv2) { matchedVerb = mv2; resLog.push(`verb '${two}' → '${mv2.c1}${mv2.c2}${mv2.c3}' via phrase-exact`); break; }
      const mv = matchVerbByToken(w, resLog);
      if (mv) { matchedVerb = mv; break; }
    }

    // Candidate nouns (objects/places/instruments), collect all
    const objectIds: string[] = [];
    for (let i=0;i<tokens.length;i++){
      const w = tokens[i].text;
      if (w === '?' || PRONOUNS.has(w) || SPECIAL.has(w) || PREPS.has(w) || isBe(w)) continue;
      // Skip nouns immediately governed by a preceding preposition (with/to/from/in/at)
      const prev = i>0 ? tokens[i-1].text : '';
      if (prev && PREPS.has(prev)) continue;
      // Heuristic: if a preposition occurred shortly before (e.g., with X and Y), treat following nouns as PP complements, not objects
      let withinPP = false;
      for (let j=i-1; j>=0 && j>=i-4; j--) {
        const ww = tokens[j].text;
        if (ww === '?') break;
        if (PREPS.has(ww)) { withinPP = true; break; }
        if (PRONOUNS.has(ww) || isBe(ww)) break;
        // stop backtracking if we hit something that looks like a verb token
        if (matchVerbByToken(ww)) break;
        // skip coordinators/aux helpers
        if (COORD_BASE.has(ww) || COORD_AUX.has(ww)) continue;
      }
      if (withinPP) continue;
      const mn = matchNounByToken(w, tokens[i+1]?.text, englishInput, resLog);
      if (mn.noun && !objectIds.includes(mn.noun.id)) { objectIds.push(mn.noun.id); if (mn.span===2) i++; }
    }

    // Clause classification
    let clause: 'copular'|'existential'|'transitive' = 'transitive';
    if (words[0] === 'there') clause = 'existential';
    else if ((pron && hasBeToken && objectIds.length && !matchedVerb) || (pron && !hasBeToken && objectIds.length && !matchedVerb)) clause = 'copular';

    let verbRootId: string | null = null;
    if (clause === 'existential' || clause === 'copular') {
      verbRootId = copulaId;
    } else if (matchedVerb) {
      verbRootId = matchedVerb.id;
    } else if (hasBeToken) {
      // "be" but not copular classification → still tie to copula
      verbRootId = copulaId;
    }

    const warnings: string[] = [];
    if (!verbRootId) warnings.push('Unknown verb');

    const frame: SemanticFrame = {
      subject: subj,
      verbRootId,
      tense,
      neg: negFlag,
      prog: progFlag,
      hab: habFlag || hab, // prefer intake; fallback to UI toggle
      question: hasQ || question,
      objects: objectIds,
      particles,
    };
    return { frame, warnings, clauseType: clause, resolutionLog: resLog };
  }

  // ===== Generator: frame + lexicon → Huntspeak =====
  type HSSubj = { form: string; subjV: string };
  function hsSubjectFor(subj: string | null | undefined): HSSubj {
    switch (subj) {
      case 'I': return { form: 'ɪ', subjV: 'ɪ' };
      case 'we': return { form: 'tɪ', subjV: 'ɪ' };
      case 'you': return { form: 'su', subjV: 'u' };
      case 'you(pl)': return { form: 'tu', subjV: 'u' };
      case 'he':
      case 'she':
      case 'they':
      default: return { form: 'se', subjV: 'e' };
    }
  }
  function tenseVowel(t: 'present'|'past'|'future'){ return t==='present' ? 'a' : t==='past' ? 'e' : 'ʌ'; }
  function conjFinite(root: LexiconEntryVerb, subj: HSSubj, t: 'present'|'past'|'future', flags: { prog:boolean; hab:boolean; neg:boolean }, ignoreProg=false){
    let v = buildFinite(root as any as Root, subj.subjV, tenseVowel(t));
    if (!ignoreProg && flags.prog) v = withProgressive(v, root as any as Root);
    if (flags.hab) v = withHabitual(v);
    if (flags.neg) v = withNegation(v);
    return v;
  }
  function findVerbById(id: string | null){ return id ? verbsLex.find(v=>v.id===id) || null : null; }
  function wordOfNounId(id: string){ return nounsLex.find(n=>n.id===id)?.word || '?'; }

  // Build particle→noun pairing from intake tokens when available.
  function pairParticlesWithNounsFromTokens(tokens: IntakeToken[]): Array<{ part: string; nounId: string }>{
    const pairs: Array<{ part: string; nounId: string }> = [];
    for (let i=0;i<tokens.length;i++){
      const w = tokens[i].text;
      const code = PREP_TO_PARTICLE[w];
      if (!code) continue;
      // Find next noun-like token
      for (let j=i+1;j<tokens.length;j++){
        const w2 = tokens[j].text;
        if (w2==='?' || PREPS.has(w2)) break;
        const n = matchNounByToken(w2, tokens[j+1]?.text, englishInput);
        if (n.noun){ pairs.push({ part: code, nounId: n.noun.id }); break; }
      }
    }
    return pairs;
  }
  function generateHuntspeak(frame: SemanticFrame, clause: 'copular'|'existential'|'transitive', tokens: IntakeToken[]): { surface: string; variants: string[] }{
    const subjHS = hsSubjectFor(frame.subject);
    const verbLex = findVerbById(frame.verbRootId);
    const pairs = pairParticlesWithNounsFromTokens(tokens);
    const coord = detectCoordination(tokens);
    const npLists = coord.lists.filter(l => l.role === 'NP');
    const COORD_WORD: Record<CoordType, string> = { AND: 'ʋa', OR: 'ra', NOR: 'ʋa', BUT: 'ʋa' };
    function listForNounId(id: string | undefined | null){
      if (!id) return null;
      return npLists.find(l => l.items.some(it => it.nounId === id)) || null;
    }
    function pushJoinedNouns(partsArr: string[], nounIds: string[], type: CoordType){
      const conj = COORD_WORD[type] || 'ʋa';
      nounIds.forEach((nid, idx) => {
        const w = wordOfNounId(nid);
        if (idx>0) partsArr.push(conj);
        partsArr.push(w);
      });
    }

    const parts: string[] = [];
    const variants: string[] = [];

    if (clause === 'existential'){
      // 3sg copula + NP (+ la PLACE). Present non-neg may optionally drop verb, but keep main as with verb.
      const copId = findCopulaRootId();
      const cop = copId ? verbsLex.find(v=>v.id===copId) : null;
      const copForm = cop ? conjFinite(cop, { form:'se', subjV:'e' }, frame.tense, { prog:false, hab:frame.hab, neg:frame.neg }, true) : '';
      if (copForm) parts.push(copForm);
      // NP(s): show direct object nouns (first is the existential NP)
      frame.objects.forEach((nid, idx) => {
        const w = wordOfNounId(nid);
        if (idx===0) parts.push(w);
      });
      // Place with la (map from pairs if present, else try to attach la to last noun if available)
      const laPair = pairs.find(p=>p.part==='la');
      if (laPair) { parts.push('la'); parts.push(wordOfNounId(laPair.nounId)); }
      else if (frame.objects.length>1) { parts.push('la'); parts.push(wordOfNounId(frame.objects[1])); }
    } else if (clause === 'copular'){
      // Equatives: present + non-neg → zero-copula; else conjugated copula
      const zero = frame.tense==='present' && !frame.neg;
      if (!zero) parts.push(subjHS.form);
      const copId = findCopulaRootId();
      const cop = copId ? verbsLex.find(v=>v.id===copId) : null;
      if (!zero && cop) parts.push(conjFinite(cop, subjHS, frame.tense, { prog:false, hab:frame.hab, neg:frame.neg }, true));
      // NP (predicate nominal): first object noun
      if (frame.objects[0]) parts.push(wordOfNounId(frame.objects[0]));
      // Variant: explicit copula when zero-copula chosen
      if (zero && cop) {
        const alt = [subjHS.form, conjFinite(cop, subjHS, frame.tense, { prog:false, hab:frame.hab, neg:frame.neg }, true), frame.objects[0] ? wordOfNounId(frame.objects[0]) : undefined].filter(Boolean).join(' ');
        variants.push(alt);
        // Main should be zero-copula surface
        parts.unshift(subjHS.form);
        parts.splice(1,1); // remove pronoun we just unshifted? ensure surface starts with pronoun for readability
        // But the intended zero-copula example omits the verb but keeps pronoun + NP
        parts.length = 0; // reset to exactly pronoun + NP
        parts.push(subjHS.form);
        if (frame.objects[0]) parts.push(wordOfNounId(frame.objects[0]));
      }
    } else {
      // Transitive
      if (subjHS.form) parts.push(subjHS.form);
      // VP coordination: build multiple verbs with shared flags
      const vpList = coord.lists.find(l => l.role === 'VP' && l.items.length >= 2);
      if (vpList){
        const conjWord = COORD_WORD[vpList.type] || 'ʋa';
        const forms: string[] = [];
        for (const it of vpList.items){
          const v = it.verbId ? verbsLex.find(x=>x.id===it.verbId) : null;
          if (v) forms.push(conjFinite(v, subjHS, frame.tense, { prog:frame.prog, hab:frame.hab, neg:frame.neg }));
        }
        if (forms.length){
          parts.push(forms.map((f,i)=> i===0 ? f : `${conjWord} ${f}`).join(' '));
        } else if (verbLex){
          parts.push(conjFinite(verbLex, subjHS, frame.tense, { prog:frame.prog, hab:frame.hab, neg:frame.neg }));
        }
      } else {
        if (verbLex) parts.push(conjFinite(verbLex, subjHS, frame.tense, { prog:frame.prog, hab:frame.hab, neg:frame.neg }));
      }
      // Direct object: support NP coordination
      if (frame.objects[0]){
        const baseObjId = frame.objects[0];
        const lst = listForNounId(baseObjId);
        if (lst && lst.items.filter(it=>it.nounId).length >= 2){
          const ids = lst.items.map(it=>it.nounId!).filter(Boolean);
          pushJoinedNouns(parts, ids, lst.type);
        } else {
          parts.push(wordOfNounId(baseObjId));
        }
      }
      // Adpositional phrases: place particle once, then join NP list with coordinator if applicable
      const usedGroups = new Set<string>();
      for (const p of pairs){
        if (frame.objects[0] && p.nounId===frame.objects[0]) continue; // avoid repeating object noun
        const lst = listForNounId(p.nounId);
        if (lst && lst.items.filter(it=>it.nounId).length >= 2){
          const key = `${p.part}:${lst.items.map(it=>it.nounId||it.text).join(',')}`;
          if (usedGroups.has(key)) continue;
          usedGroups.add(key);
          parts.push(p.part);
          const ids = lst.items.map(it=>it.nounId!).filter(Boolean);
          pushJoinedNouns(parts, ids, lst.type);
        } else {
          parts.push(p.part);
          parts.push(wordOfNounId(p.nounId));
        }
      }
    }

    // Question marker: align with app style (qa?) at end
    if (frame.question) parts.push('qa?');

    return { surface: parts.join(' ').trim(), variants };
  }

  function toggleParticle(p: string){
    setParticles(prev => prev.includes(p) ? prev.filter(x=>x!==p) : [...prev, p]);
  }
  function addObject(){
    if (!objPick) return;
    setObjects(prev => prev.includes(objPick) ? prev : [...prev, objPick]);
  }
  function removeObject(id: string){
    setObjects(prev => prev.filter(x=>x!==id));
  }

  function onTranslate(){
    // Prefer building from English intake if provided; fallback to UI state
    const built = englishInput.trim() ? buildFrameFromEnglish(intakeTokens) : null;
    const frame: SemanticFrame = built?.frame ?? { subject, verbRootId, tense, neg, prog, hab, question, objects, particles };
    const verb = verbsLex.find(v => v.id === frame.verbRootId) || null;
    const objWords = frame.objects.map(oid => nounsLex.find(n => n.id === oid)?.word || "?");
    const warnings: string[] = [];
    if (!frame.subject) warnings.push("Missing subject");
    if (!verb) warnings.push("No verb selected");

    const gen = generateHuntspeak(frame, built?.clauseType ?? 'transitive', intakeTokens);
    const surface = gen.surface || [
      "[Experimental]",
      frame.subject,
      verb ? `(${verb.c1}${verb.c2}${verb.c3} • ${verb.gloss||"verb"})` : "(no‑verb)",
      objWords.length ? `→ ${objWords.join(", ")}` : "",
      frame.question ? "?" : "",
    ].filter(Boolean).join(" ");

    const res: Result = {
      surface,
      variants: gen.variants,
      analysis: {
        frame,
        intake: {
          input: englishInput,
          tokens: intakeTokens,
          tokensFlat: intakeTokens.map(t=>t.text),
          pronoun: intakePronoun,
          bePositions,
        },
        clause: built?.clauseType ?? 'manual',
        resolutionLog: built?.resolutionLog || [],
        coordination: detectCoordination(intakeTokens),
      },
      warnings: [...warnings, ...(built?.warnings || [])],
    };
    setResult(res);
    if (gen.surface){
      const entry = { id: Math.random().toString(36).slice(2,10), input: englishInput.trim(), surface: gen.surface, at: Date.now() };
      setHistory(prev => [entry, ...prev.filter(e => e.surface!==entry.surface || e.input!==entry.input)].slice(0,10));
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Left: input controls */}
      <div>
        <div className="text-sm text-neutral-600 mb-3">Experimental: English intake + structured frame → output (stub).</div>
        <label className="block mb-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">English line (experimental)</div>
          <input
            className="w-full border rounded-lg px-2 py-2"
            placeholder="Type an English line..."
            value={englishInput}
            onChange={e=>setEnglishInput(e.target.value)}
          />
          <div className="mt-1 text-xs text-neutral-500">Keeps ?; strips quotes/punct; removes a/an/the when safe; lowercases.</div>
        </label>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <label className="block">
            <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Subject</div>
            <select className="w-full border rounded-lg px-2 py-2" value={subject} onChange={e=>setSubject(e.target.value)}>
              {["I","you","he","she","we","you(pl)","they"].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Tense</div>
            <select className="w-full border rounded-lg px-2 py-2" value={tense} onChange={e=>setTense(e.target.value as any)}>
              <option value="present">present</option>
              <option value="past">past</option>
              <option value="future">future</option>
            </select>
          </label>
        </div>

        <label className="block mb-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Verb</div>
          <select className="w-full border rounded-lg px-2 py-2" value={verbRootId ?? ""} onChange={e=>setVerbRootId(e.target.value || null)}>
            <option value="">(none)</option>
            {verbsLex.map(v => (
              <option key={v.id} value={v.id}>{`${v.c1}${v.c2}${v.c3}${v.gloss?` — ${v.gloss}`:''}`}</option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap gap-3 mb-3">
          <label className="inline-flex items-center gap-2 select-none"><input type="checkbox" className="h-4 w-4" checked={neg} onChange={e=>setNeg(e.target.checked)} /> Neg</label>
          <label className="inline-flex items-center gap-2 select-none"><input type="checkbox" className="h-4 w-4" checked={prog} onChange={e=>setProg(e.target.checked)} /> Prog</label>
          <label className="inline-flex items-center gap-2 select-none"><input type="checkbox" className="h-4 w-4" checked={hab} onChange={e=>setHab(e.target.checked)} /> Hab</label>
          <label className="inline-flex items-center gap-2 select-none"><input type="checkbox" className="h-4 w-4" checked={question} onChange={e=>setQuestion(e.target.checked)} /> Question</label>
        </div>

        <div className="mb-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Objects</div>
          <div className="flex items-center gap-2 mb-2">
            <select className="flex-1 border rounded-lg px-2 py-2" value={objPick} onChange={e=>setObjPick(e.target.value)}>
              {nounsLex.map(n => (
                <option key={n.id} value={n.id}>{`${n.word}${n.gloss?` — ${n.gloss}`:''}`}</option>
              ))}
            </select>
            <button className="px-3 py-2 rounded-lg border border-neutral-300 hover:bg-neutral-50" onClick={addObject}>Add</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {objects.map(id => {
              const n = nounsLex.find(x=>x.id===id);
              return (
                <span key={id} className="inline-flex items-center gap-2 px-2 py-1 rounded-full border border-neutral-300 text-sm">
                  {n?.word || id}
                  <button className="text-neutral-500 hover:text-neutral-800" onClick={()=>removeObject(id)} aria-label="Remove">×</button>
                </span>
              );
            })}
            {!objects.length && <span className="text-sm text-neutral-500">(none)</span>}
          </div>
        </div>

        <div className="mb-4">
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Particles</div>
          <div className="flex flex-wrap gap-3">
            {(["with","to","from","in"]).map(p => (
              <label key={p} className="inline-flex items-center gap-2 select-none">
                <input type="checkbox" className="h-4 w-4" checked={particles.includes(p)} onChange={()=>toggleParticle(p)} /> {p}
              </label>
            ))}
          </div>
        </div>

        <button className="px-3 py-2 rounded-lg border border-neutral-300 hover:bg-neutral-50" onClick={onTranslate}>Translate</button>
        <button className="ml-2 px-3 py-2 rounded-lg border border-neutral-300 hover:bg-neutral-50" onClick={()=>{
          // Helpers that consult the current lexicon
          const nounWord = (en: string) => {
            const m = matchNounByToken(en.toLowerCase(), undefined, englishInput);
            return m.noun?.word || en;
          };
          const verbForm = (enVerb: string, subjKey: 'I'|'you'|'he'|'she'|'we'|'they', t: 'present'|'past'|'future', flags?: { prog?:boolean; hab?:boolean; neg?:boolean }) => {
            const v = matchVerbByToken(enVerb.toLowerCase());
            const subjHS = hsSubjectFor(subjKey);
            return v ? conjFinite(v, subjHS, t, { prog: !!flags?.prog, hab: !!flags?.hab, neg: !!flags?.neg }) : `(no-verb:${enVerb})`;
          };
          const firstGlossWord = (v: LexiconEntryVerb) => headWords(v.gloss)[0] || (v.synonyms[0]?.toLowerCase() || '');
          const copula3sg = (t: 'present'|'past'|'future', flags?: { hab?:boolean; neg?:boolean }) => {
            const copId = findCopulaRootId();
            const cop = copId ? verbsLex.find(v=>v.id===copId) : null;
            return cop ? conjFinite(cop, { form:'se', subjV:'e' }, t, { prog:false, hab:!!flags?.hab, neg:!!flags?.neg }, true) : '(no-cop)';
          };
          const copula1sg = (t: 'present'|'past'|'future', flags?: { hab?:boolean; neg?:boolean }) => {
            const copId = findCopulaRootId();
            const cop = copId ? verbsLex.find(v=>v.id===copId) : null;
            return cop ? conjFinite(cop, { form:'ɪ', subjV:'ɪ' }, t, { prog:false, hab:!!flags?.hab, neg:!!flags?.neg }, true) : '(no-cop)';
          };

          const hunter = nounWord('hunter');
          const prey = nounWord('prey');
          const shroud = nounWord('shroud');
          const trap = nounWord('trap');

          const cases: Array<
            { name: string; input: string; expect: string; variant?: string } |
            { name: string; input: string; expectEndsWith: string }
          > = [
            {
              name: 'Transitive: I strike hunter',
              input: 'I strike hunter',
              expect: `ɪ ${verbForm('strike','I','present')} ${hunter}`,
            },
            {
              name: 'Existential: There is prey in the Shroud',
              input: 'There is prey in the Shroud',
              expect: `${copula3sg('present')} ${prey} la ${shroud}`,
            },
            {
              name: 'Equative (present): I am a hunter',
              input: 'I am a hunter',
              expect: `ɪ ${hunter}`,
              variant: `ɪ ${copula1sg('present')} ${hunter}`,
            },
            {
              name: 'Future with instrument: We will hunt with a trap',
              input: 'We will hunt with a trap',
              expect: `tɪ ${verbForm('hunt','we','future')} ri ${trap}`,
            },
            {
              name: 'Progressive + question: You are hiding?',
              input: 'You are hiding?',
              // We cannot hardcode progressive surface; rely on generator but ensure qa? at the end
              expectEndsWith: 'qa?',
            },
            {
              name: 'Negation assimilation (k- root): I do not hunt',
              input: 'I do not hunt',
              expect: `ɪ ${verbForm('hunt','I','present',{neg:true})}`,
            },
            {
              name: 'Negation non-assimilating (d- root): I do not strike hunter',
              input: 'I do not strike hunter',
              expect: `ɪ ${verbForm('strike','I','present',{neg:true})} ${hunter}`,
            },
            {
              name: 'Equative past negation: I was not a hunter',
              input: 'I was not a hunter',
              expect: `ɪ ${copula1sg('past',{neg:true})} ${hunter}`,
            },
            {
              name: 'Existential future negation: There will not be prey',
              input: 'There will not be prey',
              expect: `${copula3sg('future',{neg:true})} ${prey}`,
            },
            {
              name: 'Particles chain: I strike hunter with a trap from the Shroud',
              input: 'I strike hunter with a trap from the Shroud',
              expect: `ɪ ${verbForm('strike','I','present')} ${hunter} ri ${trap} ʌs ${shroud}`,
            },
          ];

          // Conditional assimilation test for g- root (if present in lexicon)
          const gVerb = verbsLex.find(v => v.c1.toLowerCase() === 'g');
          if (gVerb){
            const gw = firstGlossWord(gVerb) || 'go';
            cases.push({
              name: 'Negation assimilation (g- root): I do not <g-verb>',
              input: `I do not ${gw}`,
              expect: `ɪ ${conjFinite(gVerb, hsSubjectFor('I'), 'present', { prog:false, hab:false, neg:true })}`,
            });
          }
          // Assimilation test for q- root (approach)
          cases.push({
            name: 'Negation assimilation (q- root): I do not approach',
            input: 'I do not approach',
            expect: `ɪ ${verbForm('approach','I','present',{neg:true})}`,
          });
          // Habitual test via "used to"
          cases.push({
            name: 'Habitual: We used to hunt',
            input: 'We used to hunt',
            expect: `tɪ ${verbForm('hunt','we','present',{hab:true})}`,
          });

          const results: { name: string; pass: boolean; expected: string; got: string; note?: string; lex?: string }[] = [];
          for (const c of cases){
            const toks = normalizeAndTokenize(c.input);
            const built = buildFrameFromEnglish(toks);
            const gen = generateHuntspeak(built.frame, built.clauseType, toks);
            const lexVerb = built.frame.verbRootId ? verbsLex.find(v=>v.id===built.frame.verbRootId) : null;
            const lexNouns = built.frame.objects.map(id => nounsLex.find(n=>n.id===id)?.word || id);
            if ('expectEndsWith' in c){
              const pass = gen.surface.endsWith(c.expectEndsWith);
              results.push({ name: c.name, pass, expected: `(… ${c.expectEndsWith})`, got: gen.surface, lex: `verb=${lexVerb ? `${lexVerb.c1}${lexVerb.c2}${lexVerb.c3} (${lexVerb.gloss})` : '—'}; nouns=[${lexNouns.join(', ')}]` });
              continue;
            }
            const okMain = gen.surface === c.expect;
            let note: string | undefined;
            if (!okMain && 'variant' in c && c.variant){
              const okVar = gen.surface === c.expect || gen.variants.includes(c.variant);
              if (okVar && gen.surface !== c.expect) note = 'explicit copula present in variants';
              results.push({ name: c.name, pass: okVar, expected: `${c.expect} (+variant: ${c.variant})`, got: gen.surface, note, lex: `verb=${lexVerb ? `${lexVerb.c1}${lexVerb.c2}${lexVerb.c3} (${lexVerb.gloss})` : '—'}; nouns=[${lexNouns.join(', ')}]` });
              continue;
            }
            results.push({ name: c.name, pass: okMain, expected: c.expect, got: gen.surface, lex: `verb=${lexVerb ? `${lexVerb.c1}${lexVerb.c2}${lexVerb.c3} (${lexVerb.gloss})` : '—'}; nouns=[${lexNouns.join(', ')}]` });
          }
          setTests(results);
          setTestsOpen(true);
        }}>Example Tests</button>
      </div>

      {/* Right: output */}
      <div className="sub-panel rounded-xl border p-3">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Huntspeak</div>
          <div className="flex items-center gap-2">
            <button className="px-2 py-1 rounded border border-neutral-300 hover:bg-neutral-50 text-sm" onClick={() => { try { navigator.clipboard.writeText(result?.surface || ""); } catch {} }}>Copy</button>
            <button className="px-2 py-1 rounded border border-neutral-300 hover:bg-neutral-50 text-sm" onClick={()=>setShowJSON(v=>!v)}>{showJSON ? 'Hide JSON' : 'Show JSON'}</button>
          </div>
        </div>
        <div className="text-xl font-semibold mb-3 min-h-10">
          {result?.surface || "(nothing yet)"}
        </div>

        {/* Variant toggles (only when relevant) */}
        {(() => {
          const built = englishInput.trim() ? buildFrameFromEnglish(intakeTokens) : null;
          const clause = built?.clauseType;
          const frm = built?.frame;
          const equativeNow = clause==='copular' && frm?.tense==='present' && !frm?.neg;
          if (!frm) return null;
          const verb = frm.verbRootId ? verbsLex.find(v=>v.id===frm.verbRootId) : null;
          const variants: { label: string; value: string }[] = [];
          const gen = generateHuntspeak(frm, clause||'transitive', intakeTokens);
          if (equativeNow && gen.variants.length){ variants.push({ label: 'With copula', value: gen.variants[0] }); }
          // Prog/Hab/Neg permutations (flip flags individually)
          const toggles: Array<{k:'prog'|'hab'|'neg', label:string}> = [];
          if (frm.prog || verb) toggles.push({k:'prog',label:'Progressive'});
          if (frm.hab || verb) toggles.push({k:'hab',label:'Habitual'});
          if (frm.neg || verb) toggles.push({k:'neg',label:'Negation'});
          const permSurfaces: {label:string; value:string}[] = [];
          for (const t of toggles){
            const mod = { ...frm } as SemanticFrame;
            (mod as any)[t.k] = !((frm as any)[t.k]);
            const g2 = generateHuntspeak(mod, clause||'transitive', intakeTokens);
            if (g2.surface && g2.surface !== result?.surface) permSurfaces.push({ label: t.label, value: g2.surface });
          }
          // Add tense variants (Past, Present, Future)
          const tenseLabels: Record<SemanticFrame['tense'], string> = { present: 'Present', past: 'Past', future: 'Future' };
          const tenseSurfaces: {label:string; value:string}[] = (['present','past','future'] as SemanticFrame['tense'][]).map(tt => {
            const mod = { ...frm, tense: tt } as SemanticFrame;
            const g2 = generateHuntspeak(mod, clause||'transitive', intakeTokens);
            return { label: tenseLabels[tt], value: g2.surface };
          });

          if (!variants.length && !permSurfaces.length && !tenseSurfaces.length) return null;
          return (
            <div className="mb-3">
              <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Variants</div>
              {/* Row 1: copula + Prog/Hab/Neg permutations */}
              <div className="flex flex-wrap gap-2 mb-2">
                {[...variants, ...permSurfaces].map((v,i)=> (
                  <button key={i} className="inline-flex items-center gap-2 px-2 py-1 rounded-full border border-neutral-300 text-sm hover:bg-neutral-50" onClick={()=>{ try { navigator.clipboard.writeText(v.value); } catch {} }} title="Click to copy">
                    <span className="opacity-70">{v.label}:</span>
                    <span className="font-medium">{v.value}</span>
                  </button>
                ))}
              </div>
              {/* Row 2: Tense variants */}
              <div className="flex flex-wrap gap-2">
                {tenseSurfaces.map((v,i)=> (
                  <button key={i} className="inline-flex items-center gap-2 px-2 py-1 rounded-full border border-neutral-300 text-sm hover:bg-neutral-50" onClick={()=>{ try { navigator.clipboard.writeText(v.value); } catch {} }} title="Click to copy">
                    <span className="opacity-70">{v.label}:</span>
                    <span className="font-medium">{v.value}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Analysis: tidy table */}
        {(() => {
          const built = englishInput.trim() ? buildFrameFromEnglish(intakeTokens) : null;
          const frm = built?.frame;
          if (!frm) return null;
          const subjHS = hsSubjectFor(frm.subject);
          const verb = frm.verbRootId ? verbsLex.find(v=>v.id===frm.verbRootId) : null;
          const verbForm = verb ? conjFinite(verb, subjHS, frm.tense, { prog: frm.prog, hab: frm.hab, neg: frm.neg }) : '—';
          const objects = frm.objects.map(id => wordOfNounId(id)).join(', ') || '—';
          const particles = pairParticlesWithNounsFromTokens(intakeTokens).map(p => `${p.part} ${wordOfNounId(p.nounId)}`).join(' • ') || '—';
          const flags = [frm.prog?'Prog':null, frm.hab?'Hab':null, frm.neg?'Neg':null].filter(Boolean).join(', ') || '—';
          const coord = detectCoordination(intakeTokens);
          const coordSummary = coord.lists.length ? coord.lists.map(l => `${l.role}:${l.type} [${l.items.map(it=>it.text).join(', ')}]`).join(' • ') : '—';
          const usedFuzzy = (built?.resolutionLog || []).some(line => /fuzzy/.test(line));
          return (
            <div className="rounded-lg border p-2 analysis-panel">
              <div className="grid grid-cols-[10rem_1fr] gap-x-4 gap-y-1 text-sm">
                <div className="opacity-70">Subject</div><div>{subjHS.form} <span className="opacity-60">({frm.subject})</span></div>
                <div className="opacity-70">Verb</div><div>{verb ? `${verb.c1}${verb.c2}${verb.c3} — ${verb.gloss}` : '—'}</div>
                <div className="opacity-70">Form</div><div>{verbForm}</div>
                <div className="opacity-70">Tense</div><div>{frm.tense}</div>
                <div className="opacity-70">Flags</div><div>{flags}</div>
                <div className="opacity-70">Match quality</div>
                <div>{usedFuzzy ? (
                  <span className="badge badge-fuzzy">Fuzzy (≤1 edit)</span>
                ) : (
                  <span className="badge badge-exact">Exact</span>
                )}</div>
                <div className="opacity-70">Objects</div><div>{objects}</div>
                <div className="opacity-70">Particles</div><div>{particles}</div>
                <div className="opacity-70">Coordination</div><div>{coordSummary}</div>
                <div className="opacity-70">Notes</div><div>{built?.clauseType || '—'}</div>
              </div>
              {built?.resolutionLog?.length ? (
                <div className="mt-2 text-xs">
                  <div className="opacity-70 mb-1">Resolution log</div>
                  <ul className="list-disc ml-5 space-y-0.5">
                    {built.resolutionLog.map((line, i)=> (
                      <li key={i} className={/fuzzy/.test(line) ? 'text-amber-600 font-medium' : ''}>{line}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {showJSON && (
                <pre className="mt-2 text-xs overflow-auto max-h-48">{JSON.stringify(result?.analysis, null, 2)}</pre>
              )}
            </div>
          );
        })()}

        {/* Warnings + Add to lexicon CTA */}
        {((result?.warnings?.length || 0) > 0 || unknownTokens.length>0) && (
          <div className="mt-2 text-sm">
            <div className="text-amber-700 mb-1">Warnings: {result?.warnings?.join(", ")}</div>
            {unknownTokens.length>0 && (
              <div className="flex flex-wrap gap-2 items-center">
                {unknownTokens.map((w,i)=> (
                  <span key={i} className="inline-flex items-center gap-2 px-2 py-1 rounded-full border border-neutral-300">
                    <span className="text-red-700">{w}</span>
                    <button className="text-xs px-2 py-1 rounded border border-neutral-300 hover:bg-neutral-50" onClick={()=>onCreateNoun?.({ word: w, gloss: w })}>Add as Noun</button>
                    <button className="text-xs px-2 py-1 rounded border border-neutral-300 hover:bg-neutral-50" onClick={()=>onCreateRoot?.({ c1: '', c2: '', c3: '', gloss: w, synonyms: [] })}>Add as Verb</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* History and Favorites */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs uppercase tracking-wide text-neutral-500">History</div>
            {history.length>0 && (
              <button className="text-xs px-2 py-1 rounded border border-neutral-300 hover:bg-neutral-50" onClick={()=>setHistory([])}>Clear</button>
            )}
          </div>
          {history.length ? (
            <div className="flex flex-col gap-1">
              {history.map(h => (
                <div key={h.id} className="flex items-center gap-2 text-sm">
                  <button className="px-2 py-1 rounded border border-neutral-300 hover:bg-neutral-50" onClick={()=>{ try { navigator.clipboard.writeText(h.surface); } catch {} }}>Copy</button>
                  <button className="px-2 py-1 rounded border border-neutral-300 hover:bg-neutral-50" title="Favorite" onClick={()=>{
                    const exists = faves.some(f=>f.surface===h.surface && f.input===h.input);
                    setFaves(exists ? faves.filter(f=>!(f.surface===h.surface && f.input===h.input)) : [{...h}, ...faves]);
                  }}>{faves.some(f=>f.surface===h.surface && f.input===h.input) ? '★' : '☆'}</button>
                  <div className="truncate" title={h.input ? `${h.surface} — ${h.input}` : h.surface}>{h.surface}{h.input ? ` — ${h.input}` : ''}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-neutral-500">No translations yet.</div>
          )}
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs uppercase tracking-wide text-neutral-500">My Phrases</div>
            {faves.length>0 && (
              <button className="text-xs px-2 py-1 rounded border border-neutral-300 hover:bg-neutral-50" onClick={()=>setFaves([])}>Clear</button>
            )}
          </div>
          {faves.length ? (
            <div className="flex flex-col gap-1">
              {faves.map(f => (
                <div key={f.id} className="flex items-center gap-2 text-sm">
                  <button className="px-2 py-1 rounded border border-neutral-300 hover:bg-neutral-50" onClick={()=>{ try { navigator.clipboard.writeText(f.surface); } catch {} }}>Copy</button>
                  <button className="px-2 py-1 rounded border border-neutral-300 hover:bg-neutral-50" title="Remove favorite" onClick={()=> setFaves(prev=>prev.filter(x=>x.id!==f.id))}>★</button>
                  <div className="truncate" title={f.input ? `${f.surface} — ${f.input}` : f.surface}>{f.surface}{f.input ? ` — ${f.input}` : ''}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-neutral-500">None starred yet.</div>
          )}
        </div>
      </div>
      {/* Dev: Example Tests popup */}
      {testsOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={()=>setTestsOpen(false)}></div>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e)=>{ if (e.target===e.currentTarget) setTestsOpen(false); }}>
            <div className="w-full max-w-2xl rounded-2xl border border-neutral-200 bg-white fantasy-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xl font-semibold">Example Tests</h3>
                <div className="flex items-center gap-2">
                  <button
                    className="px-3 py-1 rounded-lg border border-neutral-300 hover:bg-neutral-50"
                    onClick={()=>{
                      const line = (tests||[]).map(t => `${t.pass? 'PASS':'FAIL'} ${t.name}: expected=${t.expected}; got=${t.got}${t.note?`; note=${t.note}`:''}`).join(' | ');
                      try { navigator.clipboard.writeText(line); } catch {}
                    }}
                    title="Copy plain text (single line)"
                  >Copy Plain</button>
                  <button className="px-3 py-1 rounded-lg border border-neutral-300 hover:bg-neutral-50" onClick={()=>setTestsOpen(false)}>Close</button>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                {tests?.map((t,i)=> (
                  <div key={i}>
                    <div
                      className={t.pass ? 'text-emerald-700 cursor-pointer hover:underline' : 'text-red-700 cursor-pointer hover:underline'}
                      title="Click to copy this result as plain text"
                      onClick={()=>{
                        const line = `${t.pass? 'PASS':'FAIL'} ${t.name}: expected=${t.expected}; got=${t.got}${t.note?`; note=${t.note}`:''}`;
                        try { navigator.clipboard.writeText(line); } catch {}
                      }}
                    >
                      {t.pass ? '✓' : '✗'} {t.name}: expected “{t.expected}” got “{t.got}”{t.note?` — ${t.note}`:''}
                    </div>
                    {t.lex && (
                      <div className="text-neutral-600 mt-0.5">{t.lex}</div>
                    )}
                  </div>
                ))}
                {!tests?.length && <div className="text-neutral-600">No results.</div>}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
