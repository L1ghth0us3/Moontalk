import { useEffect, useMemo } from "react";
import type { Noun, Root } from "../types";
import { PRONOUNS, TENSES } from "../types";
import Toggle from "./ui/Toggle";
import NiceSelect from "./ui/NiceSelect";
import { LS_KEYS, useLocalStorageState } from "../lib/storage";
import { buildFinite, withHabitual, withNegation, withProgressive } from "../lib/morphology";

const clip = async (text: string) => { try { await navigator.clipboard.writeText(text); } catch {} };

export default function TalkPad({ roots, nouns }: { roots: Root[]; nouns: Noun[] }){
  const [state, setState] = useLocalStorageState(LS_KEYS.talk, {
    pronForm: PRONOUNS[0].form,
    rootId: roots[0]?.id || "",
    tenseKey: TENSES[0].key,
    neg: false, prog: false, hab: false,
    obj: "", withNounId: "", toText: "", fromText: "",
    question: false, register: { attn:false, flank:false, hush:false },
  });

  // keep IDs valid when lists change
  useEffect(()=>{
    if (state.rootId && !roots.find(r=>r.id===state.rootId)) setState(s=>({ ...s, rootId: roots[0]?.id || "" }));
    if (state.withNounId && !nouns.find(n=>n.id===state.withNounId)) setState(s=>({ ...s, withNounId: "" }));
  }, [roots, nouns]);

  const pron = PRONOUNS.find(p=>p.form===state.pronForm) || PRONOUNS[0];
  const tense = TENSES.find(t=>t.key===state.tenseKey) || TENSES[0];
  const r = useMemo(()=> roots.find(x=>x.id===state.rootId) || roots[0], [roots, state.rootId]);
  const withNoun = nouns.find(n=>n.id===state.withNounId);

  const hsVerb = useMemo(()=>{
    if (!r) return "";
    let form = buildFinite(r, pron.subjV, tense.vowel);
    if (state.prog) form = withProgressive(form, r);
    if (state.hab) form = withHabitual(form);
    if (state.neg) form = withNegation(form);
    return form;
  }, [r, pron, tense, state.prog, state.hab, state.neg]);

  const sentence = useMemo(()=>{
    if (!r) return "";
    const bits: string[] = [];
    bits.push(pron.form);
    bits.push(hsVerb);
    if (state.obj.trim()) bits.push(state.obj.trim());
    if (withNoun) bits.push("fi", withNoun.word);
    if (state.toText.trim()) bits.push("ga", state.toText.trim());
    if (state.fromText.trim()) bits.push("ʌs", state.fromText.trim());
    if (state.question) bits.push("qa");
    if (state.register.flank) bits.unshift("ƛ");
    if (state.register.hush) bits.push("aᵘ");
    if (state.register.attn) bits.push("ǃ");
    return bits.join(" ");
  }, [r, pron, hsVerb, state.obj, withNoun, state.toText, state.fromText, state.question, state.register]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-neutral-200 p-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Who</div>
          <NiceSelect value={state.pronForm} onChange={v=>setState(s=>({...s, pronForm:v}))} items={PRONOUNS.map(p=>({ value:p.form, label:p.label }))} />
        </div>
        <div className="rounded-2xl border border-neutral-200 p-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Verb</div>
          <NiceSelect value={state.rootId} onChange={id=>setState(s=>({...s, rootId:id}))} items={roots.map(rt=>({ value:rt.id, label: `${[rt.c1, rt.c2, rt.c3].join("-")} — ${rt.gloss || "(no gloss)"}` }))} />
        </div>
        <div className="rounded-2xl border border-neutral-200 p-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Tense</div>
          <NiceSelect value={state.tenseKey} onChange={k=>setState(s=>({...s, tenseKey:k}))} items={TENSES.map(t=>({ value:t.key, label:t.label }))} />
          <div className="mt-2 flex flex-wrap gap-3">
            <Toggle label="Negation" info="Adds naaq-; becomes naq- before k/g/q." checked={state.neg} onChange={v=>setState(s=>({...s, neg:v}))} />
            <Toggle label="Progressive" info="Geminate C2 before tense vowel." checked={state.prog} onChange={v=>setState(s=>({...s, prog:v}))} />
            <Toggle label="Habitual" info="Adds -ar for habitual." checked={state.hab} onChange={v=>setState(s=>({...s, hab:v}))} />
          </div>
        </div>
        <div className="rounded-2xl border border-neutral-200 p-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Object (what)</div>
          <input className="w-full px-2 py-2 rounded-lg border border-neutral-300" placeholder="prey / stag / mark…" value={state.obj} onChange={e=>setState(s=>({...s, obj:e.target.value}))} />
        </div>
        <div className="rounded-2xl border border-neutral-200 p-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">With (instrument)</div>
          <NiceSelect value={state.withNounId} onChange={v=>setState(s=>({...s, withNounId:v}))} items={[{value:"", label:"— none —"}, ...nouns.map(n=>({ value:n.id, label:`${n.word} — ${n.gloss || ""}` }))]} />
        </div>
        <div className="rounded-2xl border border-neutral-200 p-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">To / From</div>
          <div className="grid grid-cols-2 gap-2">
            <input className="px-2 py-2 rounded-lg border border-neutral-300" placeholder="to (ga) — e.g., prey" value={state.toText} onChange={e=>setState(s=>({...s, toText:e.target.value}))} />
            <input className="px-2 py-2 rounded-lg border border-neutral-300" placeholder="from (ʌs) — e.g., Shroud" value={state.fromText} onChange={e=>setState(s=>({...s, fromText:e.target.value}))} />
          </div>
          <div className="mt-2 flex flex-wrap gap-3">
            <Toggle label="Question (qa)" checked={state.question} onChange={v=>setState(s=>({...s, question:v}))} />
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
      </div>
      <div className="rounded-2xl border border-neutral-200 p-3 flex items-center gap-3">
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Huntspeak</div>
          <div className="text-xl font-semibold break-words mt-1">{sentence || "—"}</div>
        </div>
        <button onClick={()=>clip(sentence)} className="px-3 py-2 rounded-xl border border-neutral-300 hover:bg-neutral-50">Copy</button>
      </div>
    </div>
  );
}
