'use client';

import { useEffect, useState } from 'react';
import { apiFetch, API_URL } from '@/lib/api';
import type { OAuthProvider } from '@/lib/types';

interface AvailableProvider {
  provider: OAuthProvider;
  label: string;
}

// Marcas de terceiros: o logo é parte da exigência de branding de Google e
// Microsoft, então vai inline em SVG (a CSP não permitiria carregar de CDN).
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

function MicrosoftMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#F25022" d="M0 0h8.5v8.5H0z" />
      <path fill="#7FBA00" d="M9.5 0H18v8.5H9.5z" />
      <path fill="#00A4EF" d="M0 9.5h8.5V18H0z" />
      <path fill="#FFB900" d="M9.5 9.5H18V18H9.5z" />
    </svg>
  );
}

const MARKS: Record<OAuthProvider, () => React.ReactElement> = {
  GOOGLE: GoogleMark,
  MICROSOFT: MicrosoftMark,
  APPLE: () => <span aria-hidden="true"></span>,
};

/**
 * Botões de login social. A lista vem da API: só aparece o provedor que o admin
 * configurou e habilitou, então a tela nunca oferece um caminho que vai falhar.
 */
export default function SocialLoginButtons() {
  const [providers, setProviders] = useState<AvailableProvider[]>([]);

  useEffect(() => {
    apiFetch<{ providers: AvailableProvider[] }>('/auth/oauth/provedores')
      .then((res) => setProviders(res.providers))
      .catch(() => setProviders([]));
  }, []);

  if (providers.length === 0) return null;

  return (
    <>
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <span className="h-px flex-1 bg-gray-200" />
        ou
        <span className="h-px flex-1 bg-gray-200" />
      </div>

      <div className="flex flex-col gap-2">
        {providers.map(({ provider, label }) => {
          const Mark = MARKS[provider];
          return (
            <a
              key={provider}
              href={`${API_URL}/auth/oauth/${provider.toLowerCase()}`}
              className="flex w-full items-center justify-center gap-2.5 rounded-full border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition-colors duration-150 hover:bg-gray-50"
            >
              <Mark />
              Entrar com {label}
            </a>
          );
        })}
      </div>
    </>
  );
}
