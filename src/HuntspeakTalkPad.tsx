import React, { useEffect, useMemo, useState } from "react";

/**
 * HUNTSPEAK TALK PAD — v1 (RP-friendly)
 * Make words → press buttons → speak Huntspeak.
 *
 * Features:
 *  - Lexicon: verb roots (triconsonantal) + nouns
 *  - Talk Pad: pick pronoun, verb, tense; add object/with/to/from; copy line
 *  - Free Translator (very simple): short English → Huntspeak
 *  - Finite verb tables + common derivations for the selected root
 *  - Export/Import data (JSON) + autosave to localStorage
 *
 * Core verb template:
 *   (SUBJ V) + C1 + (SUBJ V) + C2 + (TENSE V) + C3
 * Subject vowels: ɪ/tɪ→ "ɪ"; su/tu→ "u"; se/te→ "e"
 * Tense vowels: present "a", past "e", future "ʌ".
 */

// ---------- Types ----------
interface Root {
  id: string;
  c1: string;
  c2: string;
  c3: string;
  gloss: string;
  synonyms?: string[];
}

interface Noun {
  id: string;
  word: string;
  gloss: string;
  synonyms?: string[];
}

interface DerivationDef {
  key: string;
  label: string;
  build: (r: Root) => string;
}

// ---------- Utilities ----------
const uid = () => Math.random().toString(36).slice(2, 10);
const clip = async (text: string) => { try { await navigator.clipboard.writeText(text); } catch {} };

const DEFAULT_ROOTS: Root[] = [
  { id: uid(), c1: "k", c2: "l", c3: "b", gloss: "track; hunt", synonyms: ["hunt", "track", "stalk"] },
  { id: uid(), c1: "χ", c2: "r", c3: "q", gloss: "smell; catch scent", synonyms: ["smell", "scent"] },
  { id: uid(), c1: "s", c2: "r", c3: "q", gloss: "hide; lie in wait", synonyms: ["hide", "ambush", "wait"] },
  { id: uid(), c1: "d", c2: "r", c3: "k", gloss: "strike; bring down", synonyms: ["strike", "hit", "kill"] },
  { id: uid(), c1: "q", c2: "r", c3: "b", gloss: "draw near; approach", synonyms: ["approach", "near", "come"] },
  { id: uid(), c1: "t", c2: "r", c3: "f", gloss: "hear; detect", synonyms: ["hear", "detect", "listen"] },
];

const DEFAULT_NOUNS: Noun[] = [
  { id: uid(), word: "mallūb", gloss: "trap, snare" },
  { id: uid(), word: "kalāb", gloss: "hunter" },
  { id: uid(), word: "kalis", gloss: "scent trail" },
  { id: uid(), word: "Shroud", gloss: "the Shroud (place)" },
  { id: uid(), word: "prey", gloss: "prey" },
];

// Pronouns & harmony
const PRONOUNS = [
  { label: "1sg (ɪ)", form: "ɪ", subjV: "ɪ" },
  { label: "2sg (su)", form: "su", subjV: "u" },
  { label: "3sg (se)", form: "se", subjV: "e" },
  { label: "1pl (tɪ)", form: "tɪ", subjV: "ɪ" },
  { label: "2pl (tu)", form: "tu", subjV: "u" },
  { label: "3pl (te)", form: "te", subjV: "e" },
];

const TENSES = [
  { key: "prs", label: "present", vowel: "a" },
  { key: "pst", label: "past", vowel: "e" },
  { key: "fut", label: "future", vowel: "ʌ" },
];

// Common derivations
const DERIVATIONS: DerivationDef[] = [
  { key: "agent", label: "agent (CaCāC)", build: r => `${r.c1}a${r.c2}ā${r.c3}` },
  { key: "place", label: "place (miCCaC)", build: r => `mi${r.c1}${r.c2}a${r.c3}` },
  { key: "instrument", label: "instrument (maCCūC)", build: r => `ma${r.c1}${r.c2}ū${r.c3}` },
  { key: "middle", label: "middle/reflexive (t-CaCCaC)", build: r => `t${r.c1}a${r.c2}${r.c2}a${r.c3}` },
  { key: "caus", label: "causative (χa-CiCēC)", build: r => `χa${r.c1}i${r.c2}ē${r.c3}` },
  { key: "intens", label: "intensive (CuCCaC)", build: r => `${r.c1}u${r.c2}${r.c2}a${r.c3}` },
  { key: "pass", label: "passive (n-CaCaC)", build: r => `n${r.c1}a${r.c2}a${r.c3}` },
  { key: "concept", label: "general concept (CaCiC)", build: r => `${r.c1}a${r.c2}i${r.c3}` },
];

// ---------- Morphology helpers ----------
function buildFinite(r: Root, subjV: string, tenseV: string) {
  // C1 + (SUBJ V) + C2 + (TENSE V) + C3
  return `${r.c1}${subjV}${r.c2}${tenseV}${r.c3}`;
}

function withProgressive(form: string, r: Root) {
  const lastTwo = form.slice(-2); // tenseV + C3
  const stem = form.slice(0, -2);
  return `${stem}${r.c2}${lastTwo}`; // duplicate C2
}
function withHabitual(form: string) { return `${form}ar`; }
function withNegation(form: string) { return /^(k|g|q)/i.test(form) ? `naq${form}` : `naaq${form}`; }

// Very small English→root matcher for Free Translator
function findRootByEnglish(roots: Root[], token: string): Root | null {
  const t = token.toLowerCase();
  for (const r of roots) {
    const spaceGloss = `${r.gloss}; ${(r.synonyms||[]).join('; ')}`.toLowerCase();
    for (const g of spaceGloss.split(/[,;]/).map(s => s.trim())) {
      if (!g) continue;
      if (g === t) return r;
    }
  }
  for (const r of roots) {
    const g = `${r.gloss} ${(r.synonyms||[]).join(' ')}`.toLowerCase();
    if (g.includes(t)) return r;
  }
  return null;
}

// ---------- Main Component ----------
export default function HuntspeakTalkPad() {
  const [roots, setRoots] = useState<Root[]>([]);
  const [nouns, setNouns] = useState<Noun[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNeg, setShowNeg] = useState(false);
  const [showProg, setShowProg] = useState(false);
  const [showHab, setShowHab] = useState(false);

  // Load/save localStorage
  useEffect(() => {
    const savedR = localStorage.getItem("huntspeak_roots");
    const savedN = localStorage.getItem("huntspeak_nouns");
    if (savedR) {
      try { const parsed: Root[] = JSON.parse(savedR); if (Array.isArray(parsed) && parsed.length) { setRoots(parsed); setSelectedId(parsed[0]?.id ?? null); } else { setRoots(DEFAULT_ROOTS); setSelectedId(DEFAULT_ROOTS[0].id); } }
      catch { setRoots(DEFAULT_ROOTS); setSelectedId(DEFAULT_ROOTS[0].id); }
    } else { setRoots(DEFAULT_ROOTS); setSelectedId(DEFAULT_ROOTS[0].id); }

    if (savedN) { try { const parsedN: Noun[] = JSON.parse(savedN); setNouns(Array.isArray(parsedN) && parsedN.length ? parsedN : DEFAULT_NOUNS); } catch { setNouns(DEFAULT_NOUNS); } }
    else { setNouns(DEFAULT_NOUNS); }
  }, []);

  useEffect(() => { localStorage.setItem("huntspeak_roots", JSON.stringify(roots)); }, [roots]);
  useEffect(() => { localStorage.setItem("huntspeak_nouns", JSON.stringify(nouns)); }, [nouns]);

  const selected = useMemo(() => roots.find(r => r.id === selectedId) ?? null, [roots, selectedId]);

  const [synonymsText, setSynonymsText] = useState("");
  useEffect(() => {
    // keep the editor in sync when selection changes
    setSynonymsText((selected?.synonyms || []).join(", "));
  }, [selected?.id]);

  // Noun selection (to mirror roots UI)
  const [selectedNounId, setSelectedNounId] = useState<string | null>(nouns[0]?.id || null);
  useEffect(() => { if (!selectedNounId && nouns[0]) setSelectedNounId(nouns[0].id); }, [nouns, selectedNounId]);
  const selectedNoun = useMemo(() => nouns.find(n => n.id === selectedNounId) ?? null, [nouns, selectedNounId]);
  const [nounSynText, setNounSynText] = useState("");

  // keep the editor in sync when selection changes
  useEffect(() => {
    setNounSynText((selectedNoun?.synonyms || []).join(", "));
  }, [selectedNoun?.id]);



  // CRUD
  const addRoot = (r: Partial<Root>) => { if (!r.c1 || !r.c2 || !r.c3) return; const newRoot: Root = { id: uid(), c1: r.c1.trim(), c2: r.c2.trim(), c3: r.c3.trim(), gloss: (r.gloss ?? "").trim(), synonyms: r.synonyms ?? [] }; setRoots(prev => [newRoot, ...prev]); setSelectedId(newRoot.id); };
  const updateRoot = (id: string, patch: Partial<Root>) => setRoots(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
  const deleteRoot = (id: string) => { setRoots(prev => prev.filter(r => r.id !== id)); if (selectedId === id) setSelectedId(prev => (roots.find(r => r.id !== id)?.id ?? null)); };

  const addNoun = (n: Partial<Noun>) => { if (!n.word) return; const nn: Noun = { id: uid(), word: String(n.word), gloss: String(n.gloss ?? "") }; setNouns(prev => [nn, ...prev]); };
  const updateNoun = (id: string, patch: Partial<Noun>) => setNouns(prev => prev.map(n => (n.id === id ? { ...n, ...patch } : n)));
  const deleteNoun = (id: string) => setNouns(prev => prev.filter(n => n.id !== id));

  // Export / import JSON
  const exportJSON = () => { const blob = new Blob([JSON.stringify({ roots, nouns }, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "huntspeak_data.json"; a.click(); URL.revokeObjectURL(url); };
  const importJSON = (file: File) => { 
    const reader = new FileReader(); reader.onload = () => { 
      try { 
        const data = JSON.parse(String(reader.result)); 
        if (data && Array.isArray(data.roots) && Array.isArray(data.nouns)) { 
          const cleanedR: Root[] = data.roots.filter((x: any) => x && x.c1 && x.c2 && x.c3).map((x: any) => ({ id: uid(), c1: String(x.c1), c2: String(x.c2), c3: String(x.c3), gloss: String(x.gloss ?? ""), synonyms: Array.isArray(x.synonyms) ? x.synonyms.map((s: any) => String(s)) : [] })); 
          const cleanedN: Noun[] = data.nouns
            .filter((x: any) => x && x.word)
            .map((x: any) => ({
              id: uid(),
              word: String(x.word),
              gloss: String(x.gloss ?? ""),
              synonyms: Array.isArray(x.synonyms) ? x.synonyms.map((s: any) => String(s)) : [],
            }));

          if (cleanedR.length) { setRoots(cleanedR); setSelectedId(cleanedR[0].id); } 
          setNouns(cleanedN.length ? cleanedN : []); } 
        } catch { alert("Import failed: invalid JSON file."); } }; reader.readAsText(file); };

  return (
    <div className="p-6 2xl:p-10 max-w-none mx-auto font-sans">
      <header className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">Huntspeak Talk Pad</h1>
        <p className="text-neutral-600 mt-1">RP-ready: create words and get instant Huntspeak lines.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 2xl:grid-cols-5 gap-6">
        {/* Left rail: Lexicon */}
        <aside className="lg:col-span-1 space-y-6">
          <section className="rounded-3xl border border-neutral-200 p-4 shadow-sm">
            <h2 className="text-lg font-semibold mb-3">Verb Roots</h2>
            <RootCreator onCreate={addRoot} />
            <div className="mt-3 max-h-[20rem] overflow-y-auto space-y-2 pr-1">
              {roots.map(r => (
                <button key={r.id} onClick={() => setSelectedId(r.id)} className={`w-full text-left px-3 py-2 rounded-xl border ${selectedId === r.id ? "border-blue-500 bg-blue-50" : "border-neutral-200 hover:bg-neutral-50"}`}>
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-lg">{[r.c1, r.c2, r.c3].join("-")}</div>
                    <div className="text-xs text-neutral-500 truncate max-w-[10rem]">{r.gloss || "(no gloss)"}</div>
                  </div>
                </button>
              ))}
              {!roots.length && <div className="text-neutral-500 text-sm">No roots yet. Add one above.</div>}
            </div>

            {selected && (
              <div className="mt-4 space-y-2">
                <h3 className="text-sm font-semibold">Edit selected</h3>
                <div className="grid grid-cols-4 gap-2">
                  <input className="px-2 py-1 rounded-lg border border-neutral-300" value={selected.c1} onChange={e => updateRoot(selected.id, { c1: e.target.value })} />
                  <input className="px-2 py-1 rounded-lg border border-neutral-300" value={selected.c2} onChange={e => updateRoot(selected.id, { c2: e.target.value })} />
                  <input className="px-2 py-1 rounded-lg border border-neutral-300" value={selected.c3} onChange={e => updateRoot(selected.id, { c3: e.target.value })} />
                  <button onClick={() => deleteRoot(selected.id)} className="px-2 py-1 rounded-lg border border-red-300 text-red-600 hover:bg-red-50">Delete</button>
                </div>
                <input className="w-full px-2 py-1 rounded-lg border border-neutral-300" placeholder="gloss" value={selected.gloss} onChange={e => updateRoot(selected.id, { gloss: e.target.value })} />
                <input
                  className="w-full px-2 py-1 rounded-lg border border-neutral-300"
                  placeholder="extra English triggers (comma-separated)"
                  value={synonymsText}
                  onChange={e => setSynonymsText(e.target.value)}
                  onBlur={e => {
                    const arr = e.target.value.split(",").map(x => x.trim()).filter(Boolean);
                    updateRoot(selected!.id, { synonyms: arr });
                  }}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.currentTarget.blur(); // triggers onBlur save
                    }
                  }}
                />

              </div>
            )}

            <div className="mt-4 flex items-center gap-2">
              <button onClick={exportJSON} className="px-3 py-2 rounded-xl border border-neutral-300 hover:bg-neutral-50">Export</button>
              <label className="px-3 py-2 rounded-xl border border-neutral-300 hover:bg-neutral-50 cursor-pointer">Import<input type="file" accept="application/json" className="hidden" onChange={e => e.target.files && e.target.files[0] && importJSON(e.target.files[0])} /></label>
              <button onClick={() => {localStorage.removeItem("huntspeak_roots"); localStorage.removeItem("huntspeak_nouns"); setRoots(DEFAULT_ROOTS); setNouns(DEFAULT_NOUNS); setSelectedId(DEFAULT_ROOTS[0].id);}} className="ml-auto px-3 py-2 rounded-xl border border-neutral-300 hover:bg-neutral-50">Reset</button>
            </div>
          </section>

          <section className="rounded-3xl border border-neutral-200 p-4 shadow-sm">
            <h2 className="text-lg font-semibold mb-3">Nouns</h2>
            <NounCreator onCreate={addNoun} />
            <div className="mt-3 max-h-[20rem] overflow-y-auto space-y-2 pr-1">
              {nouns.map(n => (
                <button
                  key={n.id}
                  onClick={() => setSelectedNounId(n.id)}
                  className={`w-full text-left px-3 py-2 rounded-xl border ${
                    selectedNounId === n.id ? "border-blue-500 bg-blue-50" : "border-neutral-200 hover:bg-neutral-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-lg">{n.word}</div>
                    <div className="text-xs text-neutral-500 truncate max-w-[10rem]">{n.gloss || "(no gloss)"}</div>
                  </div>
                </button>
              ))}
              {!nouns.length && <div className="text-neutral-500 text-sm">No nouns yet. Add one above.</div>}
            </div>
            {selectedNoun && (
              <div className="mt-4 space-y-2">
                <h3 className="text-sm font-semibold">Edit selected</h3>
                <div className="grid grid-cols-4 gap-2">
                  <input className="px-2 py-1 rounded-lg border border-neutral-300"
                         value={selectedNoun.word}
                         onChange={e => updateNoun(selectedNoun.id, { word: e.target.value })} />
                  <input className="col-span-2 px-2 py-1 rounded-lg border border-neutral-300"
                         placeholder="gloss"
                         value={selectedNoun.gloss}
                         onChange={e => updateNoun(selectedNoun.id, { gloss: e.target.value })} />
                  <button onClick={() => deleteNoun(selectedNoun.id)}
                          className="px-2 py-1 rounded-lg border border-red-300 text-red-600 hover:bg-red-50">
                    Delete
                  </button>
                </div>
                <input
                  className="w-full px-2 py-1 rounded-lg border border-neutral-300"
                  placeholder="extra English triggers (comma-separated)"
                  value={nounSynText}
                  onChange={e => setNounSynText(e.target.value)}
                  onBlur={e => {
                    const arr = e.target.value.split(",").map(s => s.trim()).filter(Boolean);
                    updateNoun(selectedNoun!.id, { synonyms: arr });
                  }}
                  onKeyDown={e => {
                    if (e.key === "Enter") e.currentTarget.blur(); // triggers onBlur save
                  }}
                />
              </div>
            )}
          </section>
        </aside>

        {/* Main workspace */}
        <main className="lg:col-span-3 2xl:col-span-4 space-y-6">
          {/* TALK PAD */}
          <section className="rounded-3xl border border-neutral-200 p-4 shadow-sm">
            <h2 className="text-lg font-semibold mb-1">Talk Pad</h2>
            <p className="text-sm text-neutral-600 mb-3">Pick who + verb + tense, type object. Copy & paste into chat.</p>
            <TalkPad roots={roots} nouns={nouns} />
          </section>

          {/* FINITE TABLES */}
          <section className="rounded-3xl border border-neutral-200 p-4 shadow-sm">
            <h2 className="text-lg font-semibold mb-1">Finite forms</h2>
            <p className="text-sm text-neutral-600 mb-3">Template: <code>C1 + (SUBJ V) + C2 + (TENSE V) + C3</code></p>
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <Toggle
                label="Negation"
                info="Adds naaq- before the verb; becomes naq- before k/g/q (e.g., naqkelab)."
                checked={showNeg}
                onChange={setShowNeg}
              />
              <Toggle
                label="Progressive"
                info="Geminate C2 before the tense vowel → ongoing action (≈ “be …-ing”)."
                checked={showProg}
                onChange={setShowProg}
              />
              <Toggle
                label="Habitual"
                info="Adds -ar for customary/repeated actions or general truths."
                checked={showHab}
                onChange={setShowHab}
              />

            </div>
            {selected ? <RenderFiniteTable root={selected} showNeg={showNeg} showProg={showProg} showHab={showHab} /> : <div className="text-neutral-500">Select a root to see forms.</div>}
          </section>

          {/* DERIVATIONS */}
          <section className="rounded-3xl border border-neutral-200 p-4 shadow-sm">
            <h2 className="text-lg font-semibold mb-1">Derivations</h2>
            <p className="text-sm text-neutral-600 mb-3">Handy non-finite patterns (binyanim-style).</p>
            {selected ? <RenderDerivations root={selected} /> : <div className="text-neutral-500">Select a root.</div>}
          </section>

          {/* FREE TRANSLATOR */}
          <section className="rounded-3xl border border-neutral-200 p-4 shadow-sm">
            <h2 className="text-lg font-semibold mb-1">Free Translator (simple, 1-verb lines)</h2>
            <p className="text-sm text-neutral-600 mb-3">Try: <code>we will hunt with a trap from the Shroud</code>. Recognizes pronouns + will/did/not + with/to/from.</p>
            <FreeTranslator roots={roots} nouns={nouns} />
          </section>

          <footer className="mt-2 text-xs text-neutral-500">Tip: Digraphs like <code>sh, kh</code> can be a single C slot. Copy to paste into RP chat quickly.</footer>
        </main>
      </div>
    </div>
  );
}

// ---------- Subcomponents ----------
function Toggle({
  label,
  checked,
  onChange,
  info, // optional hover text
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  info?: string;
}) {
  return (
    <label className="inline-flex items-center gap-2 select-none cursor-pointer">
      <input
        type="checkbox"
        className="h-4 w-4"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
      />
      <span className="text-sm flex items-center gap-1">
        {label}
        {info && (
          <span className="relative group inline-flex">
            {/* info dot — no title= (prevents native tooltip) */}
            <span
              aria-label="info"
              className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-neutral-400 text-[10px] leading-none text-neutral-600 cursor-help"
            >
              i
            </span>
            {/* custom hover card (wrap long text, cap width) */}
            <span
               className="
                pointer-events-none absolute left-0 top-full mt-2 z-50 hidden
                rounded-md border border-neutral-200 bg-white
                px-3 py-2 text-sm leading-snug text-neutral-900 shadow-xl
                whitespace-pre-wrap break-words text-left
                w-[max-content] max-w-[min(90vw,48rem)]
                group-hover:block
              "
              role="tooltip"
            >
              {info}
            </span>
          </span>
        )}
      </span>
    </label>
  );
}

function NiceSelect({
  value,
  onChange,
  items,
  placeholder = "Select…",
}: {
  value: string;
  onChange: (v: string) => void;
  items: { value: string; label: string }[];
  placeholder?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [hoverIdx, setHoverIdx] = React.useState<number>(-1);
  const btnRef = React.useRef<HTMLButtonElement | null>(null);
  const boxRef = React.useRef<HTMLDivElement | null>(null);

  const selected = items.find(i => i.value === value);

  // close on outside click
  React.useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // keyboard support
  function onKeyDown(e: React.KeyboardEvent) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      setOpen(true);
      setHoverIdx(Math.max(0, items.findIndex(i => i.value === value)));
      return;
    }
    if (!open) return;
    if (e.key === "Escape") { setOpen(false); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setHoverIdx(i => Math.min(items.length - 1, (i < 0 ? 0 : i + 1))); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setHoverIdx(i => Math.max(0, (i < 0 ? 0 : i - 1))); }
    if (e.key === "Enter") {
      e.preventDefault();
      const pick = items[hoverIdx];
      if (pick) onChange(pick.value);
      setOpen(false);
    }
  }

  return (
    <div className="relative" ref={boxRef}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        onKeyDown={onKeyDown}
        className={`w-full text-left px-3 py-2 rounded-lg border
          ${open
            ? "border-neutral-300 bg-white text-neutral-900"
            : "border-neutral-600 bg-neutral-800 text-white"}
          focus:outline-none focus:ring-2 focus:ring-blue-400/30`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected
          ? <span>{selected.label}</span>
          : <span className={open ? "text-neutral-500" : "text-neutral-300"}>{placeholder}</span>}
      </button>


      {open && (
        <div
          role="listbox"
          tabIndex={-1}
          className="absolute left-0 top-full mt-1 z-50 w-full max-h-64 overflow-auto rounded-lg border border-neutral-300 bg-white shadow-xl"
        >
          {items.map((it, idx) => {
            const active = it.value === value;
            const hover = idx === hoverIdx;
            return (
              <div
                key={it.value}
                role="option"
                aria-selected={active}
                className={`px-3 py-2 cursor-pointer text-sm ${
                  hover ? "bg-neutral-100" : active ? "bg-blue-50" : ""
                } ${active ? "font-semibold" : "font-normal"} text-neutral-900`}
                onMouseEnter={() => setHoverIdx(idx)}
                onMouseLeave={() => setHoverIdx(-1)}
                onClick={() => { onChange(it.value); setOpen(false); }}
              >
                {it.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


function RootCreator({ onCreate }: { onCreate: (r: Partial<Root>) => void }) {
  const [c1, setC1] = useState("");
  const [c2, setC2] = useState("");
  const [c3, setC3] = useState("");
  const [gloss, setGloss] = useState("");
  const disabled = !c1 || !c2 || !c3;
  const submit = () => { onCreate({ c1, c2, c3, gloss }); setC1(""); setC2(""); setC3(""); setGloss(""); };
  return (
    <div className="rounded-2xl bg-neutral-50 p-3 border border-neutral-200">
      <div className="grid grid-cols-[repeat(3,auto)_1fr_auto] gap-2 items-center">
        <input className="h-10 w-[2.5rem] px-2 rounded-lg border border-neutral-300 bg-white text-neutral-900 placeholder-neutral-500 text-center" placeholder="C1" value={c1} onChange={e => setC1(e.target.value)} />
        <input className="h-10 w-[2.5rem] px-2 rounded-lg border border-neutral-300 bg-white text-neutral-900 placeholder-neutral-500 text-center" placeholder="C2" value={c2} onChange={e => setC2(e.target.value)} />
        <input className="h-10 w-[2.5rem] px-2 rounded-lg border border-neutral-300 bg-white text-neutral-900 placeholder-neutral-500 text-center" placeholder="C3" value={c3} onChange={e => setC3(e.target.value)} />
        <input className="h-10 min-w-0 w-full px-3 rounded-lg border border-neutral-300 bg-white text-neutral-900 placeholder-neutral-500" placeholder="gloss (e.g., ‘track; hunt’ )" value={gloss} onChange={e => setGloss(e.target.value)} />
        <button
          disabled={disabled}
          onClick={submit}
          aria-label="Add root"
          className={`h-10 w-10 rounded-xl flex items-center justify-center
            ${disabled
              ? "bg-neutral-700 text-neutral-400 cursor-not-allowed"
              : "bg-neutral-900 text-white hover:bg-neutral-800"}`}
        >
          <span className="text-lg font-bold leading-none">+</span>
        </button>
      </div>
    </div>
  );
}

function NounCreator({ onCreate }: { onCreate: (n: Partial<Noun>) => void }) {
  const [word, setWord] = useState("");
  const [gloss, setGloss] = useState("");
  const disabled = !word;
  const submit = () => { onCreate({ word, gloss }); setWord(""); setGloss(""); };

  return (
    <div className="rounded-2xl bg-neutral-50 p-3 border border-neutral-200">
      <div className="grid grid-cols-[4rem_4rem_4rem_minmax(10rem,1fr)_2.5rem] gap-2 items-center">
        <input className="col-span-3 px-2 py-1 rounded-lg border border-neutral-300 bg-white text-neutral-900 placeholder-neutral-500"
               placeholder="noun (e.g., mallūb)" value={word} onChange={e => setWord(e.target.value)} />
        <input className="col-span-3 px-2 py-1 rounded-lg border border-neutral-300 bg-white text-neutral-900 placeholder-neutral-500"
               placeholder="gloss (e.g., trap)" value={gloss} onChange={e => setGloss(e.target.value)} />
        <button disabled={disabled}
                onClick={submit}
                className={`col-span-1 px-3 py-2 rounded-xl ${disabled ? "border border-neutral-200 text-neutral-400" : "border border-emerald-300 text-emerald-700 hover:bg-emerald-50"}`}>
          +
        </button>
      </div>
    </div>
  );
}



function RenderFiniteTable({
  root, showNeg, showProg, showHab
}: { root: Root; showNeg: boolean; showProg: boolean; showHab: boolean; }) {
  const rows = PRONOUNS.map(p => {
    const baseForms = TENSES.map(t => buildFinite(root, p.subjV, t.vowel));
    let forms = baseForms;
    if (showProg) forms = forms.map(f => withProgressive(f, root));
    if (showHab) forms = forms.map(f => withHabitual(f));
    if (showNeg) forms = forms.map(f => withNegation(f));
    return { p, items: forms };
  });

  return (
    <div className="overflow-x-auto rounded-2xl shadow-sm border border-neutral-200">
      {/* table-fixed spreads columns evenly; colgroup pins a nice wide pronoun column */}
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
            {TENSES.map(t => (
              <th key={t.key} className="text-left px-5 py-3 font-semibold capitalize text-neutral-900">
                {t.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ p, items }, i) => (
            <tr key={p.form} className={i % 2 ? "bg-white" : "bg-neutral-50/40"}>
              <td className="px-5 py-3 whitespace-nowrap text-neutral-900">
                <span className="font-medium">{p.form}</span>{" "}
                <span className="text-neutral-600">{p.label.replace(/^[^ ]+ /, "")}</span>
              </td>
              {items.map((f, j) => (
                <td key={j} className="px-5 py-3 font-medium text-neutral-900">{f}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RenderDerivations({ root }: { root: Root }) {
  // Pull a simple English base verb from the gloss (first bit before ; , .)
  const base = useMemo(() => {
    const head = (root.gloss || "").split(/[;,.]/)[0]?.trim() || "hunt";
    return head.toLowerCase(); // e.g., "hunt", "strike", "draw near"
  }, [root.gloss]);

  // Tiny helpers to make readable English hints (kept intentionally simple)
  const gerund = (v: string) => {
    if (!v) return v;
    if (v.includes(" ")) return v;          // phrases: "bring down" → leave as "bring down"
    if (/(e)$/i.test(v) && !/(ee|oe|ye)$/i.test(v)) return v.slice(0, -1) + "ing"; // strike → striking
    return v + "ing";                        // hunt → hunting
  };
  const pastPart = (v: string) => {
    if (!v) return v;
    if (v.includes(" ")) return v;          // phrases: keep it simple
    if (/e$/i.test(v)) return v + "d";      // chase → chased
    if (/y$/i.test(v)) return v.slice(0, -1) + "ied"; // carry → carried (approx)
    return v + "ed";                         // hunt → hunted
  };
  const agentN = (v: string) => {
    if (!v) return v;
    if (v.includes(" ")) return `one who ${v}`; // "one who bring down"
    if (/e$/i.test(v)) return v.slice(0, -1) + "er"; // strike → striker
    return v + "er";                               // hunt → hunter
  };

  // Short explanations keyed to your patterns
  const explain: Record<string, string> = {
    agent:    `one who ${base} (“${agentN(base)}”)`,
    place:    `place/ground for ${gerund(base)}`,
    instrument:`tool for ${gerund(base)}`,
    middle:   `self/middle: ${base} oneself`,
    caus:     `causative: make/let someone ${base}`,
    intens:   `intensive: do ${base} intensely`,
    pass:     `passive: be ${pastPart(base)}`,
    concept:  `nominal: the act/idea of ${gerund(base)}`,
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {DERIVATIONS.map(d => (
        <div key={d.key} className="rounded-2xl border border-neutral-200 p-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500">{d.label}</div>
          <div className="text-lg font-semibold mt-1">{d.build(root)}</div>
          <div className="text-xs text-neutral-500 mt-1">≈ {explain[d.key] || "derived form"}</div>
        </div>
      ))}
    </div>
  );
}


// ----- Talk Pad -----
function TalkPad({ roots, nouns }: { roots: Root[]; nouns: Noun[] }) {
  const [pron, setPron] = useState(PRONOUNS[0]);
  const [rootId, setRootId] = useState<string>(roots[0]?.id || "");
  const [tense, setTense] = useState(TENSES[0]);
  const [neg, setNeg] = useState(false);
  const [prog, setProg] = useState(false);
  const [hab, setHab] = useState(false);
  const [obj, setObj] = useState("");
  const [withNounId, setWithNounId] = useState<string>("");
  const [toText, setToText] = useState("");
  const [fromText, setFromText] = useState("");
  const [question, setQuestion] = useState(false);
  const [register, setRegister] = useState<{attn:boolean; flank:boolean; hush:boolean}>({attn:false, flank:false, hush:false});

  const r = useMemo(() => roots.find(x => x.id === rootId) || roots[0], [roots, rootId]);
  useEffect(() => { if (!rootId && roots[0]) setRootId(roots[0].id); }, [roots, rootId]);

  const hsVerb = useMemo(() => {
    if (!r) return "";
    let form = buildFinite(r, pron.subjV, tense.vowel);
    if (prog) form = withProgressive(form, r);
    if (hab) form = withHabitual(form);
    if (neg) form = withNegation(form);
    return form;
  }, [r, pron, tense, neg, prog, hab]);

  const withNoun = nouns.find(n => n.id === withNounId);

  const sentence = useMemo(() => {
    if (!r) return "";
    const bits: string[] = [];
    bits.push(pron.form);
    bits.push(hsVerb);
    if (obj.trim()) bits.push(obj.trim());
    if (withNoun) bits.push("fi", withNoun.word);
    if (toText.trim()) bits.push("ga", toText.trim());
    if (fromText.trim()) bits.push("ʌs", fromText.trim());
    if (question) bits.push("qa");
    if (register.flank) bits.unshift("ƛ");
    if (register.hush) bits.push("aᵘ");
    if (register.attn) bits.push("ǃ");
    return bits.join(" ");
  }, [r, pron, hsVerb, obj, withNoun, toText, fromText, question, register]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-neutral-200 p-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Who</div>
          <NiceSelect
            value={pron.form}
            onChange={v => setPron(PRONOUNS.find(p => p.form === v) || PRONOUNS[0])}
            items={PRONOUNS.map(p => ({ value: p.form, label: p.label }))}
          />

        </div>
        <div className="rounded-2xl border border-neutral-200 p-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Verb</div>
          <NiceSelect
            value={rootId}
            onChange={setRootId}
            items={roots.map(rt => ({
              value: rt.id,
              label: `${[rt.c1, rt.c2, rt.c3].join("-")} — ${rt.gloss || "(no gloss)"}`
            }))}
          />
        </div>
        <div className="rounded-2xl border border-neutral-200 p-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Tense</div>
          <NiceSelect
            value={tense.key}
            onChange={k => setTense(TENSES.find(t => t.key === k) || TENSES[0])}
            items={TENSES.map(t => ({ value: t.key, label: t.label }))}
          />

          <div className="mt-2 flex flex-wrap gap-3">
            <Toggle label="Negation" info="Adds naaq- before the verb; becomes naq- before k/g/q (e.g., naqkelab)." checked={neg} onChange={setNeg} />
            <Toggle label="Progressive" info="Geminate C2 before the tense vowel → ongoing action (≈ “be …-ing”)." checked={prog} onChange={setProg} />
            <Toggle label="Habitual" info="Adds -ar for customary/repeated actions or general truths." checked={hab} onChange={setHab} />
          </div>
        </div>
        <div className="rounded-2xl border border-neutral-200 p-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Object (what)</div>
          <input className="w-full px-2 py-2 rounded-lg border border-neutral-300" placeholder="prey / stag / mark…" value={obj} onChange={e => setObj(e.target.value)} />
        </div>
        <div className="rounded-2xl border border-neutral-200 p-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">With (instrument)</div>
          <NiceSelect
            value={withNounId}
            onChange={setWithNounId}
            items={[
              { value: "", label: "— none —" },
              ...nouns.map(n => ({ value: n.id, label: `${n.word} — ${n.gloss || ""}` })),
            ]}
          />

        </div>
        <div className="rounded-2xl border border-neutral-200 p-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">To / From</div>
          <div className="grid grid-cols-2 gap-2">
            <input className="px-2 py-2 rounded-lg border border-neutral-300" placeholder="to (ga) — e.g., prey" value={toText} onChange={e => setToText(e.target.value)} />
            <input className="px-2 py-2 rounded-lg border border-neutral-300" placeholder="from (ʌs) — e.g., Shroud" value={fromText} onChange={e => setFromText(e.target.value)} />
          </div>
          <div className="mt-2 flex flex-wrap gap-3">
            <Toggle label="Question (qa)" checked={question} onChange={setQuestion} />
          </div>
        </div>
        <div className="rounded-2xl border border-neutral-200 p-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Hunt Register</div>
          <div className="flex flex-wrap gap-3">
            <Toggle label="ƛ flank" checked={register.flank} onChange={v => setRegister(s => ({...s, flank: v}))} />
            <Toggle label="ǃ attention/stop" checked={register.attn} onChange={v => setRegister(s => ({...s, attn: v}))} />
            <Toggle label="aᵘ hush" checked={register.hush} onChange={v => setRegister(s => ({...s, hush: v}))} />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 p-3 flex items-center gap-3">
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Huntspeak</div>
          <div className="text-xl font-semibold break-words mt-1">{sentence || "—"}</div>
        </div>
        <button onClick={() => clip(sentence)} className="px-3 py-2 rounded-xl border border-neutral-300 hover:bg-neutral-50">Copy</button>
      </div>
    </div>
  );
}

// ----- Free Translator -----
function FreeTranslator({ roots, nouns }: { roots: Root[]; nouns: Noun[] }) {
  const [en, setEn] = useState("");
  const [hs, setHs] = useState("");

  // normalize helpers so "the Shroud (place)" and "Shroud" both match
  function norm(s: string) {
    return s.toLowerCase().replace(/[()]/g, "").replace(/\s+/g, " ").trim();
  }
  function stripArticles(s: string) {
    return s.replace(/^(a|an|the)\s+/, "");
  }
  function findNounLexeme(nouns: Noun[], phrase: string) {
    const p = norm(stripArticles(phrase));
    const p2 = p.replace(/s$/, ""); // naive singular
    if (p2 !== p) phrase = p2; // and use p2 below
    for (const n of nouns) {
      const w = norm(n.word);
      const g = norm(n.gloss);
      if (p === w || p === g || g.includes(p)) return n.word;
      if (n.synonyms && n.synonyms.some(s => norm(s) === p)) return n.word;
    }
    return phrase.trim();
  }


  function translate() {
    if (!en.trim()) { setHs(""); return; }
    const s = en.toLowerCase().replace(/[!?.,]/g, " ").replace(/\s+/g, " ").trim();

    const subjMap: Record<string, {form:string; subjV:string}> = {
      "i": {form:"ɪ", subjV:"ɪ"},
      "we": {form:"tɪ", subjV:"ɪ"},
      "you": {form:"su", subjV:"u"},
      "you all": {form:"tu", subjV:"u"},
      "he": {form:"se", subjV:"e"},
      "she": {form:"se", subjV:"e"},
      "they": {form:"te", subjV:"e"},
    };

    let subj = subjMap["i"];
    for (const k of Object.keys(subjMap)) {
      if (s.startsWith(k+" ") || s === k) { subj = subjMap[k]; break; }
    }

    let tense = "a"; // present
    let neg = false, prog = false, hab = false;
    let rest = s.replace(/^(i|we|you all|you|he|she|they)\s*/, "");

    if (/\bwill\b/.test(rest)) { tense = "ʌ"; rest = rest.replace(/\bwill\b/g, ""); }
    if (/\bdid\b/.test(rest)) { tense = "e"; rest = rest.replace(/\bdid\b/g, ""); }
    if (/\bused to\b/.test(rest)) { hab = true; rest = rest.replace(/\bused to\b/g, ""); }
    if (/\bnot\b|\bdon't\b|\bdo not\b|\bdidn't\b|\bwill not\b|\bwon't\b/.test(rest)) { neg = true; rest = rest.replace(/\bnot|don't|do not|didn't|will not|won't/g, ""); }
    if (/\b(am|is|are|was|were)\s+\w+ing\b/.test(rest)) { prog = true; rest = rest.replace(/\b(am|is|are|was|were)\s+/g, ""); }

    rest = rest.trim();

    const words = rest.split(" ");
    let verbToken = words[0] || "";
    verbToken = verbToken.replace(/ing$/, "");

    let root = findRootByEnglish(roots, verbToken);
    if (!root && words.length >= 2) root = findRootByEnglish(roots, `${words[0]} ${words[1]}`);
    if (!root) { setHs("(Unknown verb—add a root or use Talk Pad)"); return; }

    let verb = `${root.c1}${subj.subjV}${root.c2}${tense}${root.c3}`;
    if (prog) verb = withProgressive(verb, root);
    if (hab) verb = withHabitual(verb);
    if (neg) verb = withNegation(verb);

    const withMatch = rest.match(/\bwith\s+([^]+?)(?=\bto\b|\bfrom\b|$)/);
    const toMatch   = rest.match(/\bto\s+([^]+?)(?=\bwith\b|\bfrom\b|$)/);
    const fromMatch = rest.match(/\bfrom\s+([^]+?)(?=\bwith\b|\bto\b|$)/);

    // remove the first verb token from "rest", then any trailing prepositional phrases
    let object = rest
      .replace(/^(\w+)(ing)?\b/, "")              // drop the verb token
      .replace(/\b(with|to|from)\b[^]+$/, "")     // drop pp's
      .trim();

    object = stripArticles(object);               // drop a/an/the

    const bits: string[] = [subj.form, verb];
    if (object) bits.push(findNounLexeme(nouns, object)); // <-- map to lexicon

    if (withMatch) {
      const phrase = withMatch[1].trim();
      bits.push("fi", findNounLexeme(nouns, phrase));     // <-- map to lexicon
    }
    if (toMatch)   bits.push("ga", findNounLexeme(nouns, toMatch[1].trim()));
    if (fromMatch) bits.push("ʌs", findNounLexeme(nouns, fromMatch[1].trim()));

    setHs(bits.join(" "));
  }

  return (
    <div className="space-y-2">
      <textarea className="w-full h-20 px-3 py-2 rounded-xl border border-neutral-300" placeholder="Type: we will hunt with a trap from the Shroud" value={en} onChange={e => setEn(e.target.value)} />
      <div className="flex items-center gap-2">
        <button onClick={translate} className="px-3 py-2 rounded-xl border border-neutral-300 hover:bg-neutral-50">Translate</button>
        <button onClick={() => clip(hs)} className="px-3 py-2 rounded-xl border border-neutral-300 hover:bg-neutral-50">Copy</button>
        <div className="text-sm text-neutral-500">Recognizes pronouns, will/did/not, with/to/from.</div>
      </div>
      <div className="rounded-2xl border border-neutral-200 p-3">
        <div className="text-xs uppercase tracking-wide text-neutral-500">Huntspeak</div>
        <div className="text-lg font-semibold break-words mt-1">{hs || "—"}</div>
      </div>
    </div>
  );
}
