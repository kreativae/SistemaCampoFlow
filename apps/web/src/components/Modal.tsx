'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Overlay de modal renderizado via portal direto no <body>, garantindo que o
 * position:fixed sempre se ancore à viewport — imune a ancestrais com
 * transform/filter (ex.: animações de entrada das páginas).
 * Também trava o scroll do body enquanto estiver aberto.
 */
export default function Modal({
  onClose,
  children,
  maxWidth = 'max-w-lg',
}: {
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-gray-950/35 px-4 backdrop-blur-[3px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`animate-fade-up flex max-h-[90vh] w-full ${maxWidth} flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_-16px_rgba(6,30,20,0.28)] ring-1 ring-gray-950/5`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
