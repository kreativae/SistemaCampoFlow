'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

function OAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginWithTokens } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');

    if (!accessToken || !refreshToken) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError('Resposta de login inválida. Tente novamente.');
      return;
    }

    loginWithTokens(accessToken, refreshToken)
      .then(() => router.replace('/fazendas'))
      .catch(() => setError('Não foi possível concluir o login com Google.'));
  }, [searchParams, loginWithTokens, router]);

  return (
    <div className="text-center">
      {error ? (
        <>
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>
          <button
            onClick={() => router.replace('/entrar')}
            className="mt-4 text-sm font-semibold text-emerald-700 hover:text-emerald-900"
          >
            Voltar para o login
          </button>
        </>
      ) : (
        <p className="text-sm text-gray-400">Concluindo login...</p>
      )}
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <Suspense fallback={<p className="text-sm text-gray-400">Concluindo login...</p>}>
        <OAuthCallbackContent />
      </Suspense>
    </main>
  );
}
