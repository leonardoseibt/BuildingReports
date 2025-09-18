import { useCallback } from 'react';

// Hook removido: não substitui mais <= e >= por símbolos especiais
export function useSmartReplace() {
  // Retorna um handler que não faz mais substituições
  return useCallback((value: string) => {
    return value; // Sem substituições
  }, []);
}
