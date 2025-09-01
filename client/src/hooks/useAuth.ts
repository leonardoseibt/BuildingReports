import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { PublicUser as User } from "@shared/schema";
import { useEffect, useState } from "react";
import { getQueryFn } from "@/lib/queryClient";

interface SessionUser extends User { expires_at?: number }

export function useAuth() {
  const queryClient = useQueryClient();
  const { data: user, isLoading, isError, error } = useQuery<SessionUser | null>({
    queryKey: ["/api/auth/user"],
    retry: false,
    queryFn: getQueryFn<SessionUser | null>({ on401: "returnNull" }),
  });

  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));

  // Schedule a timer to tick precisely at expiry (or every 30s if far away)
  useEffect(() => {
    if (!user?.expires_at) return;
    const remainingSec = user.expires_at - nowSec;
    const nextTickMs = remainingSec > 180 ? 30_000 : Math.max(500, remainingSec * 1000);
    const t = setTimeout(() => setNowSec(Math.floor(Date.now() / 1000)), nextTickMs);
    return () => clearTimeout(t);
  }, [user?.expires_at, nowSec]);

  const isExpired = !!user?.expires_at && user.expires_at <= nowSec;

  // When expired, proactively clear cached user so PrivateRoute redirects without needing an API call
  useEffect(() => {
    if (isExpired && user) {
      queryClient.setQueryData(["/api/auth/user"], null);
    }
  }, [isExpired, user, queryClient]);

  return {
    user: isExpired ? null : user,
    isLoading,
    isError,
    error,
    isAuthenticated: !!user && !isExpired,
    expiresAt: user?.expires_at,
    isExpired,
  };
}
