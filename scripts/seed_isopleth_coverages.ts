#!/usr/bin/env tsx
/**
 * Script: seed_isopleth_coverages.ts
 * Objetivo: Popular a tabela isopleth_coverages associando cada cidade à isopleta
 *           cuja faixa de velocidade básica do vento (ventoBasicoMS) contem o valor
 *           da cidade (cities.vento_basico_m_s).
 * Regra de intervalo: Faixas tratadas como semi-abertas encadeadas.
 *   Modelo de classificação: intervalos declarados como [min, max] mas, quando
 *   há fronteira compartilhada (max == próximo.min), o valor pertence à faixa anterior.
 *   Implementação: ordenar por min asc e selecionar a PRIMEIRA isopleta cujo
 *   min <= v AND (max IS NULL OR v <= max). Isso dá preferência à faixa anterior.
 *
 * Uso:
 *   tsx scripts/seed_isopleth_coverages.ts           # execução normal (insere)
 *   tsx scripts/seed_isopleth_coverages.ts --dry-run # apenas simula, sem inserir
 *
 * Saídas:
 *   - Resumo no console (totais, por isopleta, cidades sem correspondência)
 *   - Arquivo JSON com cidades não classificadas (data/missing-isopleth-wind-cities.json)
 */
import 'dotenv/config';
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
const { Pool } = pg;

interface IsoplethRow { id: number; code: string; min: number | null; max: number | null; }
interface CityRow { id: number; name: string; stateId: number; wind: number; }

function toNum(v: any): number | null { if (v === null || v === undefined) return null; const n = Number(v); return Number.isFinite(n) ? n : null; }

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const url = process.env.DATABASE_URL;
  if (!url) { console.error('DATABASE_URL não configurada'); process.exit(1); }
  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    console.log(dryRun ? '[DRY-RUN] Simulação de inserção de isopleth_coverages' : 'Iniciando inserção de isopleth_coverages');
    const isoRes = await client.query(`
      SELECT id, code, wind_min_m_s, wind_max_m_s
      FROM isopleths
      WHERE is_active = true
      ORDER BY wind_min_m_s NULLS FIRST, wind_max_m_s NULLS FIRST, id
    `);
    const isopleths: IsoplethRow[] = isoRes.rows.map(r => ({
      id: Number(r.id),
      code: String(r.code),
      min: toNum(r.wind_min_m_s),
      max: toNum(r.wind_max_m_s)
    }));
    if (isopleths.length === 0) {
      console.error('Nenhuma isopleta ativa encontrada. Abortando.');
      return;
    }

  // Verificação de sobreposição (igualdade de fronteira não conta como sobreposição)
    for (let i = 0; i < isopleths.length; i++) {
      for (let j = i + 1; j < isopleths.length; j++) {
        const a = isopleths[i]; const b = isopleths[j];
        const aMin = a.min ?? -Infinity; const aMax = a.max ?? +Infinity;
        const bMin = b.min ?? -Infinity; const bMax = b.max ?? +Infinity;
  if (aMin < bMax && bMin < aMax && aMax !== bMin) {
          console.warn(`Aviso: possível sobreposição entre ${a.code} [${aMin}, ${aMax}] e ${b.code} [${bMin}, ${bMax}]`);
        }
      }
    }

    const cityRes = await client.query(`
      SELECT id, name, state_id, vento_basico_m_s
      FROM cities
      WHERE vento_basico_m_s IS NOT NULL
    `);
    const cities: CityRow[] = cityRes.rows.map(r => ({
      id: Number(r.id),
      name: String(r.name),
      stateId: Number(r.state_id),
      wind: Number(r.vento_basico_m_s)
    }));
    console.log(`Isopletas ativas: ${isopleths.length}`);
    console.log(`Cidades com ventoBasicoMS: ${cities.length}`);

    // Construir índices para classificação
    const sortedIso = [...isopleths].sort((a, b) => {
      const amin = a.min ?? -Infinity; const bmin = b.min ?? -Infinity;
      if (amin !== bmin) return amin - bmin;
      const amax = a.max ?? +Infinity; const bmax = b.max ?? +Infinity;
      return amax - bmax;
    });

    interface Assignment { cityId: number; isoplethId: number; }
    const assignments: Assignment[] = [];
    const perIsoCount = new Map<number, number>();
    const unmatched: CityRow[] = [];

    for (const c of cities) {
      const v = c.wind;
      const match = sortedIso.find(i => {
        const min = i.min ?? -Infinity; const max = i.max ?? +Infinity;
        return v >= min && v <= max; // limite superior inclusive; primeira encontrada prevalece
      });
      if (match) {
        assignments.push({ cityId: c.id, isoplethId: match.id });
        perIsoCount.set(match.id, (perIsoCount.get(match.id) || 0) + 1);
      } else {
        unmatched.push(c);
      }
    }

    console.log(`Cidades classificadas: ${assignments.length}`);
    console.log(`Cidades não classificadas: ${unmatched.length}`);
    console.log('Distribuição por isopleta:');
    for (const iso of sortedIso) {
      console.log(`  - ${iso.code}: ${perIsoCount.get(iso.id) || 0}`);
    }

    if (unmatched.length) {
      const outDir = path.join(process.cwd(), 'data');
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'missing-isopleth-wind-cities.json'), JSON.stringify({
        generatedAt: new Date().toISOString(),
        totalCitiesWithWind: cities.length,
        unmatchedCount: unmatched.length,
        unmatched: unmatched.slice(0, 500).map(c => ({ id: c.id, name: c.name, stateId: c.stateId, ventoBasicoMS: c.wind }))
      }, null, 2));
      console.log('Arquivo data/missing-isopleth-wind-cities.json gerado');
    }

    if (dryRun) {
      console.log('[DRY-RUN] Nenhuma inserção realizada.');
      return;
    }

    await client.query('BEGIN');
    let inserted = 0, skipped = 0;
    for (const a of assignments) {
      // Evitar duplicados
      const res = await client.query('SELECT 1 FROM isopleth_coverages WHERE isopleth_id = $1 AND city_id = $2 LIMIT 1', [a.isoplethId, a.cityId]);
      if (res.rows.length) { skipped++; continue; }
      await client.query('INSERT INTO isopleth_coverages (isopleth_id, city_id) VALUES ($1, $2)', [a.isoplethId, a.cityId]);
      inserted++;
    }
    await client.query('COMMIT');
    console.log(`Inserções concluídas. Novas linhas: ${inserted}. Já existentes: ${skipped}.`);
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('Erro durante processamento:', e);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
