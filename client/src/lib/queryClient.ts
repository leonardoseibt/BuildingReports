import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

let csrfToken: string | null = null;
let lastCsrfFetch = 0;
const CSRF_TTL_MS = 10 * 60 * 1000; // refresh every 10min

async function ensureCsrfToken(force = false) {
  const now = Date.now();
  if (!force && csrfToken && now - lastCsrfFetch < CSRF_TTL_MS) return csrfToken;
  const cacheBuster = force ? Date.now() : Math.floor(now / CSRF_TTL_MS);
  try {
    const res = await fetch(`/api/csrf-token?t=${cacheBuster}` , {
      credentials: 'include',
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-store' },
    });
    if (res.status === 200) {
      let data: any = null;
      try { data = await res.json(); } catch { /* ignore */ }
      if (data?.token) {
        csrfToken = data.token;
        lastCsrfFetch = now;
      } else if (force) {
        csrfToken = null;
      }
    } else if (force) {
      csrfToken = null;
    }
  } catch {
    if (force) csrfToken = null;
  }
  return csrfToken;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    const path = window.location.pathname;
    const shouldRedirect = !path.startsWith('/login') && (res.status === 440 || res.status === 401);
    if (shouldRedirect) {
      // Distinguish messages slightly
      const expired = res.status === 440 || /expirad/i.test(text);
      toast({ title: 'Sessão finalizada', description: expired ? 'Faça login novamente para continuar.' : 'Autenticação necessária.', variant: 'destructive' });
      // Small timeout so toast can render
      setTimeout(() => { window.location.href = '/login'; }, 150);
    }
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Attach CSRF token for unsafe methods
  let headers: Record<string, string> = {};
  const unsafe = /^(POST|PUT|PATCH|DELETE)$/i.test(method);
  if (data) headers["Content-Type"] = "application/json";
  if (unsafe) {
    const token = await ensureCsrfToken();
    if (token) headers['csrf-token'] = token;
  }
  const attempt = async (): Promise<Response> => {
    return fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });
  };

  let res = await attempt();
  if (unsafe && res.status === 403) {
    const text = await res.clone().text();
    if (/csrf/i.test(text)) {
      // refresh token & retry once
      await ensureCsrfToken(true);
      if (csrfToken) {
        headers['csrf-token'] = csrfToken;
        res = await attempt();
      } else {
        // no token acquired -> give a clearer error
        throw new Error('403: Falha CSRF (token indisponível)');
      }
    }
  }
  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
