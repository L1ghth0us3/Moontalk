import type { Root } from "../../types";

export type HSSubj = { form: string; subjV: string };

export function hsSubjectFor(subj: string | null | undefined): HSSubj {
  switch (subj) {
    case 'I': return { form: 'ɪ', subjV: 'ɪ' };
    case 'we': return { form: 'tɪ', subjV: 'ɪ' };
    case 'you': return { form: 'su', subjV: 'u' };
    case 'you(pl)': return { form: 'tu', subjV: 'u' };
    case 'he':
    case 'she':
    case 'they':
    default: return { form: 'se', subjV: 'e' };
  }
}

export function tenseVowel(t: 'present'|'past'|'future'){ return t==='present' ? 'a' : t==='past' ? 'e' : 'ʌ'; }

export function conjFinite(root: Root, subj: HSSubj, t: 'present'|'past'|'future', flags: { prog:boolean; hab:boolean; neg:boolean }, ignoreProg=false, buildFinite: (r: Root, subjV:string, tenseV:string)=>string, withProgressive:(form:string, r:Root)=>string, withHabitual:(form:string)=>string, withNegation:(form:string)=>string){
  let v = buildFinite(root, subj.subjV, tenseVowel(t));
  if (!ignoreProg && flags.prog) v = withProgressive(v, root);
  if (flags.hab) v = withHabitual(v);
  if (flags.neg) v = withNegation(v);
  return v;
}

