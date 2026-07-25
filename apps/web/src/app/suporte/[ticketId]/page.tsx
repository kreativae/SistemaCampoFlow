'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
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

export default function SupportTicketPage() {
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();
  const params = useParams<{ ticketId: string }>();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const loadTicket = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const data = await apiFetch<Ticket>(`/suporte/${params.ticketId}`, {
        token: accessToken,
      });
      setTicket(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar ticket');
    } finally {
      setFetching(false);
    }
  }, [accessToken, params.ticketId]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/entrar');
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTicket();
  }, [loading, user, loadTicket, router]);

  async function handleReply(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setError(null);
    try {
      const updated = await apiFetch<Ticket>(`/suporte/${params.ticketId}/mensagens`, {
        method: 'POST',
        token: accessToken,
        body: { message: reply },
      });
      setTicket(updated);
      setReply('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao enviar resposta');
    } finally {
      setSending(false);
    }
  }

  if (loading || !user || fetching) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-gray-400">Carregando...</p>
      </main>
    );
  }

  if (!ticket) {
    return (
      <main className="animate-fade-up mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error ?? 'Ticket não encontrado.'}</p>
        <Link href="/suporte" className="mt-4 inline-block text-sm font-semibold text-emerald-700 hover:text-emerald-900">
          Voltar para Suporte
        </Link>
      </main>
    );
  }

  const closed = ticket.status === 'FECHADO' || ticket.status === 'RESOLVIDO';

  return (
    <main className="animate-fade-up mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <header className="mb-6">
        <Link href="/suporte" className="text-sm font-semibold text-emerald-700 hover:text-emerald-900">
          ← Voltar para Suporte
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-[28px] font-bold tracking-[-0.02em] text-gray-900">{ticket.subject}</h1>
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[ticket.status]}`}>
            {STATUS_LABEL[ticket.status]}
          </span>
        </div>
      </header>

      {error && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      )}

      <ul className="mb-6 space-y-3">
        {ticket.messages.map((msg) => (
          <li
            key={msg.id}
            className={`max-w-[85%] rounded-2xl px-4 py-3 ${
              msg.fromStaff
                ? 'bg-emerald-50 text-emerald-900'
                : 'ml-auto bg-gray-100 text-gray-900'
            }`}
          >
            <p className="mb-1 text-xs font-medium text-gray-500">
              {msg.fromStaff ? `${msg.author.name} (CampoFlow)` : msg.author.name} ·{' '}
              {new Date(msg.createdAt).toLocaleString('pt-BR')}
            </p>
            <p className="whitespace-pre-wrap text-sm">{msg.message}</p>
          </li>
        ))}
      </ul>

      {closed ? (
        <p className="text-sm text-gray-500">
          Este ticket está {STATUS_LABEL[ticket.status].toLowerCase()} e não recebe novas respostas.
        </p>
      ) : (
        <form onSubmit={handleReply} className="space-y-3">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Escreva sua resposta"
            required
            rows={3}
            className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
          />
          <button
            type="submit"
            disabled={sending}
            className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-emerald-800 active:scale-[0.98] disabled:opacity-50"
          >
            {sending ? 'Enviando...' : 'Responder'}
          </button>
        </form>
      )}
    </main>
  );
}
