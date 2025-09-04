import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ToastCtx } from './context';

export function ToastProvider({ children }: { children: React.ReactNode }){
  const [msg, setMsg] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const timer = useRef<number | null>(null);

  const show = useCallback((text: string) => {
    setMsg(text);
    // start visible next frame for transition
    requestAnimationFrame(() => setVisible(true));
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    timer.current = window.setTimeout(() => setVisible(false), 1600);
  }, []);

  // Listen for global events to trigger toast from utility code (copy helpers, etc.)
  useEffect(() => {
    function onEvt(e: Event){
      const ce = e as CustomEvent<{ message?: string }>;
      const text = ce.detail?.message || 'Saved to clipboard successfully';
      show(text);
    }
    window.addEventListener('huntspeak-toast', onEvt as EventListener);
    return () => window.removeEventListener('huntspeak-toast', onEvt as EventListener);
  }, [show]);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="fixed inset-0 pointer-events-none z-[9999]">
        <div className="absolute bottom-4 right-4">
          <div
            role="status"
            aria-live="polite"
            className={
              `transform transition-all duration-300 ` +
              (visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2')
            }
          >
            {msg && (
              <div className="pointer-events-auto rounded-lg border border-neutral-300 bg-white/95 shadow-xl backdrop-blur px-3 py-2 text-sm text-neutral-800">
                {msg}
              </div>
            )}
          </div>
        </div>
      </div>
    </ToastCtx.Provider>
  );
}
