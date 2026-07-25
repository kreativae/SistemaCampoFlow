'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';

function AcceptInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const { user, accessToken, loading } = useAuth();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleAccept() {
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/convites/aceitar', {
        method: 'POST',
        token: accessToken,
        body: { token },
      });
      setDone(true);
      setTimeout(() => router.replace('/fazendas'), 1500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao aceitar convite');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-400">Carregando...</p>;
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-gray-200/70 bg-white p-8">
        <div>
          <h1 className="text-3xl font-bold tracking-[-0.02em] text-gray-900">CampoFlow</h1>
          <p className="text-sm text-gray-500">Convite para colaborar</p>
        </div>

        {!token ? (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
            Link de convite inválido.
          </p>
        ) : done ? (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800" role="status">
            Convite aceito! Redirecionando...
          </p>
        ) : !user ? (
          <>
            <p className="text-sm text-gray-500">
              Entre ou crie uma conta com o e-mail para o qual o convite foi enviado e depois
              volte a este link para aceitar.
            </p>
            {error && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <Link
                href="/entrar"
                className="flex-1 rounded-full bg-emerald-700 px-5 py-2.5 text-center text-sm font-semibold text-white transition-all duration-150 hover:bg-emerald-800 active:scale-[0.98]"
              >
                Entrar
              </Link>
              <Link
                href="/cadastrar"
                className="flex-1 rounded-full bg-gray-900/5 px-5 py-2.5 text-center text-sm font-semibold text-gray-800 transition-colors duration-150 hover:bg-gray-900/10"
              >
                Cadastrar-se
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-500">
              Você está conectado como <strong>{user.email}</strong>. Clique abaixo para aceitar
              o convite com esta conta.
            </p>
            {error && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
                {error}
              </p>
            )}
            <button
              onClick={handleAccept}
              disabled={submitting}
              className="w-full rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-emerald-800 active:scale-[0.98] disabled:opacity-50"
            >
              {submitting ? 'Aceitando...' : 'Aceitar convite'}
            </button>
          </>
        )}
      </div>
    </main>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 items-center justify-center">
          <p className="text-sm text-gray-400">Carregando...</p>
        </main>
      }
    >
      <AcceptInviteContent />
    </Suspense>
  );
}
