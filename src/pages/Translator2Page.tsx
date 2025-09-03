import { useEffect, useState } from "react";
import Translator2 from "../components/Translator2";
import type { Root, Noun } from "../types";
import { DEFAULT_ROOTS, DEFAULT_NOUNS } from "../data/defaults";
import { lsGet, LS_KEYS } from "../lib/storage";

export default function Translator2Page(){
  const [roots, setRoots] = useState<Root[]>(() => {
    try { return lsGet<Root[]>(LS_KEYS.roots, DEFAULT_ROOTS); } catch { return DEFAULT_ROOTS; }
  });
  const [nouns, setNouns] = useState<Noun[]>(() => {
    try { return lsGet<Noun[]>(LS_KEYS.nouns, DEFAULT_NOUNS); } catch { return DEFAULT_NOUNS; }
  });
  // Keep local state in sync if storage changes elsewhere
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_KEYS.roots) {
        try { setRoots(JSON.parse(String(e.newValue || "null")) || DEFAULT_ROOTS); } catch {}
      }
      if (e.key === LS_KEYS.nouns) {
        try { setNouns(JSON.parse(String(e.newValue || "null")) || DEFAULT_NOUNS); } catch {}
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return (
    <main className="px-4 py-6 md:px-6 lg:px-10">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold">Translator 2.0</h1>
          <nav className="flex items-center gap-2">
            <a href="/" className="px-3 py-2 rounded-xl border border-neutral-300 hover:bg-neutral-50">Back to App</a>
          </nav>
        </div>
        <Translator2 roots={roots} nouns={nouns} />
      </div>
    </main>
  );
}

