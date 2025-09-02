import { useEffect, useMemo } from "react";
import type { Noun, Root } from "../types";
import { PRONOUNS, TENSES } from "../types";
import Toggle from "./ui/Toggle";
import NiceSelect from "./ui/NiceSelect";
import { LS_KEYS, useLocalStorageState } from "../lib/storage";
import { buildFinite, withHabitual, withNegation, withProgressive } from "../lib/morphology";

// Helper: best‑effort clipboard copy; ignore failures (e.g., permissions).
const clip = async (text: string) => { try { await navigator.clipboard.writeText(text); } catch {} };

/**
 * Guided sentence builder. Users pick pronoun/root/tense and optional toggles,
 * then optionally fill object and adpositional phrases. Produces a 1‑line
 * Huntspeak sentence (copyable).
 */
export default function TalkPad({ roots, nouns, selectedRootId, onSelectRoot, syncMorph = false, morph, onMorphChange, onToggleSync }: {
  roots: Root[];
  nouns: Noun[];
  selectedRootId?: string;
  onSelectRoot?: (id: string)=>void;
  syncMorph?: boolean;
  morph?: { neg: boolean; prog: boolean; hab: boolean };
  onMorphChange?: (m: { neg: boolean; prog: boolean; hab: boolean }) => void;
  onToggleSync?: () => void;
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
  const hsVerb = useMemo(()=>{
    if (!r) return "";
    let form = buildFinite(r, pron.subjV, tense.vowel);
    if (effProg) form = withProgressive(form, r);
    if (effHab) form = withHabitual(form);
    if (effNeg) form = withNegation(form);
    return form;
  }, [r, pron, tense, effProg, effHab, effNeg]);

  // Compose the final sentence. Order:
  // pronoun • verb • [object] • [fi INSTR] • [ga TO] • [ʌs FROM] • [qa?]
  // Register marks: ƛ at start (flank), aᵘ before final, ǃ at end (attention).
  const sentence = useMemo(()=>{
    if (!r) return "";
    const bits: string[] = [];
    bits.push(pron.form);
    bits.push(hsVerb);
    if (objectNoun) bits.push(objectNoun.word);
    if (withNoun) bits.push("fi", withNoun.word);
    if (state.toText.trim()) bits.push("ga", state.toText.trim());
    if (state.fromText.trim()) bits.push("ʌs", state.fromText.trim());
    if (state.question) bits.push("qa?");
    if (state.register.flank) bits.unshift("ƛ");
    if (state.register.hush) bits.push("aᵘ");
    if (state.register.attn) bits.push("ǃ");
    return bits.join(" ");
  }, [r, pron, hsVerb, objectNoun, withNoun, state.toText, state.fromText, state.question, state.register]);

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
          <div className="text-xs text-neutral-500 mb-2">Instrument marked with <code>fi</code> (e.g., fi trap).</div>
          <NiceSelect searchable value={state.withNounId} onChange={v=>setState(s=>({...s, withNounId:v}))} items={[{value:"", label:"— none —"}, ...nouns.map(n=>({ value:n.id, label:`${n.word} — ${n.gloss || ""}` }))]} />
        </div>
        <div className="rounded-2xl border border-neutral-200 p-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">To / From</div>
          <div className="text-xs text-neutral-500 mb-2">Use <code>ga</code> for “to” and <code>ʌs</code> for “from” (e.g., <code>ga</code> prey; <code>ʌs</code> Shroud).</div>
          <div className="grid grid-cols-2 gap-2">
            <input className="px-2 py-2 rounded-lg border border-neutral-300" placeholder="to (ga) — e.g., prey" value={state.toText} onChange={e=>setState(s=>({...s, toText:e.target.value}))} />
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
              <div className="text-xl font-semibold break-words mt-1">{sentence || "—"}</div>
            </div>
            <button onClick={()=>clip(sentence)} className="px-3 py-2 rounded-xl border copy-btn">Copy</button>
          </div>
        </div>
      </div>
    </div>
  );
}
