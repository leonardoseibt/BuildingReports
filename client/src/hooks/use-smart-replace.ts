import { useCallback } from 'react';

// Hook para substituir automaticamente caracteres de comparação por símbolos especiais
export function useSmartReplace() {
  // Retorna um handler que faz substituições automáticas
  return useCallback((value: string) => {
    if (!value) return value;
    
    return value
      // Conversões de símbolos de comparação para caracteres especiais
      .replace(/<=\s*/g, '≤')     // <= para ≤
      .replace(/>=\s*/g, '≥')     // >= para ≥
      .replace(/<\s*=\s*/g, '≤')  // < = para ≤ (com espaços)
      .replace(/>\s*=\s*/g, '≥')  // > = para ≥ (com espaços)
      .replace(/<\s*>\s*/g, '≠')  // <> para ≠
      .replace(/<>/g, '≠')        // <> para ≠ (sem espaços)
      .replace(/\+\-/g, '±')      // +- para ±
      .replace(/\+-/g, '±');      // +- para ± (sem espaço)
  }, []);
}
