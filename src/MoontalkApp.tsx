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
  // Translator 2.0 Settings: coordinator mapping
  const [t2Settings, setT2Settings] = useLocalStorageState(LS_KEYS.translator2Settings, {
    coordinators: { AND: 'ʋa', OR: 'ra', NOR: 'ra', BUT: 'ma' }
  });
  const [nounsKey, setNounsKey] = useState(0);

  // One-time migration: ensure new default roots (e.g., "to be") are present
  // for existing users who already have roots in localStorage. If any default
  // signatures are missing, merge them into storage and reload to propagate.
  useEffect(() => {
    try {
      const stored = lsGet<Root[] | null>(LS_KEYS.roots, null as any);
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
    } catch {}
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
    const apply = () => setSystemDark(!!mq.matches);
    apply();
    mq.addEventListener?.('change', apply as any);
    // Fallback for older browsers
    // @ts-ignore
    mq.addListener && mq.addListener(apply);
    return () => {
      mq.removeEventListener?.('change', apply as any);
      // @ts-ignore
      mq.removeListener && mq.removeListener(apply);
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
        const data = JSON.parse(String(reader.result));
        if (!data || !Array.isArray(data.roots) || !Array.isArray(data.nouns)) { alert('Import failed: invalid JSON format.'); return; }
        const cleanRoots = data.roots
          .filter((x:any)=>x && x.c1 && x.c2 && x.c3)
          .map((x:any)=>({ id: String(x.id||Math.random().toString(36).slice(2,10)), c1:String(x.c1), c2:String(x.c2), c3:String(x.c3), gloss:String(x.gloss||''), synonyms:Array.isArray(x.synonyms)?x.synonyms.map((s:any)=>String(s)):[] }));
        const cleanNouns = data.nouns
          .filter((x:any)=>x && x.word)
          .map((x:any)=>({ id:String(x.id||Math.random().toString(36).slice(2,10)), word:String(x.word), gloss:String(x.gloss||''), synonyms:Array.isArray(x.synonyms)?x.synonyms.map((s:any)=>String(s)):[] }));
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
    try { localStorage.setItem(LS_KEYS.nouns, JSON.stringify(next)); } catch {}
    setNouns(next);
    setNounsKey(k=>k+1);
  }
  // Quick-create verb root (experimental from Talk Pad add flow)
  function addRootQuick(r: { c1: string; c2: string; c3: string; gloss?: string; synonyms?: string[] }){
    const id = Math.random().toString(36).slice(2,10);
    const rr: Root = { id, c1: r.c1, c2: r.c2, c3: r.c3, gloss: r.gloss || "", synonyms: r.synonyms || [] };
    const next = [rr, ...roots];
    try { localStorage.setItem(LS_KEYS.roots, JSON.stringify(next)); } catch {}
    setRoots(next);
    setSelectedId(id);
  }

  return (
    <>
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
                aria-pressed={composerTab==='translator'}
                className={`px-3 py-2 rounded-xl border transition ${composerTab==='translator' ? 'ring-2 ring-blue-300 border-blue-500 font-semibold' : 'border-neutral-300 hover:bg-neutral-50'}`}
                onClick={()=>setComposerTab('translator')}
              >Free Translator</button>
              <button
                aria-pressed={composerTab==='translator2'}
                className={`px-3 py-2 rounded-xl border transition ${composerTab==='translator2' ? 'ring-2 ring-blue-300 border-blue-500 font-semibold' : 'border-neutral-300 hover:bg-neutral-50'}`}
                onClick={()=>setComposerTab('translator2')}
              >Translator 2.0</button>
            </div>
            {composerTab==='talk' ? (<TalkPadCollapse />) : (<TranslatorCollapse />)}
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
              <div className="pt-2 border-t border-neutral-200/70">
                <div className="text-sm font-medium mb-2">Translator 2.0 — Coordinator Mapping</div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">AND</div>
                    <input
                      className="w-full border rounded-lg px-2 py-2"
                      value={t2Settings.coordinators.AND}
                      onChange={e=>setT2Settings(s=>({ ...s, coordinators: { ...s.coordinators, AND: e.target.value } }))}
                    />
                  </label>
                  <label className="block">
                    <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">OR</div>
                    <input
                      className="w-full border rounded-lg px-2 py-2"
                      value={t2Settings.coordinators.OR}
                      onChange={e=>setT2Settings(s=>({ ...s, coordinators: { ...s.coordinators, OR: e.target.value } }))}
                    />
                  </label>
                  <label className="block">
                    <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">NOR</div>
                    <input
                      className="w-full border rounded-lg px-2 py-2"
                      value={t2Settings.coordinators.NOR}
                      onChange={e=>setT2Settings(s=>({ ...s, coordinators: { ...s.coordinators, NOR: e.target.value } }))}
                    />
                  </label>
                  <label className="block">
                    <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">BUT</div>
                    <input
                      className="w-full border rounded-lg px-2 py-2"
                      value={t2Settings.coordinators.BUT}
                      onChange={e=>setT2Settings(s=>({ ...s, coordinators: { ...s.coordinators, BUT: e.target.value } }))}
                    />
                  </label>
                </div>
                <div className="text-xs text-neutral-600 mt-1">Example: set OR = "ru" to join with “ru”.</div>
              </div>
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
                onClick={()=>{ try { localStorage.clear(); } catch {} finally { location.reload(); } }}
              >Reset Everything</button>
            </div>
          </div>
        </div>
      </>
    )}
    </>
  );
}
