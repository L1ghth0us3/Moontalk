import { createContext, useContext } from 'react';

export type MenuItem = { label: string; action: () => void };
type Ctx = { showAt: (x: number, y: number, items: MenuItem[]) => void; hide: () => void };

export const ContextMenuCtx = createContext<Ctx | null>(null);

export function useContextMenu(){
  const ctx = useContext(ContextMenuCtx);
  if (!ctx) throw new Error('useContextMenu must be used within ContextMenuProvider');
  return ctx;
}
