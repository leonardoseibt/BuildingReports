import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { db } from '../server/db';
import { isopleths, isoplethCoverages, cities, states } from '../shared/schema';
import { eq, and, sql } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface IsopletaCSVRow {
  municipio: string;
  estado: string;
  isopleta: number;
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

async function populateIsoplethCoverages() {
  console.log('🚀 Iniciando população da tabela isopleth_coverages...\n');

  // 1. Ler o arquivo CSV
  console.log('📂 Lendo arquivo Isopletas.csv...');
  const csvPath = join(__dirname, '..', 'Isopletas.csv');
  const csvContent = readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n');
  
  // Remove o cabeçalho e linhas vazias
  const [header, ...dataLines] = lines;
  
  const csvData: IsopletaCSVRow[] = dataLines
    .filter(line => line.trim().length > 0)
    .map(line => {
      const parts = line.split(',').map(p => p.trim());
      return {
        municipio: parts[0] || '',
        estado: parts[1] || '',
        isopleta: parseInt(parts[2] || '0', 10)
      };
    })
    .filter(row => row.municipio && row.estado && !isNaN(row.isopleta) && row.isopleta > 0);

  console.log(`✓ ${csvData.length} registros lidos do CSV\n`);

  // 2. Buscar todas as isopletas
  console.log('🔍 Buscando isopletas do banco de dados...');
  const allIsopleths = await db.select().from(isopleths);
  console.log(`✓ ${allIsopleths.length} isopletas encontradas`);
  
  // Mostrar as faixas de velocidade de cada isopleta
  console.log('\n📋 Isopletas cadastradas:');
  for (const iso of allIsopleths) {
    const minSpeed = iso.windMinMS ? Number(iso.windMinMS) : 0;
    const maxSpeed = iso.windMaxMS ? Number(iso.windMaxMS) : 999;
    console.log(`   ${iso.code}: ${minSpeed} - ${maxSpeed} m/s`);
  }
  console.log('');

  // 3. Buscar todos os estados
  console.log('🔍 Buscando estados do banco de dados...');
  const allStates = await db.select().from(states);
  const stateMapByName = new Map(allStates.map(s => [normalizeText(s.name), s]));
  const stateMapByCode = new Map(allStates.map(s => [normalizeText(s.code), s]));
  console.log(`✓ ${allStates.length} estados encontrados\n`);

  // 4. Buscar todas as cidades
  console.log('🔍 Buscando cidades do banco de dados...');
  const allCities = await db.select().from(cities);
  console.log(`✓ ${allCities.length} cidades encontradas\n`);

  // 5. Criar mapa de cidades por nome normalizado e estado
  const cityMap = new Map<string, typeof allCities[0]>();
  for (const city of allCities) {
    const state = allStates.find(s => s.id === city.stateId);
    if (state) {
      const key = `${normalizeText(city.name)}|${normalizeText(state.name)}`;
      cityMap.set(key, city);
      
      // Também indexar por código do estado
      const keyByCode = `${normalizeText(city.name)}|${normalizeText(state.code)}`;
      cityMap.set(keyByCode, city);
    }
  }

  // 6. Limpar registros existentes (opcional - comentado por segurança)
  // console.log('🗑️  Limpando registros existentes...');
  // await db.delete(isoplethCoverages);
  // console.log('✓ Registros limpos\n');

  // 7. Processar cada registro do CSV
  console.log('⚙️  Processando registros e criando coberturas...\n');
  
  let processed = 0;
  let created = 0;
  let updated = 0;
  let notFoundCity = 0;
  let notFoundIsopleth = 0;
  let errors = 0;

  const notFoundCities: string[] = [];
  const notFoundIsopleths: Set<number> = new Set();

  for (const row of csvData) {
    processed++;
    
    try {
      // Encontrar a isopleta baseada na velocidade do vento
      const windSpeed = row.isopleta;
      const isopleth = allIsopleths.find(iso => {
        const minSpeed = iso.windMinMS ? Number(iso.windMinMS) : 0;
        const maxSpeed = iso.windMaxMS ? Number(iso.windMaxMS) : 999;
        
        // Verifica se a velocidade está dentro do range da isopleta
        return windSpeed >= minSpeed && windSpeed <= maxSpeed;
      });

      if (!isopleth) {
        if (!notFoundIsopleths.has(windSpeed)) {
          notFoundIsopleths.add(windSpeed);
        }
        notFoundIsopleth++;
        continue;
      }

      // Tentar encontrar a cidade por nome + nome do estado
      let cityKey = `${normalizeText(row.municipio)}|${normalizeText(row.estado)}`;
      let city = cityMap.get(cityKey);

      // Se não encontrou, tentar por código do estado
      if (!city) {
        cityKey = `${normalizeText(row.municipio)}|${normalizeText(row.estado)}`;
        city = cityMap.get(cityKey);
      }

      if (!city) {
        notFoundCities.push(`${row.municipio}/${row.estado}`);
        notFoundCity++;
        continue;
      }

      // Verificar se já existe um registro
      const existing = await db
        .select()
        .from(isoplethCoverages)
        .where(
          and(
            eq(isoplethCoverages.isoplethId, isopleth.id),
            eq(isoplethCoverages.cityId, city.id)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        // Já existe, não precisa fazer nada
        updated++;
      } else {
        // Criar novo registro
        await db.insert(isoplethCoverages).values({
          isoplethId: isopleth.id,
          cityId: city.id
        });
        created++;
      }

      if (processed % 100 === 0) {
        console.log(`   Processados: ${processed}/${csvData.length} | Criados: ${created} | Existentes: ${updated} | Não encontrados: ${notFoundCity + notFoundIsopleth}`);
      }

    } catch (error) {
      console.error(`❌ Erro ao processar ${row.municipio}/${row.estado}:`, error);
      errors++;
    }
  }

  console.log('\n✅ Processo concluído!');
  console.log(`\n📊 Resumo:`);
  console.log(`   Total processado: ${processed}`);
  console.log(`   Criados: ${created}`);
  console.log(`   Já existentes: ${updated}`);
  console.log(`   Cidades não encontradas: ${notFoundCity}`);
  console.log(`   Isopletas não encontradas: ${notFoundIsopleth}`);
  console.log(`   Erros: ${errors}`);

  if (notFoundIsopleths.size > 0) {
    console.log(`\n⚠️  Velocidades de vento sem isopleta correspondente:`);
    Array.from(notFoundIsopleths).sort((a, b) => a - b).forEach(speed => {
      console.log(`   ${speed} m/s`);
    });
  }

  if (notFoundCities.length > 0 && notFoundCities.length <= 20) {
    console.log(`\n⚠️  Cidades não encontradas no banco:`);
    notFoundCities.slice(0, 20).forEach(city => {
      console.log(`   ${city}`);
    });
    if (notFoundCities.length > 20) {
      console.log(`   ... e mais ${notFoundCities.length - 20} cidades`);
    }
  }
}

// Executar
populateIsoplethCoverages()
  .then(() => {
    console.log('\n✨ Script finalizado com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Erro fatal:', error);
    process.exit(1);
  });
