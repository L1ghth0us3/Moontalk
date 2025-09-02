import { useEffect, useRef, useState } from "react";

/**
 * Returns a boolean that becomes true briefly whenever deps change,
 * suitable for toggling a one-off CSS animation class.
 */
export function usePulseOnChange(deps: unknown[], ms = 700) {
  const [pulse, setPulse] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setPulse(true);
    const t = setTimeout(() => setPulse(false), ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return pulse;
}

