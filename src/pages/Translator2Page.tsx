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

  // Apply theme class to body (match MoontalkApp behavior for all themes)
  useEffect(()=>{
    try {
      const raw = localStorage.getItem(LS_KEYS.theme) || '"auto"';
      const theme = JSON.parse(raw) as 'auto'|'fantasy'|'plain'|'dark';
      const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
      const systemDark = !!mq?.matches;
      const effective = theme==='auto' ? (systemDark ? 'dark' : 'fantasy') : theme;
      const b = document.body;
      b.classList.remove('theme-fantasy','theme-plain','theme-dark');
      b.classList.add(effective==='fantasy' ? 'theme-fantasy' : effective==='dark' ? 'theme-dark' : 'theme-plain');
    } catch {}
  }, []);

  return (
    <div className="p-6 2xl:p-10 max-w-none mx-auto font-sans">
      <header className="mb-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Moontalk</h1>
            <p className="text-neutral-600 mt-1">RP-ready: create words and get instant Huntspeak lines.</p>
          </div>
          <nav aria-label="Main" className="flex items-center gap-2">
            <a className="px-3 py-2 rounded-xl border border-neutral-300 hover:bg-neutral-50" href="/">Compose</a>
            <a className="px-3 py-2 rounded-xl border border-neutral-300 hover:bg-neutral-50" href="/what-is-this">What is this</a>
            <a className="px-3 py-2 rounded-xl border border-neutral-300 hover:bg-neutral-50" href="/translator2" aria-current="page">Translator 2.0</a>
          </nav>
        </div>
      </header>

      {/* Content wrapper mirrors main page cards / spacing */}
      <section className="rounded-3xl border border-neutral-200 p-4 shadow-sm fantasy-card">
        <Translator2 roots={roots} nouns={nouns} />
      </section>
    </div>
  );
}
