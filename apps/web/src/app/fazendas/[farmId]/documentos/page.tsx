'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FileText, Upload } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, apiUpload, apiDownload, ApiError } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import type { DocumentCategory, FarmDocument } from '@/lib/types';

const CATEGORY_OPTIONS: { value: DocumentCategory; label: string }[] = [
  { value: 'GTA', label: 'GTA' },
  { value: 'NFE', label: 'NF-e' },
  { value: 'CONTRATO', label: 'Contrato' },
  { value: 'EXAME', label: 'Exame' },
  { value: 'CERTIFICADO', label: 'Certificado' },
  { value: 'OUTRO', label: 'Outro' },
];

function categoryLabel(category: DocumentCategory) {
  return CATEGORY_OPTIONS.find((opt) => opt.value === category)?.label ?? category;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const { user, accessToken, loading } = useAuth();
  const { toastSuccess } = useToast();
  const router = useRouter();

  const [documents, setDocuments] = useState<FarmDocument[]>([]);
  // No mobile o formulário começa fechado para não empurrar a lista.
  const [showCreateMobile, setShowCreateMobile] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [category, setCategory] = useState<DocumentCategory>('GTA');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [docFilter, setDocFilter] = useState<'day' | 'week' | 'month' | 'year' | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<DocumentCategory | ''>('');

  const filteredDocuments = useMemo(() => {
    let result = documents;
    if (categoryFilter) {
      result = result.filter((d) => d.category === categoryFilter);
    }
    if (docFilter === 'all') return result;
    const now = new Date();
    const start = new Date(now);
    if (docFilter === 'day') {
      start.setHours(0, 0, 0, 0);
    } else if (docFilter === 'week') {
      const day = now.getDay();
      start.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
      start.setHours(0, 0, 0, 0);
    } else if (docFilter === 'month') {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    } else {
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
    }
    return result.filter((d) => new Date(d.createdAt) >= start);
  }, [documents, docFilter, categoryFilter]);

  const loadData = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const data = await apiFetch<FarmDocument[]>(`/fazendas/${farmId}/documentos`, {
        token: accessToken,
      });
      setDocuments(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar documentos');
    } finally {
      setFetching(false);
    }
  }, [farmId, accessToken]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/entrar');
      return;
    }
    // Fetching data on mount via an async callback is the intended pattern here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loading, user, loadData, router]);

  async function handleUpload(event: FormEvent) {
    event.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError('Selecione um arquivo');
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('category', category);
      formData.append('file', file);
      await apiUpload(`/fazendas/${farmId}/documentos`, formData, accessToken);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setSelectedFileName('');
      await loadData();
      toastSuccess('Documento enviado.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao enviar documento');
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(doc: FarmDocument) {
    setError(null);
    try {
      await apiDownload(`/fazendas/${farmId}/documentos/${doc.id}/baixar`, doc.fileName, accessToken);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao baixar documento');
    }
  }

  async function handleDelete(documentId: string) {
    setError(null);
    try {
      await apiFetch(`/fazendas/${farmId}/documentos/${documentId}`, {
        method: 'DELETE',
        token: accessToken,
      });
      await loadData();
      toastSuccess('Documento excluído.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir documento');
    }
  }

  if (loading || !user || fetching) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-gray-400">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="animate-fade-up mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8">
      <PageHeader
        icon={FileText}
        title="Documentos"
        subtitle="Arquivos da propriedade"
        backHref={`/fazendas/${farmId}`}
      />

      {error && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => setShowCreateMobile((v) => !v)}
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600/10 px-5 py-2.5 text-sm font-semibold text-emerald-800 transition-colors duration-150 hover:bg-emerald-600/20 sm:hidden"
      >
        {showCreateMobile ? 'Fechar formulário' : '+ Enviar documento'}
      </button>
      <form
        onSubmit={handleUpload}
        className={`${showCreateMobile ? 'flex' : 'hidden'} mb-8 flex-wrap items-end gap-3 rounded-2xl border border-gray-200/70 bg-white p-5 sm:flex`}
      >
        <div>
          <label className="text-sm font-medium text-gray-700">Categoria</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as DocumentCategory)}
            className="mt-1 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10 disabled:bg-gray-50 disabled:text-gray-400"
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label className="text-sm font-medium text-gray-700">Arquivo</label>
          <input
            ref={fileInputRef}
            type="file"
            required
            className="hidden"
            onChange={(e) => setSelectedFileName(e.target.files?.[0]?.name ?? '')}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-1 flex w-full items-center gap-2 rounded-xl border border-dashed border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-500 transition-all duration-150 hover:border-emerald-400 hover:bg-emerald-50/40"
          >
            <Upload size={15} className="shrink-0 text-gray-400" />
            {selectedFileName || 'Escolher arquivo...'}
          </button>
        </div>

        <button
          type="submit"
          disabled={uploading}
          className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-emerald-800 active:scale-[0.98] disabled:opacity-50"
        >
          {uploading ? 'Enviando...' : 'Enviar documento'}
        </button>
      </form>

      {documents.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <h2 className="font-bold tracking-tight text-gray-900">Documentos</h2>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as DocumentCategory | '')}
              className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm transition-all duration-150 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-600/10"
            >
              <option value="">Todas as categorias</option>
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-1">
            {([['day', 'Dia'], ['week', 'Semana'], ['month', 'Mês'], ['year', 'Ano'], ['all', 'Todos']] as const).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setDocFilter(val)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150 ${
                  docFilter === val
                    ? 'bg-emerald-700 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {filteredDocuments.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl bg-gray-100/60 px-6 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-700">
            <FileText size={22} />
          </div>
          <p className="mt-3 text-lg font-bold text-gray-900">
            {documents.length === 0 ? 'Nenhum documento enviado' : 'Nenhum documento no período'}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {documents.length === 0
              ? 'Envie notas fiscais, laudos, contratos e outros arquivos da propriedade.'
              : 'Altere o filtro para ver outros documentos.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filteredDocuments.map((doc) => (
            <li
              key={doc.id}
              className="flex flex-col gap-2 rounded-2xl border border-gray-200/70 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-gray-900">{doc.fileName}</p>
                <p className="text-sm text-gray-500">
                  {categoryLabel(doc.category)} · {formatSize(doc.fileSize)} ·{' '}
                  {new Date(doc.createdAt).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <div className="flex shrink-0 gap-3">
                <button
                  onClick={() => handleDownload(doc)}
                  className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
                >
                  Baixar
                </button>
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="text-sm font-semibold text-red-600 hover:text-red-800"
                >
                  Excluir
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
