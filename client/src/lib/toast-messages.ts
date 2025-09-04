export type ToastFn = (opts: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void;

export function showSuccess(toast: ToastFn, description: string) {
  toast({ title: 'Tudo certo! 🎉', description });
}

export function showError(toast: ToastFn, description: string) {
  toast({ title: 'Ops! Algo deu errado 😕', description, variant: 'destructive' });
}
