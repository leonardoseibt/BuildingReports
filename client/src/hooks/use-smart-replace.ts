import { useCallback } from 'react';

// Substitui '<=' por '≤' e '>=' por '≥' em tempo real
export function useSmartReplace() {
  // Retorna um handler para usar em onChange de qualquer input/textarea
  return useCallback((value: string) => {
    return value
      .replace(/<=/g, '≤')
      .replace(/>=/g, '≥');
  }, []);
}
