// Centralized localStorage keys for app persistence.
export const LS_KEYS = {
  roots: "huntspeak_roots",
  nouns: "huntspeak_nouns",
  ui: "huntspeak_ui",
  talk: "huntspeak_talkpad",
  selectedRoot: "huntspeak_selected_root",
  composerCollapsed: "huntspeak_collapse_composer",
  morphToggles: "huntspeak_morph_toggles",
  morphSync: "huntspeak_morph_sync",
} as const;

/** Read and JSON‑parse a value from localStorage with a safe fallback. */
export function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Stringify and write a value to localStorage; ignore quota/permission errors. */
export function lsSet(key: string, value: unknown) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

import { useEffect, useRef, useState } from "react";

/**
 * React state hook backed by localStorage. Hydrates from storage on first render,
 * then writes back whenever the value changes.
 */
export function useLocalStorageState<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(() => lsGet<T>(key, initial));
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    lsSet(key, state);
  }, [key, state]);
  return [state, setState] as const;
}
