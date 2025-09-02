import type { Noun, Root } from "../types";

/**
 * Displays the currently selected verb root and noun for quick reference.
 * Shows triliteral root (C1‑C2‑C3) and the noun with their glosses.
 */
export default function SelectedSummary({ root, noun }: { root: Root | null; noun: Noun | null }) {
  return (
    <section className="rounded-2xl border border-neutral-200 p-3 fantasy-card">
      <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Current selection</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl border border-neutral-200 p-3 sub-panel">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Verb root</div>
          {root ? (
            <div className="mt-1">
              <div className="font-semibold text-lg">{[root.c1, root.c2, root.c3].join("-")}</div>
              <div className="text-sm text-neutral-600">{root.gloss || "(no gloss)"}</div>
            </div>
          ) : (
            <div className="mt-1 text-sm text-neutral-500">None selected</div>
          )}
        </div>
        <div className="rounded-xl border border-neutral-200 p-3 sub-panel">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Noun</div>
          {noun ? (
            <div className="mt-1">
              <div className="font-semibold text-lg break-words">{noun.word}</div>
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

