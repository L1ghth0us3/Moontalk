// Centralized localStorage keys for app persistence.
// Keep this list as the single source of truth for any persisted UI/data state.
// When adding a new key, prefer a readable prefix like `huntspeak_*` and
// update any import/export logic or migrations accordingly.
export const LS_KEYS = {
  roots: "huntspeak_roots",
  nouns: "huntspeak_nouns",
  ui: "huntspeak_ui",
  talk: "huntspeak_talkpad",
  selectedRoot: "huntspeak_selected_root",
  composerCollapsed: "huntspeak_collapse_composer",
  morphToggles: "huntspeak_morph_toggles",
  morphSync: "huntspeak_morph_sync",
  rootsSearchOpen: "huntspeak_roots_search_open",
  nounsSearchOpen: "huntspeak_nouns_search_open",
  translator: "huntspeak_translator",
  // Theme selection; value is one of: 'auto' | 'fantasy' | 'plain' | 'dark'
  theme: "huntspeak_theme",
} as const;

/**
 * Read and JSON‑parse a value from localStorage with a safe fallback.
 * - Never throws; returns `fallback` when storage is empty or malformed.
 */
export function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Stringify and write a value to localStorage; ignore quota/permission errors.
 * - Safe to call in effects; no exceptions will bubble to React.
 */
export function lsSet(key: string, value: unknown) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

import { useEffect, useRef, useState } from "react";

/**
 * React state hook backed by localStorage. Hydrates from storage on first render,
 * then writes back whenever the value changes.
 *
 * Usage:
 *   const [val, setVal] = useLocalStorageState(LS_KEYS.someKey, defaultValue)
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
