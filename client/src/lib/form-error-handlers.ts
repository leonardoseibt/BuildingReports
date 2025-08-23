import type { FieldValues, UseFormReturn } from "react-hook-form";

type AllowedVariant = 'default' | 'destructive' | null | undefined;
interface ToastFn {
  (opts: { title: string; description?: string; variant?: AllowedVariant }): void;
}

// Centralized handler for 409 duplicate code errors.
export async function handleCodeUniquenessError(
  error: any,
  form: UseFormReturn<FieldValues> | { setError: (name: any, error: any) => void },
  toast: ToastFn,
  fallbackDescription: string
) {
  try {
    const body = await (error?.response?.json?.() ?? Promise.resolve(null));
    if ((error?.response?.status === 409) || body?.message?.includes?.('já cadastrado')) {
      // Mark field level error
      form.setError('code', { message: 'Já existe um registro com este código.' });
      toast({ title: 'Código duplicado', description: 'Escolha um código único.', variant: 'destructive' });
      return true;
    }
  } catch { /* swallow parse errors */ }
  toast({ title: 'Erro', description: fallbackDescription, variant: 'destructive' });
  return false;
}
