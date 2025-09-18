# Correção: Problema com Caracteres Especiais

## 🚨 Problema Identificado

**Causa:** Dupla normalização nas observações
- `formatTextWithLineBreaks()` já aplica `normalizePdfText()` internamente
- Aplicar `normalizePdfText()` novamente causava processamento duplo
- Resultado: caracteres especiais sendo corrompidos

## ✅ Correção Aplicada

### **Revertidas as mudanças problemáticas:**

1. **Observação inicial:** Voltou para `formatTextWithLineBreaks()`
```typescript
// ❌ Problemático (dupla normalização)
const observationContent = observationRaw ? normalizePdfText(observationRaw) : '';

// ✅ Correto (normalização única)  
const observationContent = observationRaw ? formatTextWithLineBreaks(observationRaw) : '';
```

2. **Divisão em linhas:** Removida normalização extra
```typescript
// ❌ Problemático (re-normalização)
const normalizedObservationText = normalizePdfText(observationText);
const observationLines = splitPdfTextIntoLines(doc, normalizedObservationText, availableWidth);

// ✅ Correto (texto já normalizado)
const observationLines = splitPdfTextIntoLines(doc, observationText, availableWidth);
```

### **Mantidas as mudanças benéficas:**

✅ **Título da análise:** Fundo com largura correta da tabela  
✅ **Renderização final:** `ensureUnicodeSupport()` na exibição das linhas

## 🔧 Estado Atual

**Pipeline correto das observações:**
1. `formatTextWithLineBreaks()` - Normaliza e preserva quebras de linha
2. `splitPdfTextIntoLines()` - Divide em linhas para a tabela  
3. `ensureUnicodeSupport()` - Garante Unicode na renderização

**Resultado:** Caracteres especiais funcionando novamente! 🎉