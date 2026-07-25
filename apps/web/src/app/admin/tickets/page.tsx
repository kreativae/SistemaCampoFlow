'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import type { Ticket, TicketPriority, TicketStatus } from '@/lib/types';

const STATUS_OPTIONS: { value: TicketStatus | 'TODOS'; label: string }[] = [
  { value: 'TODOS', label: 'Todos' },
  { value: 'ABERTO', label: 'Aberto' },
  { value: 'EM_ANDAMENTO', label: 'Em andamento' },
  { value: 'RESOLVIDO', label: 'Resolvido' },
  { value: 'FECHADO', label: 'Fechado' },
];

const STATUS_LABEL: Record<TicketStatus, string> = {
  ABERTO: 'Aberto',
  EM_ANDAMENTO: 'Em andamento',
  RESOLVIDO: 'Resolvido',
  FECHADO: 'Fechado',
};

const STATUS_BADGE: Record<TicketStatus, string> = {
  ABERTO: 'bg-amber-100 text-amber-800',
  EM_ANDAMENTO: 'bg-emerald-600/10 text-emerald-800',
  RESOLVIDO: 'bg-emerald-100 text-emerald-800',
  FECHADO: 'bg-gray-100 text-gray-600',
};

const PRIORITY_LABEL: Record<TicketPriority, string> = {
  BAIXA: 'Baixa',
  MEDIA: 'Média',
  ALTA: 'Alta',
};

const PRIORITY_BADGE: Record<TicketPriority, string> = {
  BAIXA: 'bg-gray-100 text-gray-600',
  MEDIA: 'bg-amber-100 text-amber-800',
  ALTA: 'bg-red-100 text-red-700',
};

function relativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `há ${days} dia(s)`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

export default function AdminTicketsPage() {
  const { accessToken } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [allTickets, setAllTickets] = useState<Ticket[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'TODOS'>('TODOS');

  const loadTickets = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const data = await apiFetch<Ticket[]>('/admin/tickets', { token: accessToken });
      setAllTickets(data);
      setTickets(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar tickets');
    } finally {
      setFetching(false);
    }
  }, [accessToken]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTickets();
  }, [loadTickets]);

  const filtered =
    statusFilter === 'TODOS' ? tickets : tickets.filter((t) => t.status === statusFilter);

  const countByStatus = (status: TicketStatus | 'TODOS') =>
    status === 'TODOS' ? allTickets.length : allTickets.filter((t) => t.status === status).length;

  return (
    <main className="animate-fade-up mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <header className="mb-6">
        <h1 className="text-[28px] font-bold tracking-[-0.02em] text-gray-900">Tickets de suporte</h1>
        <p className="text-sm text-gray-500">Tickets de todas as contas da plataforma.</p>
      </header>

      {/* Chips de status com contadores */}
      <div className="mb-6 flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((opt) => {
          const active = statusFilter === opt.value;
          const count = countByStatus(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatusFilter(opt.value)}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors duration-150 ${
                active
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-900/5 text-gray-600 hover:bg-gray-900/10'
              }`}
            >
              {opt.label}
              <span
                className={`rounded-full px-1.5 text-xs font-semibold ${
                  active ? 'bg-white/20 text-white' : 'bg-gray-900/10 text-gray-500'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      )}

      {fetching ? (
        <p className="text-sm text-gray-400">Carregando...</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl bg-gray-100/60 px-6 py-14 text-center">
          <p className="text-lg font-bold text-gray-900">Nenhum ticket encontrado</p>
          <p className="mt-1 text-sm text-gray-500">
            {statusFilter === 'TODOS'
              ? 'Quando os clientes abrirem tickets, eles aparecem aqui.'
              : 'Nenhum ticket com esse status.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((ticket) => (
            <Link
              key={ticket.id}
              href={`/admin/tickets/${ticket.id}`}
              className="block rounded-2xl border border-gray-200/70 bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_10px_30px_-12px_rgba(6,30,20,0.15)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-900">{ticket.subject}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {ticket.account.name} · atualizado {relativeTime(ticket.updatedAt)}
                    {ticket.messages?.length ? ` · ${ticket.messages.length} mensagem(ns)` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${PRIORITY_BADGE[ticket.priority]}`}
                  >
                    {PRIORITY_LABEL[ticket.priority]}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[ticket.status]}`}
                  >
                    {STATUS_LABEL[ticket.status]}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
