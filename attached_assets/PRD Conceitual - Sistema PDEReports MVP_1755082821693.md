# PRD Conceitual - Sistema PDEReports MVP
## Gerador de Relatórios de Perfil de Desempenho da Edificação

---

## 🎯 **VISÃO DO PRODUTO**

### **Objetivo**
Desenvolver sistema web para automatizar a elaboração de relatórios de Perfil de Desempenho da Edificação (PDE) conforme ABNT NBR 15575, transformando processo manual complexo em solução digital eficiente.

### **Problema Central**
- Elaboração manual consome 40-80 horas por relatório
- Alta probabilidade de erros em cálculos complexos
- Falta de padronização entre profissionais
- Necessidade de conhecimento técnico especializado

### **Proposta de Valor**
- Redução de 70% no tempo de elaboração
- Eliminação de 95% dos erros de cálculo
- Padronização completa dos relatórios
- Interface intuitiva para não-especialistas

---

## 👥 **USUÁRIOS-ALVO**

### **Persona Principal: Engenheiro Civil Consultor**
- **Perfil**: Especialista em desempenho de edificações
- **Dor**: Tempo excessivo em cálculos manuais
- **Objetivo**: Aumentar produtividade e reduzir erros
- **Comportamento**: Técnico, detalhista, busca precisão

### **Persona Secundária: Arquiteta de Construtora**
- **Perfil**: Conhecimento básico de NBR 15575
- **Dor**: Dependência de consultores externos
- **Objetivo**: Autonomia técnica e agilidade
- **Comportamento**: Prática, busca soluções simples

---

## 🔒 **REQUISITOS DE SEGURANÇA (CRÍTICOS)**

### **Autenticação e Autorização**
- **Autenticação forte** com tokens seguros
- **Controle de sessão** com expiração automática
- **Proteção contra ataques** de força bruta
- **Bloqueio automático** após tentativas falhadas
- **Recuperação segura** de senhas
- **Controle de acesso** baseado em perfis

### **Proteção de Dados**
- **Criptografia obrigatória** para dados em trânsito e repouso
- **Sanitização rigorosa** de todas as entradas
- **Validação server-side** de todos os dados
- **Proteção contra** XSS, CSRF, SQL Injection
- **Backup seguro** com criptografia
- **Logs de auditoria** completos

### **Infraestrutura Segura**
- **HTTPS obrigatório** em todas as comunicações
- **Headers de segurança** configurados
- **Rate limiting** para prevenir ataques DDoS
- **Monitoramento** de atividades suspeitas
- **Alertas automáticos** para incidentes
- **Isolamento** entre usuários e dados

---

## 📋 **FUNCIONALIDADES ESSENCIAIS MVP**

### **1. Gestão de Usuários**
**Conceitos**:
- Registro com validação de email
- Login seguro com credenciais
- Perfis diferenciados (Admin, Engenheiro, Usuário)
- Gestão de sessões ativas
- Recuperação de acesso

**Regras de Negócio**:
- Email único por usuário
- Senha com critérios de complexidade
- Bloqueio após 5 tentativas incorretas
- Sessão expira após inatividade
- Usuário só acessa próprios dados

### **2. Cadastro de Edificações**
**Conceitos**:
- Informações básicas da edificação
- Localização geográfica
- Caracterização do entorno
- Determinação automática de zona bioclimática
- Validação de dados obrigatórios

**Campos Essenciais**:
- Nome do empreendimento
- Endereço completo
- Tipologia habitacional
- Área total construída
- Número de pavimentos
- Responsável técnico

**Regras de Negócio**:
- CEP válido obrigatório
- Área deve ser positiva e realista
- Zona bioclimática determinada por localização
- Dados não podem ser alterados após relatório gerado

### **3. Sistemas Construtivos (Básicos)**

#### **Sistema Estrutural**
**Conceitos**:
- Tipo de estrutura (concreto, aço, alvenaria)
- Resistência dos materiais
- Vida Útil de Projeto (VUP)
- Classe de agressividade ambiental
- Cargas de projeto

**Regras de Negócio**:
- VUP mínima de 50 anos
- Resistência compatível com normas
- Classe de agressividade por localização

#### **Sistema de Vedações**
**Conceitos**:
- Vedações externas e internas
- Propriedades térmicas
- Propriedades acústicas
- Materiais e espessuras
- Isolamentos aplicados

**Regras de Negócio**:
- Transmitância térmica por zona bioclimática
- Isolamento acústico por classe de ruído
- Espessuras mínimas por tipo

#### **Sistema de Cobertura**
**Conceitos**:
- Tipo de cobertura
- Propriedades térmicas
- Impermeabilização
- Inclinação e drenagem
- Isolamentos térmicos

**Regras de Negócio**:
- Transmitância adequada à zona
- Impermeabilização obrigatória
- Inclinação mínima por material

### **4. Avaliação de Desempenho (5 Critérios Críticos)**

#### **Critério 1: Segurança Estrutural**
**Conceitos**:
- Verificação de VUP
- Validação de cargas
- Conformidade com normas estruturais
- Classificação automática

**Algoritmo**:
- VUP ≥ 50 anos = Mínimo
- VUP ≥ 75 anos = Intermediário  
- VUP ≥ 100 anos = Superior

#### **Critério 2: Desempenho Térmico**
**Conceitos**:
- Cálculo de transmitância térmica
- Verificação por zona bioclimática
- Capacidade térmica
- Classificação M/I/S

**Algoritmo**:
- Comparar U calculado com limites da zona
- Verificar capacidade térmica mínima
- Classificar conforme atendimento

#### **Critério 3: Desempenho Acústico**
**Conceitos**:
- Isolamento sonoro de vedações
- Classe de ruído do entorno
- Cálculo de DnT,w
- Classificação por performance

**Algoritmo**:
- Calcular isolamento por material/espessura
- Comparar com limites por classe de ruído
- Classificar conforme atendimento

#### **Critério 4: Estanqueidade à Água**
**Conceitos**:
- Verificação de impermeabilizações
- Detalhes construtivos críticos
- Pressões de ensaio
- Sistemas de drenagem

**Algoritmo**:
- Verificar presença de impermeabilização
- Validar detalhes por sistema
- Classificar por completude

#### **Critério 5: Segurança Contra Incêndio**
**Conceitos**:
- Materiais e revestimentos
- Rotas de fuga
- Sistemas de detecção
- Conformidade com normas

**Algoritmo**:
- Verificar materiais por ambiente
- Validar rotas de escape
- Classificar por conformidade

### **5. Geração de Relatórios**
**Conceitos**:
- Relatório executivo (5-10 páginas)
- Matriz visual de desempenho
- Especificações técnicas
- Memórias de cálculo
- Exportação em formato padrão

**Estrutura do Relatório**:
- Capa com identificação
- Resumo executivo
- Caracterização da edificação
- Matriz de desempenho (5 critérios)
- Detalhamento por critério
- Especificações técnicas
- Anexos normativos

**Regras de Negócio**:
- Relatório só gerado com dados completos
- Versionamento automático
- Assinatura digital do responsável
- Rastreabilidade completa

---

## 🎨 **CONCEITOS DE INTERFACE**

### **Princípios de UX**
- **Simplicidade**: Interface intuitiva para não-especialistas
- **Progressividade**: Guiar usuário passo a passo
- **Feedback**: Validação em tempo real
- **Consistência**: Padrões visuais uniformes
- **Acessibilidade**: Compatível com padrões web

### **Fluxo Principal**
```
Login → Dashboard → Novo Projeto → Dados Gerais → 
Sistemas → Validação → Cálculos → Relatório → Download
```

### **Componentes Essenciais**
- **Formulários inteligentes** com validação
- **Indicadores visuais** de progresso
- **Alertas contextuais** para erros
- **Matriz visual** de desempenho
- **Preview** de relatórios

### **Responsividade**
- **Desktop-first** para profissionais
- **Adaptação tablet** para apresentações
- **Mobile básico** para consultas

---

## 📊 **MODELO DE DADOS CONCEITUAL**

### **Entidades Principais**
```
Usuário
├── Edificação
    ├── Sistema Estrutural
    ├── Sistema de Vedações  
    ├── Sistema de Cobertura
    ├── Avaliação de Desempenho
    └── Relatórios
```

### **Relacionamentos**
- Usuário **possui** múltiplas Edificações
- Edificação **tem** múltiplos Sistemas
- Edificação **gera** múltiplos Relatórios
- Avaliação **referencia** Sistemas
- Relatório **consolida** Avaliações

### **Regras de Integridade**
- Exclusão em cascata controlada
- Versionamento de alterações
- Auditoria de modificações
- Backup incremental

---

## 🧮 **ALGORITMOS DE CÁLCULO**

### **Desempenho Térmico**
**Conceito**: Cálculo de transmitância térmica por camadas
```
Entrada: Lista de camadas (material, espessura, condutividade)
Processo: Somatório das resistências térmicas
Saída: Transmitância U (W/m²K)
Classificação: Comparação com limites por zona bioclimática
```

### **Desempenho Acústico**
**Conceito**: Cálculo de isolamento sonoro
```
Entrada: Material, espessura, densidade
Processo: Lei da massa para isolamento
Saída: Isolamento DnT,w (dB)
Classificação: Comparação com limites por classe de ruído
```

### **Zona Bioclimática**
**Conceito**: Determinação automática por coordenadas
```
Entrada: Latitude, longitude (via CEP)
Processo: Mapeamento geográfico conforme NBR 15220-3
Saída: Zona bioclimática (ZB1 a ZB8)
```

---

## ✅ **CRITÉRIOS DE VALIDAÇÃO**

### **Funcionalidades**
- [ ] Usuário consegue criar conta e fazer login
- [ ] Sistema determina zona bioclimática automaticamente
- [ ] Cálculos de desempenho são precisos
- [ ] Relatório é gerado corretamente
- [ ] Interface é intuitiva para não-especialistas

### **Segurança**
- [ ] Zero vulnerabilidades críticas detectadas
- [ ] Todos os dados são criptografados
- [ ] Logs de auditoria estão completos
- [ ] Testes de penetração são aprovados
- [ ] Backup e recuperação funcionam

### **Performance**
- [ ] Login em menos de 3 segundos
- [ ] Cálculos em menos de 5 segundos
- [ ] Geração de relatório em menos de 10 segundos
- [ ] Sistema suporta 50 usuários simultâneos
- [ ] Disponibilidade acima de 99%

### **Qualidade**
- [ ] Interface responsiva em dispositivos principais
- [ ] Validações impedem dados inconsistentes
- [ ] Mensagens de erro são claras
- [ ] Documentação está completa
- [ ] Código está bem estruturado

---

## 🎯 **ESTRATÉGIA DE DESENVOLVIMENTO**

### **Abordagem Incremental**
1. **Base Segura**: Autenticação e infraestrutura
2. **Core MVP**: Funcionalidades essenciais
3. **Validação**: Testes com usuários reais
4. **Iteração**: Melhorias baseadas em feedback

### **Princípios Técnicos**
- **Segurança por design**: Não é adicionada depois
- **Validação dupla**: Cliente e servidor
- **Separação de responsabilidades**: Frontend/Backend
- **Escalabilidade**: Arquitetura preparada para crescimento
- **Manutenibilidade**: Código limpo e documentado

### **Qualidade Assegurada**
- **Testes automatizados** para funcionalidades críticas
- **Code review** obrigatório
- **Análise estática** de segurança
- **Monitoramento** em produção
- **Documentação** técnica completa

---

## 📈 **MÉTRICAS DE SUCESSO**

### **Adoção**
- 50 usuários ativos em 3 meses
- 100 relatórios gerados em 6 meses
- Taxa de retenção > 60%
- NPS > 40

### **Eficiência**
- Redução de 50% no tempo de elaboração
- 90% de precisão nos cálculos
- 95% de satisfação com interface
- < 5% taxa de abandono no fluxo

### **Técnicas**
- 99% de disponibilidade
- < 3s tempo de resposta médio
- Zero incidentes de segurança
- < 0.1% taxa de erro

---

**Este PRD conceitual fornece diretrizes claras para desenvolvimento, mantendo flexibilidade para escolhas tecnológicas e implementação específica.**

