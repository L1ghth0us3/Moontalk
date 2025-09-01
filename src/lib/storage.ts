export const LS_KEYS = {
  roots: "huntspeak_roots",
  nouns: "huntspeak_nouns",
  ui: "huntspeak_ui",
  talk: "huntspeak_talkpad",
} as const;

export function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function lsSet(key: string, value: unknown) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

import { useEffect, useRef, useState } from "react";

export function useLocalStorageState<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(() => lsGet<T>(key, initial));
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    lsSet(key, state);
  }, [key, state]);
  return [state, setState] as const;
}

