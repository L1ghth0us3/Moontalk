import React from 'react';
import { translate } from '../../lib/translator2';
import { DEFAULT_ROOTS, DEFAULT_NOUNS } from '../../data/defaults';

type Result = { category: string; name: string; pass: boolean; expected: string; got: string; note?: string };

export default function DevTestRunner(){
  const [results, setResults] = React.useState<Result[] | null>(null);
  const [running, setRunning] = React.useState(false);

  const run = React.useCallback(() => {
    setRunning(true);
    const out: Result[] = [];
    const check = (category: string, name: string, expected: string | RegExp | ((s: string)=>boolean), input: string) => {
      const r = translate(input, DEFAULT_ROOTS, DEFAULT_NOUNS);
      let pass = false;
      if (typeof expected === 'string') pass = r.surface === expected;
      else if (expected instanceof RegExp) pass = expected.test(r.surface);
      else pass = expected(r.surface);
      out.push({ category, name, pass, expected: typeof expected==='string' ? expected : expected instanceof RegExp ? expected.toString() : 'predicate', got: r.surface });
    };

    // Transitive: pronouns × objects × tenses
    check('Transitive', 'I strike hunter', 'ɪ dɪrak kalāb', 'I strike hunter');
    check('Transitive', 'I hunt prey', (s)=>/\bɪ\b/.test(s) && /\bdray\b/.test(s), 'I hunt prey');
    check('Transitive', 'You hunt prey', (s)=>/^su\b/.test(s) && /\bdray\b/.test(s), 'You hunt prey');
    check('Transitive', 'We did hunt prey', (s)=>/^tɪ\b/.test(s) && /\bdray\b/.test(s), 'We did hunt prey');
    check('Transitive', 'They will hunt prey', (s)=>/^te\b/.test(s) && /\bdray\b/.test(s), 'They will hunt prey');
    check('Transitive', 'They smell forest', (s)=>s.split(/\s+/).length>=3 && /\bte\b/.test(s), 'They smell forest');

    // Intransitives
    check('Intransitive', 'He sits', (s)=>/^se\b/.test(s) && s.split(/\s+/).length>=2, 'He sits');
    check('Intransitive', 'We move', (s)=>/^tɪ\b/.test(s) && s.split(/\s+/).length>=2, 'We move');

    // Copula / Equatives
    check('Copula', 'I am a hunter (zero)', 'ɪ kalāb', 'I am a hunter');
    check('Copula', 'They are hunters (zero)', (s)=>/^te\s+kalāb$/.test(s), 'They are hunters');
    check('Copula', 'I am not a hunter', (s)=>/^ɪ\s+.*kalāb/.test(s) && /(naaq|naq)/.test(s), 'I am not a hunter');

    // Existential / Locative-like
    check('Existential', 'There is water in cave', (s)=>/\bʌmas\b/.test(s) && /\bla\b/.test(s) && /\bhʌiru\b/.test(s), 'There is water in cave');
    check('Existential', 'There are animals in forest', (s)=>/\btye\b/.test(s) && /\bla\b/.test(s) && /\bʋæʋi\b/.test(s), 'There are animals in forest');
    check('Existential', 'There is fire at home', (s)=>/\bχʌl\b/.test(s) && /\bla\b/.test(s) && /\bteʋikay\b/.test(s), 'There is fire at home');

    // Particles: with/to/from/in
    check('Particles', 'We will hunt with bow', /\bri\b/, 'We will hunt with bow');
    check('Particles', 'I move to cave', (s)=>/\bith\b/.test(s) && /\bhʌiru\b/.test(s), 'I move to cave');
    check('Particles', 'They come from forest', (s)=>/\bʌs\b/.test(s) && /\bʋæʋi\b/.test(s), 'They come from forest');
    check('Particles', 'She is in water', (s)=>/\bla\b/.test(s) && /\bʌmas\b/.test(s), 'She is in water');

    // Negation
    check('Negation', 'I do not hunt (k- assimilation)', /^ɪ\s+naq/, 'I do not hunt');
    check('Negation', 'She does not strike (default)', (s)=>/\bnaaq/.test(s), 'She does not strike');

    // Progressive / Habitual / Questions
    check('Aspect', 'Progressive + question: You are hiding?', (s)=>s.endsWith('qa?'), 'You are hiding?');
    check('Aspect', 'Habitual: We used to hunt prey', (s)=>/^tɪ\b/.test(s) && /\bdray\b/.test(s), 'We used to hunt prey');
    check('Aspect', 'Question: We hunt prey?', (s)=>s.endsWith('qa?') && /\bdray\b/.test(s), 'We hunt prey?');

    // Multi-word verb phrase
    check('Phrasal', 'She draw near cave', (s)=>/^se\b/.test(s) && /\bhʌiru\b/.test(s), 'She draw near cave');

    setResults(out);
    setRunning(false);
  }, []);

  React.useEffect(() => { run(); }, [run]);

  const passCount = (results||[]).filter(r=>r.pass).length;
  const total = results?.length || 0;
  const byCat = React.useMemo(() => {
    const m = new Map<string, Result[]>();
    for (const r of results || []){
      const arr = m.get(r.category) || [];
      arr.push(r);
      m.set(r.category, arr);
    }
    return Array.from(m.entries());
  }, [results]);
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
        <div className="space-y-3 text-sm">
          {byCat.map(([cat, items]) => {
            const pc = items.filter(i=>i.pass).length;
            return (
              <div key={cat}>
                <div className="font-medium text-neutral-800 mb-1">{cat} — {pc}/{items.length} passing</div>
                <div className="space-y-1">
                  {items.map((t,i)=> (
                    <div key={cat + ':' + i} className={t.pass ? 'text-emerald-700' : 'text-red-700'}>
                      {t.pass ? '✓' : '✗'} {t.name}
                      <div className="text-neutral-600 text-xs">expected: {t.expected}</div>
                      <div className="text-neutral-600 text-xs">got: {t.got}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
