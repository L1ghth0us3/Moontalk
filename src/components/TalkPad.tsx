import { useEffect, useMemo, useState } from "react";
import type { Noun, Root } from "../types";
import { PRONOUNS, TENSES } from "../types";
import Toggle from "./ui/Toggle";
import NiceSelect from "./ui/NiceSelect";
import { lexNoun } from "../lib/lex";
import { LS_KEYS, useLocalStorageState } from "../lib/storage";
import { buildFinite, withHabitual, withNegation, withProgressive } from "../lib/morphology";

// Helper: best‑effort clipboard copy; ignore failures (e.g., permissions).
const clip = async (text: string) => { try { await navigator.clipboard.writeText(text); } catch {} };

/**
 * Guided sentence builder.
 *
 * Users pick pronoun/root/tense and optional morphology toggles, then
 * optionally choose an object noun and adpositional phrases (with/to/from).
 * Produces a single‑line Huntspeak sentence ready to copy.
 *
 * Data flow
 * - Persisted panel state via LS_KEYS.talk (so user context survives reloads).
 * - Optional sync with FiniteForms for Neg/Prog/Hab via shared `morph` props.
 */
export default function TalkPad({ roots, nouns, selectedRootId, onSelectRoot, syncMorph = false, morph, onMorphChange, onToggleSync, onCreateNoun, onCreateRoot }: {
  roots: Root[];
  nouns: Noun[];
  selectedRootId?: string;
  onSelectRoot?: (id: string)=>void;
  syncMorph?: boolean;
  morph?: { neg: boolean; prog: boolean; hab: boolean };
  onMorphChange?: (m: { neg: boolean; prog: boolean; hab: boolean }) => void;
  onToggleSync?: () => void;
  onCreateNoun?: (n: { word: string; gloss?: string; synonyms?: string[] }) => void;
  onCreateRoot?: (r: { c1: string; c2: string; c3: string; gloss?: string; synonyms?: string[] }) => void;
}){
  const [state, setState] = useLocalStorageState(LS_KEYS.talk, {
    pronForm: PRONOUNS[0].form,
    rootId: roots[0]?.id || "",
    tenseKey: TENSES[0].key,
    neg: false, prog: false, hab: false,
    obj: "", objectNounId: "", withNounId: "", toText: "", fromText: "",
    question: false, register: { attn:false, flank:false, hush:false },
  });

  // Keep selected IDs valid when upstream lists mutate (add/remove).
  useEffect(()=>{
    if (state.rootId && !roots.find(r=>r.id===state.rootId)) setState(s=>({ ...s, rootId: roots[0]?.id || "" }));
    if (state.withNounId && !nouns.find(n=>n.id===state.withNounId)) setState(s=>({ ...s, withNounId: "" }));
    if (state.objectNounId && !nouns.find(n=>n.id===state.objectNounId)) setState(s=>({ ...s, objectNounId: "" }));
  }, [roots, nouns]);

  // When sync is enabled, use shared toggles directly via eff*; no local mirroring needed.

  // Follow external selected root from the Verb Root component when provided.
  useEffect(()=>{
    if (!selectedRootId) return;
    const exists = roots.some(r=>r.id===selectedRootId);
    if (!exists) return;
    if (state.rootId !== selectedRootId) setState(s=>({ ...s, rootId: selectedRootId }));
  }, [selectedRootId, roots]);

  const pron = PRONOUNS.find(p=>p.form===state.pronForm) || PRONOUNS[0];
  const effNeg = syncMorph ? !!morph?.neg : state.neg;
  const effProg = syncMorph ? !!morph?.prog : state.prog;
  const effHab = syncMorph ? !!morph?.hab : state.hab;
  const tense = TENSES.find(t=>t.key===state.tenseKey) || TENSES[0];
  const r = useMemo(()=> roots.find(x=>x.id===state.rootId) || roots[0], [roots, state.rootId]);
  const withNoun = nouns.find(n=>n.id===state.withNounId);
  const objectNoun = nouns.find(n=>n.id===state.objectNounId);

  // Migrate legacy free-text obj to objectNounId when possible
  useEffect(()=>{
    if (!state.obj || state.objectNounId) return;
    const needle = state.obj.toLowerCase().trim();
    if (!needle) return;
    const match = nouns.find(n => n.word.toLowerCase() === needle
      || n.gloss.toLowerCase() === needle
      || (n.synonyms || []).some(s => s.toLowerCase() === needle));
    if (match) setState(s=>({ ...s, objectNounId: match.id }));
  }, [state.obj, state.objectNounId, nouns]);

  // Build the Huntspeak verb form in stages with optional morphology toggles.
  // Order of application: Progressive → Habitual → Negation.
  const hsVerb = useMemo(()=>{
    if (!r) return "";
    let form = buildFinite(r, pron.subjV, tense.vowel);
    if (effProg) form = withProgressive(form, r);
    if (effHab) form = withHabitual(form);
    if (effNeg) form = withNegation(form);
    return form;
  }, [r, pron, tense, effProg, effHab, effNeg]);

  type Part = { text: string; u?: boolean; en?: string };
  // Compose the final sentence into parts with untranslated markers for hover/add flows.
  // pronoun • verb • [object] • [fi INSTR] • [ga TO] • [ʌs FROM] • [qa?]
  // Register marks: ƛ at start (flank), aᵘ before final, ǃ at end (attention).
  const sentenceParts = useMemo<Part[]>(()=>{
    if (!r) return [];
    const parts: Part[] = [];
    // Registers (leading)
    if (state.register.flank) parts.push({ text: "ƛ" });
    // Core
    parts.push({ text: pron.form });
    parts.push({ text: hsVerb });
    if (objectNoun) parts.push({ text: objectNoun.word });
    if (withNoun) { parts.push({ text: "ri" }); parts.push({ text: withNoun.word }); }
    if (state.toText.trim()) { parts.push({ text: "ith" }); const v = state.toText.trim(); const w = lexNoun(nouns, v); parts.push({ text: w, u: w === v, en: v }); }
    if (state.fromText.trim()) { parts.push({ text: "ʌs" }); const v = state.fromText.trim(); const w = lexNoun(nouns, v); parts.push({ text: w, u: w === v, en: v }); }
    if (state.question) parts.push({ text: "qa?" });
    if (state.register.hush) parts.push({ text: "aᵘ" });
    if (state.register.attn) parts.push({ text: "ǃ" });
    return parts;
  }, [r, pron, hsVerb, objectNoun, withNoun, state.toText, state.fromText, state.question, state.register, nouns]);
  const sentence = useMemo(()=> sentenceParts.map(p=>p.text).join(" "), [sentenceParts]);

  // Experimental: quick add unknown word as Noun or Verb Root
  const [addOpen, setAddOpen] = useState<null | { en: string; step: 'choose'|'noun'|'verb' }>(null);
  const [nounDraft, setNounDraft] = useState<{ word: string; gloss: string; syn: string }>({ word: "", gloss: "", syn: "" });
  const [rootDraft, setRootDraft] = useState<{ c1: string; c2: string; c3: string; gloss: string; syn: string }>({ c1: "", c2: "", c3: "", gloss: "", syn: "" });
  function openAddEnglish(en: string){ setNounDraft({ word: "", gloss: en, syn: "" }); setRootDraft({ c1: "", c2: "", c3: "", gloss: en, syn: "" }); setAddOpen({ en, step: 'choose' }); }
  function saveNoun(){ const syns = nounDraft.syn.split(',').map(s=>s.trim()).filter(Boolean); onCreateNoun?.({ word: nounDraft.word.trim(), gloss: nounDraft.gloss.trim(), synonyms: syns }); setAddOpen(null); }
  function saveRoot(){ const syns = rootDraft.syn.split(',').map(s=>s.trim()).filter(Boolean); if (!rootDraft.c1 || !rootDraft.c2 || !rootDraft.c3) return; onCreateRoot?.({ c1: rootDraft.c1.trim(), c2: rootDraft.c2.trim(), c3: rootDraft.c3.trim(), gloss: rootDraft.gloss.trim(), synonyms: syns }); setAddOpen(null); }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-neutral-200 p-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Who</div>
          {(() => {
            const EN_WHO: Record<string,string> = { 'ɪ':'I', su:'you (sg)', se:'he/she', 'tɪ':'we', tu:'you (pl)', te:'they' };
            const items = PRONOUNS.map(p => ({ value: p.form, label: `${p.label} — ${EN_WHO[p.form] || ''}`.trim() }));
            return (
              <NiceSelect value={state.pronForm} onChange={v=>setState(s=>({...s, pronForm:v}))} items={items} />
            );
          })()}
        </div>
        <div className="rounded-2xl border border-neutral-200 p-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Verb</div>
          <NiceSelect searchable value={state.rootId} onChange={id=>{ setState(s=>({...s, rootId:id})); onSelectRoot?.(id); }} items={roots.map(rt=>({ value:rt.id, label: `${[rt.c1, rt.c2, rt.c3].join("-")} — ${rt.gloss || "(no gloss)"}` }))} />
        </div>
        <div className="rounded-2xl border border-neutral-200 p-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Tense</div>
          <NiceSelect value={state.tenseKey} onChange={k=>setState(s=>({...s, tenseKey:k}))} items={TENSES.map(t=>({ value:t.key, label:t.label }))} />
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="flex flex-wrap gap-3">
              <Toggle label="Negation" info="Adds naaq-; becomes naq- before k/g/q." checked={effNeg} onChange={v=>{
                if (syncMorph) onMorphChange?.({ neg: v, prog: effProg, hab: effHab }); else setState(s=>({...s, neg:v}));
              }} />
              <Toggle label="Progressive" info="Geminate C2 before tense vowel." checked={effProg} onChange={v=>{
                if (syncMorph) onMorphChange?.({ neg: effNeg, prog: v, hab: effHab }); else setState(s=>({...s, prog:v}));
              }} />
              <Toggle label="Habitual" info="Adds -ar for habitual." checked={effHab} onChange={v=>{
                if (syncMorph) onMorphChange?.({ neg: effNeg, prog: effProg, hab: v }); else setState(s=>({...s, hab:v}));
              }} />
            </div>
            <div className="relative group ml-3">
              <button
                type="button"
                onClick={onToggleSync}
                className={`text-xs px-2 py-0.5 rounded-full border select-none ${syncMorph ? 'border-emerald-300 text-emerald-700 bg-emerald-50' : 'border-neutral-300 text-neutral-700 bg-neutral-50 hover:bg-neutral-100'}`}
                title={syncMorph ? 'Click to turn sync Off' : 'Click to turn sync On'}
              >
                {syncMorph ? 'Sync: On' : 'Sync: Off'}
              </button>
              <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 hidden rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs leading-snug text-neutral-900 shadow-xl whitespace-nowrap group-hover:block">
                Sync Neg/Prog/Hab across panels
              </span>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-neutral-200 p-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Object (what)</div>
          <NiceSelect searchable
            value={state.objectNounId}
            onChange={v=>setState(s=>({...s, objectNounId:v}))}
            items={[{value:"", label:"— none —"}, ...nouns.map(n=>({ value:n.id, label:`${n.word} — ${n.gloss || ""}` }))]}
          />
        </div>
        <div className="rounded-2xl border border-neutral-200 p-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">With (instrument)</div>
          <div className="text-xs text-neutral-500 mb-2">Instrument marked with <code>ri</code> (e.g., ri trap).</div>
          <NiceSelect searchable value={state.withNounId} onChange={v=>setState(s=>({...s, withNounId:v}))} items={[{value:"", label:"— none —"}, ...nouns.map(n=>({ value:n.id, label:`${n.word} — ${n.gloss || ""}` }))]} />
        </div>
        <div className="rounded-2xl border border-neutral-200 p-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">To / From</div>
          <div className="text-xs text-neutral-500 mb-2">Use <code>ith</code> for “to” and <code>ʌs</code> for “from” (e.g., <code>ith</code> prey; <code>ʌs</code> Shroud).</div>
          <div className="grid grid-cols-2 gap-2">
            <input className="px-2 py-2 rounded-lg border border-neutral-300" placeholder="to (ith) — e.g., prey" value={state.toText} onChange={e=>setState(s=>({...s, toText:e.target.value}))} />
            <input className="px-2 py-2 rounded-lg border border-neutral-300" placeholder="from (ʌs) — e.g., Shroud" value={state.fromText} onChange={e=>setState(s=>({...s, fromText:e.target.value}))} />
          </div>
          <div className="mt-2 flex flex-wrap gap-3">
            <Toggle label="Question (qa?)" checked={state.question} onChange={v=>setState(s=>({...s, question:v}))} />
          </div>
        </div>
        <div className="rounded-2xl border border-neutral-200 p-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Hunt Register</div>
          <div className="flex flex-wrap gap-3">
            <Toggle label="ƛ flank" checked={state.register.flank} onChange={v=>setState(s=>({...s, register:{...s.register, flank:v}}))} />
            <Toggle label="ǃ attention/stop" checked={state.register.attn} onChange={v=>setState(s=>({...s, register:{...s.register, attn:v}}))} />
            <Toggle label="aᵘ hush" checked={state.register.hush} onChange={v=>setState(s=>({...s, register:{...s.register, hush:v}}))} />
          </div>
        </div>
        {/* Result panel occupies the remaining slot on the second row (at 2xl) */}
        <div className="rounded-2xl border p-3 result-card">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <div className="text-xs uppercase tracking-wide opacity-80">Result (Huntspeak)</div>
              <div className="text-xl font-semibold break-words mt-1">
                {sentenceParts.length ? (
                  sentenceParts.map((p, i) => p.u ? (
                    <span key={i}
                      title="Word not found in lexicon. Click to add it."
                      onClick={()=>openAddEnglish(p.en ?? p.text)}
                      className="text-red-600 cursor-pointer hover:underline decoration-dotted underline-offset-2"
                    >{i>0?" ":""}{p.text}</span>
                  ) : (
                    <span key={i}>{i>0?" ":""}{p.text}</span>
                  ))
                ) : (
                  "—"
                )}
              </div>
            </div>
            <button onClick={()=>clip(sentence)} className="px-3 py-2 rounded-xl border copy-btn">Copy</button>
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
    </div>
  );
}
