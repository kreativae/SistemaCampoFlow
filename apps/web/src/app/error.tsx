'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[CampoFlow] Erro não tratado:', error);
  }, [error]);

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="rounded-2xl border border-gray-200/70 bg-white p-6">
        <h2 className="text-xl font-bold tracking-tight text-gray-900">Algo deu errado</h2>
        <p className="mt-2 text-sm text-gray-500">
          Ocorreu um erro inesperado. Tente novamente ou volte para a página inicial.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-emerald-800 active:scale-[0.98] disabled:opacity-50"
          >
            Tentar novamente
          </button>
          <a
            href="/fazendas"
            className="rounded-full bg-gray-900/5 px-5 py-2.5 text-sm font-semibold text-gray-800 transition-colors duration-150 hover:bg-gray-900/10"
          >
            Voltar ao início
          </a>
        </div>
      </div>
    </main>
  );
}
