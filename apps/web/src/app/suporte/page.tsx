'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import type { Ticket } from '@/lib/types';

const STATUS_LABEL: Record<Ticket['status'], string> = {
  ABERTO: 'Aberto',
  EM_ANDAMENTO: 'Em andamento',
  RESOLVIDO: 'Resolvido',
  FECHADO: 'Fechado',
};

const STATUS_BADGE: Record<Ticket['status'], string> = {
  ABERTO: 'bg-amber-100 text-amber-800',
  EM_ANDAMENTO: 'bg-emerald-100 text-emerald-800',
  RESOLVIDO: 'bg-emerald-100 text-emerald-800',
  FECHADO: 'bg-gray-100 text-gray-600',
};

export default function SupportPage() {
  const { user, accessToken, loading, logout } = useAuth();
  const router = useRouter();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<Ticket['priority']>('MEDIA');
  const [creating, setCreating] = useState(false);

  const loadTickets = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const data = await apiFetch<Ticket[]>('/suporte', { token: accessToken });
      setTickets(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar tickets');
    } finally {
      setFetching(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/entrar');
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTickets();
  }, [loading, user, loadTickets, router]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await apiFetch<Ticket>('/suporte', {
        method: 'POST',
        token: accessToken,
        body: { subject, message, priority },
      });
      setSubject('');
      setMessage('');
      setPriority('MEDIA');
      await loadTickets();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao abrir ticket');
    } finally {
      setCreating(false);
    }
  }

  if (loading || !user) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-gray-400">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="animate-fade-up mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-[-0.02em] text-gray-900">Suporte</h1>
          <p className="text-sm text-gray-500">Olá, {user.name}</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/fazendas" className="text-sm font-semibold text-emerald-700 hover:text-emerald-900">
            Painel
          </Link>
          <button
            onClick={logout}
            className="text-sm font-semibold text-gray-600 hover:text-gray-900"
          >
            Sair
          </button>
        </div>
      </header>

      {error && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      )}

      <form onSubmit={handleCreate} className="mb-8 space-y-3 rounded-2xl border border-gray-200/70 bg-white p-5">
        <h2 className="text-sm font-bold tracking-tight text-gray-700">Abrir novo ticket</h2>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Assunto"
          required
          className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Descreva o problema ou dúvida"
          required
          rows={3}
          className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
        />
        <div className="flex items-center justify-between">
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Ticket['priority'])}
            className="rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
          >
            <option value="BAIXA">Prioridade baixa</option>
            <option value="MEDIA">Prioridade média</option>
            <option value="ALTA">Prioridade alta</option>
          </select>
          <button
            type="submit"
            disabled={creating}
            className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-emerald-800 active:scale-[0.98] disabled:opacity-50"
          >
            {creating ? 'Enviando...' : 'Abrir ticket'}
          </button>
        </div>
      </form>

      <h2 className="mb-3 text-sm font-bold tracking-tight text-gray-700">Meus tickets</h2>
      {fetching ? (
        <p className="text-sm text-gray-400">Carregando...</p>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl bg-gray-100/60 px-6 py-14 text-center">
          <p className="text-lg font-bold text-gray-900">Nenhum ticket de suporte</p>
          <p className="mt-1 text-sm text-gray-500">Abra um chamado acima para tirar dúvidas ou reportar problemas.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <Link
                href={`/suporte/${ticket.id}`}
                className="flex items-center justify-between rounded-2xl border border-gray-200/70 bg-white px-5 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_10px_30px_-12px_rgba(6,30,20,0.15)]"
              >
                <div>
                  <p className="font-medium text-gray-900">{ticket.subject}</p>
                  <p className="text-xs text-gray-400">
                    Atualizado em {new Date(ticket.updatedAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[ticket.status]}`}
                >
                  {STATUS_LABEL[ticket.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
