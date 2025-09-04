import type { FieldValues, UseFormReturn } from "react-hook-form";
import { showError, type ToastFn } from "./toast-messages";

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
      showError(toast, 'Código já cadastrado. Escolha um código único.');
      return true;
    }
  } catch { /* swallow parse errors */ }
  showError(toast, fallbackDescription);
  return false;
}
