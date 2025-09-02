import React from "react";

/**
 * Lightweight accessible-ish select with keyboard navigation and hover states.
 * Keeps styling consistent across themes while avoiding native <select>.
 */
export default function NiceSelect({ value, onChange, items, placeholder = "Select…", searchable = false }: { value: string; onChange: (v: string)=>void; items: { value: string; label: string }[]; placeholder?: string; searchable?: boolean; }) {
  const [open, setOpen] = React.useState(false);
  const [hoverIdx, setHoverIdx] = React.useState<number>(-1);
  const boxRef = React.useRef<HTMLDivElement | null>(null);
  const searchRef = React.useRef<HTMLInputElement | null>(null);
  const selected = items.find(i => i.value === value);
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    function onDoc(e: MouseEvent){ if (!boxRef.current) return; if (!boxRef.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  React.useEffect(() => {
    if (open && searchable) {
      // Reset query and focus on open for quick type-to-filter
      setQuery("");
      // slight delay to ensure input is mounted
      setTimeout(()=> searchRef.current?.focus(), 0);
    }
  }, [open, searchable]);

  function fuzzySubsequence(needle: string, hay: string){
    if (!needle) return true;
    let j = 0;
    for (let i = 0; i < hay.length && j < needle.length; i++) {
      if (hay[i] === needle[j]) j++;
    }
    return j === needle.length;
  }

  const filtered = React.useMemo(() => {
    if (!searchable || !query.trim()) return items;
    const norm = (s: string) => s.toLowerCase();
    const strip = (s: string) => s.toLowerCase().replace(/[^a-z0-9ɪʌ]+/gi, "");
    const q = norm(query);
    const qs = strip(query);
    return items.filter(it => {
      const lbl = norm(it.label);
      const lbls = strip(it.label);
      const val = String(it.value || "").toLowerCase();
      return fuzzySubsequence(q, lbl) || fuzzySubsequence(qs, lbls) || (val && fuzzySubsequence(q, val));
    });
  }, [items, query, searchable]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ")) { e.preventDefault(); setOpen(true); setHoverIdx(Math.max(0, filtered.findIndex(i=>i.value===value))); return; }
    if (!open) return;
    if (e.key === "Escape") { setOpen(false); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setHoverIdx(i => Math.min(filtered.length - 1, (i < 0 ? 0 : i + 1))); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setHoverIdx(i => Math.max(0, (i < 0 ? 0 : i - 1))); }
    if (e.key === "Enter") { e.preventDefault(); const pick = filtered[hoverIdx]; if (pick) onChange(pick.value); setOpen(false); }
  }

  return (
    <div className="relative" ref={boxRef}>
      <button type="button" onClick={() => setOpen(o=>!o)} onKeyDown={onKeyDown}
        className={`w-full text-left px-3 py-2 rounded-lg border ${open?"border-neutral-300 bg-white text-neutral-900":"border-neutral-600 bg-neutral-800 text-white"} focus:outline-none focus:ring-2 focus:ring-blue-400/30`} aria-haspopup="listbox" aria-expanded={open}>
        {selected ? <span>{selected.label}</span> : <span className={open?"text-neutral-500":"text-neutral-300"}>{placeholder}</span>}
      </button>
      {open && (
        <div role="listbox" tabIndex={-1} className="absolute left-0 top-full mt-1 z-50 w-full rounded-lg border border-neutral-300 bg-white shadow-xl">
          {searchable && (
            <div className="p-2 border-b border-neutral-200 bg-white">
              <input ref={searchRef} value={query} onChange={e=>{ setQuery(e.target.value); setHoverIdx(0); }} placeholder="Type to filter…" className="w-full px-2 py-1 rounded border border-neutral-300 text-sm" />
            </div>
          )}
          <div className="max-h-56 overflow-auto">
            {filtered.map((it, idx) => {
              const active = it.value === value; const hover = idx === hoverIdx;
              return (
                <div key={it.value} role="option" aria-selected={active} className={`px-3 py-2 cursor-pointer text-sm ${hover?"bg-neutral-100":active?"bg-blue-50":""} ${active?"font-semibold":"font-normal"} text-neutral-900`} onMouseEnter={()=>setHoverIdx(idx)} onMouseLeave={()=>setHoverIdx(-1)} onClick={()=>{ onChange(it.value); setOpen(false); }}>{it.label}</div>
              );
            })}
            {!filtered.length && (
              <div className="px-3 py-2 text-sm text-neutral-500">No matches</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
