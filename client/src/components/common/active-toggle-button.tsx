import { Button } from "@/components/ui/button";
import { Power } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { showSuccess, showError } from "@/lib/toast-messages";
import * as React from 'react';

interface ActiveToggleButtonProps {
  id: string | number;
  resource: string; // e.g. 'typologies'
  isActive: boolean;
  queryKey: any[]; // react-query key used for list invalidation
  entityLabel: string; // singular label for toast messages ("Tipo", "Critério")
  className?: string;
  disabled?: boolean;
  confirm?: boolean; // future use
  onToggled?: (newValue: boolean) => void; // external hook
}

export const ActiveToggleButton: React.FC<ActiveToggleButtonProps> = ({
  id,
  resource,
  isActive,
  queryKey,
  entityLabel,
  className,
  disabled,
  onToggled,
}) => {
  const { toast } = useToast();
  const [localActive, setLocalActive] = React.useState(isActive);

  // Keep local state in sync if parent changes (e.g. after refetch)
  React.useEffect(() => { setLocalActive(isActive); }, [isActive]);

  const mutation = useMutation({
    mutationFn: async (nextValue: boolean) => {
      await apiRequest('PUT', `/api/${resource}/${id}`, { isActive: nextValue });
      return nextValue;
    },
    onMutate: async (nextValue) => {
      // Optimistic update: cancel queries and set new value in cache
      await queryClient.cancelQueries({ queryKey });
      const prevData = queryClient.getQueryData<any>(queryKey);

      // Try to update matching row's isActive inline (assuming array response)
      if (Array.isArray(prevData)) {
        const newData = prevData.map(item => item.id === id ? { ...item, isActive: nextValue } : item);
        queryClient.setQueryData(queryKey, newData);
      }
      setLocalActive(nextValue);
      onToggled?.(nextValue);
      return { prevData };
    },
    onError: (_err, _vars, context) => {
      // Rollback
      if (context?.prevData) {
        queryClient.setQueryData(queryKey, context.prevData);
        const restored = Array.isArray(context.prevData) ? context.prevData.find((r:any) => r.id === id) : null;
        setLocalActive(restored?.isActive ?? isActive);
      }
      showError(toast, 'Falha ao alterar status.');
    },
    onSuccess: (val) => {
      showSuccess(toast, `${entityLabel} ${val ? 'ativado' : 'desativado'}.`);
    },
    onSettled: () => {
      // Ensure final server state reflected
      queryClient.invalidateQueries({ queryKey });
    }
  });

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      title={localActive ? 'Desativar' : 'Ativar'}
      className={className}
  disabled={disabled || mutation.isPending}
      onClick={() => mutation.mutate(!localActive)}
    >
  <Power className={`h-4 w-4 ${localActive ? 'text-emerald-600' : 'text-slate-400'} ${mutation.isPending ? 'opacity-50 animate-pulse' : ''}`} />
      <span className="sr-only">{localActive ? 'Desativar' : 'Ativar'} {entityLabel}</span>
    </Button>
  );
};
