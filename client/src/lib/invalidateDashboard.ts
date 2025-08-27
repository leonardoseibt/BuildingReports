import { QueryClient } from '@tanstack/react-query';

/**
 * Invalida queries de métricas do dashboard (básicas e estendidas) de forma padronizada.
 */
export function invalidateDashboard(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
  queryClient.invalidateQueries({ queryKey: ['/api/dashboard/extended-stats'] });
}
