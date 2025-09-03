import { useEffect, useMemo, useRef, useState } from "react";
import type { Noun, Root } from "../../types";
import { useLocalStorageState, LS_KEYS, lsGet } from "../../lib/storage";
import { PRONOUNS, TENSES } from "../../types";
import { buildFinite } from "../../lib/morphology";
import { useContextMenu, copyText } from "../../lib/contextMenu";

const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * CRUD list for nouns with simple creator and detail editor.
 *
 * - Persists to localStorage and notifies parent via onChange.
 * - Fuzzy search over word/gloss/synonyms using subsequence matching.
 * - Editing happens in the Expanded modal to keep the compact panel lightweight.
 */
export default function NounEditor({ initial, onChange, selectedId, onSelect, showCollapse = false }: { initial: Noun[]; onChange: (n: Noun[])=>void; selectedId: string|null; onSelect: (id: string|null)=>void; showCollapse?: boolean; }){
  const { showAt } = useContextMenu();
  const [nouns, setNouns] = useLocalStorageState<Noun[]>(LS_KEYS.nouns, initial);
  useEffect(()=>{ onChange(nouns); }, [nouns]);

  const selected = useMemo(()=> nouns.find(n=>n.id===selectedId) ?? null, [nouns, selectedId]);
  const [synText, setSynText] = useState("");
  useEffect(()=> setSynText((selected?.synonyms||[]).join(", ")), [selected?.id]);

  const addNoun = (n: Partial<Noun>) => { if (!n.word) return; const nn: Noun = { id: uid(), word: String(n.word), gloss: String(n.gloss ?? "") }; setNouns(prev=>[nn, ...prev]); onSelect(nn.id); };
  const updateNoun = (id: string, patch: Partial<Noun>) => setNouns(prev=> prev.map(n=> n.id===id ? { ...n, ...patch } : n));
  const deleteNoun = (id: string) => {
    // Update nouns; selection will be reconciled by parent effects (see MoontalkApp/Translator2)
    setNouns(prev => prev.filter(n => n.id !== id));
  };

  const [collapsed, setCollapsed] = useLocalStorageState<boolean>('huntspeak_collapse_nouns', false);
  const [expanded, setExpanded] = useState(false);
  const [showSearch, setShowSearch] = useLocalStorageState<boolean>(LS_KEYS.nounsSearchOpen, false);
  const [query, setQuery] = useState("");
  const [colliding, setColliding] = useState<Set<string>>(new Set());
  const [collisions, setCollisions] = useState<Record<string, Array<{ form: string; root: string; gloss: string; pron: string; tense: string }>>>({});
  const [scanned, setScanned] = useState<boolean>(false);
  const [scanToast, setScanToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const [dupWords, setDupWords] = useState<string[]>([]);
  const [dupGlossGroups, setDupGlossGroups] = useState<Array<{ term: string; ids: string[] }>>([]);

  function normalizeGlossTerms(raw: string): string[] {
    if (!raw) return [];
    // Remove parenthetical content
    let s = raw.replace(/\([^)]*\)/g, '');
    // Split by semicolons/commas
    const parts = s.split(/[;,]/);
    const STOP = new Set(['the','a','an','to']);
    const out: string[] = [];
    for (let part of parts){
      part = part.toLowerCase();
      // Keep letters/spaces only
      part = part.replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
      if (!part) continue;
      const words = part.split(' ').filter(w => w && !STOP.has(w));
      const term = words.join(' ').trim();
      if (term) out.push(term);
    }
    // Deduplicate terms within a single gloss
    return Array.from(new Set(out));
  }

  // Focus bridge: open noun on request from other components
  useEffect(() => {
    function onStorage(e: StorageEvent){
      if (e.key !== LS_KEYS.nounsFocus || !e.newValue) return;
      try {
        const { id } = JSON.parse(e.newValue);
        if (id){ onSelect(id); setExpanded(true); }
        localStorage.removeItem(LS_KEYS.nounsFocus);
      } catch {}
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [onSelect]);

  // Simple subsequence matcher for forgiving/fuzzy filtering
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

  // Duplicate noun words
  useEffect(() => {
    const map = new Map<string, number>();
    for (const n of nouns){
      const w = (n.word||'').trim().toLowerCase(); if (!w) continue;
      map.set(w, (map.get(w)||0)+1);
    }
    const d: string[] = []; for (const [w,c] of map){ if (c>1) d.push(w); }
    setDupWords(d);
  }, [nouns]);

  // Duplicate gloss groups (fuzzy: split terms, strip stopwords/parentheses/punct)
  useEffect(() => {
    const map = new Map<string, string[]>();
    for (const n of nouns){
      const terms = normalizeGlossTerms(n.gloss||'');
      for (const t of terms){
        const arr = map.get(t) || [];
        if (!arr.includes(n.id)) arr.push(n.id);
        map.set(t, arr);
      }
    }
    const groups: Array<{ term:string; ids:string[] }> = [];
    for (const [t,ids] of map){ if (ids.length>1) groups.push({ term: t, ids }); }
    setDupGlossGroups(groups);
  }, [nouns]);

  function buildCollisions(currentNouns: Noun[]): { col: Set<string>; colDetail: Record<string, Array<{ form: string; root: string; gloss: string; pron: string; tense: string }>> }{
    const roots: Root[] = lsGet<Root[]>(LS_KEYS.roots, [] as any);
    const formMap = new Map<string, Array<{ form: string; root: string; gloss: string; pron: string; tense: string }>>();
    for (const r of roots){
      const rootSig = `${r.c1}${r.c2}${r.c3}`;
      const gloss = r.gloss || '';
      for (const p of PRONOUNS){
        for (const t of TENSES){
          const f = buildFinite(r as any, p.subjV, t.vowel);
          const key = f.toLowerCase();
          const arr = formMap.get(key) || [];
          arr.push({ form: f, root: rootSig, gloss, pron: p.form, tense: t.label });
          formMap.set(key, arr);
        }
      }
    }
    const col = new Set<string>();
    const colDetail: Record<string, Array<{ form: string; root: string; gloss: string; pron: string; tense: string }>> = {};
    for (const n of currentNouns){
      const key = (n.word||'').toLowerCase();
      const hits = formMap.get(key);
      if (hits && hits.length){
        col.add(n.id);
        colDetail[n.id] = hits;
      }
    }
    return { col, colDetail };
  }

  function scanVerbCollisions(){
    try {
      const { col, colDetail } = buildCollisions(nouns);
      setColliding(col);
      setCollisions(colDetail);
      if (col.size > 0) {
        setScanned(true);
      } else {
        // Show ephemeral toast instead of a persistent banner when no collisions
        setScanned(false);
        setScanToast('No noun ↔ verb-form collisions');
        if (toastTimer.current) { clearTimeout(toastTimer.current); toastTimer.current = null; }
        toastTimer.current = window.setTimeout(() => setScanToast(null), 2200);
      }
    } catch { setColliding(new Set()); setScanned(true); }
  }

  // Auto-update collisions while panel is visible (e.g., after deletions)
  useEffect(() => {
    if (!scanned) return;
    const { col, colDetail } = buildCollisions(nouns);
    setColliding(col);
    setCollisions(colDetail);
    if (col.size === 0) setScanned(false);
  }, [nouns, scanned]);

  return (
    <>
    <section className="rounded-3xl border border-neutral-200 p-4 shadow-sm overflow-hidden fantasy-card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl md:text-2xl font-semibold">Nouns</h2>
      <div className="flex items-center gap-2">
          <button aria-label="Search" title="Search" className="px-2 py-1 text-sm rounded border border-neutral-300 hover:bg-neutral-50" onClick={()=>setShowSearch(s=>!s)}>🔎</button>
          <div className="relative">
            <button aria-label="Scan verb collisions" title="Scan verb collisions (on-demand)" className="px-2 py-1 text-sm rounded border border-amber-300 text-amber-700 hover:bg-amber-50" onClick={scanVerbCollisions}>Scan</button>
            {scanToast && (
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 rounded-md border border-amber-300 bg-amber-50 text-amber-700 text-xs px-2.5 py-1.5 shadow-lg transition-opacity duration-500 opacity-100">
                {scanToast}
              </div>
            )}
          </div>
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
      {/* Duplicate errors: words */}
      {dupWords.length>0 && (
        <div className="mt-2 text-sm rounded-lg border border-red-300 text-red-700 bg-red-50 px-3 py-2">
          <div className="font-semibold mb-1">Errors: duplicate nouns</div>
          <div className="flex flex-wrap gap-2">
            {dupWords.map(w => (
              <span key={w} className="px-2 py-1 rounded border border-red-300 text-red-700 text-xs">{w}</span>
            ))}
          </div>
        </div>
      )}
      {/* Duplicate errors: gloss (fuzzy terms) */}
      {dupGlossGroups.length>0 && (
        <div className="mt-2 text-sm rounded-lg border border-red-300 text-red-700 bg-red-50 px-3 py-2">
          <div className="font-semibold mb-1">Errors: duplicate noun gloss terms</div>
          {dupGlossGroups.map((g,i)=> (
            <div key={i} className="mb-1">
              <div className="opacity-80">“{g.term}”</div>
              <div className="flex flex-wrap gap-2 mt-1">
                {g.ids.map(id => {
                  const n = nouns.find(x=>x.id===id);
                  if (!n) return null;
                  return (
                    <button key={id} className="px-2 py-1 rounded border border-red-300 text-red-700 hover:bg-red-100 text-xs" onClick={()=>{ onSelect(id); setExpanded(true); }}>{n.word}</button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      {scanned && colliding.size>0 && (
        <div className={`mt-2 text-sm rounded-lg px-3 py-2 ${colliding.size>0 ? 'border border-amber-300 text-amber-700 bg-amber-50' : 'border border-neutral-200 text-neutral-700 bg-neutral-50'}`}>
          {(
            <div>
              <div className="font-semibold mb-1">Warnings: {colliding.size} noun{colliding.size===1?'':'s'} collide with verb forms</div>
              <div className="space-y-1">
                {Array.from(colliding).map(id => {
                  const n = nouns.find(x=>x.id===id);
                  if (!n) return null;
                  const hits = collisions[id] || [];
                  return (
                    <div key={id} className="border border-amber-200 rounded-md px-2 py-1 bg-amber-50/50">
                      <button className="font-medium underline underline-offset-2" onClick={()=>{ onSelect(id); setExpanded(true); }}>{n.word}</button>
                      <div className="text-xs mt-1">
                        {hits.slice(0,6).map((h,idx)=> (
                          <span key={idx} className="inline-block mr-2 mb-1 px-1.5 py-0.5 rounded border border-amber-200 bg-white text-amber-700">
                            {h.form} <span className="opacity-70">({h.pron}, {h.tense}; {h.root}{h.gloss?` — ${h.gloss}`:''})</span>
                          </span>
                        ))}
                        {hits.length>6 && <span className="opacity-70">(+{hits.length-6} more)</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
      <NounCreator onCreate={addNoun} />
      {showSearch && (
        <div className="mt-3">
          <input className="w-full px-3 py-2 rounded-lg border border-neutral-300" placeholder="Search nouns (word, gloss, synonyms)" value={query} onChange={e=>setQuery(e.target.value)} />
        </div>
      )}
      <div className="mt-2 text-xs text-neutral-500">Tip: Right-click a noun to copy its word or gloss.</div>
      <div className="mt-3 max-h-[20rem] overflow-y-auto space-y-2 pr-1">
        {(showSearch && query ? filtered : nouns).map(n => (
          <button key={n.id} onClick={() => onSelect(n.id)} onDoubleClick={()=>setExpanded(true)} onContextMenu={(e)=>{
            e.preventDefault();
            showAt(e.clientX, e.clientY, [
              { label: 'Copy word', action: () => copyText(n.word || '') },
              { label: 'Copy gloss', action: () => copyText(n.gloss || '') },
            ]);
          }} className={`w-full text-left px-3 py-2 rounded-xl border ${selectedId === n.id ? "border-blue-500 noun-item--selected" : (colliding.has(n.id) ? 'border-amber-300 bg-amber-50' : 'border-neutral-200 hover:bg-neutral-50')}`}>
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="font-semibold text-lg truncate max-w-full">{n.word}</div>
              <div className="text-xs text-neutral-500 truncate flex-1 min-w-0 text-right">{n.gloss || "(no gloss)"}</div>
            </div>
          </button>
        ))}
        {!(showSearch && query ? filtered.length : nouns.length) && <div className="text-neutral-500 text-sm">{showSearch && query ? 'No matching nouns.' : 'No nouns yet. Add one above.'}</div>}
      </div>

      {/* Edit selected is available in Expanded view */}
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
                {dupWords.length>0 && (
                  <div className="mt-2 text-sm rounded-lg border border-red-300 text-red-700 bg-red-50 px-3 py-2">
                    <div className="font-semibold mb-1">Errors: duplicate nouns</div>
                    <div className="flex flex-wrap gap-2">
                      {dupWords.map(w => (
                        <span key={w} className="px-2 py-1 rounded border border-red-300 text-red-700 text-xs">{w}</span>
                      ))}
                    </div>
                  </div>
                )}
                {dupGlossGroups.length>0 && (
                  <div className="mt-2 text-sm rounded-lg border border-red-300 text-red-700 bg-red-50 px-3 py-2">
                    <div className="font-semibold mb-1">Errors: duplicate noun gloss terms</div>
                    {dupGlossGroups.map((g,i)=> (
                      <div key={i} className="mb-1">
                        <div className="opacity-80">“{g.term}”</div>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {g.ids.map(id => {
                            const n = nouns.find(x=>x.id===id);
                            if (!n) return null;
                            return (
                              <button key={id} className="px-2 py-1 rounded border border-red-300 text-red-700 hover:bg-red-100 text-xs" onClick={()=>{ onSelect(id); }}>{n.word}</button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {scanned && colliding.size>0 && (
                  <div className="mt-2 text-sm rounded-lg border border-amber-300 text-amber-700 bg-amber-50 px-3 py-2">
                    <div className="font-semibold mb-1">Warnings: {colliding.size} noun{colliding.size===1?'':'s'} collide with verb forms</div>
                    <div className="space-y-1 max-h-40 overflow-auto pr-1">
                      {Array.from(colliding).map(id => {
                        const n = nouns.find(x=>x.id===id);
                        if (!n) return null;
                        const hits = collisions[id] || [];
                        return (
                          <div key={id} className="border border-amber-200 rounded-md px-2 py-1 bg-amber-50/50">
                            <button className="font-medium underline underline-offset-2" onClick={()=>{ onSelect(id); }}>{n.word}</button>
                            <div className="text-xs mt-1">
                              {hits.slice(0,6).map((h,idx)=> (
                                <span key={idx} className="inline-block mr-2 mb-1 px-1.5 py-0.5 rounded border border-amber-200 bg-white text-amber-700">
                                  {h.form} <span className="opacity-70">({h.pron}, {h.tense}; {h.root}{h.gloss?` — ${h.gloss}`:''})</span>
                                </span>
                              ))}
                              {hits.length>6 && <span className="opacity-70">(+{hits.length-6} more)</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="mt-2 text-xs text-neutral-500">Tip: Right-click a noun to copy its word or gloss.</div>
                <div className="mt-3 max-h-[24rem] overflow-y-auto space-y-2 pr-1">
                  {filtered.map(n => (
                    <button key={n.id} onClick={() => onSelect(n.id)} onContextMenu={(e)=>{
                      e.preventDefault();
                      showAt(e.clientX, e.clientY, [
                        { label: 'Copy word', action: () => copyText(n.word || '') },
                        { label: 'Copy gloss', action: () => copyText(n.gloss || '') },
                      ]);
                    }} className={`w-full text-left px-3 py-2 rounded-xl border ${selectedId === n.id ? "border-blue-500 noun-item--selected" : "border-neutral-200 hover:bg-neutral-50"}`}>
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
