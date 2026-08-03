'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Alterna entre a lista recortada e a lista completa.
 *
 * Padrão do sistema: listas longas de registro (pesagens, histórico, movimentações)
 * mostram só os mais recentes e escondem o resto atrás deste botão — a página serve
 * para ler o estado atual, não para varrer o passado inteiro.
 */
export default function ShowMoreButton({
  expanded,
  hiddenCount,
  onToggle,
  noun = 'registros',
  feminine = false,
}: {
  expanded: boolean;
  /** Quantos itens estão escondidos. O botão não aparece quando é zero. */
  hiddenCount: number;
  onToggle: () => void;
  /** Substantivo no plural, ex.: "pesagens", "movimentações". */
  noun?: string;
  /** Concorda o "outros/outras" com o gênero do substantivo. */
  feminine?: boolean;
}) {
  if (hiddenCount <= 0) return null;

  return (
    <button
      type="button"
      onClick={onToggle}
      className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gray-900/5 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors duration-150 hover:bg-gray-900/10"
    >
      {expanded ? (
        <>
          <ChevronUp size={15} strokeWidth={2.2} />
          Mostrar menos
        </>
      ) : (
        <>
          <ChevronDown size={15} strokeWidth={2.2} />
          Ver {feminine ? 'outras' : 'outros'} {hiddenCount} {noun}
        </>
      )}
    </button>
  );
}
