import { useEffect, useMemo, useRef, useState } from "react";
import { useLocalStorageState } from "../lib/storage";
import type { Root } from "../types";

// Non‑finite / binyanim‑style derivation patterns from a triliteral root.
// Each pattern builds a lexical derivative and a short English explanation.
const DERIVATIONS = [
  { key: "agent", label: "agent (CaCāC)", build: (r: Root) => `${r.c1}a${r.c2}ā${r.c3}` },
  { key: "place", label: "place (miCCaC)", build: (r: Root) => `mi${r.c1}${r.c2}a${r.c3}` },
  { key: "instrument", label: "instrument (maCCūC)", build: (r: Root) => `ma${r.c1}${r.c2}ū${r.c3}` },
  { key: "middle", label: "middle/reflexive (t'-CaCCaC)", build: (r: Root) => `t'${r.c1}a${r.c2}${r.c2}a${r.c3}` },
  { key: "caus", label: "causative (χa-CiCēC)", build: (r: Root) => `χa${r.c1}i${r.c2}ē${r.c3}` },
  { key: "intens", label: "intensive (CuCCaC)", build: (r: Root) => `${r.c1}u${r.c2}${r.c2}a${r.c3}` },
  { key: "pass", label: "passive (n-CaCaC)", build: (r: Root) => `n${r.c1}a${r.c2}a${r.c3}` },
  { key: "concept", label: "general concept (CaCiC)", build: (r: Root) => `${r.c1}a${r.c2}i${r.c3}` },
];

/**
 * RenderDerivations
 *
 * Shows a grid of non‑finite (lexical) forms derived from a triliteral root.
 * Clicking a card opens a small popover that lets the user save the form as a noun.
 *
 * - Outside click closes any open popover.
 * - Explanations are derived from the English gloss of the current root.
 */
export default function RenderDerivations({ root, showCollapse = false, onCreateNoun }: { root: Root, showCollapse?: boolean; onCreateNoun?: (n: { word: string; gloss?: string; synonyms?: string[] }) => void }){
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ word: string; gloss: string; syn: string }>({ word: "", gloss: "", syn: "" });
  const panelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent){
      if (!openKey) return;
      if (!panelRef.current) return;
      if (!panelRef.current.contains(e.target as Node)) setOpenKey(null);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [openKey]);
  // Use the first segment of the gloss as a base for natural‑language explanations.
  const base = useMemo(()=>{
    const head = (root.gloss || "").split(/[;,.]/)[0]?.trim() || "hunt";
    return head.toLowerCase();
  }, [root.gloss]);

  const gerund = (v: string) => v.includes(" ") ? v : (/e$/i.test(v) && !/(ee|oe|ye)$/i.test(v) ? v.slice(0, -1) + "ing" : v + "ing");
  const pastPart = (v: string) => v.includes(" ") ? v : (/e$/i.test(v) ? v + "d" : /y$/i.test(v) ? v.slice(0, -1) + "ied" : v + "ed");
  const agentN = (v: string) => v.includes(" ") ? `one who ${v}` : (/e$/i.test(v) ? v.slice(0, -1) + "er" : v + "er");

  const explain: Record<string, string> = {
    agent:    `one who ${base} (“${agentN(base)}”)`,
    place:    `place/ground for ${gerund(base)}`,
    instrument:`tool for ${gerund(base)}`,
    middle:   `self/middle: ${base} oneself`,
    caus:     `causative: make/let someone ${base}`,
    intens:   `intensive: do ${base} intensely`,
    pass:     `passive: be ${pastPart(base)}`,
    concept:  `nominal: the act/idea of ${gerund(base)}`,
  } as const;

  const [collapsed, setCollapsed] = useLocalStorageState<boolean>('huntspeak_collapse_derivations', false);
  return (
    <section className="rounded-3xl border border-neutral-200 p-4 shadow-sm fantasy-card" ref={panelRef}>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl md:text-2xl font-semibold">Derivations</h2>
        {showCollapse && (
          <button aria-label={collapsed? 'Expand' : 'Collapse'} className="px-2 py-1 text-sm rounded border border-neutral-300 hover:bg-neutral-50" onClick={()=>setCollapsed(c=>!c)}>
            {collapsed ? '▸' : '▾'}
          </button>
        )}
      </div>
      {!collapsed && (
      <>
      <p className="text-sm text-neutral-600 mb-3">Handy non-finite patterns (binyanim-style). {onCreateNoun && 'Click a card to save it as a noun.'}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {DERIVATIONS.map(d => {
          const form = d.build(root);
          const isOpen = openKey === d.key;
          return (
            <div
              key={d.key}
              className="relative rounded-2xl border border-neutral-200 p-3 cursor-pointer transition derivation-card"
              onClick={()=>{ if (!onCreateNoun) return; setOpenKey(k=> k===d.key ? null : d.key); setDraft({ word: form, gloss: (explain as any)[d.key] || "", syn: "" }); }}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs uppercase tracking-wide text-neutral-500">{d.label}</div>
                  <div className="text-lg font-semibold mt-1">{form}</div>
                </div>
              </div>
              <div className="text-sm text-neutral-600 mt-1">{(explain as any)[d.key]}</div>
              {isOpen && (
                <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-xl border popover-panel shadow-xl p-3" onClick={e=>e.stopPropagation()}>
                  <div className="text-sm font-medium mb-2">Save as noun</div>
                  <div className="space-y-2">
                    <input className="w-full px-2 py-1 rounded-lg border border-neutral-300" placeholder="noun (word)" value={draft.word} onChange={e=>setDraft(s=>({...s, word:e.target.value}))} />
                    <input className="w-full px-2 py-1 rounded-lg border border-neutral-300" placeholder="gloss" value={draft.gloss} onChange={e=>setDraft(s=>({...s, gloss:e.target.value}))} />
                    <input className="w-full px-2 py-1 rounded-lg border border-neutral-300" placeholder="extra English (comma-separated)" value={draft.syn} onChange={e=>setDraft(s=>({...s, syn:e.target.value}))} />
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button className="px-2 py-1 rounded border border-neutral-300 hover:bg-neutral-50" onClick={()=>setOpenKey(null)}>Cancel</button>
                      <button className="px-2 py-1 rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50" onClick={()=>{ const syns = draft.syn.split(',').map(s=>s.trim()).filter(Boolean); onCreateNoun?.({ word: draft.word.trim(), gloss: draft.gloss.trim(), synonyms: syns }); setOpenKey(null); }}>Save</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      </>
      )}
    </section>
  );
}
