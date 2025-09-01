import { PRONOUNS, TENSES } from "../types";
import type { Root } from "../types";
import { buildFinite, withHabitual, withNegation, withProgressive } from "../lib/morphology";
import Toggle from "./ui/Toggle";

export default function FiniteForms({ root }: { root: Root }){
  const [state, setState] = ((): [
    { showNeg:boolean; showProg:boolean; showHab:boolean },
    (p: Partial<{showNeg:boolean; showProg:boolean; showHab:boolean}>)=>void
  ] => {
    // tiny internal unpersisted state
    let s = { showNeg:false, showProg:false, showHab:false };
    return [s, (p)=>{ Object.assign(s, p); }];
  })();

  const rows = PRONOUNS.map(p => {
    const baseForms = TENSES.map(t => buildFinite(root, p.subjV, t.vowel));
    let forms = baseForms;
    if (state.showProg) forms = forms.map(f => withProgressive(f, root));
    if (state.showHab) forms = forms.map(f => withHabitual(f));
    if (state.showNeg) forms = forms.map(f => withNegation(f));
    return { p, items: forms };
  });

  return (
    <section className="rounded-3xl border border-neutral-200 p-4 shadow-sm">
      <h2 className="text-lg font-semibold mb-1">Finite forms</h2>
      <p className="text-sm text-neutral-600 mb-3">Template: <code>C1 + (SUBJ V) + C2 + (TENSE V) + C3</code></p>
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <Toggle label="Negation" info="Adds naaq-; naq- before k/g/q." checked={state.showNeg} onChange={v=>setState({showNeg:v})} />
        <Toggle label="Progressive" info="Geminate C2 before tense vowel." checked={state.showProg} onChange={v=>setState({showProg:v})} />
        <Toggle label="Habitual" info="Adds -ar for habitual." checked={state.showHab} onChange={v=>setState({showHab:v})} />
      </div>
      <div className="overflow-x-auto rounded-2xl shadow-sm border border-neutral-200">
        <table className="table-fixed w-full text-sm 2xl:text-base text-neutral-900">
          <colgroup>
            <col className="w-[16rem]" />
            <col />
            <col />
            <col />
          </colgroup>
          <thead className="bg-neutral-50">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-neutral-900">Pronoun</th>
              {TENSES.map(t => (<th key={t.key} className="text-left px-5 py-3 font-semibold capitalize text-neutral-900">{t.label}</th>))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, items }, i) => (
              <tr key={p.form} className={i % 2 ? "bg-white" : "bg-neutral-50/40"}>
                <td className="px-5 py-3 whitespace-nowrap text-neutral-900">
                  <span className="font-medium">{p.form}</span>{" "}
                  <span className="text-neutral-600">{p.label.replace(/^[^ ]+ /, "")}</span>
                </td>
                {items.map((f, j) => (<td key={j} className="px-5 py-3 font-medium text-neutral-900">{f}</td>))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
