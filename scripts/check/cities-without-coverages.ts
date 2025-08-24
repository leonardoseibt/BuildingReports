#!/usr/bin/env tsx
/**
 * Script: cities-without-coverages.ts
 * Objetivo: Verificar se todas as cidades cadastradas possuem ao menos uma entrada
 *           em bioclimatic_zone_coverages (abrangências de zonas bioclimáticas).
 * Saída:  - Resumo no console
 *         - Arquivo JSON em data/cities-without-coverages.json
 */
import 'dotenv/config';
import { db, pool } from '../../server/db';
import { bioclimaticZoneCoverages, cities, states } from '../../shared/schema';
import fs from 'node:fs';
import path from 'node:path';

interface CityRow { id: number; name: string; stateId: number; }
interface StateRow { id: number; code: string; name: string; }

async function main() {
  const allCities: CityRow[] = await db.select({ id: cities.id, name: cities.name, stateId: cities.stateId }).from(cities);
  const allStates: StateRow[] = await db.select({ id: states.id, code: states.code, name: states.name }).from(states);
  const stateById = new Map(allStates.map(s => [s.id, s]));

  // Obter cityIds que possuem cobertura (distinct)
  const covered = await db
    .select({ cityId: bioclimaticZoneCoverages.cityId })
    .from(bioclimaticZoneCoverages)
    .groupBy(bioclimaticZoneCoverages.cityId);
  const coveredSet = new Set(covered.map(c => c.cityId));

  const missing = allCities.filter(c => !coveredSet.has(c.id));

  console.log(`Total cidades: ${allCities.length}`);
  console.log(`Cidades com ao menos uma cobertura: ${coveredSet.size}`);
  console.log(`Cidades sem cobertura: ${missing.length}`);

  if (missing.length) {
    console.log('\nAlgumas cidades sem cobertura (primeiras 50):');
    for (const c of missing.slice(0, 50)) {
      const st = stateById.get(c.stateId);
      console.log(`- ${c.name} / ${st?.code}`);
    }
  } else {
    console.log('Todas as cidades possuem cobertura.');
  }

  const outDir = path.join(process.cwd(), 'data');
  fs.mkdirSync(outDir, { recursive: true });
  const payload = missing.map(c => ({ id: c.id, name: c.name, state: stateById.get(c.stateId)?.code }));
  fs.writeFileSync(path.join(outDir, 'cities-without-coverages.json'), JSON.stringify({ generatedAt: new Date().toISOString(), totalCities: allCities.length, covered: coveredSet.size, missingCount: missing.length, missing: payload }, null, 2));
  console.log('\nResultado salvo em data/cities-without-coverages.json');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => pool.end());
