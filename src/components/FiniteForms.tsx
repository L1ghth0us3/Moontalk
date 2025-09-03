import { PRONOUNS, TENSES } from "../types";
import type { Root } from "../types";
import { buildFinite, withHabitual, withNegation, withProgressive } from "../lib/morphology";
import Toggle from "./ui/Toggle";
import { useState, useMemo } from "react";
import { useLocalStorageState } from "../lib/storage";

/**
 * Matrix of finite forms for a single root across all pronouns × tenses.
 *
 * - Toggles apply Progressive/Habitual/Negation to the entire table at once.
 * - Can optionally sync these toggles with Talk Pad via `syncMorph`+`morph`.
 * - Cell spacing adapts to the longest visible word to keep the grid compact.
 */
export default function FiniteForms({ root, showCollapse = false, syncMorph = false, morph, onMorphChange, onToggleSync }: {
  root: Root;
  showCollapse?: boolean;
  syncMorph?: boolean;
  morph?: { neg: boolean; prog: boolean; hab: boolean };
  onMorphChange?: (m: { neg: boolean; prog: boolean; hab: boolean }) => void;
  onToggleSync?: () => void;
}){
  const [showNeg, setShowNeg] = useState(false);
  const [showProg, setShowProg] = useState(false);
  const [showHab, setShowHab] = useState(false);
  const [collapsed, setCollapsed] = useLocalStorageState<boolean>('huntspeak_collapse_finite', false);
  const effNeg = syncMorph ? !!morph?.neg : showNeg;
  const effProg = syncMorph ? !!morph?.prog : showProg;
  const effHab = syncMorph ? !!morph?.hab : showHab;

  // Precompute the table rows when inputs/toggles change.
  const rows = useMemo(() => PRONOUNS.map(p => {
    const baseForms = TENSES.map(t => buildFinite(root, p.subjV, t.vowel));
    let forms = baseForms;
    if (effProg) forms = forms.map(f => withProgressive(f, root));
    if (effHab) forms = forms.map(f => withHabitual(f));
    if (effNeg) forms = forms.map(f => withNegation(f));
    return { p, items: forms };
  }), [root, effNeg, effProg, effHab]);

  // Dynamic spacing based on the longest visible cell (approximate by character length)
  const maxFormLen = useMemo(() => {
    let maxLen = 0;
    for (const r of rows) for (const f of r.items) maxLen = Math.max(maxLen, f.length);
    return maxLen;
  }, [rows]);
  const maxPronLen = useMemo(() => Math.max(...PRONOUNS.map(p => p.label.length)), []);
  const maxLen = Math.max(maxFormLen, maxPronLen);

  function densityFromLen(len: number) {
    if (len >= 14) return 'tight';
    if (len >= 10) return 'compact';
    return 'normal';
  }
  const density = densityFromLen(maxLen);
  const headPronPad = density === 'tight' ? 'px-1 py-1' : density === 'compact' ? 'px-2 py-1' : 'px-3 py-2';
  const headTensePad = density === 'tight' ? 'px-2 py-1' : density === 'compact' ? 'px-3 py-1.5' : 'px-4 py-2';
  const cellPronPad = density === 'tight' ? 'px-1 py-1' : density === 'compact' ? 'px-2 py-1' : 'px-3 py-2';
  const cellTensePad = density === 'tight' ? 'px-2 py-1' : density === 'compact' ? 'px-3 py-1.5' : 'px-4 py-2';
  // First column width in ch units based on pronoun label length (clamped)
  const firstColCh = Math.min(18, Math.max(8, maxPronLen + 4));

  return (
    <section className="rounded-3xl border border-neutral-200 p-4 shadow-sm fantasy-card">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl md:text-2xl font-semibold">Finite Forms</h2>
        {showCollapse && (
          <button aria-label={collapsed? 'Expand' : 'Collapse'} className="px-2 py-1 text-sm rounded border border-neutral-300 hover:bg-neutral-50" onClick={()=>setCollapsed(c=>!c)}>
            {collapsed ? '▸' : '▾'}
          </button>
        )}
      </div>
      {!collapsed && (
      <>
      <p className="text-sm text-neutral-600 mb-3">Template: <code>C1 + (SUBJ V) + C2 + (TENSE V) + C3</code></p>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex flex-wrap items-center gap-3">
          <Toggle label="Negation" info="Adds naaq-; naq- before k/g/q." checked={effNeg} onChange={(v)=> syncMorph ? onMorphChange?.({ neg:v, prog: effProg, hab: effHab }) : setShowNeg(v)} />
          <Toggle label="Progressive" info="Geminate C2 before tense vowel." checked={effProg} onChange={(v)=> syncMorph ? onMorphChange?.({ neg: effNeg, prog: v, hab: effHab }) : setShowProg(v)} />
          <Toggle label="Habitual" info="Adds -ar for habitual." checked={effHab} onChange={(v)=> syncMorph ? onMorphChange?.({ neg: effNeg, prog: effProg, hab: v }) : setShowHab(v)} />
        </div>
        <div className="relative group ml-3">
          <button
            type="button"
            onClick={onToggleSync}
            className={`text-xs px-2 py-0.5 rounded-full border select-none ${syncMorph ? 'border-emerald-300 text-emerald-700 bg-emerald-50' : 'border-neutral-300 text-neutral-700 bg-neutral-50 hover:bg-neutral-100'}`}
            title={syncMorph ? 'Click to turn sync Off' : 'Click to turn sync On'}
          >
            {syncMorph ? 'Sync: On' : 'Sync: Off'}
          </button>
          <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 hidden rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs leading-snug text-neutral-900 shadow-xl whitespace-nowrap group-hover:block">
            Sync Neg/Prog/Hab across panels
          </span>
        </div>
      </div>
      <div className="overflow-x-auto rounded-2xl shadow-sm border border-neutral-200">
        <table className="table-fixed w-full text-sm 2xl:text-base finite-table">
          <colgroup>
            <col style={{ width: `${firstColCh}ch` }} />
            <col />
            <col />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th className={`text-left ${headPronPad} font-semibold`}>Pronoun</th>
              {TENSES.map(t => (<th key={t.key} className={`text-left ${headTensePad} font-semibold capitalize text-neutral-900`}>{t.label}</th>))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, items }, i) => (
              <tr key={p.form} className={i % 2 ? "row-odd" : "row-even"}>
                <td className={`${cellPronPad} whitespace-nowrap`}>
                  <span className="font-medium">{p.form}</span>{" "}
                  <span className="opacity-80">{p.label.replace(/^[^ ]+ /, "")}</span>
                </td>
                {items.map((f, j) => (<td key={j} className={`${cellTensePad} font-medium`}>{f}</td>))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </>
      )}
    </section>
  );
}
