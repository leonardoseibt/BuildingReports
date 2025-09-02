import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { refreshSession } from '@/lib/authUtils';
import { queryClient } from '@/lib/queryClient';

// Configurable warning threshold (seconds) via Vite env var
const WARNING_THRESHOLD_SEC = Number(import.meta.env.VITE_SESSION_WARNING_SEC || 5 * 60); // default 5m
// Grace period (ms) to keep the prompt hidden right after uma renovação manual, mesmo que já esteja dentro do threshold
const HIDE_AFTER_REFRESH_MS = Number(import.meta.env.VITE_SESSION_PROMPT_HIDE_AFTER_REFRESH_MS || 30_000); // 30s

export function SessionExpiryPrompt() {
  const { expiresAt, isAuthenticated } = useAuth();
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastExtended, setLastExtended] = useState<number | null>(null);

  // Tick every second when near expiry, otherwise every 30s
  useEffect(() => {
    if (!expiresAt || !isAuthenticated) return;
    const remaining = expiresAt - nowSec;
    const nextMs = remaining <= WARNING_THRESHOLD_SEC ? 1000 : 30_000;
    const t = setTimeout(() => setNowSec(Math.floor(Date.now() / 1000)), nextMs);
    return () => clearTimeout(t);
  }, [expiresAt, nowSec, isAuthenticated]);

  if (!isAuthenticated || !expiresAt) return null;
  const remaining = expiresAt - nowSec;
  // Auto-hide logic: se acabou de renovar, ocultar enquanto dentro da janela de grace
  const inGrace = lastExtended !== null && (Date.now() - lastExtended) < HIDE_AFTER_REFRESH_MS;
  const show = remaining > 0 && remaining <= WARNING_THRESHOLD_SEC && !inGrace;
  const minutes = Math.floor(Math.max(remaining, 0) / 60);
  const seconds = Math.max(remaining, 0) % 60;

  async function handleExtend() {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const data = await refreshSession();
      if (data?.expires_at) {
        const user: any = queryClient.getQueryData(['/api/auth/user']);
        if (user) queryClient.setQueryData(['/api/auth/user'], { ...user, expires_at: data.expires_at });
        setLastExtended(Date.now());
      }
    } finally {
      setIsRefreshing(false);
    }
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-md border border-amber-300 bg-white shadow-lg p-4 animate-in fade-in slide-in-from-bottom-2">
      <div className="text-sm font-medium text-amber-800 mb-1">Sessão prestes a expirar</div>
      <p className="text-xs text-amber-700 mb-2">Sua sessão expira em {minutes}:{seconds.toString().padStart(2, '0')}. Clique em Continuar para mantê-la ativa.</p>
      {lastExtended && <p className="text-[10px] text-slate-400 mb-1">Renovada há {Math.round((Date.now()-lastExtended)/1000)}s</p>}
      <div className="flex gap-2 justify-end">
        <button
          onClick={handleExtend}
          disabled={isRefreshing}
          className="px-3 py-1.5 text-xs font-medium rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-60"
        >{isRefreshing ? 'Renovando…' : 'Continuar'}</button>
      </div>
    </div>
  );
}

export default SessionExpiryPrompt;