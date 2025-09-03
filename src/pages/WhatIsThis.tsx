import { useEffect } from "react";
import { LS_KEYS } from "../lib/storage";

export default function WhatIsThis(){
  useEffect(()=>{
    document.title = "Moontalk — What is this";
    // Apply same theme class as the app (auto → fantasy/dark)
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

  const sections = [
    { id: 'tldr', label: 'TL;DR' },
    { id: 'purpose', label: 'Purpose' },
    { id: 'core', label: 'Core Idea' },
    { id: 'copula', label: 'Copula' },
    { id: 'howto', label: 'Quick How‑to' },
    { id: 'deriv', label: 'Derivations' },
    { id: 'examples', label: 'Examples' },
    { id: 'notes', label: 'Translator Notes' },
  ];

  return (
    <main className="px-4 py-6 md:px-6 lg:px-10">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold">What is this?</h1>
          <nav className="flex items-center gap-2">
            <a href="/" className="px-3 py-2 rounded-xl border border-neutral-300 hover:bg-neutral-50">Back to App</a>
          </nav>
        </div>

        {/* Layout: single column on mobile; article + sticky mini‑TOC on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_16rem] gap-8 items-start">
          {/* Article */}
          <article className="fantasy-card rounded-2xl border border-neutral-200 p-5 lg:p-6 max-w-[90ch] font-sans leading-7">
            <section id="tldr" className="mb-6">
              <h2 className="text-xl font-semibold mb-2">Huntspeak in 10 seconds</h2>
              <p className="text-sm text-neutral-600">Template: <code>C1 + (SUBJ V) + C2 + (TENSE V) + C3</code>. Vowels: ɪ (I/we), u (you/you all), e (he/she/they). Tense: a = now, e = past, ʌ = future. Quick toggles: progressive = double C2, habitual = <code>-ar</code>, negation = <code>naaq-</code> (or <code>naq-</code> before k/g/q). Particles: <code>ri</code> (with), <code>ith</code> (to), <code>ʌs</code> (from), <code>la</code> (in/at).</p>
            </section>

            <section id="purpose" className="mb-6">
              <h2 className="text-xl font-semibold mb-2">1) Purpose</h2>
              <p>This is a gamer‑friendly Moontalk workbench. Make words (verbs/nouns), see handy forms/derivations, and compose quick RP lines you can drop in chat. It’s deliberately simple and fast—no deep linguistics degree required.</p>
            </section>

            <section id="core" className="mb-6">
              <h2 className="text-xl font-semibold mb-2">2) Core idea</h2>
              <ul className="list-disc ml-5 space-y-1">
                <li>Words come from 3‑letter “roots” (C1–C2–C3).</li>
                <li>Verbs are built with a small template (see TL;DR above).</li>
                <li>Pick who’s speaking (I/you/he…) → the vowel follows automatically.</li>
                <li>Flip on progressive/habitual/negation if you need them.</li>
                <li>Nouns don’t change for plural—“prey” is just “prey”.</li>
                <li>Particles you’ll use a lot: <code>ri</code> (with), <code>ith</code> (to), <code>ʌs</code> (from), <code>la</code> (in/at).</li>
              </ul>
            </section>

            <section id="copula" className="mb-6">
              <h2 className="text-xl font-semibold mb-2">3) Copula (“to be”)</h2>
              <ul className="list-disc ml-5 space-y-1">
                <li>“To be” is a normal verb root: <code>k–r–n</code> “be; exist”.</li>
                <li>Right now (present), you can often drop it: <em>ɪ kalāb</em> = “I am a hunter”.</li>
                <li>Past/future/negation keep it: <em>ɪ kɪren kalāb</em>, <em>ɪ naq‑kɪren kalāb</em>.</li>
                <li>“There is/are X (in PLACE)” → <em>3sg copula + X (+ la + PLACE)</em>: <em>keran prey la Shroud</em>.</li>
                <li>“I had X” → existential (past) + to‑me: <em>3sg copula + X + ith + ɪ</em>: <em>keren prey ith ɪ</em>.</li>
              </ul>
            </section>

            <section id="howto" className="mb-6">
              <h2 className="text-xl font-semibold mb-2">4) Quick how‑to for players</h2>
              <p>Pick who → choose a verb → set tense or toggles → add a noun → optionally add <code>ri</code>/<code>ith</code>/<code>ʌs</code>/<code>la</code> → copy to chat.</p>
            </section>

            <section id="deriv" className="mb-6">
              <h2 className="text-xl font-semibold mb-2">5) Derivations cheat‑sheet</h2>
              <p className="mb-2">These are quick word‑building patterns from a verb root. They don’t change verb conjugation—think “make a related noun quickly”. In the app, click a derivation card to prefill a noun; you can tweak and save it.</p>
              <ul className="list-disc ml-5 space-y-2">
                <li>
                  <strong>Agent</strong> <code>CaCāC</code> — “one who VERBs”. Useful for profession/role names.
                  <span className="block text-neutral-600 text-sm">If base gloss is “hunt”, this is like “hunter”. Example from k‑l‑b → <em>kalāb</em>.</span>
                </li>
                <li>
                  <strong>Place</strong> <code>miCCaC</code> — “place/ground for VERB‑ing”.
                  <span className="block text-neutral-600 text-sm">Good for lairs, ambush spots, training grounds. From k‑l‑b → <em>kallab</em>‑type shapes.</span>
                </li>
                <li>
                  <strong>Instrument</strong> <code>maCCūC</code> — “tool for VERB‑ing”.
                  <span className="block text-neutral-600 text-sm">Any gear/device tied to the action. From k‑l‑b → <em>kallūb</em> (e.g., a dedicated hunting tool).</span>
                </li>
                <li>
                  <strong>Middle/Reflexive</strong> <code>t'‑CaCCaC</code> — “VERB oneself / do it in the middle”.
                  <span className="block text-neutral-600 text-sm">Tends to read like self‑directed or in‑between voice. From k‑l‑b → <em>t'kal lab</em>‑style shapes.</span>
                </li>
                <li>
                  <strong>Causative</strong> <code>χa‑CiCēC</code> — “make/let someone VERB”.
                  <span className="block text-neutral-600 text-sm">Push or permit the action in others. From k‑l‑b → <em>χakilēb</em>.</span>
                </li>
                <li>
                  <strong>Intensive</strong> <code>CuCCaC</code> — “do VERB intensely/with emphasis”.
                  <span className="block text-neutral-600 text-sm">Turn the dial up—stronger or more focused flavor of the base action. From k‑l‑b → <em>kullab</em>.</span>
                </li>
                <li>
                  <strong>Passive</strong> <code>n‑CaCaC</code> — “be VERB‑ed”.
                  <span className="block text-neutral-600 text-sm">State/result of undergoing the verb. From k‑l‑b → <em>nakalab</em>.</span>
                </li>
                <li>
                  <strong>Concept</strong> <code>CaCiC</code> — “the act/idea of VERB‑ing”.
                  <span className="block text-neutral-600 text-sm">Abstract noun for discussions, plans, or general talk. From k‑l‑b → <em>kalib</em>.</span>
                </li>
              </ul>
              <p className="text-sm text-neutral-600 mt-2">Tip: Derivations are great for building your own lexicon quickly—save what you like, ignore what you don’t.</p>
            </section>

            <section id="examples" className="mb-6">
              <h2 className="text-xl font-semibold mb-2">6) Examples</h2>
              <ul className="space-y-1">
                <li>“<em>ɪ dɪrak kalāb</em>” — I strike hunter.</li>
                <li>“<em>se naqqelab ri mallūb</em>” — she doesn’t hunt with a trap.</li>
                <li>“<em>keran prey la Shroud</em>” — there is prey in the Shroud.</li>
                <li>“<em>keren prey ith ɪ</em>” — I had prey.</li>
                <li>“<em>ith tʊrʌk ʔaraq?</em>” — will you approach the scent?</li>
              </ul>
            </section>

            <section id="notes" className="mb-8">
              <h2 className="text-xl font-semibold mb-2">7) Translator notes</h2>
              <ul className="list-disc ml-5 space-y-1">
                <li>English “be / am / is / are / was / were / been / being” maps to the copula above; present equatives may drop the verb.</li>
                <li>Noun matching is friendly: it looks at gloss and synonyms. English plurals are fine—Huntspeak nouns don’t change.</li>
              </ul>
            </section>

            <footer className="border-t border-neutral-200/60 pt-4">
              <div className="flex flex-wrap gap-2">
                <a href="/" className="px-3 py-2 rounded-xl border border-neutral-300 hover:bg-neutral-50">Compose</a>
                <a href="/" className="px-3 py-2 rounded-xl border border-neutral-300 hover:bg-neutral-50">Verbs</a>
                <a href="/" className="px-3 py-2 rounded-xl border border-neutral-300 hover:bg-neutral-50">Nouns</a>
                <span className="text-sm text-neutral-500 ml-auto">Export/Backup from the Data menu.</span>
              </div>
            </footer>
          </article>

          {/* Sticky mini‑TOC */}
          <aside className="hidden lg:block sticky top-6 h-min">
            <nav className="fantasy-card rounded-2xl border border-neutral-200 p-3 text-sm w-64">
              <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">On this page</div>
              <ul className="space-y-1">
                {sections.map(s => (
                  <li key={s.id}><a href={`#${s.id}`} className="hover:underline decoration-dotted underline-offset-2">{s.label}</a></li>
                ))}
              </ul>
            </nav>
          </aside>
        </div>
      </div>
    </main>
  );
}
