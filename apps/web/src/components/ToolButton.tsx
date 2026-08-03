'use client';

import type { LucideIcon } from 'lucide-react';

/**
 * Ação secundária do cabeçalho de uma página de módulo.
 *
 * Só ícone, em tinta neutra, para não competir com o botão primário de novo
 * registro (emerald sólido). Serve para ferramentas de consulta pontual —
 * calculadoras, históricos, comparativos — que não devem ocupar a página
 * permanentemente.
 *
 * O rótulo vira aria-label e tooltip, já que o botão não tem texto visível.
 */
export default function ToolButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-900/5 text-gray-700 transition-colors duration-150 hover:bg-gray-900/10 hover:text-gray-900"
    >
      <Icon size={19} strokeWidth={1.9} />
    </button>
  );
}
