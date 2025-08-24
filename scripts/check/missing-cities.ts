#!/usr/bin/env tsx
/**
 * Script: missing-cities.ts
 * Goal: Verificar quais municípios brasileiros (IBGE) estão ausentes na tabela `cities`.
 * Abordagem:
 * 1. Carrega lista oficial de municípios (hardcode mínima aqui + instrução para ampliar) ou via CSV local.
 * 2. Consulta banco atual (tabela states + cities) e gera diff.
 * 3. Imprime resumo e arquivo JSON opcional.
 *
 * Nota: Para cobertura completa, substitua `allBrazilianCities` por importação de um dataset IBGE completo.
 */
import 'dotenv/config';
import { db, pool } from '../../server/db';
// Imports diretos de tabelas não necessários aqui; usamos db.query.
import fs from 'node:fs';
import path from 'node:path';

// Placeholder reduzido: substitua por dataset completo (ex: CSV IBGE) => [{uf: 'RS', nome: 'Porto Alegre'}, ...]
// Você pode obter lista: https://servicodados.ibge.gov.br/api/v1/localidades/municipios
// ou gerar via curl e salvar em data/ibge-municipios.json
interface RawCity { uf: string; nome: string; }

// Função para carregar dataset completo se existir arquivo local
function loadDataset(): RawCity[] {
  const localJson = path.join(process.cwd(), 'data', 'ibge-municipios.json');
  if (fs.existsSync(localJson)) {
    const raw = JSON.parse(fs.readFileSync(localJson, 'utf-8')) as any[];
    // Estrutura API IBGE: {id, nome, microrregiao: { mesorregiao: { UF: { sigla }}}}
    return raw.map(r => ({ uf: r.microrregiao?.mesorregiao?.UF?.sigla, nome: r.nome }))
      .filter(r => r.uf && r.nome) as RawCity[];
  }
  // Fallback mínimo (exemplos) – ampliar para análise real.
  return [
    { uf: 'RS', nome: 'Porto Alegre' },
    { uf: 'RS', nome: 'Canoas' },
    { uf: 'RS', nome: 'Pelotas' },
    { uf: 'SP', nome: 'São Paulo' },
    { uf: 'SP', nome: 'Campinas' },
    { uf: 'RJ', nome: 'Rio de Janeiro' },
    { uf: 'MG', nome: 'Belo Horizonte' },
  ];
}

async function main() {
  const ref = loadDataset();
  const refKey = (c: RawCity) => `${c.uf}::${normalize(c.nome)}`;
  const refSet = new Set(ref.map(refKey));

  // Carregar estados (map UF -> id)
  const dbStates = await db.query.states.findMany();
  const stateByCode = new Map(dbStates.map(s => [s.code.toUpperCase(), s]));

  // Carregar cidades atuais
  const dbCities = await db.query.cities.findMany();

  // Construir set existente UF::nomeNormalizado
  const existingSet = new Set(
    dbCities.map(c => {
      const st = dbStates.find(s => s.id === c.stateId);
      return st ? `${st.code.toUpperCase()}::${normalize(c.name)}` : '';
    }).filter(Boolean)
  );

  // Descobrir ausentes
  const missing = ref.filter(c => !existingSet.has(refKey(c)));

  // Agrupar por UF
  const byUf: Record<string, RawCity[]> = {};
  for (const m of missing) {
    byUf[m.uf] = byUf[m.uf] || []; byUf[m.uf].push(m);
  }

  console.log(`Total referência (dataset): ${ref.length}`);
  console.log(`Total no banco (cities): ${dbCities.length}`);
  console.log(`Encontrados ausentes (no escopo do dataset carregado): ${missing.length}`);
  if (missing.length) {
    console.log('\nLista (UF - Município)');
    for (const uf of Object.keys(byUf).sort()) {
      console.log(`\n${uf} (${byUf[uf].length})`);
      for (const c of byUf[uf]) console.log(`  - ${c.nome}`);
    }
  } else {
    console.log('Nenhuma cidade ausente para o dataset carregado.');
  }

  // Salvar arquivo JSON de resultado
  const outDir = path.join(process.cwd(), 'data');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'missing-cities-result.json'), JSON.stringify({ generatedAt: new Date().toISOString(), totalRef: ref.length, totalDb: dbCities.length, missing }, null, 2));
  console.log(`\nResultado salvo em data/missing-cities-result.json`);
}

function normalize(v: string) {
  return v.normalize('NFD').replace(/\p{Diacritic}+/gu, '').toLowerCase();
}

main().catch(err => { console.error(err); process.exit(1); }).finally(() => pool.end());
