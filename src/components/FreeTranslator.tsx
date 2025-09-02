import { useState } from "react";
import { useLocalStorageState } from "../lib/storage";
import type { Noun, Root } from "../types";
import { findRootByEnglish, withHabitual, withNegation, withProgressive } from "../lib/morphology";

const clip = async (text: string) => { try { await navigator.clipboard.writeText(text); } catch {} };

export default function FreeTranslator({ roots, nouns, showCollapse = false }: { roots: Root[]; nouns: Noun[]; showCollapse?: boolean }){
  const [en, setEn] = useState("");
  const [hs, setHs] = useState("");
  const [collapsed, setCollapsed] = useLocalStorageState<boolean>('huntspeak_collapse_translator', false);

  function norm(s: string) { return s.toLowerCase().replace(/[()]/g, "").replace(/\s+/g, " ").trim(); }
  function stripArticles(s: string) { return s.replace(/^(a|an|the)\s+/, ""); }
  function lex(nouns: Noun[], phrase: string){ const p = norm(stripArticles(phrase)); const p2 = p.replace(/s$/, ""); if (p2!==p) phrase = p2; for (const n of nouns){ const w=norm(n.word), g=norm(n.gloss); if (p===w||p===g||g.includes(p)) return n.word; if (n.synonyms && n.synonyms.some(s=>norm(s)===p)) return n.word; } return phrase.trim(); }

  function translate(){
    if (!en.trim()) { setHs(""); return; }
    const s = en.toLowerCase().replace(/[!?.,]/g, " ").replace(/\s+/g, " ").trim();
    const subjMap: Record<string,{form:string; subjV:string}> = { "i":{form:"ɪ",subjV:"ɪ"}, "we":{form:"tɪ",subjV:"ɪ"}, "you":{form:"su",subjV:"u"}, "you all":{form:"tu",subjV:"u"}, "he":{form:"se",subjV:"e"}, "she":{form:"se",subjV:"e"}, "they":{form:"te",subjV:"e"} };
    let subj = subjMap["i"]; for (const k of Object.keys(subjMap)){ if (s.startsWith(k+" ") || s===k){ subj=subjMap[k]; break; } }
    let tense = "a"; let neg=false, prog=false, hab=false; let rest = s.replace(/^(i|we|you all|you|he|she|they)\s*/, "");
    if (/\bwill\b/.test(rest)) { tense = "ʌ"; rest = rest.replace(/\bwill\b/g, ""); }
    if (/\bdid\b/.test(rest)) { tense = "e"; rest = rest.replace(/\bdid\b/g, ""); }
    if (/\bused to\b/.test(rest)) { hab = true; rest = rest.replace(/\bused to\b/g, ""); }
    if (/\bnot\b|\bdon't\b|\bdo not\b|\bdidn't\b|\bwill not\b|\bwon't\b/.test(rest)) { neg=true; rest = rest.replace(/\bnot|don't|do not|didn't|will not|won't/g, ""); }
    if (/\b(am|is|are|was|were)\s+\w+ing\b/.test(rest)) { prog=true; rest = rest.replace(/\b(am|is|are|was|were)\s+/g, ""); }
    rest = rest.trim();
    const words = rest.split(" ");
    let verbToken = words[0] || ""; verbToken = verbToken.replace(/ing$/, "");
    let root = findRootByEnglish(roots, verbToken); if (!root && words.length>=2) root = findRootByEnglish(roots, `${words[0]} ${words[1]}`);
    if (!root) { setHs("(Unknown verb—add a root or use Talk Pad)"); return; }
    let verb = `${root.c1}${subj.subjV}${root.c2}${tense}${root.c3}`; if (prog) verb=withProgressive(verb,root); if (hab) verb=withHabitual(verb); if (neg) verb=withNegation(verb);
    const withMatch = rest.match(/\bwith\s+([^]+?)(?=\bto\b|\bfrom\b|$)/); const toMatch = rest.match(/\bto\s+([^]+?)(?=\bwith\b|\bfrom\b|$)/); const fromMatch = rest.match(/\bfrom\s+([^]+?)(?=\bwith\b|\bto\b|$)/);
    let object = rest.replace(/^(\w+)(ing)?\b/, "").replace(/\b(with|to|from)\b[^]+$/, "").trim(); object = stripArticles(object);
    const bits: string[] = [subj.form, verb]; if (object) bits.push(lex(nouns, object)); if (withMatch) bits.push("fi", lex(nouns, withMatch[1].trim())); if (toMatch) bits.push("ga", lex(nouns, toMatch[1].trim())); if (fromMatch) bits.push("ʌs", lex(nouns, fromMatch[1].trim()));
    setHs(bits.join(" "));
  }

  return (
    <section className="rounded-3xl border border-neutral-200 p-4 shadow-sm fantasy-card">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl md:text-2xl font-semibold">Free Translator (simple, 1-verb lines)</h2>
        {showCollapse && (
          <button aria-label={collapsed? 'Expand' : 'Collapse'} className="px-2 py-1 text-sm rounded border border-neutral-300 hover:bg-neutral-50" onClick={()=>setCollapsed(c=>!c)}>
            {collapsed ? '▸' : '▾'}
          </button>
        )}
      </div>
      {!collapsed && (
      <>
      <p className="text-sm text-neutral-600 mb-3">Try: <code>we will hunt with a trap from the Shroud</code>. Recognizes pronouns + will/did/not + with/to/from.</p>
      <div className="space-y-2">
        <textarea className="w-full h-20 px-3 py-2 rounded-xl border border-neutral-300" placeholder="Type: we will hunt with a trap from the Shroud" value={en} onChange={e=>setEn(e.target.value)} />
        <div className="flex items-center gap-2">
          <button onClick={translate} className="px-3 py-2 rounded-xl border border-neutral-300 hover:bg-neutral-50">Translate</button>
          <button onClick={()=>clip(hs)} className="px-3 py-2 rounded-xl border border-neutral-300 hover:bg-neutral-50">Copy</button>
          <div className="text-sm text-neutral-500">Recognizes pronouns, will/did/not, with/to/from.</div>
        </div>
        <div className="rounded-2xl border border-neutral-200 p-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Huntspeak</div>
          <div className="text-lg font-semibold break-words mt-1">{hs || "—"}</div>
        </div>
      </div>
      </>
      )}
    </section>
  );
}
