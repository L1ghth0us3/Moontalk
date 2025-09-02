import { useEffect, useMemo, useState } from "react";
import type { Noun } from "../../types";
import { useLocalStorageState, LS_KEYS } from "../../lib/storage";
import Collapse from "../ui/Collapse";

const uid = () => Math.random().toString(36).slice(2, 10);

export default function NounEditor({ initial, onChange, selectedId, onSelect, showCollapse = false }: { initial: Noun[]; onChange: (n: Noun[])=>void; selectedId: string|null; onSelect: (id: string|null)=>void; showCollapse?: boolean; }){
  const [nouns, setNouns] = useLocalStorageState<Noun[]>(LS_KEYS.nouns, initial);
  useEffect(()=>{ onChange(nouns); }, [nouns]);

  const selected = useMemo(()=> nouns.find(n=>n.id===selectedId) ?? null, [nouns, selectedId]);
  const [synText, setSynText] = useState("");
  useEffect(()=> setSynText((selected?.synonyms||[]).join(", ")), [selected?.id]);

  const addNoun = (n: Partial<Noun>) => { if (!n.word) return; const nn: Noun = { id: uid(), word: String(n.word), gloss: String(n.gloss ?? "") }; setNouns(prev=>[nn, ...prev]); onSelect(nn.id); };
  const updateNoun = (id: string, patch: Partial<Noun>) => setNouns(prev=> prev.map(n=> n.id===id ? { ...n, ...patch } : n));
  const deleteNoun = (id: string) => { setNouns(prev=> prev.filter(n=> n.id!==id)); if (selectedId===id) onSelect(nouns.find(n=> n.id!==id)?.id ?? null); };

  const [collapsed, setCollapsed] = useLocalStorageState<boolean>('huntspeak_collapse_nouns', false);

  return (
    <section className="rounded-3xl border border-neutral-200 p-4 shadow-sm overflow-hidden fantasy-card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl md:text-2xl font-semibold">Nouns</h2>
        {showCollapse && (
          <button aria-label={collapsed? 'Expand' : 'Collapse'} className="px-2 py-1 text-sm rounded border border-neutral-300 hover:bg-neutral-50" onClick={()=>setCollapsed(c=>!c)}>
            {collapsed ? '▸' : '▾'}
          </button>
        )}
      </div>
      <Collapse open={!collapsed}>
      <NounCreator onCreate={addNoun} />
      <div className="mt-3 max-h-[20rem] overflow-y-auto space-y-2 pr-1">
        {nouns.map(n => (
          <button key={n.id} onClick={() => onSelect(n.id)} className={`w-full text-left px-3 py-2 rounded-xl border ${selectedId === n.id ? "border-blue-500 bg-blue-50" : "border-neutral-200 hover:bg-neutral-50"}`}>
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="font-semibold text-lg truncate max-w-full">{n.word}</div>
              <div className="text-xs text-neutral-500 truncate flex-1 min-w-0 text-right">{n.gloss || "(no gloss)"}</div>
            </div>
          </button>
        ))}
        {!nouns.length && <div className="text-neutral-500 text-sm">No nouns yet. Add one above.</div>}
      </div>

      {selected && (
        <div className="mt-4 space-y-2">
          <h3 className="text-sm font-semibold">Edit selected</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <input className="w-full min-w-0 px-2 py-1 rounded-lg border border-neutral-300" value={selected.word} onChange={e=>updateNoun(selected.id,{word:e.target.value})} />
            <input className="md:col-span-2 w-full min-w-0 px-2 py-1 rounded-lg border border-neutral-300" placeholder="gloss" value={selected.gloss} onChange={e=>updateNoun(selected.id,{gloss:e.target.value})} />
            <button onClick={()=>deleteNoun(selected.id)} className="w-full md:w-auto px-2 py-1 rounded-lg border border-red-300 text-red-600 hover:bg-red-50">Delete</button>
          </div>
          <input className="w-full px-2 py-1 rounded-lg border border-neutral-300" placeholder="extra English triggers (comma-separated)" value={synText} onChange={e=>setSynText(e.target.value)} onBlur={e=> updateNoun(selected.id, { synonyms: e.target.value.split(",").map(s=>s.trim()).filter(Boolean) })} />
        </div>
      )}
      </Collapse>
    </section>
  );
}

function NounCreator({ onCreate }: { onCreate: (n: Partial<Noun>) => void }){
  const [word, setWord] = useState("");
  const [gloss, setGloss] = useState("");
  const disabled = !word;
  const submit = () => { onCreate({ word, gloss }); setWord(""); setGloss(""); };
  return (
    <div className="rounded-2xl p-3 border sub-panel">
      <div className="flex flex-wrap items-center gap-2">
        <input className="flex-1 min-w-[8rem] px-2 py-1 rounded-lg border border-neutral-300 bg-white text-neutral-900 placeholder-neutral-500" placeholder="noun (e.g., mallūb)" value={word} onChange={e=>setWord(e.target.value)} />
        <input className="flex-1 min-w-[10rem] px-2 py-1 rounded-lg border border-neutral-300 bg-white text-neutral-900 placeholder-neutral-500" placeholder="gloss (e.g., trap)" value={gloss} onChange={e=>setGloss(e.target.value)} />
        <button disabled={disabled} onClick={submit} className={`h-10 w-10 shrink-0 rounded-xl ${disabled?"border border-neutral-200 text-neutral-400":"border border-emerald-300 text-emerald-700 hover:bg-emerald-50"}`}>+</button>
      </div>
    </div>
  );
}
