'use client';

import { useEffect, useState } from 'react';
import { apiFetch, API_URL } from '@/lib/api';

export default function GoogleLoginButton() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    apiFetch<{ enabled: boolean }>('/auth/google/status')
      .then((res) => setEnabled(res.enabled))
      .catch(() => setEnabled(false));
  }, []);

  if (!enabled) return null;

  return (
    <a
      href={`${API_URL}/auth/google`}
      className="flex w-full items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition-colors duration-150 hover:bg-gray-50"
    >
      Entrar com Google
    </a>
  );
}
