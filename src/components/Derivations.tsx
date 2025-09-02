import { useMemo } from "react";
import { useLocalStorageState } from "../lib/storage";
import type { Root } from "../types";

const DERIVATIONS = [
  { key: "agent", label: "agent (CaCāC)", build: (r: Root) => `${r.c1}a${r.c2}ā${r.c3}` },
  { key: "place", label: "place (miCCaC)", build: (r: Root) => `mi${r.c1}${r.c2}a${r.c3}` },
  { key: "instrument", label: "instrument (maCCūC)", build: (r: Root) => `ma${r.c1}${r.c2}ū${r.c3}` },
  { key: "middle", label: "middle/reflexive (t-CaCCaC)", build: (r: Root) => `t${r.c1}a${r.c2}${r.c2}a${r.c3}` },
  { key: "caus", label: "causative (χa-CiCēC)", build: (r: Root) => `χa${r.c1}i${r.c2}ē${r.c3}` },
  { key: "intens", label: "intensive (CuCCaC)", build: (r: Root) => `${r.c1}u${r.c2}${r.c2}a${r.c3}` },
  { key: "pass", label: "passive (n-CaCaC)", build: (r: Root) => `n${r.c1}a${r.c2}a${r.c3}` },
  { key: "concept", label: "general concept (CaCiC)", build: (r: Root) => `${r.c1}a${r.c2}i${r.c3}` },
];

export default function RenderDerivations({ root }: { root: Root }){
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
  const [showCollapse] = useLocalStorageState<boolean>('huntspeak_show_collapse', false);
  // lightweight state without adding storage util here
  return (
    <section className="rounded-3xl border border-neutral-200 p-4 shadow-sm fantasy-card">
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
      <p className="text-sm text-neutral-600 mb-3">Handy non-finite patterns (binyanim-style).</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {DERIVATIONS.map(d => (
          <div key={d.key} className="rounded-2xl border border-neutral-200 p-3">
            <div className="text-xs uppercase tracking-wide text-neutral-500">{d.label}</div>
            <div className="text-lg font-semibold mt-1">{d.build(root)}</div>
            <div className="text-sm text-neutral-600 mt-1">{(explain as any)[d.key]}</div>
          </div>
        ))}
      </div>
      </>
      )}
    </section>
  );
}
