import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

type ConfirmOptions = { title: string; message?: string; confirmLabel?: string; danger?: boolean };
type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

// A themed replacement for window.confirm: `if (!(await confirm({ title }))) return;`
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);

  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>(resolve => setPending({ ...options, resolve })), []);

  const answer = useCallback(
    (ok: boolean) => {
      pending?.resolve(ok);
      setPending(null);
    },
    [pending],
  );

  useEffect(() => {
    if (!pending) return;
    confirmButton.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && answer(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending, answer]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div className="v-modal-bg v-confirm-bg" onClick={() => answer(false)}>
          <div className="v-panel v-modal v-confirm" role="alertdialog" aria-modal="true" aria-label={pending.title} onClick={e => e.stopPropagation()}>
            <div className={`v-confirm-icon ${pending.danger ? 'danger' : ''}`} aria-hidden="true">{pending.danger ? '!' : '?'}</div>
            <h2 className="v-h2">{pending.title}</h2>
            {pending.message && <p className="v-muted">{pending.message}</p>}
            <div className="v-row" style={{ justifyContent: 'flex-end', marginTop: 18 }}>
              <button className="v-btn" onClick={() => answer(false)}>Cancel</button>
              <button ref={confirmButton} className={`v-btn ${pending.danger ? 'v-btn-danger-solid' : 'v-btn-primary'}`} onClick={() => answer(true)}>
                {pending.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside ConfirmProvider');
  return ctx;
}
