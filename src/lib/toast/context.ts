import { createContext, useContext } from 'react';

export type ToastAPI = { show: (msg: string) => void };
export const ToastCtx = createContext<ToastAPI | null>(null);
export function useToast(){
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

