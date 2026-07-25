'use client';

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** If set, the user must type this exact text into a field before confirming. */
  requireText?: string;
  requireTextLabel?: string;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | undefined>(undefined);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [typedText, setTypedText] = useState('');
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setTypedText('');
      setPending({ ...options, resolve });
    });
  }, []);

  function handleClose(result: boolean) {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setPending(null);
    setTypedText('');
  }

  const textMatches = !pending?.requireText || typedText === pending.requireText;

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {pending && (
        <div className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-gray-950/35 px-4 backdrop-blur-[3px]">
          <div className="animate-fade-up w-full max-w-md rounded-3xl bg-white p-7 shadow-[0_24px_60px_-16px_rgba(6,30,20,0.28)] ring-1 ring-gray-950/5">
            <h2
              className={`text-lg font-bold tracking-tight ${pending.danger ? 'text-red-700' : 'text-gray-900'}`}
            >
              {pending.title}
            </h2>
            <p className="mt-2 whitespace-pre-line text-sm text-gray-600">{pending.message}</p>

            {pending.requireText && (
              <div className="mt-4">
                <label className="text-xs font-medium text-gray-600">
                  {pending.requireTextLabel ??
                    `Digite "${pending.requireText}" para confirmar`}
                </label>
                <input
                  type="text"
                  autoFocus
                  value={typedText}
                  onChange={(e) => setTypedText(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10"
                />
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => handleClose(false)}
                className="rounded-full bg-gray-900/5 px-5 py-2.5 text-sm font-semibold text-gray-800 transition-colors duration-150 hover:bg-gray-900/10"
              >
                {pending.cancelLabel ?? 'Cancelar'}
              </button>
              <button
                type="button"
                disabled={!textMatches}
                onClick={() => handleClose(true)}
                className={`rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-150 disabled:opacity-50 ${
                  pending.danger
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-emerald-700 hover:bg-emerald-800'
                }`}
              >
                {pending.confirmLabel ?? 'Confirmar'}
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
  if (!ctx) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return ctx.confirm;
}
