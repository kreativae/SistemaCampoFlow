'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import type { Ticket, TicketPriority, TicketStatus } from '@/lib/types';

const STATUS_OPTIONS: { value: TicketStatus; label: string }[] = [
  { value: 'ABERTO', label: 'Aberto' },
  { value: 'EM_ANDAMENTO', label: 'Em andamento' },
  { value: 'RESOLVIDO', label: 'Resolvido' },
  { value: 'FECHADO', label: 'Fechado' },
];

const STATUS_BADGE: Record<TicketStatus, string> = {
  ABERTO: 'bg-amber-100 text-amber-800',
  EM_ANDAMENTO: 'bg-emerald-600/10 text-emerald-800',
  RESOLVIDO: 'bg-emerald-100 text-emerald-800',
  FECHADO: 'bg-gray-100 text-gray-600',
};

const PRIORITY_LABEL: Record<TicketPriority, string> = {
  BAIXA: 'Prioridade baixa',
  MEDIA: 'Prioridade média',
  ALTA: 'Prioridade alta',
};

const PRIORITY_BADGE: Record<TicketPriority, string> = {
  BAIXA: 'bg-gray-100 text-gray-600',
  MEDIA: 'bg-amber-100 text-amber-800',
  ALTA: 'bg-red-100 text-red-700',
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

export default function AdminTicketPage() {
  const { accessToken } = useAuth();
  const params = useParams<{ ticketId: string }>();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const loadTicket = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const data = await apiFetch<Ticket>(`/admin/tickets/${params.ticketId}`, {
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTicket();
  }, [loadTicket]);

  async function handleReply(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setError(null);
    try {
      const updated = await apiFetch<Ticket>(
        `/admin/tickets/${params.ticketId}/mensagens`,
        { method: 'POST', token: accessToken, body: { message: reply } },
      );
      setTicket(updated);
      setReply('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao enviar resposta');
    } finally {
      setSending(false);
    }
  }

  async function handleStatusChange(status: TicketStatus) {
    setUpdatingStatus(true);
    setError(null);
    try {
      const updated = await apiFetch<Ticket>(`/admin/tickets/${params.ticketId}/status`, {
        method: 'PATCH',
        token: accessToken,
        body: { status },
      });
      setTicket(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar status');
    } finally {
      setUpdatingStatus(false);
    }
  }

  if (fetching) {
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
      </main>
    );
  }

  const isClosed = ticket.status === 'RESOLVIDO' || ticket.status === 'FECHADO';

  return (
    <main className="animate-fade-up mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <Link href="/admin/tickets" className="text-sm font-semibold text-emerald-700 hover:text-emerald-900">
        ← Voltar para Tickets
      </Link>

      {/* Cabeçalho do ticket */}
      <header className="mt-3 mb-6 rounded-2xl border border-gray-200/70 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-xl font-bold tracking-[-0.02em] text-gray-900 sm:text-[28px]">
              {ticket.subject}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${PRIORITY_BADGE[ticket.priority]}`}
              >
                {PRIORITY_LABEL[ticket.priority]}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[ticket.status]}`}
              >
                {STATUS_OPTIONS.find((s) => s.value === ticket.status)?.label}
              </span>
            </div>
          </div>
          <label className="shrink-0 text-sm font-medium text-gray-700">
            Alterar status
            <select
              value={ticket.status}
              disabled={updatingStatus}
              onChange={(e) => handleStatusChange(e.target.value as TicketStatus)}
              className="mt-1 block rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-normal text-gray-900 transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 border-t border-gray-100 pt-3 text-sm text-gray-600 sm:grid-cols-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">Conta</p>
            <p className="truncate">{ticket.account.name}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">E-mail</p>
            <p className="truncate">{ticket.account.billingEmail}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">Aberto por</p>
            <p className="truncate">{ticket.createdBy.name}</p>
          </div>
        </div>
      </header>

      {error && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      )}

      {/* Conversa */}
      <ul className="mb-6 space-y-4">
        {ticket.messages.map((msg) => (
          <li key={msg.id} className={`flex gap-2.5 ${msg.fromStaff ? 'flex-row-reverse' : ''}`}>
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                msg.fromStaff ? 'bg-emerald-700 text-white' : 'bg-gray-200 text-gray-600'
              }`}
              title={msg.author.name}
            >
              {initials(msg.author.name)}
            </span>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.fromStaff
                  ? 'rounded-tr-sm bg-emerald-700 text-white'
                  : 'rounded-tl-sm bg-white text-gray-900 ring-1 ring-gray-200'
              }`}
            >
              <p
                className={`mb-1 text-xs font-medium ${
                  msg.fromStaff ? 'text-emerald-100' : 'text-gray-500'
                }`}
              >
                {msg.author.name}
                {msg.fromStaff ? ' · Equipe CampoFlow' : ''} ·{' '}
                {new Date(msg.createdAt).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
              <p className="whitespace-pre-wrap text-sm">{msg.message}</p>
            </div>
          </li>
        ))}
      </ul>

      {/* Resposta */}
      <form
        onSubmit={handleReply}
        className="rounded-2xl border border-gray-200/70 bg-white p-5"
      >
        {isClosed && (
          <p className="mb-3 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            Este ticket está {ticket.status === 'RESOLVIDO' ? 'resolvido' : 'fechado'}. Responder
            reabre a conversa para o cliente.
          </p>
        )}
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Responder como equipe CampoFlow..."
          required
          rows={3}
          className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
        />
        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-xs text-gray-400">
            A resposta é enviada em nome da equipe CampoFlow.
          </p>
          <button
            type="submit"
            disabled={sending || !reply.trim()}
            className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:bg-emerald-800 active:scale-[0.98] disabled:opacity-50"
          >
            {sending ? 'Enviando...' : 'Responder'}
          </button>
        </div>
      </form>
    </main>
  );
}
