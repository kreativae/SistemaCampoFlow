'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Leaf } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import GoogleLoginButton from '@/components/GoogleLoginButton';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(email, password, name);
      router.replace('/fazendas');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao cadastrar');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="animate-fade-up w-full max-w-sm space-y-4 rounded-2xl border border-gray-200/70 bg-white p-8"
      >
        <div className="space-y-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-sm shadow-emerald-700/25">
            <Leaf size={22} strokeWidth={2} className="text-white" />
          </span>
          <div>
            <h1 className="text-3xl font-bold tracking-[-0.02em] text-gray-900">CampoFlow</h1>
            <p className="text-sm text-gray-500">Crie sua conta</p>
          </div>
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
            {error}
          </p>
        )}

        <div className="space-y-1">
          <label htmlFor="name" className="text-sm font-medium text-gray-700">
            Nome
          </label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
          />
        </div>

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

        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium text-gray-700">
            Senha
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            pattern="(?=.*[A-Za-z])(?=.*\d).+"
            title="Pelo menos 8 caracteres, incluindo letras e números"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
          />
          <p className="text-xs text-gray-400">Pelo menos 8 caracteres, incluindo letras e números.</p>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-emerald-800 active:scale-[0.98] disabled:opacity-50"
        >
          {submitting ? 'Cadastrando...' : 'Cadastrar'}
        </button>

        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="h-px flex-1 bg-gray-200" />
          ou
          <span className="h-px flex-1 bg-gray-200" />
        </div>

        <GoogleLoginButton />

        <p className="text-center text-sm text-gray-500">
          Já tem conta?{' '}
          <Link href="/entrar" className="font-semibold text-emerald-700 hover:text-emerald-900">
            Entrar
          </Link>
        </p>
      </form>
    </main>
  );
}
