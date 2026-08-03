'use client';

import type { ReactNode } from 'react';
import { X, type LucideIcon } from 'lucide-react';
import Modal from './Modal';

/**
 * Casca padrão dos modais de cadastro/edição: cabeçalho fixo com chip de ícone,
 * título e fechar; corpo rolável.
 *
 * O corpo rola sozinho (o Modal já limita a altura em 90vh), então formulários
 * longos — venda de grãos, por exemplo — não empurram o cabeçalho para fora da tela.
 */
export default function FormModal({
  icon: Icon,
  title,
  subtitle,
  onClose,
  children,
  maxWidth = 'max-w-2xl',
}: {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
}) {
  return (
    <Modal onClose={onClose} maxWidth={maxWidth}>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-6 py-4">
        <div className="flex min-w-0 items-center gap-3">
          {Icon && (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-700">
              <Icon size={19} strokeWidth={1.9} />
            </span>
          )}
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold tracking-tight text-gray-900">{title}</h2>
            {subtitle && <p className="truncate text-xs text-gray-500">{subtitle}</p>}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="shrink-0 rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
        >
          <X size={18} strokeWidth={2} />
        </button>
      </div>
      <div className="overflow-y-auto px-6 py-5">{children}</div>
    </Modal>
  );
}
