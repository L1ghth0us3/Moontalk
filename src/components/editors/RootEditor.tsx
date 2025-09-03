import { useEffect, useMemo, useState } from "react";
import type { Root } from "../../types";
import { useLocalStorageState, LS_KEYS } from "../../lib/storage";
import FiniteForms from "../FiniteForms";
import RenderDerivations from "../Derivations";

const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * CRUD list for verb roots with a simple in‑panel creator and detail editor.
 *
 * - Persists to localStorage and notifies parent via onChange.
 * - Fuzzy search matches subsequences in gloss/synonyms or C1-C2-C3 when query contains '-'.
 * - Expanded modal shows the list on the left and details + tools on the right.
 */
export default function RootEditor({ initial, onChange, selectedId, onSelect, showCollapse = false, onCreateNoun }: { initial: Root[]; onChange: (r: Root[])=>void; selectedId: string|null; onSelect: (id: string|null)=>void; showCollapse?: boolean; onCreateNoun?: (n: { word: string; gloss?: string; synonyms?: string[] }) => void; }){
  const [roots, setRoots] = useLocalStorageState<Root[]>(LS_KEYS.roots, initial);
  useEffect(()=>{ onChange(roots); }, [roots]);
  // Duplicate detection by signature
  const dupSigs = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of roots){
      const sig = `${(r.c1||'').toLowerCase()}-${(r.c2||'').toLowerCase()}-${(r.c3||'').toLowerCase()}`;
      counts.set(sig, (counts.get(sig)||0)+1);
    }
    const d = new Set<string>();
    for (const [k,v] of counts){ if (v>1) d.add(k); }
    return d;
  }, [roots]);

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
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [showSearch, setShowSearch] = useLocalStorageState<boolean>(LS_KEYS.rootsSearchOpen, false);
  const [dupGlossGroups, setDupGlossGroups] = useState<Array<{ term: string; ids: string[] }>>([]);
  function normalizeGlossTerms(raw: string): string[] {
    if (!raw) return [];
    let s = raw.replace(/\([^)]*\)/g, '');
    const parts = s.split(/[;,]/);
    const STOP = new Set(['the','a','an','to']);
    const out: string[] = [];
    for (let part of parts){
      part = part.toLowerCase();
      part = part.replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
      if (!part) continue;
      const words = part.split(' ').filter(w => w && !STOP.has(w));
      const term = words.join(' ').trim();
      if (term) out.push(term);
    }
    return Array.from(new Set(out));
  }
  // no scan toast in RootEditor (scan lives in NounEditor)

  // Simple subsequence matcher for forgiving/fuzzy filtering
  function fuzzySubsequence(needle: string, hay: string){
    needle = needle.toLowerCase();
    hay = hay.toLowerCase();
    let j = 0;
    for (let i = 0; i < hay.length && j < needle.length; i++) {
      if (hay[i] === needle[j]) j++;
    }
    return j === needle.length;
  }

  const filtered = useMemo(()=>{
    const q = query.trim().toLowerCase();
    if (!q) return roots;
    const wantRoot = q.includes('-');
    return roots.filter(r => {
      const glossStr = `${r.gloss || ''} ${(r.synonyms||[]).join(' ')}`.toLowerCase();
      const a = fuzzySubsequence(q, glossStr);
      if (a) return true;
      if (wantRoot) {
        const rootStr = `${r.c1}-${r.c2}-${r.c3}`.toLowerCase();
        return fuzzySubsequence(q, rootStr);
      }
      return false;
    });
  }, [roots, query]);

  // Duplicate gloss detection (fuzzy terms, non-empty)
  useEffect(() => {
    const map = new Map<string, string[]>();
    for (const r of roots){
      const terms = normalizeGlossTerms(r.gloss||'');
      for (const t of terms){
        const arr = map.get(t) || [];
        if (!arr.includes(r.id)) arr.push(r.id);
        map.set(t, arr);
      }
    }
    const groups: Array<{ term:string; ids:string[] }> = [];
    for (const [t,ids] of map){ if (ids.length>1) groups.push({ term: t, ids }); }
    setDupGlossGroups(groups);
  }, [roots]);

  // removed scan function

  return (
    <>
    <section className="rounded-3xl border border-neutral-200 p-4 shadow-sm overflow-hidden fantasy-card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl md:text-2xl font-semibold">Verb Roots</h2>
        <div className="flex items-center gap-2">
          <button aria-label="Search" title="Search" className="px-2 py-1 text-sm rounded border border-neutral-300 hover:bg-neutral-50" onClick={()=>setShowSearch(s=>!s)}>
            🔎
          </button>
          {showCollapse && (
            <button aria-label={collapsed? 'Expand' : 'Collapse'} className="px-2 py-1 text-sm rounded border border-neutral-300 hover:bg-neutral-50" onClick={()=>setCollapsed(c=>!c)}>
              {collapsed ? '▸' : '▾'}
            </button>
          )}
          <button aria-label="Expand" title="Expand" className="px-2 py-1 text-sm rounded border border-neutral-300 hover:bg-neutral-50" onClick={()=>setExpanded(true)}>
            ⛶
          </button>
        </div>
      </div>
      {!collapsed && (
      <>
      <div className="flex items-center gap-2">
        <RootCreator onCreate={addRoot} />
      </div>
      {dupSigs.size>0 && (
        <div className="mt-2 text-sm rounded-lg border border-red-300 text-red-700 bg-red-50 px-3 py-2">
          <div className="font-semibold mb-1">Errors: duplicate verb roots</div>
          <div className="flex flex-wrap gap-2">
            {roots.map(r => {
              const sig = `${(r.c1||'').toLowerCase()}-${(r.c2||'').toLowerCase()}-${(r.c3||'').toLowerCase()}`;
              if (!dupSigs.has(sig)) return null;
              return (
                <button key={r.id} className="px-2 py-1 rounded border border-red-300 text-red-700 hover:bg-red-100 text-xs" onClick={()=>{ onSelect(r.id); setExpanded(true); }}>{[r.c1,r.c2,r.c3].join('-')} — {r.gloss||'(no gloss)'}</button>
              );
            })}
          </div>
        </div>
      )}
      {dupGlossGroups.length>0 && (
        <div className="mt-2 text-sm rounded-lg border border-red-300 text-red-700 bg-red-50 px-3 py-2">
          <div className="font-semibold mb-1">Errors: duplicate verb gloss terms</div>
          {dupGlossGroups.map((g,i)=> (
            <div key={i} className="mb-1">
              <div className="opacity-80">“{g.term}”</div>
              <div className="flex flex-wrap gap-2 mt-1">
                {g.ids.map(id => {
                  const r = roots.find(x=>x.id===id);
                  if (!r) return null;
                  return (
                    <button key={id} className="px-2 py-1 rounded border border-red-300 text-red-700 hover:bg-red-100 text-xs" onClick={()=>{ onSelect(id); setExpanded(true); }}>{[r.c1,r.c2,r.c3].join('-')}</button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      {showSearch && (
        <div className="mt-3">
          <input
            className="w-full px-3 py-2 rounded-lg border border-neutral-300"
            placeholder="Search English or use C1-C2-C3 (e.g., k-l-b)"
            value={query}
            onChange={e=>setQuery(e.target.value)}
          />
        </div>
      )}
      <div className="mt-3 max-h-[20rem] overflow-y-auto space-y-2 pr-1">
        {(showSearch && query ? filtered : roots).map(r => (
          <div
            key={r.id}
            className={`px-3 py-2 rounded-xl border flex items-center gap-2 ${selectedId === r.id ? "border-blue-500 root-item--selected" : (dupSigs.has(`${(r.c1||'').toLowerCase()}-${(r.c2||'').toLowerCase()}-${(r.c3||'').toLowerCase()}`) ? 'border-red-300 bg-red-50' : 'border-neutral-200 hover:bg-neutral-50')}`}
            onClick={() => onSelect(r.id)}
            onDoubleClick={()=>setExpanded(true)}
            role="button"
            tabIndex={0}
          >
            <div className="font-semibold text-lg shrink-0">{[r.c1, r.c2, r.c3].join("-")}</div>
            <div className="text-xs text-neutral-500 truncate ml-auto">{r.gloss || "(no gloss)"}</div>
            <button
              className="ml-2 px-2 py-1 rounded border border-neutral-300 hover:bg-neutral-50 text-xs shrink-0"
              title="Copy root"
              aria-label="Copy root"
              onClick={(e)=>{ e.stopPropagation(); try { navigator.clipboard.writeText([r.c1,r.c2,r.c3].join('-')); } catch {} }}
            >📋</button>
          </div>
        ))}
        {!(showSearch && query ? filtered.length : roots.length) && (
          <div className="text-neutral-500 text-sm">{showSearch && query ? 'No matching roots.' : 'No roots yet. Add one above.'}</div>
        )}
      </div>
      </>
      )}
    </section>

    {expanded && (
      <>
        <div className="fixed inset-0 bg-black/50 z-50" onClick={()=>setExpanded(false)}></div>
        <div className="fixed inset-0 z-50 p-4 flex items-center justify-center" onClick={(e)=>{ if (e.target === e.currentTarget) setExpanded(false); }}>
          <div className="w-full max-w-[96vw] max-h-[90vh] overflow-auto rounded-2xl border border-neutral-200 bg-white fantasy-card p-5 expand-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xl md:text-2xl font-semibold">Verb Roots — Expanded</h3>
              <button className="px-3 py-1 rounded-lg border border-neutral-300 hover:bg-neutral-50" onClick={()=>setExpanded(false)}>Close</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <RootCreator onCreate={addRoot} />
                <div className="mt-3">
                  <input
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300"
                    placeholder="Search English or use C1-C2-C3 (e.g., k-l-b)"
                    value={query}
                    onChange={e=>setQuery(e.target.value)}
                  />
                </div>
                {dupSigs.size>0 && (
                  <div className="mt-2 text-sm rounded-lg border border-red-300 text-red-700 bg-red-50 px-3 py-2">
                    <div className="font-semibold mb-1">Errors: duplicate verb roots</div>
                    <div className="flex flex-wrap gap-2">
                      {roots.map(r => {
                        const sig = `${(r.c1||'').toLowerCase()}-${(r.c2||'').toLowerCase()}-${(r.c3||'').toLowerCase()}`;
                        if (!dupSigs.has(sig)) return null;
                        return (
                          <button key={r.id} className="px-2 py-1 rounded border border-red-300 text-red-700 hover:bg-red-100 text-xs" onClick={()=>{ onSelect(r.id); }}>[{[r.c1,r.c2,r.c3].join('-')}] {r.gloss||'(no gloss)'}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {dupGlossGroups.length>0 && (
                  <div className="mt-2 text-sm rounded-lg border border-red-300 text-red-700 bg-red-50 px-3 py-2">
                    <div className="font-semibold mb-1">Errors: duplicate verb gloss terms</div>
                    {dupGlossGroups.map((g,i)=> (
                      <div key={i} className="mb-1">
                        <div className="opacity-80">“{g.term}”</div>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {g.ids.map(id => {
                            const r = roots.find(x=>x.id===id);
                            if (!r) return null;
                            return (
                              <button key={id} className="px-2 py-1 rounded border border-red-300 text-red-700 hover:bg-red-100 text-xs" onClick={()=>{ onSelect(id); }}>{[r.c1,r.c2,r.c3].join('-')}</button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-3 max-h-[24rem] overflow-y-auto space-y-2 pr-1">
                  {filtered.map(r => (
                    <div
                      key={r.id}
                      className={`px-3 py-2 rounded-xl border flex items-center gap-2 ${selectedId === r.id ? "border-blue-500 root-item--selected" : (dupSigs.has(`${(r.c1||'').toLowerCase()}-${(r.c2||'').toLowerCase()}-${(r.c3||'').toLowerCase()}`) ? 'border-red-300 bg-red-50' : 'border-neutral-200 hover:bg-neutral-50')}`}
                      onClick={() => onSelect(r.id)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="font-semibold text-lg shrink-0">{[r.c1, r.c2, r.c3].join("-")}</div>
                      <div className="text-xs text-neutral-500 truncate ml-auto">{r.gloss || "(no gloss)"}</div>
                      <button
                        className="ml-2 px-2 py-1 rounded border border-neutral-300 hover:bg-neutral-50 text-xs shrink-0"
                        title="Copy root"
                        aria-label="Copy root"
                        onClick={(e)=>{ e.stopPropagation(); try { navigator.clipboard.writeText([r.c1,r.c2,r.c3].join('-')); } catch {} }}
                      >📋</button>
                    </div>
                  ))}
                  {!filtered.length && <div className="text-neutral-500 text-sm">No matching roots.</div>}
                </div>
                {selected && (
                  <div className="mt-4 space-y-2">
                    <h4 className="text-sm font-semibold">Edit selected</h4>
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
              </div>
              <div>
                {selected && (
                  <div className="space-y-4">
                    <FiniteForms root={selected} />
                    <RenderDerivations root={selected} onCreateNoun={onCreateNoun} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </>
    )}
    </>
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
