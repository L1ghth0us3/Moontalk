import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ContextMenuCtx, type MenuItem } from './context';

export function ContextMenuProvider({ children }: { children: React.ReactNode }){
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{x:number;y:number}>({ x: 0, y: 0 });
  const [items, setItems] = useState<MenuItem[]>([]);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const hide = useCallback(()=> setOpen(false), []);

  const showAt = useCallback((x: number, y: number, items: MenuItem[]) => {
    requestAnimationFrame(() => {
      const margin = 8;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const px = Math.max(margin, Math.min(x, vw - margin - 200));
      const py = Math.max(margin, Math.min(y, vh - margin - 120));
      setItems(items);
      setPos({ x: px, y: py });
      setOpen(true);
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent){ if (e.key === 'Escape') hide(); }
    function onClick(e: MouseEvent){
      if (!panelRef.current) return;
      if (!panelRef.current.contains(e.target as Node)) hide();
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('mousedown', onClick); };
  }, [open, hide]);

  const value = useMemo(() => ({ showAt, hide }), [showAt, hide]);

  return (
    <ContextMenuCtx.Provider value={value}>
      {children}
      {open && (
        <div
          ref={panelRef}
          className="fixed z-[100] popover-panel ctx-menu rounded-md overflow-hidden border shadow-lg text-sm py-0"
          style={{ left: pos.x, top: pos.y }}
          role="menu"
        >
          {items.map((it, idx) => (
            <button
              key={idx}
              className="block w-full text-left px-3 py-1.5 hover:bg-neutral-50 rounded-none"
              role="menuitem"
              onClick={() => { hide(); it.action(); }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </ContextMenuCtx.Provider>
  );
}
