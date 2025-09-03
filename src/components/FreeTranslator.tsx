import React from "react";
import { useLocalStorageState, LS_KEYS } from "../lib/storage";
import { stripArticles, lexNoun } from "../lib/lex";
import type { Noun, Root } from "../types";
import { findRootByEnglish, withHabitual, withNegation, withProgressive } from "../lib/morphology";

// Helper: best‑effort clipboard copy; ignore failures.
const clip = async (text: string) => { try { await navigator.clipboard.writeText(text); } catch {} };

/**
 * Naive English → Huntspeak translator for single‑verb clauses.
 *
 * Heuristics:
 * - Detects subject pronoun (i/we/you/you all/he/she/they) and basic tense markers (will/did)
 * - Flags: not/don't/didn't/won't → negation; be + -ing → progressive; "used to" → habitual
 * - Adpositional chunks: with / to / from → fi / ga / ʌs
 * - Looks up verb roots by matching gloss/synonyms; nouns by word/gloss/synonyms.
 *
 * Limitations: This is intentionally shallow and meant as a demo aide. For
 * complex inputs or unknown vocabulary, prefer the Talk Pad.
 */
type Part = { text: string; u?: boolean; en?: string } // u = untranslated highlight; en = original English
type TrState = { en: string; hs: string; hsParts?: Part[] }

export default function FreeTranslator({ roots, nouns, showCollapse = false, embedded = false, onCreateNoun, onCreateRoot, forceCopula = false }: { roots: Root[]; nouns: Noun[]; showCollapse?: boolean; embedded?: boolean; onCreateNoun?: (n: { word: string; gloss?: string; synonyms?: string[] }) => void; onCreateRoot?: (r: { c1: string; c2: string; c3: string; gloss?: string; synonyms?: string[] }) => void; forceCopula?: boolean }){
  const [tr, setTr] = useLocalStorageState<TrState>(LS_KEYS.translator, { en: "", hs: "" });
  const [collapsed, setCollapsed] = useLocalStorageState<boolean>('huntspeak_collapse_translator', false);
  // Experimental add flow for unknown tokens
  const [addOpen, setAddOpen] = React.useState<null | { en: string; step: 'choose'|'noun'|'verb' }>(null);
  const [nounDraft, setNounDraft] = React.useState<{ word: string; gloss: string; syn: string }>({ word: "", gloss: "", syn: "" });
  const [rootDraft, setRootDraft] = React.useState<{ c1: string; c2: string; c3: string; gloss: string; syn: string }>({ c1: "", c2: "", c3: "", gloss: "", syn: "" });
  function openAddEnglish(en: string){ setNounDraft({ word: "", gloss: en, syn: "" }); setRootDraft({ c1: "", c2: "", c3: "", gloss: en, syn: "" }); setAddOpen({ en, step: 'choose' }); }
  function saveNoun(){ const syns = nounDraft.syn.split(',').map(s=>s.trim()).filter(Boolean); onCreateNoun?.({ word: nounDraft.word.trim(), gloss: nounDraft.gloss.trim(), synonyms: syns }); setAddOpen(null); }
  function saveRoot(){ const syns = rootDraft.syn.split(',').map(s=>s.trim()).filter(Boolean); if (!rootDraft.c1 || !rootDraft.c2 || !rootDraft.c3) return; onCreateRoot?.({ c1: rootDraft.c1.trim(), c2: rootDraft.c2.trim(), c3: rootDraft.c3.trim(), gloss: rootDraft.gloss.trim(), synonyms: syns }); setAddOpen(null); }

  // noun lex is shared via ../lib/lex

  function translate(){
    if (!tr.en.trim()) { setTr(s=>({ ...s, hs: "" })); return; }
    const s = tr.en.toLowerCase().replace(/[!?.,]/g, " ").replace(/\s+/g, " ").trim();
    const subjMap: Record<string,{form:string; subjV:string}> = { "i":{form:"ɪ",subjV:"ɪ"}, "we":{form:"tɪ",subjV:"ɪ"}, "you":{form:"su",subjV:"u"}, "you all":{form:"tu",subjV:"u"}, "he":{form:"se",subjV:"e"}, "she":{form:"se",subjV:"e"}, "they":{form:"te",subjV:"e"} };
    let subj = subjMap["i"]; for (const k of Object.keys(subjMap)){ if (s.startsWith(k+" ") || s===k){ subj=subjMap[k]; break; } }
    let tense = "a"; let neg=false, prog=false, hab=false; let rest = s.replace(/^(i|we|you all|you|he|she|they)\s*/, "");
    const raw = rest; // keep an unmodified copy for structure detection (existential/equative/locative/possession)
    if (/\bwill\b/.test(rest)) { tense = "ʌ"; rest = rest.replace(/\bwill\b/g, ""); }
    // Past markers: did / was / were / been / had
    if (/\b(did|was|were|been|had)\b/.test(rest)) { tense = "e"; rest = rest.replace(/\b(did|was|were|been|had)\b/g, ""); }
    if (/\bused to\b/.test(rest)) { hab = true; rest = rest.replace(/\bused to\b/g, ""); }
    if (/\bnot\b|\bdon't\b|\bdo not\b|\bdidn't\b|\bwill not\b|\bwon't\b|\bisn't\b|\baren't\b|\bwasn't\b|\bweren't\b/.test(rest)) { neg=true; rest = rest.replace(/\bnot|don't|do not|didn't|will not|won't|isn't|aren't|wasn't|weren't/g, ""); }
    if (/\b(am|is|are|was|were)\s+\w+ing\b/.test(rest)) { prog=true; rest = rest.replace(/\b(am|is|are|was|were)\s+/g, ""); }
    rest = rest.trim();
    const beFormRe = /\b(be|am|is|are|was|were|been|being)\b/;

    // Helpers for COPULA root
    const getCopula = (): Root | null => (
      findRootByEnglish(roots, 'to be') || findRootByEnglish(roots, 'be') || findRootByEnglish(roots, 'exist') || findRootByEnglish(roots, 'copula')
    );
    const conjCopula = (subjV: string, tenseV: string) => {
      const r = getCopula(); if (!r) return '';
      let v = `${r.c1}${subjV}${r.c2}${tenseV}${r.c3}`;
      // ignore progressive for copula; habitual is allowed
      if (hab) v = withHabitual(v);
      if (neg) v = withNegation(v);
      return v;
    };
    const words = rest.split(" ");
    let verbToken = words[0] || ""; verbToken = verbToken.replace(/ing$/, "");
    // Pre-extract object and adpositional phrases for both verb and no-verb flows
    const withMatch = rest.match(/\bwith\s+([^]+?)(?=\bto\b|\bfrom\b|\bin\b|\bat\b|$)/);
    const toMatch   = rest.match(/\bto\s+([^]+?)(?=\bwith\b|\bfrom\b|\bin\b|\bat\b|$)/);
    const fromMatch = rest.match(/\bfrom\s+([^]+?)(?=\bwith\b|\bto\b|$)/);
    const inMatch   = rest.match(/\b(in|at)\s+([^]+?)(?=\bwith\b|\bto\b|\bfrom\b|$)/);
    const withMatchRaw = raw.match(/\bwith\s+([^]+?)(?=\bto\b|\bfrom\b|\bin\b|\bat\b|$)/);
    const toMatchRaw   = raw.match(/\bto\s+([^]+?)(?=\bwith\b|\bfrom\b|\bin\b|\bat\b|$)/);
    const fromMatchRaw = raw.match(/\bfrom\s+([^]+?)(?=\bwith\b|\bto\b|$)/);
    const inMatchRaw   = raw.match(/\b(in|at)\s+([^]+?)(?=\bwith\b|\bto\b|\bfrom\b|$)/);
    let object = rest.replace(/^(\w+)(ing)?\b/, "")
      .replace(/\b(with|to|from)\b[^]+$/, "")
      .trim();
    object = stripArticles(object);

    // Existential: there is/are/was/were NP (+ in/at PLACE)
    const ex = raw.match(/^there\s+(is|are|was|were)\s+([^]+)$/);
    if (ex) {
      const npChunk = ex[2].replace(/\b(in|at)\b[^]+$/, '').trim();
      const place = (ex[2].match(/\b(in|at)\s+([^]+)$/) || [])[2]?.trim();
      const np = lexNoun(nouns, npChunk);
      const v = conjCopula('e', tense);
      const parts: Part[] = [];
      // present non‑negated may drop copula, but default to include it
      const drop = (tense==='a' && !neg && !hab && !forceCopula);
      if (!drop) parts.push({ text: v || '' });
      parts.push({ text: np, u: np === npChunk, en: npChunk });
      if (place) { parts.push({ text: 'la' }); const w = lexNoun(nouns, place); parts.push({ text: w, u: w === place, en: place }); }
      setTr(s0=>({ ...s0, hs: parts.map(p=>p.text).join(' ').trim(), hsParts: parts }));
      return;
    }

    // Possession: has/have/had NP → 3sg COP + NP + ith + SUBJ
    const poss = raw.match(/^(has|have|had)\s+([^]+)$/);
    if (poss) {
      const npChunk = poss[2].trim();
      const np = lexNoun(nouns, npChunk);
      const v = conjCopula('e', tense);
      const parts: Part[] = [];
      const drop = (tense==='a' && !neg && !hab && !forceCopula);
      if (!drop) parts.push({ text: v || '' });
      parts.push({ text: np, u: np === npChunk, en: npChunk });
      parts.push({ text: 'ith' });
      parts.push({ text: subj.form });
      setTr(s0=>({ ...s0, hs: parts.map(p=>p.text).join(' ').trim(), hsParts: parts }));
      return;
    }

    // Locative: (be‑form optional) in/at PLACE
    if (inMatchRaw) {
      const place = inMatchRaw[2].trim();
      const v = conjCopula(subj.subjV, tense);
      const parts: Part[] = [];
      const drop = (tense==='a' && !neg && !forceCopula);
      parts.push({ text: subj.form });
      if (!drop) parts.push({ text: v || '' });
      parts.push({ text: 'la' });
      const w = lexNoun(nouns, place);
      parts.push({ text: w, u: w === place, en: place });
      setTr(s0=>({ ...s0, hs: parts.map(p=>p.text).join(' ').trim(), hsParts: parts }));
      return;
    }

    // Try single‑token verb first, then a two‑word verb phrase.
    let root = findRootByEnglish(roots, verbToken);
    if (!root && words.length>=2) root = findRootByEnglish(roots, `${words[0]} ${words[1]}`);

    // Equative copula: be‑form or SUBJ + NP (no explicit verb)
    const beEquative = beFormRe.test(raw) || (!root && !withMatchRaw && !toMatchRaw && !fromMatchRaw && !inMatchRaw && !!raw.trim());
    if (beEquative) {
      // Remove leading be‑form if present
      let afterBe = raw.replace(beFormRe, '').trim(); if (!afterBe) afterBe = raw;
      const npChunk = afterBe.trim();
      const np = lexNoun(nouns, npChunk);
      const parts: Part[] = [];
      parts.push({ text: subj.form });
      const drop = (tense==='a' && !neg && !hab && !forceCopula);
      if (!drop) {
        const v = conjCopula(subj.subjV, tense);
        parts.push({ text: v || '' });
      }
      parts.push({ text: np, u: np === npChunk, en: npChunk });
      setTr(s0=>({ ...s0, hs: parts.map(p=>p.text).join(' ').trim(), hsParts: parts }));
      return;
    }
    // If no verb root is found, attempt partial translation: pronoun + unchanged verb token + noun/prep lexing.
    if (!root) {
      const cand = stripArticles(tr.en).trim();
      const simple = cand.replace(/[!?.,]/g, " ").replace(/\s+/g, " ").trim();
      const wc = simple ? simple.split(" ").length : 0;
      if (wc === 1) {
        // Single-word: translate noun if possible, else echo.
        const out = lexNoun(nouns, cand);
        const parts: Part[] = [{ text: out, u: out === cand, en: cand }];
        setTr(s0 => ({ ...s0, hs: out, hsParts: parts }));
        return;
      }
      const parts: Part[] = [];
      parts.push({ text: subj.form });
      if (verbToken) parts.push({ text: verbToken, u: true, en: verbToken });
      if (object) { const objOut = lexNoun(nouns, object); parts.push({ text: objOut, u: objOut === object, en: object }); }
      if (withMatch) { parts.push({ text: "ri" }); const v = withMatch[1].trim(); const w = lexNoun(nouns, v); parts.push({ text: w, u: w === v, en: v }); }
      if (toMatch)   { parts.push({ text: "ith" }); const v = toMatch[1].trim();   const w = lexNoun(nouns, v); parts.push({ text: w, u: w === v, en: v }); }
      if (fromMatch) { parts.push({ text: "ʌs" }); const v = fromMatch[1].trim(); const w = lexNoun(nouns, v); parts.push({ text: w, u: w === v, en: v }); }
      setTr(s0 => ({ ...s0, hs: parts.map(p=>p.text).join(" "), hsParts: parts }));
      return;
    }
    let verb = `${root.c1}${subj.subjV}${root.c2}${tense}${root.c3}`; if (prog) verb=withProgressive(verb,root); if (hab) verb=withHabitual(verb); if (neg) verb=withNegation(verb);
    const parts2: Part[] = [];
    parts2.push({ text: subj.form });
    parts2.push({ text: verb });
    if (object) { const objOut = lexNoun(nouns, object); parts2.push({ text: objOut, u: objOut === object, en: object }); }
    if (withMatch) { parts2.push({ text: "ri" }); const v = withMatch[1].trim(); const w = lexNoun(nouns, v); parts2.push({ text: w, u: w === v, en: v }); }
    if (toMatch)   { parts2.push({ text: "ith" }); const v = toMatch[1].trim();   const w = lexNoun(nouns, v); parts2.push({ text: w, u: w === v, en: v }); }
    if (fromMatch) { parts2.push({ text: "ʌs" }); const v = fromMatch[1].trim(); const w = lexNoun(nouns, v); parts2.push({ text: w, u: w === v, en: v }); }
    setTr(s=>({ ...s, hs: parts2.map(p=>p.text).join(" "), hsParts: parts2 }));
  }

  if (embedded) {
    return (
      <>
        <p className="text-sm text-neutral-600 mb-3">Translate simple one-verb English lines into Huntspeak. Recognizes pronouns, will/did/not, and with/to/from phrases.</p>
        <div className="space-y-2">
          <textarea className="w-full h-20 px-3 py-2 rounded-xl border border-neutral-300" placeholder="Type: we will hunt with a trap from the Shroud" value={tr.en} onChange={e=>setTr(s=>({ ...s, en: e.target.value }))} />
          <div className="flex items-center gap-2">
            <button onClick={translate} className="px-3 py-2 rounded-xl border border-neutral-300 hover:bg-neutral-50">Translate</button>
            <button onClick={()=>clip(tr.hs)} className="px-3 py-2 rounded-xl border border-neutral-300 hover:bg-neutral-50">Copy</button>
            <div className="text-sm text-neutral-500">Recognizes pronouns, will/did/not, with/to/from.</div>
          </div>
          <div className="rounded-2xl border border-neutral-200 p-3">
            <div className="text-xs uppercase tracking-wide text-neutral-500">Huntspeak</div>
            <div className="text-lg font-semibold break-words mt-1">
              {tr.hsParts && tr.hsParts.length ? (
                tr.hsParts.map((p, i) => p.u ? (
                  <span key={i} title="Word not found in lexicon. Click to add it." onClick={()=>openAddEnglish(p.en ?? p.text)} className="text-red-600 cursor-pointer hover:underline decoration-dotted underline-offset-2">{i>0?" ":""}{p.text}</span>
                ) : (
                  <span key={i}>{i>0?" ":""}{p.text}</span>
                ))
              ) : (
                tr.hs || "—"
              )}
            </div>
          </div>
        </div>
        {addOpen && (
          <>
            <div className="fixed inset-0 bg-black/40 z-50" onClick={()=>setAddOpen(null)} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e)=>{ if (e.target===e.currentTarget) setAddOpen(null); }}>
              <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white fantasy-card p-4">
                {addOpen.step === 'choose' && (
                  <div className="space-y-3">
                    <div className="text-sm text-neutral-700">Add “<span className="font-semibold">{addOpen.en}</span>” to lexicon:</div>
                    <div className="flex items-center gap-2">
                      <button className="px-3 py-2 rounded-lg border border-neutral-300 hover:bg-neutral-50" onClick={()=>{ setNounDraft(s=>({...s, gloss: addOpen.en})); setAddOpen(o=>o && ({ ...o, step: 'noun' })); }}>Add as Noun</button>
                      <button className="px-3 py-2 rounded-lg border border-neutral-300 hover:bg-neutral-50" onClick={()=> setAddOpen(o=>o && ({ ...o, step: 'verb' }))}>Add as Verb</button>
                    </div>
                  </div>
                )}
                {addOpen.step === 'noun' && (
                  <div className="space-y-3">
                    <div className="text-sm font-semibold">New Noun</div>
                    <input className="w-full px-2 py-1 rounded-lg border border-neutral-300" placeholder="noun (word)" value={nounDraft.word} onChange={e=>setNounDraft(s=>({...s, word: e.target.value}))} />
                    <input className="w-full px-2 py-1 rounded-lg border border-neutral-300" placeholder="gloss (English)" value={nounDraft.gloss} onChange={e=>setNounDraft(s=>({...s, gloss: e.target.value}))} />
                    <input className="w-full px-2 py-1 rounded-lg border border-neutral-300" placeholder="extra English (comma-separated)" value={nounDraft.syn} onChange={e=>setNounDraft(s=>({...s, syn: e.target.value}))} />
                    <div className="flex items-center justify-end gap-2">
                      <button className="px-3 py-2 rounded-lg border border-neutral-300 hover:bg-neutral-50" onClick={()=>setAddOpen(null)}>Cancel</button>
                      <button className="px-3 py-2 rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-50" onClick={saveNoun}>Save Noun</button>
                    </div>
                  </div>
                )}
                {addOpen.step === 'verb' && (
                  <div className="space-y-3">
                    <div className="text-sm font-semibold">New Verb Root</div>
                    <div className="grid grid-cols-3 gap-2">
                      <input className="px-2 py-1 rounded-lg border border-neutral-300 text-center" placeholder="C1" value={rootDraft.c1} onChange={e=>setRootDraft(s=>({...s, c1: e.target.value}))} />
                      <input className="px-2 py-1 rounded-lg border border-neutral-300 text-center" placeholder="C2" value={rootDraft.c2} onChange={e=>setRootDraft(s=>({...s, c2: e.target.value}))} />
                      <input className="px-2 py-1 rounded-lg border border-neutral-300 text-center" placeholder="C3" value={rootDraft.c3} onChange={e=>setRootDraft(s=>({...s, c3: e.target.value}))} />
                    </div>
                    <input className="w-full px-2 py-1 rounded-lg border border-neutral-300" placeholder="gloss (English)" value={rootDraft.gloss} onChange={e=>setRootDraft(s=>({...s, gloss: e.target.value}))} />
                    <input className="w-full px-2 py-1 rounded-lg border border-neutral-300" placeholder="extra English (comma-separated)" value={rootDraft.syn} onChange={e=>setRootDraft(s=>({...s, syn: e.target.value}))} />
                    <div className="flex items-center justify-end gap-2">
                      <button className="px-3 py-2 rounded-lg border border-neutral-300 hover:bg-neutral-50" onClick={()=>setAddOpen(null)}>Cancel</button>
                      <button className="px-3 py-2 rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-50" onClick={saveRoot}>Save Verb</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </>
    );
  }

  return (
    <section className="rounded-3xl border border-neutral-200 p-4 shadow-sm fantasy-card">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl md:text-2xl font-semibold">Free Translator (simple, 1-verb lines)</h2>
        {showCollapse && (
          <button aria-label={collapsed? 'Expand' : 'Collapse'} className="px-2 py-1 text-sm rounded border border-neutral-300 hover:bg-neutral-50" onClick={()=>setCollapsed(c=>!c)}>
            {collapsed ? '▸' : '▾'}
          </button>
        )}
      </div>
      {!collapsed && (
      <>
      <p className="text-sm text-neutral-600 mb-3">Try: <code>we will hunt with a trap from the Shroud</code>. Recognizes pronouns + will/did/not + with/to/from.</p>
      <div className="space-y-2">
        <textarea className="w-full h-20 px-3 py-2 rounded-xl border border-neutral-300" placeholder="Type: we will hunt with a trap from the Shroud" value={tr.en} onChange={e=>setTr(s=>({ ...s, en: e.target.value }))} />
        <div className="flex items-center gap-2">
          <button onClick={translate} className="px-3 py-2 rounded-xl border border-neutral-300 hover:bg-neutral-50">Translate</button>
          <button onClick={()=>clip(tr.hs)} className="px-3 py-2 rounded-xl border border-neutral-300 hover:bg-neutral-50">Copy</button>
          <div className="text-sm text-neutral-500">Recognizes pronouns, will/did/not, with/to/from.</div>
        </div>
        <div className="rounded-2xl border border-neutral-200 p-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Huntspeak</div>
          <div className="text-lg font-semibold break-words mt-1">
            {tr.hsParts && tr.hsParts.length ? (
              tr.hsParts.map((p, i) => p.u ? (
                <span key={i} title="Word not found in lexicon. Click to add it." onClick={()=>openAddEnglish(p.en ?? p.text)} className="text-red-600 cursor-pointer hover:underline decoration-dotted underline-offset-2">{i>0?" ":""}{p.text}</span>
              ) : (
                <span key={i}>{i>0?" ":""}{p.text}</span>
              ))
            ) : (
              tr.hs || "—"
            )}
          </div>
        </div>

        {addOpen && (
          <>
            <div className="fixed inset-0 bg-black/40 z-50" onClick={()=>setAddOpen(null)} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e)=>{ if (e.target===e.currentTarget) setAddOpen(null); }}>
              <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white fantasy-card p-4">
                {addOpen.step === 'choose' && (
                  <div className="space-y-3">
                    <div className="text-sm text-neutral-700">Add “<span className="font-semibold">{addOpen.en}</span>” to lexicon:</div>
                    <div className="flex items-center gap-2">
                      <button className="px-3 py-2 rounded-lg border border-neutral-300 hover:bg-neutral-50" onClick={()=>{ setNounDraft(s=>({...s, gloss: addOpen.en})); setAddOpen(o=>o && ({ ...o, step: 'noun' })); }}>Add as Noun</button>
                      <button className="px-3 py-2 rounded-lg border border-neutral-300 hover:bg-neutral-50" onClick={()=> setAddOpen(o=>o && ({ ...o, step: 'verb' }))}>Add as Verb</button>
                    </div>
                  </div>
                )}
                {addOpen.step === 'noun' && (
                  <div className="space-y-3">
                    <div className="text-sm font-semibold">New Noun</div>
                    <input className="w-full px-2 py-1 rounded-lg border border-neutral-300" placeholder="noun (word)" value={nounDraft.word} onChange={e=>setNounDraft(s=>({...s, word: e.target.value}))} />
                    <input className="w-full px-2 py-1 rounded-lg border border-neutral-300" placeholder="gloss (English)" value={nounDraft.gloss} onChange={e=>setNounDraft(s=>({...s, gloss: e.target.value}))} />
                    <input className="w-full px-2 py-1 rounded-lg border border-neutral-300" placeholder="extra English (comma-separated)" value={nounDraft.syn} onChange={e=>setNounDraft(s=>({...s, syn: e.target.value}))} />
                    <div className="flex items-center justify-end gap-2">
                      <button className="px-3 py-2 rounded-lg border border-neutral-300 hover:bg-neutral-50" onClick={()=>setAddOpen(null)}>Cancel</button>
                      <button className="px-3 py-2 rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-50" onClick={saveNoun}>Save Noun</button>
                    </div>
                  </div>
                )}
                {addOpen.step === 'verb' && (
                  <div className="space-y-3">
                    <div className="text-sm font-semibold">New Verb Root</div>
                    <div className="grid grid-cols-3 gap-2">
                      <input className="px-2 py-1 rounded-lg border border-neutral-300 text-center" placeholder="C1" value={rootDraft.c1} onChange={e=>setRootDraft(s=>({...s, c1: e.target.value}))} />
                      <input className="px-2 py-1 rounded-lg border border-neutral-300 text-center" placeholder="C2" value={rootDraft.c2} onChange={e=>setRootDraft(s=>({...s, c2: e.target.value}))} />
                      <input className="px-2 py-1 rounded-lg border border-neutral-300 text-center" placeholder="C3" value={rootDraft.c3} onChange={e=>setRootDraft(s=>({...s, c3: e.target.value}))} />
                    </div>
                    <input className="w-full px-2 py-1 rounded-lg border border-neutral-300" placeholder="gloss (English)" value={rootDraft.gloss} onChange={e=>setRootDraft(s=>({...s, gloss: e.target.value}))} />
                    <input className="w-full px-2 py-1 rounded-lg border border-neutral-300" placeholder="extra English (comma-separated)" value={rootDraft.syn} onChange={e=>setRootDraft(s=>({...s, syn: e.target.value}))} />
                    <div className="flex items-center justify-end gap-2">
                      <button className="px-3 py-2 rounded-lg border border-neutral-300 hover:bg-neutral-50" onClick={()=>setAddOpen(null)}>Cancel</button>
                      <button className="px-3 py-2 rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-50" onClick={saveRoot}>Save Verb</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
      </>
      )}
    </section>
  );
}
