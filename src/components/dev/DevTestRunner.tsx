import React from 'react';
import { translate } from '../../lib/translator2';
import { DEFAULT_ROOTS, DEFAULT_NOUNS } from '../../data/defaults';

type Result = { name: string; pass: boolean; expected: string; got: string; note?: string };

export default function DevTestRunner(){
  const [results, setResults] = React.useState<Result[] | null>(null);
  const [running, setRunning] = React.useState(false);

  const run = React.useCallback(() => {
    setRunning(true);
    const out: Result[] = [];
    const check = (name: string, expected: string | RegExp | ((s: string)=>boolean), input: string) => {
      const r = translate(input, DEFAULT_ROOTS, DEFAULT_NOUNS);
      let pass = false;
      if (typeof expected === 'string') pass = r.surface === expected;
      else if (expected instanceof RegExp) pass = expected.test(r.surface);
      else pass = expected(r.surface);
      out.push({ name, pass, expected: typeof expected==='string' ? expected : expected instanceof RegExp ? expected.toString() : 'predicate', got: r.surface });
    };

    // Core scenarios (keep aligned with vitest suite where possible)
    check('Transitive: I strike hunter', 'ɪ dɪrak kalāb', 'I strike hunter');
    check('Equative zero-copula: I am a hunter', 'ɪ kalāb', 'I am a hunter');
    check('Existential: There is animal in forest', /\bla\b.+/, 'There is animal in forest');
    check('Progressive + question: You are hiding?', (s)=>s.endsWith('qa?'), 'You are hiding?');
    check('Negation assimilation: I do not hunt', /^ɪ\s+naq/, 'I do not hunt');
    check('Future + instrument: We will hunt with bow', /\bri\b/, 'We will hunt with bow');
    check('They smell forest', (s)=>s.split(/\s+/).length>=3, 'They smell forest');

    setResults(out);
    setRunning(false);
  }, []);

  React.useEffect(() => { run(); }, [run]);

  const passCount = (results||[]).filter(r=>r.pass).length;
  const total = results?.length || 0;
  const copyReport = () => {
    if (!results) return;
    const line = results.map(t => `${t.pass? 'PASS':'FAIL'} ${t.name}: expected=${t.expected}; got=${t.got}`).join(' | ');
    try { navigator.clipboard.writeText(line); } catch { /* ignore */ }
    try { window.dispatchEvent(new CustomEvent('huntspeak-toast', { detail: { message: 'Saved to clipboard successfully' } })); } catch {/* ignore */}
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-neutral-600">Live translator checks (dev) — {passCount}/{total} passing</div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1 rounded-lg border border-neutral-300 hover:bg-neutral-50 text-sm" onClick={run} disabled={running}>{running?'Running…':'Re-run'}</button>
          <button className="px-3 py-1 rounded-lg border border-neutral-300 hover:bg-neutral-50 text-sm" onClick={copyReport}>Copy Report</button>
        </div>
      </div>
      <div className="max-h-64 overflow-auto pr-1">
        <div className="space-y-1 text-sm">
          {(results||[]).map((t,i)=> (
            <div key={i} className={t.pass ? 'text-emerald-700' : 'text-red-700'}>
              {t.pass ? '✓' : '✗'} {t.name}
              <div className="text-neutral-600 text-xs">got: {t.got}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

