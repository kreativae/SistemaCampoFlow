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
      <div className="rounded-2xl border border-gray-200/80 bg-white p-8 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">Algo deu errado</h2>
        <p className="mt-2 text-sm text-gray-500">
          Ocorreu um erro inesperado. Tente novamente ou volte para a página inicial.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-800"
          >
            Tentar novamente
          </button>
          <a
            href="/fazendas"
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            Voltar ao início
          </a>
        </div>
      </div>
    </main>
  );
}
