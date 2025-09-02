import React from "react";

/**
 * Lightweight accessible-ish select with keyboard navigation and hover states.
 * Keeps styling consistent across themes while avoiding native <select>.
 */
export default function NiceSelect({ value, onChange, items, placeholder = "Select…" }: { value: string; onChange: (v: string)=>void; items: { value: string; label: string }[]; placeholder?: string; }) {
  const [open, setOpen] = React.useState(false);
  const [hoverIdx, setHoverIdx] = React.useState<number>(-1);
  const boxRef = React.useRef<HTMLDivElement | null>(null);
  const selected = items.find(i => i.value === value);

  React.useEffect(() => {
    function onDoc(e: MouseEvent){ if (!boxRef.current) return; if (!boxRef.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ")) { e.preventDefault(); setOpen(true); setHoverIdx(Math.max(0, items.findIndex(i=>i.value===value))); return; }
    if (!open) return;
    if (e.key === "Escape") { setOpen(false); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setHoverIdx(i => Math.min(items.length - 1, (i < 0 ? 0 : i + 1))); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setHoverIdx(i => Math.max(0, (i < 0 ? 0 : i - 1))); }
    if (e.key === "Enter") { e.preventDefault(); const pick = items[hoverIdx]; if (pick) onChange(pick.value); setOpen(false); }
  }

  return (
    <div className="relative" ref={boxRef}>
      <button type="button" onClick={() => setOpen(o=>!o)} onKeyDown={onKeyDown}
        className={`w-full text-left px-3 py-2 rounded-lg border ${open?"border-neutral-300 bg-white text-neutral-900":"border-neutral-600 bg-neutral-800 text-white"} focus:outline-none focus:ring-2 focus:ring-blue-400/30`} aria-haspopup="listbox" aria-expanded={open}>
        {selected ? <span>{selected.label}</span> : <span className={open?"text-neutral-500":"text-neutral-300"}>{placeholder}</span>}
      </button>
      {open && (
        <div role="listbox" tabIndex={-1} className="absolute left-0 top-full mt-1 z-50 w-full max-h-64 overflow-auto rounded-lg border border-neutral-300 bg-white shadow-xl">
          {items.map((it, idx) => {
            const active = it.value === value; const hover = idx === hoverIdx;
            return (
              <div key={it.value} role="option" aria-selected={active} className={`px-3 py-2 cursor-pointer text-sm ${hover?"bg-neutral-100":active?"bg-blue-50":""} ${active?"font-semibold":"font-normal"} text-neutral-900`} onMouseEnter={()=>setHoverIdx(idx)} onMouseLeave={()=>setHoverIdx(-1)} onClick={()=>{ onChange(it.value); setOpen(false); }}>{it.label}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
