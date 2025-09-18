# Correção: Quebras de Linha em Descrições e Observações

## 🚨 Problema Identificado

**Sintoma:** Quebras de linha (Enter) nas descrições e observações dos parâmetros não apareciam no PDF
**Causa:** Linhas vazias não eram renderizadas com espaçamento adequado

## ✅ Correção Implementada

### **Renderização de Descrições (Linhas 1460-1468)**

#### **Antes:**
```typescript
descriptionLines.forEach((line: string) => {
  doc.text(line, startX, currentY, { baseline: 'top' } as any);
  currentY += baseLineHeight;
});
```

#### **Depois:**
```typescript
descriptionLines.forEach((line: string) => {
  if (line === '') {
    // Linha vazia - adicionar espaçamento de linha vazia
    currentY += baseLineHeight * 0.5; // Metade da altura para linhas vazias
  } else {
    doc.text(line, startX, currentY, { baseline: 'top' } as any);
    currentY += baseLineHeight;
  }
});
```

### **Renderização de Observações (Linhas 1480-1488)**

#### **Antes:**
```typescript
observationLines.forEach((line: string) => {
  const normalizedLine = ensureUnicodeSupport(line, doc);
  doc.text(normalizedLine, startX, currentY, { baseline: 'top' } as any);
  currentY += observationLineHeight;
});
```

#### **Depois:**
```typescript
observationLines.forEach((line: string) => {
  if (line === '') {
    // Linha vazia - adicionar espaçamento de linha vazia
    currentY += observationLineHeight * 0.5; // Metade da altura para linhas vazias
  } else {
    const normalizedLine = ensureUnicodeSupport(line, doc);
    doc.text(normalizedLine, startX, currentY, { baseline: 'top' } as any);
    currentY += observationLineHeight;
  }
});
```

## 🔧 Como Funciona

### **Pipeline de Processamento:**
1. **Input:** Texto com quebras de linha (`Linha 1\nLinha 2\n\nLinha 4`)
2. **formatTextWithLineBreaks():** Normaliza e preserva `\n`
3. **splitPdfTextIntoLines():** Divide por `\n`, preservando linhas vazias
4. **Renderização:** Agora trata linhas vazias com espaçamento reduzido

### **Tratamento de Linhas Vazias:**
- **Linha com conteúdo:** Renderizada normalmente com altura total
- **Linha vazia (`''`):** Apenas espaçamento de 50% da altura normal
- **Resultado:** Quebras de linha visualmente corretas

## 🎯 Resultado Esperado

✅ **Quebras de linha preservadas** - `\n` no texto resulta em quebra visual no PDF  
✅ **Parágrafos separados** - Linhas vazias criam espaçamento entre parágrafos  
✅ **Espaçamento proporcional** - Linhas vazias usam metade da altura para evitar espaços excessivos  
✅ **Funciona em ambos** - Descrições e observações tratadas consistentemente

## 📋 Teste
Digite textos com quebras de linha nas descrições/observações dos parâmetros e verifique se aparecem corretamente no PDF!