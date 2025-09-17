import type { FieldValues, UseFormReturn } from "react-hook-form";
import { showError, type ToastFn } from "./toast-messages";
import { parseApiError } from "./api-error";

// Centralized handler for 409 duplicate code errors.
export async function handleCodeUniquenessError(
  error: any,
  form: UseFormReturn<FieldValues> | { setError: (name: any, error: any) => void },
  toast: ToastFn,
  fallbackDescription: string
) {
  const parsed = parseApiError(error);
  if (parsed.status === 409 || /já cadastrado/i.test(parsed.message)) {
    form.setError('code', { message: 'Já existe um registro com este código.' });
    showError(toast, 'Código já cadastrado. Escolha um código único.');
    return true;
  }
  const description = parsed.message || fallbackDescription;
  showError(toast, description);
  return false;
}
