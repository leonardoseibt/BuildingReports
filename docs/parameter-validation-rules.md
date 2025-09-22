# Regras de Validação de Parâmetros Numéricos

## Visão Geral

Durante a geração de relatórios, quando um parâmetro na tabela `parameters` tem um atributo associado do tipo `numeric` e possui valores nos campos `min_limit` e/ou `max_limit`, o sistema aplica as seguintes regras de validação para determinar se o parâmetro é aplicável à edificação:

## Regras de Validação

### 1. Limite Mínimo (`min_limit`)
- **Regra**: O valor do atributo da edificação deve ser **MAIOR** que `min_limit`
- **Operador**: `valor > min_limit` (não >=)
- **Comportamento**: Se `min_limit` não estiver informado (NULL), não há validação de limite inferior

### 2. Limite Máximo (`max_limit`)
- **Regra**: O valor do atributo da edificação deve ser **MENOR OU IGUAL** a `max_limit`
- **Operador**: `valor <= max_limit`
- **Comportamento**: Se `max_limit` não estiver informado (NULL), é considerado infinito (sem limite superior)

### 3. Ambos os Limites
- **Regra**: O valor deve satisfazer AMBAS as condições: `min_limit < valor <= max_limit`

## Exemplos Práticos

### Exemplo 1: Altura da Edificação
```
Parameter:
- attributeId: altura_edificacao (numeric)
- min_limit: 10.00
- max_limit: 50.00

Edificação com altura = 15.00m
✅ Aplica (10.00 < 15.00 <= 50.00)

Edificação com altura = 10.00m
❌ NÃO aplica (10.00 não é > 10.00)

Edificação com altura = 50.00m
✅ Aplica (10.00 < 50.00 <= 50.00)

Edificação com altura = 60.00m
❌ NÃO aplica (60.00 não é <= 50.00)
```

### Exemplo 2: Apenas Limite Mínimo
```
Parameter:
- attributeId: area_total (numeric)
- min_limit: 100.00
- max_limit: NULL

Edificação com área = 150.00m²
✅ Aplica (150.00 > 100.00, sem limite superior)

Edificação com área = 100.00m²
❌ NÃO aplica (100.00 não é > 100.00)
```

### Exemplo 3: Apenas Limite Máximo
```
Parameter:
- attributeId: profundidade_subsolo (numeric)
- min_limit: NULL
- max_limit: 5.00

Edificação com profundidade = 3.00m
✅ Aplica (sem limite inferior, 3.00 <= 5.00)

Edificação com profundidade = 5.00m
✅ Aplica (sem limite inferior, 5.00 <= 5.00)

Edificação com profundidade = 6.00m
❌ NÃO aplica (6.00 não é <= 5.00)
```

## Implementação

A validação é implementada na função `shouldShowParameter` no arquivo:
- `client/src/components/reports/report-print.tsx`

### Código de Validação
```typescript
const numericValue = parseFloat(String(attributeValue));
if (!isNaN(numericValue)) {
  // Validação conforme regras: valor deve ser > min_limit e <= max_limit
  if (parameter.minLimit !== null && parameter.minLimit !== undefined) {
    const minLimit = parseFloat(String(parameter.minLimit));
    if (!isNaN(minLimit) && numericValue <= minLimit) return false;
  }
  if (parameter.maxLimit !== null && parameter.maxLimit !== undefined) {
    const maxLimit = parseFloat(String(parameter.maxLimit));
    if (!isNaN(maxLimit) && numericValue > maxLimit) return false;
  }
  // Se maxLimit não informado, é considerado infinito (sem validação de limite superior)
}
```

## Notas Importantes

1. **Validação de Integridade**: O backend valida que `min_limit <= max_limit` durante a criação/edição de parâmetros para manter a integridade dos dados.

2. **Aplicação vs Integridade**: A validação descrita neste documento é para determinar a **aplicabilidade** de parâmetros durante a geração de relatórios, não para validar a integridade dos dados de parâmetros.

3. **Valores Nulos**: Campos NULL em `min_limit` ou `max_limit` são tratados como "sem limite" para aquela direção.

4. **Precisão Numérica**: Os valores são convertidos usando `parseFloat()`, permitindo comparações com números decimais.