import { useEffect, useState } from "react";
import type { Noun, Root } from "./types";
import { DEFAULT_NOUNS, DEFAULT_ROOTS } from "./data/defaults";
import RootEditor from "./components/editors/RootEditor";
import NounEditor from "./components/editors/NounEditor";
import TalkPad from "./components/TalkPad";
import RenderDerivations from "./components/Derivations";
import FreeTranslator from "./components/FreeTranslator";
import { useLocalStorageState } from "./lib/storage";
import FiniteForms from "./components/FiniteForms";

export default function HuntspeakTalkPad(){
  const [roots, setRoots] = useState<Root[]>(DEFAULT_ROOTS);
  const [nouns, setNouns] = useState<Noun[]>(DEFAULT_NOUNS);
  const [selectedId, setSelectedId] = useState<string|null>(roots[0]?.id || null);
  const [selectedNounId, setSelectedNounId] = useState<string|null>(nouns[0]?.id || null);
  const [theme, setTheme] = useLocalStorageState<'fantasy'|'plain'>("huntspeak_theme", 'fantasy');
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(()=>{
    if (!selectedId && roots[0]) setSelectedId(roots[0].id);
    else if (selectedId && !roots.some(r=>r.id===selectedId)) setSelectedId(roots[0]?.id || null);
  }, [roots, selectedId]);
  useEffect(()=>{
    if (!selectedNounId && nouns[0]) setSelectedNounId(nouns[0].id);
    else if (selectedNounId && !nouns.some(n=>n.id===selectedNounId)) setSelectedNounId(nouns[0]?.id || null);
  }, [nouns, selectedNounId]);
  useEffect(()=>{
    const b = document.body;
    b.classList.remove('theme-fantasy','theme-plain');
    b.classList.add(theme==='fantasy' ? 'theme-fantasy' : 'theme-plain');
  }, [theme]);

  const selected = roots.find(r=>r.id===selectedId) || null;

  return (
    <>
    <div className="p-6 2xl:p-10 max-w-none mx-auto font-sans">
      <header className="mb-6 relative">
        <h1 className="text-2xl md:text-3xl font-bold">Huntspeak Talk Pad</h1>
        <p className="text-neutral-600 mt-1">RP-ready: create words and get instant Huntspeak lines.</p>
        <div className="absolute right-0 top-0">
          <div className="relative">
            <button aria-label="Menu" className="px-3 py-2 rounded-xl border border-neutral-300 hover:bg-neutral-50" onClick={()=>setMenuOpen(o=>!o)}>
              <span className="block w-6 h-[2px] bg-current mb-1"></span>
              <span className="block w-6 h-[2px] bg-current mb-1"></span>
              <span className="block w-6 h-[2px] bg-current"></span>
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-40 rounded-lg border border-neutral-200 bg-white shadow-xl z-50">
                <button className="w-full text-left px-3 py-2 hover:bg-neutral-50" onClick={()=>{ setSettingsOpen(true); setMenuOpen(false); }}>Settings</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 2xl:grid-cols-5 gap-6">
        <aside className="lg:col-span-1 space-y-6">
          <RootEditor initial={roots} onChange={setRoots} selectedId={selectedId} onSelect={setSelectedId} />
          <NounEditor initial={nouns} onChange={setNouns} selectedId={selectedNounId} onSelect={setSelectedNounId} />
        </aside>
        <main className="lg:col-span-3 2xl:col-span-4 space-y-6">
          <section className="rounded-3xl border border-neutral-200 p-4 shadow-sm fantasy-card">
            <h2 className="text-xl md:text-2xl font-semibold mb-1">Talk Pad</h2>
            <p className="text-sm text-neutral-600 mb-3">Pick who + verb + tense, type object. Copy & paste into chat.</p>
            <TalkPad roots={roots} nouns={nouns} />
          </section>
          {selected && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
              <FiniteForms root={selected} />
              <RenderDerivations root={selected} />
            </div>
          )}
          <FreeTranslator roots={roots} nouns={nouns} />
        </main>
      </div>
    </div>
    {settingsOpen && (
      <>
        <div className="fixed inset-0 bg-black/50 z-40" onClick={()=>setSettingsOpen(false)}></div>
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white fantasy-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xl font-semibold">Settings</h3>
              <button className="px-3 py-1 rounded-lg border border-neutral-300 hover:bg-neutral-50" onClick={()=>setSettingsOpen(false)}>Close</button>
            </div>
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium mb-1">Theme</div>
                <div className="grid grid-cols-2 gap-2">
                  <button className={`px-3 py-2 rounded-lg border ${theme==='fantasy'?'bg-amber-50 border-amber-300':'border-neutral-300'}`} onClick={()=>setTheme('fantasy')}>Fantasy</button>
                  <button className={`px-3 py-2 rounded-lg border ${theme==='plain'?'bg-neutral-50 border-neutral-300':'border-neutral-300'}`} onClick={()=>setTheme('plain')}>Plain</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    )}
    </>
  );
}
