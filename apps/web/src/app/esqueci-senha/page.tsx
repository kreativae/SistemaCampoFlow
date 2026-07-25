'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { apiFetch, ApiError } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch('/auth/esqueci-senha', {
        method: 'POST',
        body: { email },
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao solicitar redefinição de senha');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="animate-fade-up w-full max-w-sm space-y-4 rounded-2xl border border-gray-200/70 bg-white p-6">
        <div>
          <h1 className="text-3xl font-bold tracking-[-0.02em] text-gray-900">CampoFlow</h1>
          <p className="text-sm text-gray-500">Esqueci minha senha</p>
        </div>

        {sent ? (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800" role="status">
            Se o e-mail informado estiver cadastrado, você receberá instruções para redefinir
            a senha em breve.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-gray-500">
              Informe o e-mail da sua conta e enviaremos um link para você criar uma nova senha.
            </p>

            {error && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
                {error}
              </p>
            )}

            <div className="space-y-1">
              <label htmlFor="email" className="text-sm font-medium text-gray-700">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-emerald-800 active:scale-[0.98] disabled:opacity-50"
            >
              {submitting ? 'Enviando...' : 'Enviar link de redefinição'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-gray-500">
          <Link href="/entrar" className="font-semibold text-emerald-700 hover:text-emerald-900">
            Voltar para o login
          </Link>
        </p>
      </div>
    </main>
  );
}
