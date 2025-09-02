import { useEffect, useMemo, useState } from "react";
import type { Noun } from "../../types";
import { useLocalStorageState, LS_KEYS } from "../../lib/storage";

const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * CRUD list for nouns with simple creator and detail editor.
 * Persists to localStorage and notifies parent via onChange.
 */
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
  const [expanded, setExpanded] = useState(false);
  const [showSearch, setShowSearch] = useLocalStorageState<boolean>(LS_KEYS.nounsSearchOpen, false);
  const [query, setQuery] = useState("");

  function fuzzySubsequence(needle: string, hay: string){
    needle = needle.toLowerCase(); hay = hay.toLowerCase();
    let j = 0; for (let i = 0; i < hay.length && j < needle.length; i++){ if (hay[i] === needle[j]) j++; }
    return j === needle.length;
  }
  const filtered = useMemo(()=>{
    const q = query.trim().toLowerCase(); if (!q) return nouns;
    return nouns.filter(n=>{
      const bag = `${n.word} ${n.gloss} ${(n.synonyms||[]).join(' ')}`.toLowerCase();
      return fuzzySubsequence(q, bag);
    });
  }, [nouns, query]);

  return (
    <>
    <section className="rounded-3xl border border-neutral-200 p-4 shadow-sm overflow-hidden fantasy-card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl md:text-2xl font-semibold">Nouns</h2>
        <div className="flex items-center gap-2">
          <button aria-label="Search" title="Search" className="px-2 py-1 text-sm rounded border border-neutral-300 hover:bg-neutral-50" onClick={()=>setShowSearch(s=>!s)}>🔎</button>
          {showCollapse && (
            <button aria-label={collapsed? 'Expand' : 'Collapse'} className="px-2 py-1 text-sm rounded border border-neutral-300 hover:bg-neutral-50" onClick={()=>setCollapsed(c=>!c)}>
              {collapsed ? '▸' : '▾'}
            </button>
          )}
          <button aria-label="Expand" title="Expand" className="px-2 py-1 text-sm rounded border border-neutral-300 hover:bg-neutral-50" onClick={()=>setExpanded(true)}>⛶</button>
        </div>
      </div>
      {!collapsed && (
      <>
      <NounCreator onCreate={addNoun} />
      {showSearch && (
        <div className="mt-3">
          <input className="w-full px-3 py-2 rounded-lg border border-neutral-300" placeholder="Search nouns (word, gloss, synonyms)" value={query} onChange={e=>setQuery(e.target.value)} />
        </div>
      )}
      <div className="mt-3 max-h-[20rem] overflow-y-auto space-y-2 pr-1">
        {(showSearch && query ? filtered : nouns).map(n => (
          <button key={n.id} onClick={() => onSelect(n.id)} onDoubleClick={()=>setExpanded(true)} className={`w-full text-left px-3 py-2 rounded-xl border ${selectedId === n.id ? "border-blue-500 noun-item--selected" : "border-neutral-200 hover:bg-neutral-50"}`}>
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="font-semibold text-lg truncate max-w-full">{n.word}</div>
              <div className="text-xs text-neutral-500 truncate flex-1 min-w-0 text-right">{n.gloss || "(no gloss)"}</div>
            </div>
          </button>
        ))}
        {!(showSearch && query ? filtered.length : nouns.length) && <div className="text-neutral-500 text-sm">{showSearch && query ? 'No matching nouns.' : 'No nouns yet. Add one above.'}</div>}
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
      </>
      )}
    </section>

    {expanded && (
      <>
        <div className="fixed inset-0 bg-black/50 z-50" onClick={()=>setExpanded(false)}></div>
        <div className="fixed inset-0 z-50 p-4 flex items-center justify-center" onClick={(e)=>{ if (e.target === e.currentTarget) setExpanded(false); }}>
          <div className="w-full max-w-[92vw] xl:max-w-[1200px] 2xl:max-w-[1400px] max-h-[90vh] overflow-auto rounded-2xl border border-neutral-200 bg-white fantasy-card p-5 expand-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xl md:text-2xl font-semibold">Nouns — Expanded</h3>
              <button className="px-3 py-1 rounded-lg border border-neutral-300 hover:bg-neutral-50" onClick={()=>setExpanded(false)}>Close</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <NounCreator onCreate={addNoun} />
                <div className="mt-3">
                  <input className="w-full px-3 py-2 rounded-lg border border-neutral-300" placeholder="Search nouns (word, gloss, synonyms)" value={query} onChange={e=>setQuery(e.target.value)} />
                </div>
                <div className="mt-3 max-h-[24rem] overflow-y-auto space-y-2 pr-1">
                  {filtered.map(n => (
                    <button key={n.id} onClick={() => onSelect(n.id)} className={`w-full text-left px-3 py-2 rounded-xl border ${selectedId === n.id ? "border-blue-500 noun-item--selected" : "border-neutral-200 hover:bg-neutral-50"}`}>
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <div className="font-semibold text-lg truncate max-w-full">{n.word}</div>
                        <div className="text-xs text-neutral-500 truncate flex-1 min-w-0 text-right">{n.gloss || "(no gloss)"}</div>
                      </div>
                    </button>
                  ))}
                  {!filtered.length && <div className="text-neutral-500 text-sm">No matching nouns.</div>}
                </div>
              </div>
              {selected && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Edit selected</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <input className="w-full min-w-0 px-2 py-1 rounded-lg border border-neutral-300" value={selected.word} onChange={e=>updateNoun(selected.id,{word:e.target.value})} />
                    <input className="md:col-span-2 w-full min-w-0 px-2 py-1 rounded-lg border border-neutral-300" placeholder="gloss" value={selected.gloss} onChange={e=>updateNoun(selected.id,{gloss:e.target.value})} />
                    <button onClick={()=>deleteNoun(selected.id)} className="w-full md:w-auto px-2 py-1 rounded-lg border border-red-300 text-red-600 hover:bg-red-50">Delete</button>
                  </div>
                  <input className="w-full px-2 py-1 rounded-lg border border-neutral-300" placeholder="extra English triggers (comma-separated)" value={synText} onChange={e=>setSynText(e.target.value)} onBlur={e=> updateNoun(selected.id, { synonyms: e.target.value.split(",").map(s=>s.trim()).filter(Boolean) })} />
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    )}
    </>
  );
}

// Inline creator for a new noun; resets inputs after submit.
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
