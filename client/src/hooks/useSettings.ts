import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SETTINGS_QUERY_KEY, DEFAULT_PAGE_SIZE, type SettingsData } from "@/lib/settings";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { showSuccess, showError } from "@/lib/toast-messages";
import { parseApiError } from "@/lib/api-error";

export function useSettingsQuery(enabled: boolean) {
  return useQuery<SettingsData>({
    queryKey: SETTINGS_QUERY_KEY,
    enabled,
  });
}

export function useSaveSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation<SettingsData, unknown, SettingsData>({
    mutationFn: async (payload) => {
      const res = await apiRequest("PUT", "/api/settings", payload);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(SETTINGS_QUERY_KEY, data);
      showSuccess(toast, "Configurações atualizadas com sucesso.");
    },
    onError: (error) => {
      const parsed = parseApiError(error);
      const description = parsed.message || "Não foi possível salvar as configurações.";
      showError(toast, description);
    },
  });
}

export function usePageSize(enabled: boolean) {
  const { data } = useSettingsQuery(enabled);
  return data?.pageSize ?? DEFAULT_PAGE_SIZE;
}
