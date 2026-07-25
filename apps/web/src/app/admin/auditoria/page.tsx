'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import type { AuditLog, AuditLogListResponse } from '@/lib/types';

const METHOD_OPTIONS = ['POST', 'PATCH', 'PUT', 'DELETE'];

function methodBadgeClass(method: string) {
  if (method === 'DELETE') return 'bg-red-100 text-red-700';
  if (method === 'POST') return 'bg-emerald-100 text-emerald-800';
  return 'bg-gray-100 text-gray-600';
}

export default function AdminAuditPage() {
  const { accessToken } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const load = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (method) params.set('method', method);
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      const res = await apiFetch<AuditLogListResponse>(
        `/admin/auditoria?${params.toString()}`,
        { token: accessToken },
      );
      setLogs(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar auditoria');
    } finally {
      setFetching(false);
    }
  }, [accessToken, search, method, page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return (
    <main className="animate-fade-up mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-[-0.02em] text-gray-900">Auditoria</h1>
          <p className="text-sm text-gray-500">
            Registro de todas as ações que alteram dados (criação, edição, exclusão) —
            quem fez, o quê e quando.
          </p>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setSearch(searchInput.trim());
          }}
          className="flex flex-1 gap-2"
        >
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por e-mail do usuário ou caminho (path)"
            className="w-full max-w-md rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
          />
          <button
            type="submit"
            className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-emerald-800 active:scale-[0.98] disabled:opacity-50"
          >
            Buscar
          </button>
        </form>
        <select
          value={method}
          onChange={(e) => {
            setPage(1);
            setMethod(e.target.value);
          }}
          className="rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
        >
          <option value="">Todos os métodos</option>
          {METHOD_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      )}

      {fetching ? (
        <p className="text-sm text-gray-400">Carregando...</p>
      ) : logs.length === 0 ? (
        <div className="rounded-2xl bg-gray-100/60 px-6 py-14 text-center">
          <p className="text-lg font-bold text-gray-900">Nenhum registro encontrado.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200/70 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">
                <th className="px-4 py-3">Quando</th>
                <th className="hidden px-4 py-3 md:table-cell">Usuário</th>
                <th className="px-4 py-3">Método</th>
                <th className="px-4 py-3">Caminho</th>
                <th className="px-4 py-3">Status</th>
                <th className="hidden px-4 py-3 lg:table-cell">IP</th>
                <th className="hidden px-4 py-3 xl:table-cell">Dados</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t border-gray-100 transition-colors hover:bg-gray-50/70">
                  <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                    {new Date(log.createdAt).toLocaleString('pt-BR')}
                  </td>
                  <td className="hidden px-4 py-3 text-gray-700 md:table-cell">{log.userEmail ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${methodBadgeClass(log.method)}`}
                    >
                      {log.method}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{log.path}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        log.statusCode >= 400 ? 'text-red-600' : 'text-gray-600'
                      }
                    >
                      {log.statusCode}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 font-mono text-xs text-gray-500 lg:table-cell">
                    {log.ipAddress ?? '—'}
                  </td>
                  <td className="hidden max-w-xs truncate px-4 py-3 font-mono text-xs text-gray-500 xl:table-cell" title={log.requestBody ? JSON.stringify(log.requestBody) : ''}>
                    {log.requestBody ? JSON.stringify(log.requestBody).slice(0, 80) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
          <span>
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} de {total}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-full bg-gray-900/5 px-4 py-2 text-sm font-semibold text-gray-800 transition-colors duration-150 hover:bg-gray-900/10 disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={page * pageSize >= total}
              className="rounded-full bg-gray-900/5 px-4 py-2 text-sm font-semibold text-gray-800 transition-colors duration-150 hover:bg-gray-900/10 disabled:opacity-40"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
