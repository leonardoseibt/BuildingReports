# Correções Implementadas para Caracteres Especiais no PDF

## Resumo das Alterações

### ✅ 1. Correções de Mojibake
Adicionadas as correções para caracteres mal codificados no objeto `COMMON_ENCODING_REPLACEMENTS`:
```typescript
'â‰¤': '≤',  // Correção para menor ou igual
'â‰¥': '≥'   // Correção para maior ou igual
```

### ✅ 2. Entidades HTML para Caracteres Especiais
Expandida a função `decodeHtmlEntities` para incluir todas as entidades matemáticas:
```typescript
'&le;': '≤',
'&leq;': '≤',
'&ge;': '≥',
'&geq;': '≥',
'&plusmn;': '±',
'&deg;': '°',
'&mu;': 'μ',
'&times;': '×',
'&divide;': '÷'
```

### ✅ 3. Conversões Seguras de ASCII
A função `sanitizeComparisonCharacters` agora converte corretamente:
- `<=` → `≤`
- `>=` → `≥`
- `<>` → `≠`
- Mantém `<` e `>` isolados inalterados

### ✅ 4. Pipeline Simplificado
Implementado novo pipeline na função `normalizePdfText`:
1. `decodeHtmlEntities()` - Converte entidades HTML
2. `applyCommonEncodingFixes()` - Corrige mojibake
3. `sanitizeComparisonCharacters()` - Converte ASCII para Unicode
4. Limpeza de espaços + `normalize('NFKC')`

### ✅ 5. Fonte Unicode
- Fonte `DejaVuSans` já configurada corretamente no documento
- Aplicada tanto no texto direto quanto nas tabelas `autoTable`

### ✅ 6. Limpeza do Código
Removidas funções não utilizadas:
- `preserveUnicodeCharacters()`
- `restoreUnicodeCharacters()`
- `decodeMisencodedText()`
- `WINDOWS_1252_EXTENDED_MAP`

## Resultado
✅ Entidades HTML: `&le;` → `≤`
✅ Mojibake: `â‰¤` → `≤`
✅ ASCII: `<=` → `≤`
✅ Referências numéricas: `&#8804;` → `≤`
✅ Referências hex: `&#x2264;` → `≤`

O pipeline agora processa todos os tipos de entrada e garante que os caracteres especiais matemáticos sejam exibidos corretamente no PDF.