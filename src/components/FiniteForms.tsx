import { PRONOUNS, TENSES } from "../types";
import type { Root } from "../types";
import { buildFinite, withHabitual, withNegation, withProgressive } from "../lib/morphology";
import Toggle from "./ui/Toggle";
import { useState, useMemo } from "react";
import { useLocalStorageState } from "../lib/storage";

/**
 * Matrix of finite forms for a single root across all pronouns × tenses,
 * with optional toggles to apply progressive/habitual/negation uniformly.
 */
export default function FiniteForms({ root, showCollapse = false }: { root: Root, showCollapse?: boolean }){
  const [showNeg, setShowNeg] = useState(false);
  const [showProg, setShowProg] = useState(false);
  const [showHab, setShowHab] = useState(false);
  const [collapsed, setCollapsed] = useLocalStorageState<boolean>('huntspeak_collapse_finite', false);

  // Precompute the table rows when inputs/toggles change.
  const rows = useMemo(() => PRONOUNS.map(p => {
    const baseForms = TENSES.map(t => buildFinite(root, p.subjV, t.vowel));
    let forms = baseForms;
    if (showProg) forms = forms.map(f => withProgressive(f, root));
    if (showHab) forms = forms.map(f => withHabitual(f));
    if (showNeg) forms = forms.map(f => withNegation(f));
    return { p, items: forms };
  }), [root, showNeg, showProg, showHab]);

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
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <Toggle label="Negation" info="Adds naaq-; naq- before k/g/q." checked={showNeg} onChange={setShowNeg} />
        <Toggle label="Progressive" info="Geminate C2 before tense vowel." checked={showProg} onChange={setShowProg} />
        <Toggle label="Habitual" info="Adds -ar for habitual." checked={showHab} onChange={setShowHab} />
      </div>
      <div className="overflow-x-auto rounded-2xl shadow-sm border border-neutral-200">
        <table className="table-fixed w-full text-sm 2xl:text-base finite-table">
          <colgroup>
            <col className="w-[16rem]" />
            <col />
            <col />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th className="text-left px-4 py-2 font-semibold">Pronoun</th>
              {TENSES.map(t => (<th key={t.key} className="text-left px-5 py-3 font-semibold capitalize text-neutral-900">{t.label}</th>))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, items }, i) => (
              <tr key={p.form} className={i % 2 ? "row-odd" : "row-even"}>
                <td className="px-5 py-3 whitespace-nowrap">
                  <span className="font-medium">{p.form}</span>{" "}
                  <span className="opacity-80">{p.label.replace(/^[^ ]+ /, "")}</span>
                </td>
                {items.map((f, j) => (<td key={j} className="px-5 py-3 font-medium">{f}</td>))}
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
