import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { db } from '../server/db';
import { isopleths, isoplethCoverages, cities, states } from '../shared/schema';
import { eq, and, inArray } from 'drizzle-orm';

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

async function fixDuplicateIsoplethCoverages() {
  console.log('🚀 Iniciando correção de duplicatas em isopleth_coverages...\n');

  // 1. Ler o arquivo CSV (fonte da verdade)
  console.log('📂 Lendo arquivo Isopletas.csv...');
  const csvPath = join(__dirname, '..', 'Isopletas.csv');
  const csvContent = readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n');
  
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
  console.log(`✓ ${allIsopleths.length} isopletas encontradas\n`);

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
  const cityIdToState = new Map<number, typeof allStates[0]>();
  
  for (const city of allCities) {
    const state = allStates.find(s => s.id === city.stateId);
    if (state) {
      cityIdToState.set(city.id, state);
      
      const key = `${normalizeText(city.name)}|${normalizeText(state.name)}`;
      cityMap.set(key, city);
      
      const keyByCode = `${normalizeText(city.name)}|${normalizeText(state.code)}`;
      cityMap.set(keyByCode, city);
    }
  }

  // 6. Buscar todos os registros de isopleth_coverages
  console.log('🔍 Buscando todas as coberturas existentes...');
  const allCoverages = await db.select().from(isoplethCoverages);
  console.log(`✓ ${allCoverages.length} coberturas encontradas\n`);

  // 7. Agrupar coberturas por cityId para detectar duplicatas
  console.log('🔍 Detectando duplicatas...');
  const coveragesByCity = new Map<number, typeof allCoverages>();
  
  for (const coverage of allCoverages) {
    const cityId = coverage.cityId;
    if (!coveragesByCity.has(cityId)) {
      coveragesByCity.set(cityId, []);
    }
    coveragesByCity.get(cityId)!.push(coverage);
  }

  // Encontrar cidades com múltiplas coberturas
  const duplicates = Array.from(coveragesByCity.entries())
    .filter(([cityId, coverages]) => coverages.length > 1);

  console.log(`✓ ${duplicates.length} cidades com duplicatas encontradas\n`);

  if (duplicates.length === 0) {
    console.log('✅ Nenhuma duplicata encontrada! Banco de dados está correto.\n');
    return;
  }

  // 8. Para cada cidade com duplicata, corrigir baseado no CSV
  console.log('⚙️  Corrigindo duplicatas...\n');
  
  let processed = 0;
  let deleted = 0;
  let kept = 0;
  let notFoundInCSV = 0;
  let errors = 0;

  for (const [cityId, coverages] of duplicates) {
    processed++;
    
    try {
      const city = allCities.find(c => c.id === cityId);
      const state = cityIdToState.get(cityId);
      
      if (!city || !state) {
        console.error(`❌ Cidade ou estado não encontrado para cityId: ${cityId}`);
        errors++;
        continue;
      }

      // Buscar no CSV qual é a isopleta correta para esta cidade
      const cityKey1 = `${normalizeText(city.name)}|${normalizeText(state.name)}`;
      const cityKey2 = `${normalizeText(city.name)}|${normalizeText(state.code)}`;
      
      const csvRow = csvData.find(row => {
        const key1 = `${normalizeText(row.municipio)}|${normalizeText(row.estado)}`;
        const key2 = `${normalizeText(row.municipio)}|${normalizeText(row.estado)}`;
        return key1 === cityKey1 || key2 === cityKey2 || key1 === cityKey2 || key2 === cityKey1;
      });

      if (!csvRow) {
        console.log(`⚠️  ${city.name}/${state.code}: Não encontrada no CSV, mantendo registros`);
        notFoundInCSV++;
        continue;
      }

      // Encontrar qual é a isopleta correta baseada na velocidade do CSV
      const windSpeed = csvRow.isopleta;
      const correctIsopleth = allIsopleths.find(iso => {
        const minSpeed = iso.windMinMS ? Number(iso.windMinMS) : 0;
        const maxSpeed = iso.windMaxMS ? Number(iso.windMaxMS) : 999;
        return windSpeed >= minSpeed && windSpeed <= maxSpeed;
      });

      if (!correctIsopleth) {
        console.log(`⚠️  ${city.name}/${state.code}: Isopleta não encontrada para velocidade ${windSpeed} m/s`);
        errors++;
        continue;
      }

      // Separar coberturas: a correta e as incorretas
      const correctCoverage = coverages.find(c => c.isoplethId === correctIsopleth.id);
      const incorrectCoverages = coverages.filter(c => c.isoplethId !== correctIsopleth.id);

      if (!correctCoverage && incorrectCoverages.length === coverages.length) {
        // Nenhuma cobertura está correta, deletar todas e criar a correta
        const idsToDelete = incorrectCoverages.map(c => c.id);
        
        console.log(`🔧 ${city.name}/${state.code}: Deletando ${incorrectCoverages.length} registros incorretos e criando correto (Isopleta ${correctIsopleth.code})`);
        
        await db.delete(isoplethCoverages)
          .where(inArray(isoplethCoverages.id, idsToDelete));
        
        await db.insert(isoplethCoverages).values({
          isoplethId: correctIsopleth.id,
          cityId: city.id
        });
        
        deleted += incorrectCoverages.length;
        kept += 1;
      } else if (correctCoverage && incorrectCoverages.length > 0) {
        // Tem a correta e tem incorretas, deletar apenas as incorretas
        const idsToDelete = incorrectCoverages.map(c => c.id);
        
        const incorrectIsopleths = incorrectCoverages
          .map(c => allIsopleths.find(iso => iso.id === c.isoplethId)?.code)
          .filter(Boolean)
          .join(', ');
        
        console.log(`🔧 ${city.name}/${state.code}: Deletando ${incorrectCoverages.length} registros incorretos (${incorrectIsopleths}), mantendo correto (${correctIsopleth.code})`);
        
        await db.delete(isoplethCoverages)
          .where(inArray(isoplethCoverages.id, idsToDelete));
        
        deleted += incorrectCoverages.length;
        kept += 1;
      } else {
        // Só tem a correta, nada a fazer (não deveria cair aqui)
        console.log(`✓ ${city.name}/${state.code}: Apenas registro correto encontrado`);
        kept += coverages.length;
      }

      if (processed % 10 === 0) {
        console.log(`   Processados: ${processed}/${duplicates.length} | Deletados: ${deleted} | Mantidos: ${kept}\n`);
      }

    } catch (error) {
      console.error(`❌ Erro ao processar cityId ${cityId}:`, error);
      errors++;
    }
  }

  console.log('\n✅ Processo concluído!');
  console.log(`\n📊 Resumo:`);
  console.log(`   Cidades processadas: ${processed}`);
  console.log(`   Registros deletados: ${deleted}`);
  console.log(`   Registros mantidos: ${kept}`);
  console.log(`   Cidades não encontradas no CSV: ${notFoundInCSV}`);
  console.log(`   Erros: ${errors}`);
}

// Executar
fixDuplicateIsoplethCoverages()
  .then(() => {
    console.log('\n✨ Script finalizado com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Erro fatal:', error);
    process.exit(1);
  });
