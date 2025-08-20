import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
const { Pool } = pg;

type Row = Record<string, string>;

function normKey(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '') // remove non-alphanum
    .trim();
}

function parseCSV(content: string): Row[] {
  // Lightweight CSV parser supporting quoted fields and commas inside quotes.
  // For simplicity, handle CRLF and LF; assumes UTF-8.
  const lines = content.replace(/\r\n?/g, '\n').split('\n').filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];
  // Detect delimiter by first line
  const first = lines[0];
  const commaCount = (first.match(/,/g) || []).length;
  const semiCount = (first.match(/;/g) || []).length;
  const delim = semiCount > commaCount ? ';' : ',';
  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') { // escaped quote
            cur += '"'; i++;
          } else {
            inQuotes = false;
          }
        } else {
          cur += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === delim) {
          out.push(cur); cur = '';
        } else {
          cur += ch;
        }
      }
    }
    out.push(cur);
    return out.map(s => s.trim());
  };
  const header = parseLine(lines[0]).map(h => h.trim());
  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    if (cols.length === 1 && cols[0] === '') continue;
    const row: Row = {};
    header.forEach((h, idx) => { row[h] = cols[idx] ?? ''; });
    rows.push(row);
  }
  return rows;
}

function getField(row: Row, names: string[]): string | undefined {
  const keys = Object.keys(row);
  const map: Record<string, string> = {};
  for (const k of keys) map[normKey(k)] = k;
  for (const n of names) {
    const nk = normKey(n);
    const match = map[nk];
    if (match !== undefined && row[match] !== undefined) {
      const val = String(row[match]).trim();
      if (val !== '') return val;
    }
  }
  // fallback: try partial contains
  for (const n of names) {
    const nk = normKey(n);
    const k = keys.find(k0 => {
      const kk = normKey(k0);
      return kk.includes(nk) || nk.includes(kk);
    });
    if (k && row[k] !== undefined) {
      const val = String(row[k]).trim();
      if (val !== '') return val;
    }
  }
  return undefined;
}

function normZoneCode(v?: string): string | undefined {
  if (!v) return undefined;
  let s = v.toUpperCase().replace(/\s+/g, '');
  // Remove common prefixes
  if (s.startsWith('ZB')) s = s.slice(2);
  // Map possible representations like '3-A' or '3_A' -> '3A'
  s = s.replace(/[-_]/g, '');
  return s;
}

function toNum(v?: string): number | null {
  if (v == null) return null;
  let s = String(v).trim();
  if (s === '') return null;
  s = s.replace(/\s+/g, '');
  // pt-BR thousand separator
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    s = s.replace(/\./g, '').replace(/,/, '.');
  } else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) {
    // en-US thousands
    s = s.replace(/,/g, '');
  } else {
    // generic: decimal comma -> dot
    s = s.replace(/,/, '.');
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: tsx scripts/import/coverages-from-csv.ts <file.csv>');
    process.exit(1);
  }
  const abs = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);
  if (!fs.existsSync(abs)) {
    console.error('File not found:', abs);
    process.exit(1);
  }

  // Try UTF-8, fallback to latin1 if we see replacement characters (�)
  let csv = fs.readFileSync(abs, 'utf8');
  if (csv.includes('\uFFFD') || csv.includes('�')) {
    csv = fs.readFileSync(abs, 'latin1');
  }
  const rows = parseCSV(csv);
  console.log(`Parsed ${rows.length} rows from CSV.`);

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  try {
  const zonesRes = await client.query('SELECT id, code FROM bioclimatic_zones');
    const zoneMap = new Map<string, number>();
    zonesRes.rows.forEach((r: any) => zoneMap.set(String(r.code).toUpperCase(), Number(r.id)));
    if (zoneMap.size === 0) {
      console.error('No zones found in table bioclimatic_zones. Seed zones first.');
      process.exit(1);
    }

  await client.query('BEGIN');

    let inserted = 0, createdStates = 0, createdCities = 0, updatedCities = 0, skipped = 0, duplicates = 0;
    for (const r of rows) {
      const uf = getField(r, ['UF', 'Estado', 'state', 'SIGLA_UF', 'SiglaUF', 'UF_SIGLA', 'SG_UF']);
      const cityName = getField(r, ['Município', 'Municipio', 'Cidade', 'city', 'NM_MUN', 'Nome_Municipio', 'Nome_Município', 'NM_MUNICIPIO', 'MUNICIPIO', 'MUNICÍPIO', 'NomeMunicípio']);
      const reg = getField(r, ['Região', 'Regiao', 'Região IBGE', 'region', 'REGIAO', 'Macrorregião', 'Macrorregiao', 'REGIAO_GEOGRAFICA', 'REGIAO_IBGE']);
      const codeRaw = getField(r, ['ZB', 'Zona', 'Zona_Bioclimatica', 'Zona Bioclimática', 'zone', 'ZONA_2024', 'ZB2024', 'ZB_2024', 'Zona_2024']);
      const code = normZoneCode(codeRaw);
      if (!uf || !code || !cityName) { skipped++; continue; } // require UF, city, and Zone
      const zoneId = zoneMap.get(code) || zoneMap.get((normZoneCode('ZB' + code) || ''));
      if (!zoneId) { console.warn('Unknown zone code:', code); skipped++; continue; }

      const latitude = toNum(getField(r, ['Latitude', 'LAT', 'LATITUDE']));
      const longitude = toNum(getField(r, ['Longitude', 'LONG', 'LON', 'LONGITUDE']));
      const altitude = toNum(getField(r, ['Altitude_m', 'Altitude (m)', 'ALTITUDE', 'ALT']));
      const tbs = toNum(getField(r, ['TBS_C', 'TBS (C)', 'TBS (°C)', 'TBS', 'TEMP_BULBO_SECO', 'TBS_C_MED']));
      const ur = toNum(getField(r, ['UR_%', 'UR (%)', 'UR', 'UMIDADE_RELATIVA', 'UR_MED']));
      const rad = toNum(getField(r, ['Radiação_Wm2', 'Radiacao_Wm2', 'Radiação (W/m2)', 'Radiação (W/m²)', 'RADIACAO_WM2', 'RADIACAO_HG_DM_WM2', 'RADIACAO_HG_DM_W_M2', 'RADIACAO_MEDIA_WM2', 'RADIACAO', 'RADIACAO_HG']));
      const vento = toNum(getField(r, ['Vento_m_s', 'Vento (m/s)', 'VENTO_M_S', 'VENTO', 'VEL_VENTO', 'VEL_VENTO_M_S']));
      const amp = toNum(getField(r, ['Amplitude_C', 'Amplitude (C)', 'Amplitude (°C)', 'AMPLITUDE_C', 'AMPL_TERMICA']));

      // Ensure state
      const ufCode = uf.toUpperCase();
      let stateId: number | null = null;
      {
        const st = await client.query('SELECT id FROM states WHERE code = $1', [ufCode]);
        if (st.rows.length > 0) {
          stateId = Number(st.rows[0].id);
        } else {
          const ins = await client.query('INSERT INTO states (code, name) VALUES ($1, $2) RETURNING id', [ufCode, ufCode]);
          stateId = Number(ins.rows[0].id);
          createdStates++;
        }
      }

      // Ensure city
      let cityId: number | null = null;
      {
        const sel = await client.query('SELECT id, region, latitude, longitude, altitude_m, tbs_c, ur_percent, radiacao_wm2, vento_m_s, amplitude_c FROM cities WHERE state_id = $1 AND lower(name) = lower($2) LIMIT 1', [stateId, cityName]);
        if (sel.rows.length > 0) {
          cityId = Number(sel.rows[0].id);
          // Update metrics if we have values and existing are null
          const needsUpdate = (
            (reg && !sel.rows[0].region) ||
            (latitude != null && sel.rows[0].latitude == null) ||
            (longitude != null && sel.rows[0].longitude == null) ||
            (altitude != null && sel.rows[0].altitude_m == null) ||
            (tbs != null && sel.rows[0].tbs_c == null) ||
            (ur != null && sel.rows[0].ur_percent == null) ||
            (rad != null && sel.rows[0].radiacao_wm2 == null) ||
            (vento != null && sel.rows[0].vento_m_s == null) ||
            (amp != null && sel.rows[0].amplitude_c == null)
          );
          if (needsUpdate) {
            await client.query(
              `UPDATE cities SET 
                region = COALESCE(region, $1),
                latitude = COALESCE(latitude, $2),
                longitude = COALESCE(longitude, $3),
                altitude_m = COALESCE(altitude_m, $4),
                tbs_c = COALESCE(tbs_c, $5),
                ur_percent = COALESCE(ur_percent, $6),
                radiacao_wm2 = COALESCE(radiacao_wm2, $7),
                vento_m_s = COALESCE(vento_m_s, $8),
                amplitude_c = COALESCE(amplitude_c, $9)
               WHERE id = $10`,
              [reg || null, latitude, longitude, altitude, tbs, ur, rad, vento, amp, cityId]
            );
            updatedCities++;
          }
        } else {
          const ins = await client.query(
            `INSERT INTO cities (state_id, name, region, latitude, longitude, altitude_m, tbs_c, ur_percent, radiacao_wm2, vento_m_s, amplitude_c)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
             RETURNING id`,
            [stateId, cityName, reg || null, latitude, longitude, altitude, tbs, ur, rad, vento, amp]
          );
          cityId = Number(ins.rows[0].id);
          createdCities++;
        }
      }

      // Associate coverage if not exists
  const exists = await client.query('SELECT 1 FROM bioclimatic_zone_coverages WHERE zone_id=$1 AND city_id=$2', [zoneId, cityId]);
      if (exists.rows.length === 0) {
        await client.query('INSERT INTO bioclimatic_zone_coverages (zone_id, city_id) VALUES ($1, $2)', [zoneId, cityId]);
        inserted++;
      } else {
        duplicates++;
      }
    }
    await client.query('COMMIT');
    console.log(`Inserted ${inserted} coverages. Created states: ${createdStates}, created cities: ${createdCities}, updated cities: ${updatedCities}, skipped: ${skipped}, duplicates: ${duplicates}.`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Import failed:', e);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
