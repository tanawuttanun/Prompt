import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

type Tone = 'gold' | 'ok' | 'error' | 'info';
type Toast = { id: number; message: string; detail?: string; icon?: string; tone: Tone; leaving?: boolean };
type ToastOptions = { detail?: string; icon?: string; tone?: Tone; duration?: number };

const ToastContext = createContext<((message: string, options?: ToastOptions) => void) | null>(null);

// Pop-up notifications in the corner: slide in, shimmer once, slide out.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts(list => list.map(t => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setToasts(list => list.filter(t => t.id !== id)), 320);
  }, []);

  const toast = useCallback(
    (message: string, options: ToastOptions = {}) => {
      const id = nextId.current++;
      setToasts(list => [...list.slice(-3), { id, message, detail: options.detail, icon: options.icon ?? '✦', tone: options.tone ?? 'gold' }]);
      setTimeout(() => dismiss(id), options.duration ?? 3200);
    },
    [dismiss],
  );

  const value = useMemo(() => toast, [toast]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="v-toasts" role="status" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`v-toast v-toast-${t.tone} ${t.leaving ? 'leaving' : ''}`}>
            <span className="v-toast-icon" aria-hidden="true">{t.icon}</span>
            <div>
              <b>{t.message}</b>
              {t.detail && <div className="v-small v-muted">{t.detail}</div>}
            </div>
            <button className="v-toast-close" aria-label="Dismiss" onClick={() => dismiss(t.id)}>×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
