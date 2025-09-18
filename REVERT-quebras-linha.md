# REVERTIDO: Mudanças nas Quebras de Linha

## 🔄 Reversão Realizada

**Motivo:** A alteração para tratar linhas vazias interferiu no processamento de caracteres especiais
**Ação:** Revertidas as mudanças nas linhas 1460-1468 e 1480-1488

## ❌ Problema da Abordagem Anterior

### **O que foi tentado:**
```typescript
if (line === '') {
  currentY += lineHeight * 0.5; // Linha vazia
} else {
  doc.text(line, startX, currentY, { baseline: 'top' } as any);
  currentY += lineHeight;
}
```

### **Por que causou problema:**
- Mudou o fluxo de renderização que estava funcionando para caracteres especiais
- Pode ter interferido no processamento de `ensureUnicodeSupport()`
- Alterou a lógica de posicionamento Y que afeta a fonte

## ✅ Estado Atual (Funcionando)

**Caracteres especiais:** ✅ Funcionando corretamente  
**Quebras de linha:** ❌ Ainda precisam ser investigadas

## 🔍 Próximos Passos para Quebras de Linha

### **Investigação Necessária:**
1. Verificar se o problema está no dados vindos do banco
2. Testar se `\n` está realmente presente no texto original
3. Examinar se `jsPDF.splitTextToSize()` está preservando quebras de linha
4. Considerar abordagem alternativa que não altere a renderização

### **Abordagens Alternativas:**
- Processar quebras de linha no nível de `formatTextWithLineBreaks()`
- Usar `doc.splitTextToSize()` com configuração especial para quebras
- Implementar parser customizado que respeite tanto quebras quanto caracteres especiais

## 🎯 Prioridade Atual

**MANTER:** Caracteres especiais funcionando (≥, ≤, ±, °, μ, ×, ÷, ≠)  
**INVESTIGAR:** Quebras de linha sem quebrar caracteres especiais

## 📋 Estado do Sistema

- ✅ Título da análise com fundo correto
- ✅ Caracteres especiais em descrições 
- ✅ Caracteres especiais em observações (fonte normal, tamanho 7, cor cinza)
- ❌ Quebras de linha (requer investigação mais profunda)

**Nota:** Mantemos a estabilidade dos caracteres especiais enquanto investigamos uma solução segura para quebras de linha.