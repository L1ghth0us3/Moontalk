import { useEffect, useState } from "react";
import type { Noun, Root } from "./types";
import { DEFAULT_NOUNS, DEFAULT_ROOTS } from "./data/defaults";
import RootEditor from "./components/editors/RootEditor";
import NounEditor from "./components/editors/NounEditor";
import TalkPad from "./components/TalkPad";
import RenderDerivations from "./components/Derivations";
import FiniteForms from "./components/FiniteForms";

export default function HuntspeakTalkPad(){
  const [roots, setRoots] = useState<Root[]>(DEFAULT_ROOTS);
  const [nouns, setNouns] = useState<Noun[]>(DEFAULT_NOUNS);
  const [selectedId, setSelectedId] = useState<string|null>(roots[0]?.id || null);
  const [selectedNounId, setSelectedNounId] = useState<string|null>(nouns[0]?.id || null);

  useEffect(()=>{ if (!selectedId && roots[0]) setSelectedId(roots[0].id); }, [roots, selectedId]);
  useEffect(()=>{ if (!selectedNounId && nouns[0]) setSelectedNounId(nouns[0].id); }, [nouns, selectedNounId]);

  const selected = roots.find(r=>r.id===selectedId) || null;

  return (
    <div className="p-6 2xl:p-10 max-w-none mx-auto font-sans">
      <header className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">Huntspeak Talk Pad</h1>
        <p className="text-neutral-600 mt-1">RP-ready: create words and get instant Huntspeak lines.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 2xl:grid-cols-5 gap-6">
        <aside className="lg:col-span-1 space-y-6">
          <RootEditor initial={roots} onChange={setRoots} selectedId={selectedId} onSelect={setSelectedId} />
          <NounEditor initial={nouns} onChange={setNouns} selectedId={selectedNounId} onSelect={setSelectedNounId} />
        </aside>
        <main className="lg:col-span-3 2xl:col-span-4 space-y-6">
          <section className="rounded-3xl border border-neutral-200 p-4 shadow-sm">
            <h2 className="text-lg font-semibold mb-1">Talk Pad</h2>
            <p className="text-sm text-neutral-600 mb-3">Pick who + verb + tense, type object. Copy & paste into chat.</p>
            <TalkPad roots={roots} nouns={nouns} />
          </section>
          {selected && <FiniteForms root={selected} />}
          {selected && <RenderDerivations root={selected} />}
        </main>
      </div>
    </div>
  );
}
