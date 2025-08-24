import { useEffect } from 'react';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

/**
 * Reusable hook to redirect unauthenticated users to /login with a unified toast.
 * Usage: call inside component body: useAuthRedirect();
 * Optional param to disable auto redirect (just show toast) or to customize delay.
 */
export function useAuthRedirect(options?: { enabled?: boolean; delayMs?: number }) {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const enabled = options?.enabled !== false;
  const delay = options?.delayMs ?? 400;

  useEffect(() => {
    if (!enabled) return;
    if (!isLoading && !isAuthenticated) {
      toast({ title: 'Sessão finalizada', description: 'Faça login novamente para continuar.', variant: 'destructive' });
      const t = setTimeout(() => { if (window.location.pathname !== '/login') window.location.href = '/login'; }, delay);
      return () => clearTimeout(t);
    }
  }, [enabled, delay, isAuthenticated, isLoading, toast]);
}
