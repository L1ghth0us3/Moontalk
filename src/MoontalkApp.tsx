import { useEffect, useState } from "react";
import type { Noun, Root } from "./types";
import { DEFAULT_NOUNS, DEFAULT_ROOTS } from "./data/defaults";
import RootEditor from "./components/editors/RootEditor";
import NounEditor from "./components/editors/NounEditor";
import TalkPad from "./components/TalkPad";
import RenderDerivations from "./components/Derivations";
import FreeTranslator from "./components/FreeTranslator";
import Translator2 from "./components/Translator2";
import { useLocalStorageState, LS_KEYS, lsGet, lsSet } from "./lib/storage";
import FiniteForms from "./components/FiniteForms";
import { ContextMenuProvider } from "./lib/contextMenu";
import { ToastProvider } from "./lib/toast";

/**
 * Application shell
 *
 * Responsibilities
 * - Own the top‑level in‑memory state for Roots and Nouns (mirrored by editors).
 * - Persist user preferences and UI toggles to localStorage via LS_KEYS.
 * - Wire cross‑component features (e.g., shared morph toggles, quick noun create).
 * - Render the main sections: Talk Pad, Roots/Nouns editors, Finite Forms, Derivations.
 *
 * Theme handling
 * - Theme is stored in localStorage (see LS_KEYS.theme) and applied as a body class.
 * - Supported labels: Auto, Dracula, Light, Dark.
 *
 * Conventions
 * - “Expanded” modals (⛶) use a centered fixed overlay with click‑off‑to‑close.
 * - All modals and popovers avoid global state; they are local to their components.
 */
export default function MoontalkApp(){
  const [roots, setRoots] = useState<Root[]>(DEFAULT_ROOTS);
  const [nouns, setNouns] = useState<Noun[]>(DEFAULT_NOUNS);
  const [selectedId, setSelectedId] = useLocalStorageState<string|null>(LS_KEYS.selectedRoot, roots[0]?.id || null);
  const [selectedNounId, setSelectedNounId] = useState<string|null>(nouns[0]?.id || null);
  // Theme selection persisted via shared LS_KEYS for consistency across the app
  const [theme, setTheme] = useLocalStorageState<'fantasy'|'plain'|'dark'|'auto'>(LS_KEYS.theme, 'auto');
  const [systemDark, setSystemDark] = useState<boolean>(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const [composerTab, setComposerTab] = useLocalStorageState<'talk'|'translator'|'translator2'>("huntspeak_composer_tab", 'talk');
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [syncMorph, setSyncMorph] = useLocalStorageState<boolean>(LS_KEYS.morphSync, true);
  const [sharedMorph, setSharedMorph] = useLocalStorageState<{neg:boolean;prog:boolean;hab:boolean}>(LS_KEYS.morphToggles, {neg:false,prog:false,hab:false});
  // Translator 2.0 settings managed within Translator2 component
  const [nounsKey, setNounsKey] = useState(0);

  // One-time migration: ensure new default roots (e.g., "to be") are present
  // for existing users who already have roots in localStorage. If any default
  // signatures are missing, merge them into storage and reload to propagate.
  useEffect(() => {
    try {
      const stored = lsGet<Root[] | null>(LS_KEYS.roots, null as unknown as Root[] | null);
      if (Array.isArray(stored)) {
        const sig = (r: Root) => `${r.c1}-${r.c2}-${r.c3}`.toLowerCase();
        const present = new Set(stored.map(sig));
        const missing = DEFAULT_ROOTS.filter(r => !present.has(sig(r)));
        if (missing.length) {
          const next = [...stored, ...missing];
          lsSet(LS_KEYS.roots, next);
          // Reload to let RootEditor (which hydrates from LS on mount) pick up the merge.
          location.reload();
        }
      } else {
        // First-time: seed defaults to storage for consistency.
        lsSet(LS_KEYS.roots, DEFAULT_ROOTS);
      }
    } catch { void 0; }
  }, []);

  // Keep a valid selected root when the roots list changes (e.g. delete).
  useEffect(()=>{
    if (!selectedId && roots[0]) setSelectedId(roots[0].id);
    else if (selectedId && !roots.some(r=>r.id===selectedId)) setSelectedId(roots[0]?.id || null);
  }, [roots, selectedId]);
  // Keep a valid selected noun when the nouns list changes.
  useEffect(()=>{
    if (!selectedNounId && nouns[0]) setSelectedNounId(nouns[0].id);
    else if (selectedNounId && !nouns.some(n=>n.id===selectedNounId)) setSelectedNounId(nouns[0]?.id || null);
  }, [nouns, selectedNounId]);
  // Track system dark preference for 'auto' theme (supports modern + legacy listeners)
  useEffect(()=>{
    if (typeof window === 'undefined' || !('matchMedia' in window)) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemDark(!!mq.matches);
    const onChange = (e: MediaQueryListEvent) => { void e; setSystemDark(!!mq.matches); };
    if ('addEventListener' in mq) {
      mq.addEventListener('change', onChange);
    }
    const legacy = mq as MediaQueryList & { addListener?: (cb: (e: MediaQueryListEvent)=>void)=>void; removeListener?: (cb: (e: MediaQueryListEvent)=>void)=>void };
    if (legacy.addListener) legacy.addListener(onChange);
    return () => {
      if ('removeEventListener' in mq) {
        mq.removeEventListener('change', onChange);
      }
      if (legacy.removeListener) legacy.removeListener(onChange);
    };
  }, []);

  // No sticky background tracking (removed by request)

  // Apply effective theme class to <body> whenever theme or system preference changes.
  // 'auto' → fantasy (light) by day, dark at night.
  useEffect(()=>{
    const effective = theme==='auto' ? (systemDark ? 'dark' : 'fantasy') : theme;
    const b = document.body;
    b.classList.remove('theme-fantasy','theme-plain','theme-dark');
    b.classList.add(effective==='fantasy' ? 'theme-fantasy' : effective==='dark' ? 'theme-dark' : 'theme-plain');
  }, [theme, systemDark]);

  // Disable the native context menu across the app; we will show custom menus as needed.
  useEffect(() => {
    function onCtx(e: MouseEvent){ e.preventDefault(); }
    document.addEventListener('contextmenu', onCtx);
    return () => document.removeEventListener('contextmenu', onCtx);
  }, []);

  const selected = roots.find(r=>r.id===selectedId) || null;
  const [showCollapse, setShowCollapse] = useLocalStorageState<boolean>('huntspeak_show_collapse', false);
  const [composerCollapsed, setComposerCollapsed] = useLocalStorageState<boolean>(LS_KEYS.composerCollapsed, false);
  // Small helper UI to allow collapsing the TalkPad area when enabled in settings.
  function TalkPadCollapse(){
    if (!showCollapse) return null;
    return (
      <button aria-label={composerCollapsed? 'Expand' : 'Collapse'} className="px-2 py-1 text-sm rounded border border-neutral-300 hover:bg-neutral-50" onClick={()=>setComposerCollapsed(c=>!c)}>
        {composerCollapsed ? '▸' : '▾'}
      </button>
    );
  }
  function TranslatorCollapse(){
    if (!showCollapse) return null;
    return (
      <button aria-label={composerCollapsed? 'Expand' : 'Collapse'} className="px-2 py-1 text-sm rounded border border-neutral-300 hover:bg-neutral-50" onClick={()=>setComposerCollapsed(c=>!c)}>
        {composerCollapsed ? '▸' : '▾'}
      </button>
    );
  }
  // Show TalkPad only when not collapsed.
  function TalkPadBody(){
    if (composerCollapsed) return null;
    return (
      <>
        <p className="text-sm text-neutral-600 mb-3">Pick who + verb + tense, type object. Copy & paste into chat.</p>
        <TalkPad
          roots={roots}
          nouns={nouns}
          selectedRootId={selected?.id || undefined}
          onSelectRoot={(id)=>setSelectedId(id)}
          syncMorph={syncMorph}
          morph={sharedMorph}
          onMorphChange={setSharedMorph}
          onToggleSync={()=>setSyncMorph(v=>!v)}
          onCreateNoun={addNounQuick}
          onCreateRoot={addRootQuick}
        />
      </>
    );
  }
  function TranslatorBody(){
    if (composerCollapsed) return null;
    return (
      <>
        {/* Embedded = true: renders a compact translator body without own card shell */}
        <FreeTranslator roots={roots} nouns={nouns} embedded onCreateNoun={addNounQuick} onCreateRoot={addRootQuick} />
      </>
    );
  }
  function Translator2Body(){
    if (composerCollapsed) return null;
    return (
      <>
        <Translator2 roots={roots} nouns={nouns} onCreateNoun={addNounQuick} onCreateRoot={addRootQuick} />
      </>
    );
  }

  // Import/Export (roots + nouns) as strict JSON with minimal validation.
  // Export writes a file; Import sanitizes structure and reloads to hydrate app state.
  function exportData(){
    const payload = { roots, nouns };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'huntspeak_data.json'; a.click();
    URL.revokeObjectURL(url);
  }
  function importData(file: File){
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(String(reader.result)) as unknown;
        type ImportRoot = { id?: unknown; c1?: unknown; c2?: unknown; c3?: unknown; gloss?: unknown; synonyms?: unknown };
        type ImportNoun = { id?: unknown; word?: unknown; gloss?: unknown; synonyms?: unknown };
        const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object';
        const toStr = (v: unknown, fallback = ''): string => typeof v === 'string' ? v : String(v ?? fallback);
        const toStrArr = (v: unknown): string[] => Array.isArray(v) ? v.map(s => String(s)) : [];
        const data = isObj(raw) ? raw as Record<string, unknown> : {};
        const rootsIn = Array.isArray(data.roots) ? (data.roots as unknown[]) : [];
        const nounsIn = Array.isArray(data.nouns) ? (data.nouns as unknown[]) : [];
        if (!rootsIn || !nounsIn) { alert('Import failed: invalid JSON format.'); return; }
        const cleanRoots = rootsIn
          .filter((x): x is ImportRoot => isObj(x) && 'c1' in x && 'c2' in x && 'c3' in x)
          .map(x=>({ id: toStr((x as ImportRoot).id ?? Math.random().toString(36).slice(2,10)), c1: toStr((x as ImportRoot).c1), c2: toStr((x as ImportRoot).c2), c3: toStr((x as ImportRoot).c3), gloss: toStr((x as ImportRoot).gloss), synonyms: toStrArr((x as ImportRoot).synonyms) }));
        const cleanNouns = nounsIn
          .filter((x): x is ImportNoun => isObj(x) && 'word' in x)
          .map(x=>({ id: toStr((x as ImportNoun).id ?? Math.random().toString(36).slice(2,10)), word: toStr((x as ImportNoun).word), gloss: toStr((x as ImportNoun).gloss), synonyms: toStrArr((x as ImportNoun).synonyms) }));
        localStorage.setItem(LS_KEYS.roots, JSON.stringify(cleanRoots));
        localStorage.setItem(LS_KEYS.nouns, JSON.stringify(cleanNouns));
        // Reload to propagate freshly imported data through the app state.
        location.reload();
      } catch { alert('Import failed: unreadable JSON.'); }
    };
    reader.readAsText(file);
  }

  // Quick-create nouns from derivations
  function addNounQuick(n: { word: string; gloss?: string; synonyms?: string[] }){
    const id = Math.random().toString(36).slice(2,10);
    const nn: Noun = { id, word: n.word, gloss: n.gloss || "", synonyms: n.synonyms || [] };
    const next = [nn, ...nouns];
    try { localStorage.setItem(LS_KEYS.nouns, JSON.stringify(next)); } catch { void 0; }
    setNouns(next);
    setNounsKey(k=>k+1);
  }
  // Quick-create verb root (experimental from Talk Pad add flow)
  function addRootQuick(r: { c1: string; c2: string; c3: string; gloss?: string; synonyms?: string[] }){
    const id = Math.random().toString(36).slice(2,10);
    const rr: Root = { id, c1: r.c1, c2: r.c2, c3: r.c3, gloss: r.gloss || "", synonyms: r.synonyms || [] };
    const next = [rr, ...roots];
    try { localStorage.setItem(LS_KEYS.roots, JSON.stringify(next)); } catch { void 0; }
    setRoots(next);
    setSelectedId(id);
  }

  return (
    <ToastProvider>
    <ContextMenuProvider>
    <div className="p-6 2xl:p-10 max-w-none mx-auto font-sans">
      <header className="mb-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Moontalk</h1>
            <p className="text-neutral-600 mt-1">RP-ready: create words and get instant Huntspeak lines.</p>
          </div>
          <nav aria-label="Main" className="flex items-center gap-2">
            <a className="px-3 py-2 rounded-xl border border-neutral-300 hover:bg-neutral-50" href="/what-is-this">What is this</a>
            <button className="px-3 py-2 rounded-xl border border-neutral-300 hover:bg-neutral-50" onClick={()=>setDataOpen(true)}>Data</button>
            <button className="px-3 py-2 rounded-xl border border-neutral-300 hover:bg-neutral-50" onClick={()=>setSettingsOpen(true)}>Settings</button>
          </nav>
        </div>
      </header>

      {/* Sticky composer: simple two-button tabs */}
      <div className="sticky top-2 z-30">
        <section className="rounded-3xl border border-neutral-200 p-4 shadow-sm fantasy-card">
          <div className="flex items-center justify-between mb-2">
            <div role="tablist" aria-label="Composer" className="flex items-center gap-2">
              <button
                aria-pressed={composerTab==='talk'}
                className={`px-3 py-2 rounded-xl border transition ${composerTab==='talk' ? 'ring-2 ring-blue-300 border-blue-500 font-semibold' : 'border-neutral-300 hover:bg-neutral-50'}`}
                onClick={()=>setComposerTab('talk')}
              >Talk Pad</button>
              <button
                aria-pressed={composerTab==='translator2'}
                className={`px-3 py-2 rounded-xl border transition ${composerTab==='translator2' ? 'ring-2 ring-blue-300 border-blue-500 font-semibold' : 'border-neutral-300 hover:bg-neutral-50'}`}
                onClick={()=>setComposerTab('translator2')}
              >Translator 2.0</button>
            </div>
            <div className="flex items-center gap-3">
              {/* Subtle link to legacy translator, visually de-emphasized */}
              <button
                aria-pressed={composerTab==='translator'}
                className={`text-xs px-2 py-1 rounded border transition ${composerTab==='translator' ? 'border-neutral-300 bg-neutral-50' : 'border-transparent text-neutral-500 hover:underline'}`}
                onClick={()=>setComposerTab('translator')}
                title="Open legacy translator"
              >Translator [Legacy]</button>
              {composerTab==='talk' ? (<TalkPadCollapse />) : (<TranslatorCollapse />)}
            </div>
          </div>
          {composerTab==='talk' ? (
            <TalkPadBody />
          ) : composerTab==='translator' ? (
            <TranslatorBody />
          ) : composerTab==='translator2' ? (
            <Translator2Body />
          ) : null}
        </section>
      </div>

      {/* Below: Roots, Nouns, Finite Forms, Derivations — hidden when Translator 2.0 is active */}
      {composerTab!=='translator2' && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-start">
          <RootEditor initial={roots} onChange={setRoots} selectedId={selectedId} onSelect={setSelectedId} showCollapse={showCollapse} onCreateNoun={addNounQuick} />
          <NounEditor key={nounsKey} initial={nouns} onChange={setNouns} selectedId={selectedNounId} onSelect={setSelectedNounId} showCollapse={showCollapse} />
          {selected && (
            <FiniteForms
              root={selected}
              showCollapse={showCollapse}
              syncMorph={syncMorph}
              morph={sharedMorph}
              onMorphChange={setSharedMorph}
              onToggleSync={()=>setSyncMorph(v=>!v)}
            />
          )}
          {selected && (<RenderDerivations root={selected} showCollapse={showCollapse} onCreateNoun={addNounQuick} />)}
        </div>
      )}
    </div>
      {dataOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40"></div>
          <div
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            onClick={(e)=>{ if (e.target === e.currentTarget) setDataOpen(false); }}
          >
            <div className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white fantasy-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xl font-semibold">Data: Import / Export</h3>
                <button className="px-3 py-1 rounded-lg border border-neutral-300 hover:bg-neutral-50" onClick={()=>setDataOpen(false)}>Close</button>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <button className="px-3 py-2 rounded-lg border border-neutral-300 hover:bg-neutral-50" onClick={exportData}>Export</button>
                  <label className="px-3 py-2 rounded-lg border border-neutral-300 hover:bg-neutral-50 cursor-pointer">
                    Import
                    <input type="file" accept="application/json" className="hidden" onChange={e=>{ const f=e.target.files?.[0]; if (f) importData(f); }} />
                  </label>
                </div>
                <div className="text-xs opacity-70">Exports and imports roots and nouns as JSON.</div>
                <div className="pt-3 border-t border-neutral-200/70">
                  <button
                    title="Fully Reset Local Storage! Danger!"
                    className="btn-danger px-3 py-2 rounded-lg"
                    onClick={()=>setConfirmResetOpen(true)}
                  >Hard Reset</button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    {settingsOpen && (
      <>
        <div className="fixed inset-0 bg-black/50 z-40"></div>
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          onClick={(e)=>{ if (e.target === e.currentTarget) setSettingsOpen(false); }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white fantasy-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xl font-semibold">Settings</h3>
              <button className="px-3 py-1 rounded-lg border border-neutral-300 hover:bg-neutral-50" onClick={()=>setSettingsOpen(false)}>Close</button>
            </div>
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium mb-1">Theme</div>
                <div className="grid grid-cols-4 gap-2" role="group" aria-label="Theme selector">
                  <button
                    aria-pressed={theme==='auto'}
                    className={`px-3 py-2 rounded-lg border transition ${theme==='auto' ? 'ring-2 ring-blue-300 border-blue-500 font-semibold' : 'border-neutral-300'}`}
                    onClick={()=>setTheme('auto')}
                  >{theme==='auto' ? '✓ Auto' : 'Auto'}</button>
                  <button
                    aria-pressed={theme==='fantasy'}
                    className={`px-3 py-2 rounded-lg border transition ${theme==='fantasy' ? 'ring-2 ring-amber-200 border-amber-500 font-semibold' : 'border-neutral-300'}`}
                    onClick={()=>setTheme('fantasy')}
                  >{theme==='fantasy' ? '✓ Dracula' : 'Dracula'}</button>
                  <button
                    aria-pressed={theme==='plain'}
                    className={`px-3 py-2 rounded-lg border transition ${theme==='plain' ? 'ring-2 ring-neutral-200 border-neutral-500 font-semibold' : 'border-neutral-300'}`}
                    onClick={()=>setTheme('plain')}
                  >{theme==='plain' ? '✓ Light' : 'Light'}</button>
                  <button
                    aria-pressed={theme==='dark'}
                    className={`px-3 py-2 rounded-lg border transition ${theme==='dark' ? 'ring-2 ring-violet-300 border-neutral-600 font-semibold text-white bg-neutral-800' : 'border-neutral-300'}`}
                    onClick={()=>setTheme('dark')}
                  >{theme==='dark' ? '✓ Dark' : 'Dark'}</button>
                </div>
              </div>
              <div className="pt-2 border-t border-neutral-200/70">
                <div className="text-sm font-medium mb-2">Interface</div>
                <label className="inline-flex items-center gap-2 select-none">
                  <input type="checkbox" className="h-4 w-4" checked={showCollapse} onChange={e=>setShowCollapse(e.target.checked)} />
                  <span>Show collapse controls</span>
                  <span className="text-xs opacity-70">({showCollapse ? 'On' : 'Off'})</span>
                </label>
                <div className="mt-2">
                  <label className="inline-flex items-center gap-2 select-none">
                    <input type="checkbox" className="h-4 w-4" checked={syncMorph} onChange={e=>setSyncMorph(e.target.checked)} />
                    <span>Sync Neg/Prog/Hab between Talk Pad and Finite Forms</span>
                    <span className="text-xs opacity-70">({syncMorph ? 'On' : 'Off'})</span>
                  </label>
                </div>
              </div>
              {/* Translator 2.0 settings moved to Translator 2.0 UI */}
              {/* Data controls moved to the Data popup */}
            </div>
          </div>
        </div>
      </>
    )}
    {confirmResetOpen && (
      <>
        <div className="fixed inset-0 bg-black/50 z-50"></div>
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          onClick={(e)=>{ if (e.target === e.currentTarget) setConfirmResetOpen(false); }}
        >
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white fantasy-card p-5">
            <h3 className="text-xl font-semibold mb-2">Are you sure?</h3>
            <p className="text-sm text-neutral-700 mb-4">
              This will remove all Moontalk data and settings from your browser, including Verb Roots, Nouns, Talk Pad state, and interface preferences. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button className="px-3 py-2 rounded-lg border border-neutral-300 hover:bg-neutral-50" onClick={()=>setConfirmResetOpen(false)}>Cancel</button>
              <button
                className="px-3 py-2 rounded-lg border border-red-300 text-red-700 hover:bg-red-50"
                onClick={()=>{ try { localStorage.clear(); } catch { void 0; } finally { location.reload(); } }}
              >Reset Everything</button>
            </div>
          </div>
        </div>
      </>
    )}
    </ContextMenuProvider>
    </ToastProvider>
  );
}
