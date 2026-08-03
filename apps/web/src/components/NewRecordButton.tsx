'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus } from 'lucide-react';

/**
 * Gatilho padrão de "novo registro" das páginas de módulo.
 *
 * Renderiza duas affordances para a mesma ação, cada uma onde é esperada:
 * - Desktop: botão rotulado no topo à direita (slot `actions` do PageHeader).
 * - Mobile: botão flutuante "+" no canto inferior direito, ao alcance do polegar.
 *
 * O flutuante é enviado por portal ao <body> para que o `position: fixed` se ancore
 * na viewport mesmo quando o componente é usado dentro do cabeçalho — que tem
 * ancestrais com transform (animate-fade-up) capazes de quebrar o fixed.
 *
 * z-30 o mantém abaixo do drawer de navegação (z-40) e dos modais (z-50).
 */
export default function NewRecordButton({
  label,
  onClick,
  disabled = false,
}: {
  /** Rótulo da ação, ex.: "Novo insumo". Também vira o aria-label do flutuante. */
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="hidden items-center gap-1.5 rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-emerald-800 active:scale-[0.98] disabled:opacity-50 md:inline-flex"
      >
        <Plus size={16} strokeWidth={2.4} />
        {label}
      </button>

      {mounted &&
        createPortal(
          <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            className="fixed bottom-5 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-700 text-white shadow-[0_12px_28px_-8px_rgba(6,30,20,0.45)] transition-all duration-150 hover:bg-emerald-800 active:scale-95 disabled:opacity-50 md:hidden"
          >
            <Plus size={26} strokeWidth={2.4} />
          </button>,
          document.body,
        )}
    </>
  );
}
