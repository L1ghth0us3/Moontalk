import { useEffect, useRef, useState } from "react";
import type { Root, Noun } from "../types";
import { translate as translateLib } from "../lib/translator2/index";
import RootEditor from "./editors/RootEditor";
import NounEditor from "./editors/NounEditor";
import FiniteForms from "./FiniteForms";
import RenderDerivations from "./Derivations";
import { useLocalStorageState, LS_KEYS } from "../lib/storage";

export type Result = { surface: string; variants: string[]; analysis: Record<string, unknown>; warnings: string[] };

export default function Translator2({ roots, nouns, onCreateNoun, onCreateRoot }: { roots: Root[]; nouns: Noun[]; onCreateNoun?: (n: { word: string; gloss?: string; synonyms?: string[] })=>void; onCreateRoot?: (r: { c1: string; c2: string; c3: string; gloss?: string; synonyms?: string[] })=>void; }){
  // Touch optional callback to satisfy noUnusedParameters
  void onCreateRoot;
  // Local lexicon (editable via embedded editors)
  const [rootsLocal, setRootsLocal] = useState<Root[]>(roots);
  const [nounsLocal, setNounsLocal] = useState<Noun[]>(nouns);
  const [nounsKey, setNounsKey] = useState(0);
  const [selectedRootId, setSelectedRootId] = useState<string | null>(rootsLocal[0]?.id ?? null);
  const [selectedNounId, setSelectedNounId] = useState<string | null>(nounsLocal[0]?.id ?? null);
  useEffect(() => {
    if (selectedNounId && !nounsLocal.some(n => n.id === selectedNounId)) {
      setSelectedNounId(nounsLocal[0]?.id ?? null);
    }
  }, [nounsLocal, selectedNounId]);

  // UI persistent state (keeps shape stable for future options)
  const [ui, setUi] = useLocalStorageState(LS_KEYS.translator2UI, {
    subject: "I" as "I"|"you"|"he"|"she"|"we"|"they",
    verbRootId: rootsLocal[0]?.id ?? null as string | null,
    tense: "present" as "present"|"past"|"future",
    neg: false, prog: false, hab: false, question: false,
    objPick: nounsLocal[0]?.id ?? "",
    objects: [] as string[],
    particles: [] as string[],
    englishInput: ""
  });
  const englishInput = ui.englishInput; const setEnglishInput = (v: string)=>setUi(s=>({...s, englishInput:v}));

  const [result, setResult] = useState<Result | null>(null);
  const [faves, setFaves] = useLocalStorageState<{id:string; input:string; surface:string; at:number}[]>(LS_KEYS.translator2Faves, []);
  const [showJSON, setShowJSON] = useState(false);

  // Settings: coordinators and particles mapping
  type T2Settings = { coordinators: Record<'AND'|'OR'|'NOR'|'BUT', string>; particles: Record<'WITH'|'TO'|'FROM'|'IN_AT', string> };
  const [t2Settings, setT2Settings] = useLocalStorageState<T2Settings>(LS_KEYS.translator2Settings, {
    coordinators: { AND: 'ʋa', OR: 'ra', NOR: 'ra', BUT: 'ma' },
    particles: { WITH: 'ri', TO: 'ith', FROM: 'ʌs', IN_AT: 'la' },
  });
  const [t2SettingsOpen, setT2SettingsOpen] = useState(false);

  // Live translate (debounced)
  const liveTimer = useRef<number | null>(null);
  const lastComputed = useRef<string>("");
  useEffect(() => {
    const val = englishInput.trim();
    if (liveTimer.current) { clearTimeout(liveTimer.current); liveTimer.current = null; }
    if (!val) { setResult(null); lastComputed.current = ""; return; }
    liveTimer.current = window.setTimeout(() => {
      if (lastComputed.current !== val) {
        const r = translateLib(val, rootsLocal, nounsLocal, {
          particles: t2Settings?.particles,
          coordinators: t2Settings?.coordinators,
          flags: { enableCoordination: true },
        });
        setResult({ surface: r.surface, variants: r.variants, analysis: r.analysis, warnings: r.warnings });
        lastComputed.current = val;
      }
    }, 120);
    return () => { if (liveTimer.current) { clearTimeout(liveTimer.current); liveTimer.current = null; } };
  }, [englishInput, rootsLocal, nounsLocal, t2Settings]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Left: English input + Favorites + Guide */}
      <div>
        <label className="block mb-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">English line</div>
          <input
            className="w-full border rounded-lg px-2 py-2"
            placeholder="Type an English line..."
            value={englishInput}
            onChange={e=>setEnglishInput(e.target.value)}
          />
          <div className="mt-1 text-xs text-neutral-500">Keeps ?; strips quotes/punct; removes a/an/the when safe; lowercases.</div>
        </label>

        {/* Favorites + Guide row */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
          {/* Favorites list */}
          <section className="rounded-xl border border-neutral-200 fantasy-card p-3">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs uppercase tracking-wide text-neutral-500">My Phrases</div>
              {faves.length>0 && (
                <button className="text-xs px-2 py-1 rounded border border-neutral-300 hover:bg-neutral-50" onClick={()=>setFaves([])}>Clear</button>
              )}
            </div>
            {faves.length ? (
              <div className="mt-2 max-h-72 overflow-auto pr-1">
                <div className="flex flex-col gap-1">
                  {faves.map(f => (
                    <div key={f.id} className="flex items-center gap-2 text-sm">
                      <button className="px-2 py-1 rounded border border-neutral-300 hover:bg-neutral-50" onClick={()=>{ try { navigator.clipboard.writeText(f.surface); } catch { void 0; } finally { try { window.dispatchEvent(new CustomEvent('huntspeak-toast', { detail: { message: 'Saved to clipboard successfully' } })); } catch { void 0; } } }}>Copy</button>
                      <button className="px-2 py-1 rounded border border-neutral-300 hover:bg-neutral-50" title="Remove favorite" onClick={()=> setFaves(prev=>prev.filter(x=>x.id!==f.id))}>★</button>
                      <div className="truncate" title={f.input ? `${f.surface} — ${f.input}` : f.surface}>{f.surface}{f.input ? ` — ${f.input}` : ''}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-sm text-neutral-500">None starred yet.</div>
            )}
          </section>

          {/* Usage guide */}
          <section className="rounded-xl border border-neutral-200 fantasy-card p-3 text-sm leading-6">
            <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">How to use</div>
            <ul className="list-disc ml-5 space-y-1">
              <li>Subjects: i / you / he / she / we / they</li>
              <li>Tense: will → future; did/was/were → past</li>
              <li>Negation: not, don't, didn't, won't → negative</li>
              <li>Progressive: be + -ing (am/is/are/was/were hiding) → progressive</li>
              <li>Habitual: used to → habitual</li>
              <li>Particles: with → ri; to → ith; from → ʌs; in/at → la</li>
              <li>Coordination: and/or/nor/but join verbs and nouns (joiners editable in Settings)</li>
              <li>Objects: me/us/you/him/her/them → ɪ/tɪ/su/se/se/te</li>
            </ul>
            <div className="mt-2 text-xs text-neutral-600">
              Example: “we hunt with trap in shroud and hunter smell us and strike us” → tɪ kɪlab ri maklūb la sharūd ʋa kalāb χeraq ʋa derek tɪ
            </div>
          </section>
        </div>

        {/* Editors row: Verb Roots and Nouns */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
          <div>
            <RootEditor
              initial={rootsLocal}
              onChange={setRootsLocal}
              selectedId={selectedRootId}
              onSelect={setSelectedRootId}
              showCollapse={false}
              onCreateNoun={(n)=>{
                const id = Math.random().toString(36).slice(2,10);
                setNounsLocal(prev => [{ id, word: n.word, gloss: n.gloss || "", synonyms: n.synonyms || [] }, ...prev]);
                try { onCreateNoun?.(n); } catch { /* ignore */ }
              }}
            />
          </div>
          <div>
            <NounEditor
              key={nounsKey}
              initial={nounsLocal}
              onChange={setNounsLocal}
              selectedId={selectedNounId}
              onSelect={setSelectedNounId}
              showCollapse={false}
            />
          </div>
        </div>

        {/* Forms row: Finite Forms and Derivations for selected root */}
        {selectedRootId && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            {(() => {
              const root = rootsLocal.find(r=>r.id===selectedRootId);
              if (!root) return <div className="text-sm text-neutral-500">Select a verb root to see forms.</div>;
              return (
                <>
                  <FiniteForms root={root} />
                  <RenderDerivations root={root} onCreateNoun={(n)=>{
                    const id = Math.random().toString(36).slice(2,10);
                    const newNoun = { id, word: n.word, gloss: n.gloss || "", synonyms: n.synonyms || [] };
                    const next = [newNoun, ...nounsLocal];
                    setNounsLocal(next);
                    try { localStorage.setItem(LS_KEYS.nouns, JSON.stringify(next)); } catch { /* ignore */ }
                    setNounsKey(k=>k+1);
                    try { onCreateNoun?.(n); } catch { /* ignore */ }
                  }} />
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Right: output */}
      <div className="sub-panel rounded-xl border p-3">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Huntspeak</div>
          <div className="flex items-center gap-2">
            <button
              className="px-2 py-1 rounded border border-neutral-300 hover:bg-neutral-50 text-sm"
              onClick={() => {
                const surface = result?.surface?.trim() || '';
                const inputLine = englishInput.trim();
                if (!surface) return;
                const exists = faves.some(f => f.surface===surface && f.input===inputLine);
                if (exists) {
                  setFaves(prev => prev.filter(f => !(f.surface===surface && f.input===inputLine)));
                } else {
                  const entry = { id: Math.random().toString(36).slice(2,10), input: inputLine, surface, at: Date.now() };
                  setFaves(prev => [entry, ...prev]);
                }
              }}
              title="Toggle favorite for this output"
            >{(() => {
              const surface = result?.surface?.trim() || '';
              const inputLine = englishInput.trim();
              const exists = surface && faves.some(f => f.surface===surface && f.input===inputLine);
              return exists ? '★ Favorite' : '☆ Favorite';
            })()}</button>
            <button className="px-2 py-1 rounded border border-neutral-300 hover:bg-neutral-50 text-sm" onClick={() => { try { navigator.clipboard.writeText(result?.surface || ""); } catch { void 0; } finally { try { window.dispatchEvent(new CustomEvent('huntspeak-toast', { detail: { message: 'Saved to clipboard successfully' } })); } catch { void 0; } } }}>Copy</button>
            <button className="px-2 py-1 rounded border border-neutral-300 hover:bg-neutral-50 text-sm" onClick={()=>setShowJSON(v=>!v)}>{showJSON ? 'Hide JSON' : 'Show JSON'}</button>
            <button className="px-2 py-1 rounded border border-neutral-300 hover:bg-neutral-50 text-sm" onClick={()=>setT2SettingsOpen(true)}>Settings</button>
          </div>
        </div>
        <div className="text-xl font-semibold mb-3 min-h-10">
          {(() => {
            const surface = result?.surface || "";
            if (!surface) return "(nothing yet)";
            // Cosmetic: wrap pronouns in parentheses when at start or after a joiner
            const joiners = new Set<string>(Object.values((t2Settings?.coordinators ?? { AND:'ʋa', OR:'ra', NOR:'ra', BUT:'ma' }) as Record<'AND'|'OR'|'NOR'|'BUT', string>));
            const pron = new Set(["ɪ","tɪ","su","tu","se","te"]);
            const toks = surface.split(/\s+/);
            for (let i=0;i<toks.length;i++){
              if (pron.has(toks[i]) && (i===0 || joiners.has(toks[i-1]))){
                toks[i] = `(${toks[i]})`;
              }
            }
            return toks.join(' ');
          })()}
        </div>

        {/* Variants */}
        {result?.variants?.length ? (
          <div className="mb-3">
            <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Variants</div>
            <div className="flex flex-wrap gap-2">
              {result.variants.map((v,i)=> (
                <button key={i} className="inline-flex items-center gap-2 px-2 py-1 rounded-full border border-neutral-300 text-sm hover:bg-neutral-50" onClick={()=>{ try { navigator.clipboard.writeText(v); } catch { void 0; } finally { try { window.dispatchEvent(new CustomEvent('huntspeak-toast', { detail: { message: 'Saved to clipboard successfully' } })); } catch { void 0; } } }} title="Click to copy">
                  <span className="font-medium">{v}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Analysis (from library) */}
        {(() => {
          const analysis = (result?.analysis || {}) as {
            frame?: { subject?: string; tense?: string; neg?: boolean; prog?: boolean; hab?: boolean; question?: boolean; verbRootId?: string|null; objects?: string[] };
            intake?: { tokensFlat?: string[] };
            particlePairs?: Array<{ part:string; nounId:string; noun?:string; en:string }>;
            clause?: string;
            resolutionLog?: string[];
            unknownTokens?: string[];
          } | undefined;
          const frm = analysis?.frame;
          if (!frm) return null;
          const tokensFlat: string[] = analysis?.intake?.tokensFlat || [];
          const pairs = analysis?.particlePairs || [];
          const resLog: string[] = Array.isArray(analysis?.resolutionLog) ? (analysis?.resolutionLog as string[]) : [];
          const unknown = Array.isArray(analysis?.unknownTokens) ? (analysis?.unknownTokens as string[]) : [];
          const objects = (frm.objects || []).map(id => nounsLocal.find(n=>n.id===id)?.word || id).join(', ') || '—';
          const flags = [frm.prog?'Prog':null, frm.hab?'Hab':null, frm.neg?'Neg':null].filter(Boolean).join(', ') || '—';
          return (
            <div className="rounded-lg border p-2 analysis-panel">
              <div className="grid grid-cols-[10rem_1fr] gap-x-4 gap-y-1 text-sm">
                <div className="opacity-70">Clause</div><div>{analysis?.clause || '—'}</div>
                <div className="opacity-70">Subject</div><div>{frm.subject || '—'}</div>
                <div className="opacity-70">Tense</div><div>{frm.tense || '—'}</div>
                <div className="opacity-70">Flags</div><div>{flags}</div>
                <div className="opacity-70">Objects</div><div>{objects}</div>
                <div className="opacity-70">Intake</div><div>{tokensFlat.join(' ') || '—'}</div>
              </div>
              {(() => {
                const P_MAP = (t2Settings as { coordinators: Record<'AND'|'OR'|'NOR'|'BUT', string>; particles?: Record<'WITH'|'TO'|'FROM'|'IN_AT', string> }).particles || { WITH:'ri', TO:'ith', FROM:'ʌs', IN_AT:'la' };
                const EN_LABEL: Record<string, string> = { WITH: 'with; instrument', TO: 'to; goal', FROM: 'from; source', IN_AT: 'in/at; location' };
                const PARTICLE_INFO: Record<string, { en: string; triggers: string[] }> = {
                  [P_MAP.WITH]: { en: EN_LABEL.WITH, triggers: ['with'] },
                  [P_MAP.TO]: { en: EN_LABEL.TO, triggers: ['to'] },
                  [P_MAP.FROM]: { en: EN_LABEL.FROM, triggers: ['from'] },
                  [P_MAP.IN_AT]: { en: EN_LABEL.IN_AT, triggers: ['in','at'] },
                } as Record<string, { en: string; triggers: string[] }>;
                if (!pairs.length) return null;
                const map = new Map<string, { triggers: Set<string>; nouns: Set<string> }>();
                for (const p of pairs){
                  const ent = map.get(p.part) || { triggers: new Set(), nouns: new Set() };
                  ent.triggers.add(p.en);
                  ent.nouns.add(p.noun || (nounsLocal.find(n=>n.id===p.nounId)?.word || p.nounId));
                  map.set(p.part, ent);
                }
                const items = Array.from(map.entries());
                return (
                  <div className="mt-3">
                    <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Particles</div>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {items.map(([code, data]) => (
                        <div key={`particle-${code}`} className="min-w-[16rem] rounded-lg border p-2 sub-panel">
                          <div className="text-sm font-medium mb-1">{code}</div>
                          <div className="text-sm"><span className="opacity-70">EN:</span> {PARTICLE_INFO[code]?.en || '—'}</div>
                          <div className="text-sm"><span className="opacity-70">Triggered by:</span> {Array.from(data.triggers).join(', ')}</div>
                          <div className="text-sm"><span className="opacity-70">Noun:</span> {Array.from(data.nouns).join(', ')}</div>
                          <div className="text-xs mt-1 opacity-80">Possible triggers: {(PARTICLE_INFO[code]?.triggers || []).join(', ') || '—'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {resLog.length ? (
                <div className="mt-2 text-xs">
                  <div className="opacity-70 mb-1">Resolution log</div>
                  <ul className="list-disc ml-5 space-y-0.5">
                    {resLog.map((line, i)=> (
                      <li key={i} className={/fuzzy/.test(line) ? 'text-amber-600 font-medium' : ''}>{line}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {unknown.length ? (
                <div className="mt-2 text-sm">
                  <div className="opacity-70 mb-1">Unknown tokens</div>
                  <div className="flex flex-wrap gap-2 items-center">
                    {unknown.map((w,i)=> (
                      <span key={i} className="inline-flex items-center gap-2 px-2 py-1 rounded-full border border-neutral-300">
                        <span className="text-red-700">{w}</span>
                        <button className="text-xs px-2 py-1 rounded border border-neutral-300 hover:bg-neutral-50" onClick={()=>onCreateNoun?.({ word: w, gloss: w })}>Add as Noun</button>
                        <button className="text-xs px-2 py-1 rounded border border-neutral-300 hover:bg-neutral-50" onClick={()=>onCreateRoot?.({ c1: '', c2: '', c3: '', gloss: w, synonyms: [] })}>Add as Verb</button>
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {showJSON && (
                <pre className="mt-2 text-xs overflow-auto max-h-48">{JSON.stringify(result?.analysis, null, 2)}</pre>
              )}
            </div>
          );
        })()}

        {/* Warnings */}
        {(result?.warnings?.length || 0) > 0 && (
          <div className="mt-2 text-sm">
            <div className="text-amber-700 mb-1">Warnings: {result?.warnings?.join(", ")}</div>
          </div>
        )}
      </div>

      {t2SettingsOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={()=>setT2SettingsOpen(false)}></div>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e)=>{ if (e.target===e.currentTarget) setT2SettingsOpen(false); }}>
            <div className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white fantasy-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xl font-semibold">Translator 2.0 Settings</h3>
                <button className="px-3 py-1 rounded-lg border border-neutral-300 hover:bg-neutral-50" onClick={()=>setT2SettingsOpen(false)}>Close</button>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-medium mb-2">Coordinator Mapping</div>
                  <div className="grid grid-cols-2 gap-3">
                    {(['AND','OR','NOR','BUT'] as const).map(k => (
                      <label key={k} className="block">
                        <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">{k}</div>
                        <input className="w-full border rounded-lg px-2 py-2" value={t2Settings.coordinators[k]} onChange={e=>setT2Settings(s=>({ ...s, coordinators: { ...s.coordinators, [k]: e.target.value } }))} />
                      </label>
                    ))}
                  </div>
                </div>
                <div className="pt-2 border-t border-neutral-200/70">
                  <div className="text-sm font-medium mb-2">Particles Mapping</div>
                  <div className="grid grid-cols-2 gap-3">
                    {(() => {
                      const DEF_P = { WITH:'ri', TO:'ith', FROM:'ʌs', IN_AT:'la' } as const;
                      const current = (t2Settings as { particles?: Record<string,string> }).particles || {};
                      return (
                        <>
                          {([
                            { key: 'WITH', label: 'with / instrument' },
                            { key: 'TO', label: 'to / goal' },
                            { key: 'FROM', label: 'from / source' },
                            { key: 'IN_AT', label: 'in / at / location' },
                          ] as const).map(p => (
                            <label key={p.key} className="block">
                              <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">{p.label}</div>
                              <input
                                className="w-full border rounded-lg px-2 py-2"
                                value={(current as Record<string,string>)[p.key] || (DEF_P as Record<string,string>)[p.key]}
                                onChange={e=>setT2Settings(s=>({ ...s, particles: { ...(s.particles || {}), [p.key]: e.target.value } }))}
                              />
                            </label>
                          ))}
                        </>
                      );
                    })()}
                  </div>
                  <div className="text-xs text-neutral-600 mt-1">Map English roles to HS particles (used in output/analysis).</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
