import type { Noun, Root } from "../types";

/**
 * Displays the currently selected verb root and noun for quick reference.
 * Shows triliteral root (C1‑C2‑C3) and the noun with their glosses.
 */
export default function SelectedSummary({ root, noun }: { root: Root | null; noun: Noun | null }) {
  return (
    <section className="rounded-3xl border p-5 shadow-lg main-card fantasy-card overflow-hidden mb-6 md:mb-8">
      <div className="accent h-1 w-full rounded-t-3xl -mt-5 mb-4" />
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-xl md:text-2xl font-semibold">Current Selection</h2>
        <div className="text-sm opacity-75">Quick reference</div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-neutral-200 p-4 sub-panel">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Verb root</div>
          {root ? (
            <div className="mt-1">
              <div className="font-bold text-2xl">{[root.c1, root.c2, root.c3].join("-")}</div>
              <div className="text-sm text-neutral-600">{root.gloss || "(no gloss)"}</div>
            </div>
          ) : (
            <div className="mt-1 text-sm text-neutral-500">None selected</div>
          )}
        </div>
        <div className="rounded-xl border border-neutral-200 p-4 sub-panel">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Noun</div>
          {noun ? (
            <div className="mt-1">
              <div className="font-bold text-2xl break-words">{noun.word}</div>
              <div className="text-sm text-neutral-600">{noun.gloss || "(no gloss)"}</div>
            </div>
          ) : (
            <div className="mt-1 text-sm text-neutral-500">None selected</div>
          )}
        </div>
      </div>
    </section>
  );
}
