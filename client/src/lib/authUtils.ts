import { queryClient, clearCsrfToken } from './queryClient';
import { toast } from '@/hooks/use-toast';

export function isUnauthorizedError(error: Error): boolean {
  return /^401: .*Unauthorized/.test(error.message);
}

// Centralized manual logout
export async function logout(options: { redirect?: boolean } = {}) {
  try { await fetch('/api/logout', { credentials: 'include' }); } catch { /* ignore */ }
  clearCsrfToken();
  queryClient.clear();
  toast({ title: 'Sessão encerrada', description: 'Você saiu do sistema.' });
  if (options.redirect !== false) {
    setTimeout(() => { window.location.href = '/login'; }, 100);
  }
}

// Explicit refresh request (optional manual trigger)
export async function refreshSession(): Promise<{ expires_at: number; now: number } | null> {
  try {
    const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// Schedule periodic soft-refresh (optional usage in a top-level component)
export function scheduleAutoRefresh(intervalMs = 60_000) {
  let timer: any = null;
  const tick = async () => {
    const user: any = queryClient.getQueryData(['/api/auth/user']);
    if (user?.expires_at) {
      const nowSec = Math.floor(Date.now() / 1000);
      const remaining = user.expires_at - nowSec;
      if (remaining < 5 * 60) { // inside renewal window
        const refreshed = await refreshSession();
        if (refreshed?.expires_at) {
          // Update cached user object with new expiry
            queryClient.setQueryData(['/api/auth/user'], { ...user, expires_at: refreshed.expires_at });
        }
      }
    }
    timer = setTimeout(tick, intervalMs);
  };
  tick();
  return () => { if (timer) clearTimeout(timer); };
}