import { useEffect, useMemo, useState } from "react";
import type { Root } from "../../types";
import { useLocalStorageState, LS_KEYS } from "../../lib/storage";
import { usePulseOnChange } from "../../lib/usePulse";

const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * CRUD list for verb roots with a simple in‑panel creator and detail editor.
 * Persists to localStorage and notifies parent via onChange.
 */
export default function RootEditor({ initial, onChange, selectedId, onSelect, showCollapse = false }: { initial: Root[]; onChange: (r: Root[])=>void; selectedId: string|null; onSelect: (id: string|null)=>void; showCollapse?: boolean; }){
  const [roots, setRoots] = useLocalStorageState<Root[]>(LS_KEYS.roots, initial);
  useEffect(()=>{ onChange(roots); }, [roots]);

  const selected = useMemo(()=> roots.find(r=>r.id===selectedId) ?? null, [roots, selectedId]);
  const [synonymsText, setSynonymsText] = useState("");
  useEffect(()=> setSynonymsText((selected?.synonyms||[]).join(", ")), [selected?.id]);

  const addRoot = (r: Partial<Root>) => {
    if (!r.c1 || !r.c2 || !r.c3) return;
    const newRoot: Root = { id: uid(), c1: r.c1.trim(), c2: r.c2.trim(), c3: r.c3.trim(), gloss: (r.gloss??"").trim(), synonyms: r.synonyms??[] };
    setRoots(prev=>[newRoot, ...prev]); onSelect(newRoot.id);
  };
  const updateRoot = (id: string, patch: Partial<Root>) => setRoots(prev=> prev.map(r=> r.id===id ? { ...r, ...patch }: r));
  const deleteRoot = (id: string) => { setRoots(prev=> prev.filter(r=> r.id!==id)); if (selectedId===id) onSelect(roots.find(r=> r.id!==id)?.id ?? null); };

  const [collapsed, setCollapsed] = useLocalStorageState<boolean>('huntspeak_collapse_roots', false);
  const pulseSelected = usePulseOnChange([selectedId]);

  return (
    <section className="rounded-3xl border border-neutral-200 p-4 shadow-sm overflow-hidden fantasy-card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl md:text-2xl font-semibold">Verb Roots</h2>
        {showCollapse && (
          <button aria-label={collapsed? 'Expand' : 'Collapse'} className="px-2 py-1 text-sm rounded border border-neutral-300 hover:bg-neutral-50" onClick={()=>setCollapsed(c=>!c)}>
            {collapsed ? '▸' : '▾'}
          </button>
        )}
      </div>
      {!collapsed && (
      <>
      <RootCreator onCreate={addRoot} />
      <div className="mt-3 max-h-[20rem] overflow-y-auto space-y-2 pr-1">
        {roots.map(r => (
          <button key={r.id} onClick={() => onSelect(r.id)} className={`w-full text-left px-3 py-2 rounded-xl border ${selectedId === r.id ? "border-blue-500 bg-blue-50" : "border-neutral-200 hover:bg-neutral-50"} ${pulseSelected && selectedId === r.id ? 'pulse-once' : ''}`}>
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="font-semibold text-lg shrink-0">{[r.c1, r.c2, r.c3].join("-")}</div>
              <div className="text-xs text-neutral-500 truncate flex-1 min-w-0 text-right">{r.gloss || "(no gloss)"}</div>
            </div>
          </button>
        ))}
        {!roots.length && <div className="text-neutral-500 text-sm">No roots yet. Add one above.</div>}
      </div>

      {selected && (
        <div className="mt-4 space-y-2">
          <h3 className="text-sm font-semibold">Edit selected</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <input className="w-full min-w-0 px-2 py-1 rounded-lg border border-neutral-300" value={selected.c1} onChange={e=>updateRoot(selected.id,{c1:e.target.value})} />
            <input className="w-full min-w-0 px-2 py-1 rounded-lg border border-neutral-300" value={selected.c2} onChange={e=>updateRoot(selected.id,{c2:e.target.value})} />
            <input className="w-full min-w-0 px-2 py-1 rounded-lg border border-neutral-300" value={selected.c3} onChange={e=>updateRoot(selected.id,{c3:e.target.value})} />
            <button onClick={()=>deleteRoot(selected.id)} className="w-full md:w-auto px-2 py-1 rounded-lg border border-red-300 text-red-600 hover:bg-red-50">Delete</button>
          </div>
          <input className="w-full px-2 py-1 rounded-lg border border-neutral-300" placeholder="gloss" value={selected.gloss} onChange={e=>updateRoot(selected.id,{gloss:e.target.value})} />
          <input className="w-full px-2 py-1 rounded-lg border border-neutral-300" placeholder="extra English triggers (comma-separated)" value={synonymsText} onChange={e=>setSynonymsText(e.target.value)} onBlur={e=> updateRoot(selected.id, { synonyms: e.target.value.split(",").map(s=>s.trim()).filter(Boolean) })} />
        </div>
      )}
      </>
      )}
    </section>
  );
}

// Inline creator for a new root; keeps inputs local until submit.
function RootCreator({ onCreate }: { onCreate: (r: Partial<Root>) => void }) {
  const [c1, setC1] = useState("");
  const [c2, setC2] = useState("");
  const [c3, setC3] = useState("");
  const [gloss, setGloss] = useState("");
  const disabled = !c1 || !c2 || !c3;
  const submit = () => { onCreate({ c1, c2, c3, gloss }); setC1(""); setC2(""); setC3(""); setGloss(""); };
  return (
    <div className="rounded-2xl p-3 border sub-panel">
      <div className="flex flex-wrap items-center gap-2">
        <input className="h-10 w-12 px-2 rounded-lg border border-neutral-300 bg-white text-neutral-900 placeholder-neutral-500 text-center" placeholder="C1" value={c1} onChange={e => setC1(e.target.value)} />
        <input className="h-10 w-12 px-2 rounded-lg border border-neutral-300 bg-white text-neutral-900 placeholder-neutral-500 text-center" placeholder="C2" value={c2} onChange={e => setC2(e.target.value)} />
        <input className="h-10 w-12 px-2 rounded-lg border border-neutral-300 bg-white text-neutral-900 placeholder-neutral-500 text-center" placeholder="C3" value={c3} onChange={e => setC3(e.target.value)} />
        <input className="h-10 min-w-0 flex-1 px-3 rounded-lg border border-neutral-300 bg-white text-neutral-900 placeholder-neutral-500" placeholder="gloss (e.g., ‘track; hunt’ )" value={gloss} onChange={e => setGloss(e.target.value)} />
        <button disabled={disabled} onClick={submit} aria-label="Add root" className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center ${disabled?"bg-neutral-700 text-neutral-400 cursor-not-allowed":"bg-neutral-900 text-white hover:bg-neutral-800"}`}>
          <span className="text-lg font-bold leading-none">+</span>
        </button>
      </div>
    </div>
  );
}
