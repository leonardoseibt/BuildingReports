import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import pg from 'pg';
const { Pool } = pg;

/*
  Otimizado: pré-carrega estados e cidades em memória e faz UPDATE em lote.
  Uso:
    tsx scripts/import/update-cities-wind.ts <isopletas.csv> [--overwrite] [--dry-run] [--progress=N]

  Flags:
    --overwrite    Sobrescreve valores já existentes (default: não sobrescreve)
    --dry-run      Apenas mostra estatísticas, não executa UPDATE
    --progress=N   Log a cada N linhas processadas (default 500)
    --fallback-db  Caso não encontre a cidade pela chave normalizada em memória, tenta uma busca direta (lower) no banco.
    --delimiter=,|; Força delimitador (ignora detecção automática). Pode usar ',', ';', 'comma', 'semicolon'.
*/

interface Row { [k: string]: string }

function normalizeKey(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/[^a-z0-9]+/g,'').trim();
}
// Normalização usada na chave: minúsculas, sem acentos, só caracteres [a-z0-9].
// Isso já garante busca case-insensitive e accent-insensitive.
function normalizeCityName(s: string): string { return normalizeKey(s); }

function parseCSV(content: string, forcedDelim?: string): Row[] {
  const lines = content.replace(/\r\n?/g,'\n').split('\n').filter(l=>l.trim().length>0);
  if (!lines.length) return [];
  let delim: string;
  if(forcedDelim){
    if([',','comma','COMMA'].includes(forcedDelim)) delim = ','; else if([';','semicolon','SEMICOLON'].includes(forcedDelim)) delim = ';'; else delim = ',';
  } else {
    const first = lines[0];
    const comma = (first.match(/,/g)||[]).length;
    const semi = (first.match(/;/g)||[]).length;
    delim = semi>comma?';':',';
  }
  const parseLine = (line: string): string[] => {
    const out: string[] = []; let cur=''; let q=false; for (let i=0;i<line.length;i++){ const ch=line[i]; if(q){ if(ch==='\"'){ if(line[i+1]==='\"'){cur+='\"';i++;} else {q=false;} } else cur+=ch; } else { if(ch==='\"'){ q=true; } else if(ch===delim){ out.push(cur); cur=''; } else cur+=ch; } } out.push(cur); return out.map(s=>s.trim()); };
  const header = parseLine(lines[0]);
  const rows: Row[] = [];
  for (let i=1;i<lines.length;i++){ const cols=parseLine(lines[i]); if(cols.length===1 && cols[0]==='') continue; const row: Row = {}; header.forEach((h,idx)=> row[h]=cols[idx]??''); rows.push(row); }
  return rows;
}

function getField(row: Row, names: string[]): string | undefined {
  const idx: Record<string,string> = {}; Object.keys(row).forEach(k=> idx[normalizeKey(k)] = k);
  for (const n of names){ const nk=normalizeKey(n); const real = idx[nk]; if(real){ const v = row[real].trim(); if(v) return v; } }
  // fallback parcial
  for (const n of names){ const nk=normalizeKey(n); const k = Object.keys(row).find(k0=> normalizeKey(k0).includes(nk) || nk.includes(normalizeKey(k0))); if(k){ const v = row[k].trim(); if(v) return v; } }
  return undefined;
}

function toNum(v?: string): number | null {
  if(!v) return null; let s=v.trim(); if(!s) return null;
  if(/^[0-9]{1,3}(\.[0-9]{3})+(,[0-9]+)?$/.test(s)){ s = s.replace(/\./g,'').replace(',', '.'); }
  else if(/^[0-9]{1,3}(,[0-9]{3})+(\.[0-9]+)?$/.test(s)){ s = s.replace(/,/g,''); }
  else { s = s.replace(',', '.'); }
  const n = parseFloat(s); return Number.isFinite(n)? n : null;
}

async function main(){
  const args = process.argv.slice(2);
  if(args.length===0){ console.error('Uso: tsx scripts/import/update-cities-wind.ts <isopletas.csv> [--overwrite] [--dry-run] [--progress=N]'); process.exit(1); }
  const file = args[0];
  const overwrite = args.includes('--overwrite');
  const dryRun = args.includes('--dry-run');
  const fallbackDb = args.includes('--fallback-db');
  const progressArg = args.find(a=> a.startsWith('--progress='));
  const progressEvery = progressArg ? parseInt(progressArg.split('=')[1],10) || 500 : 500;
  const abs = path.isAbsolute(file)? file : path.resolve(process.cwd(), file);
  if(!fs.existsSync(abs)){ console.error('File not found:', abs); process.exit(1); }
  const delimFlag = args.find(a=> a.startsWith('--delimiter='));
  const forcedDelim = delimFlag ? delimFlag.split('=')[1] : undefined;
  let csv = fs.readFileSync(abs, 'utf8'); if(csv.includes('\uFFFD')||csv.includes('�')) csv = fs.readFileSync(abs, 'latin1');
  const rows = parseCSV(csv, forcedDelim);
  console.log('Parsed', rows.length, 'rows');

  const url = process.env.DATABASE_URL; if(!url){ console.error('DATABASE_URL not set'); process.exit(1); }
  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    // Pré-carregar estados
    const statesRes = await client.query('SELECT id, code, name FROM states');
    const stateCodeToId = new Map<string, number>();
    const stateNameNormToId = new Map<string, number>();
    for (const r of statesRes.rows){
      const code = String(r.code).toUpperCase();
      stateCodeToId.set(code, Number(r.id));
      if (r.name) {
        stateNameNormToId.set(normalizeCityName(String(r.name)), Number(r.id));
      }
    }
    // Mapa fixo de nomes completos -> siglas (caso a tabela states.name não tenha o nome completo)
    const fullNameToUF: Record<string,string> = {
      'acre':'AC','alagoas':'AL','amapa':'AP','amazonas':'AM','bahia':'BA','ceara':'CE','distritofederal':'DF','espiritosanto':'ES','goias':'GO','maranhao':'MA','matogrosso':'MT','matogrossodosul':'MS','minasgerais':'MG','para':'PA','paraiba':'PB','parana':'PR','pernambuco':'PE','piaui':'PI','riodejaneiro':'RJ','riograndedonorte':'RN','riograndedosul':'RS','rondonia':'RO','roraima':'RR','santacatarina':'SC','saopaulo':'SP','sergipe':'SE','tocantins':'TO'};
    // Pré-carregar cidades
    const citiesRes = await client.query('SELECT id, state_id, name, vento_basico_m_s FROM cities');
    interface CityInfo { id:number; stateId:number; name:string; existing:number|null }
    const cityMap = new Map<string, CityInfo>();
    for (const r of citiesRes.rows){
      const stateId = Number(r.state_id); const name = String(r.name); const key = stateId + '|' + normalizeCityName(name); 
      cityMap.set(key, { id: Number(r.id), stateId, name, existing: r.vento_basico_m_s == null ? null : Number(r.vento_basico_m_s) });
    }
    console.log(`Loaded ${stateCodeToId.size} states and ${cityMap.size} cities from DB.`);

    let toUpdate: { id:number; value:number }[] = [];
    let skippedNoMatch=0, skippedNoValue=0, preservedExisting=0, duplicateCityRows=0;
    const seenForCity = new Set<number>();

    rows.forEach((r, idx)=>{
      const ufRaw = getField(r,['UF','Estado','SiglaUF','SG_UF','ESTADO']);
      const cityName = getField(r,['Cidade','Municipio','Município','City','Municipality','Nome_Municipio','NomeMunicípio','NM_MUNICIPIO']);
      const iso = getField(r,['ISOPLETA','Isopleta','Isopletas','Vento Básico','VentoBasico','Vento_Basico','VENTO_BASICO']);
      const val = toNum(iso ?? '');
      if(!ufRaw || !cityName){ skippedNoMatch++; return; }
      if(val==null){ skippedNoValue++; return; }
      let stateId = stateCodeToId.get(ufRaw.toUpperCase());
      if(!stateId){
        // tentar por nome completo normalizado
        const norm = normalizeCityName(ufRaw);
        // se states.name estiver preenchido
        stateId = stateNameNormToId.get(norm);
        if(!stateId){
          const ufFromFull = fullNameToUF[norm];
          if(ufFromFull){ stateId = stateCodeToId.get(ufFromFull); }
        }
      }
      if(!stateId){ skippedNoMatch++; return; }
      const key = stateId + '|' + normalizeCityName(cityName);
      const city = cityMap.get(key);
      if(!city){
        // Se não achou pela chave normalizada e fallback habilitado,
        // registra para tentativa posterior individual no DB.
        if(fallbackDb) {
          toUpdate.push({ id: -stateId, value: val }); // placeholder com id negativo para marcar fallback
          return;
        }
        skippedNoMatch++; return;
      }
      if(city.existing != null && !overwrite){ preservedExisting++; return; }
      if(seenForCity.has(city.id) && !overwrite){ duplicateCityRows++; return; }
      seenForCity.add(city.id);
      toUpdate.push({ id: city.id, value: val });
      if(progressEvery>0 && (idx+1)%progressEvery===0){
        process.stdout.write(`Processed ${idx+1}/${rows.length} rows... updates queued: ${toUpdate.length}\r`);
      }
    });

    console.log();
    console.log('Queue built. Candidates to update:', toUpdate.length);
    if(dryRun){
      console.log({ dryRun:true, willUpdate: toUpdate.length, skippedNoMatch, skippedNoValue, preservedExisting, duplicateCityRows });
      return;
    }
    if(toUpdate.length === 0){
      console.log({ updated:0, skippedNoMatch, skippedNoValue, preservedExisting, duplicateCityRows });
      return;
    }
    // Separar itens normais e fallbacks (id negativo sinaliza fallbackDb)
    const normalUpdates = toUpdate.filter(t=> t.id > 0);
    const fallbackMarkers = toUpdate.filter(t=> t.id < 0);

    const chunkSize = 1000;
    let updated = 0;
    for (let i=0;i<normalUpdates.length;i+=chunkSize){
      const slice = normalUpdates.slice(i, i+chunkSize);
      const ids = slice.map(s=> s.id);
      const values = slice.map(s=> s.value);
      await client.query('UPDATE cities AS c SET vento_basico_m_s = v.val FROM (SELECT UNNEST($1::int[]) AS id, UNNEST($2::numeric[]) AS val) v WHERE c.id = v.id', [ids, values]);
      updated += slice.length;
      console.log(`Applied batch: ${updated}/${normalUpdates.length}`);
    }

    // Fallbacks: tentativas individuais case-insensitive direto no banco.
    let fallbackUpdated = 0;
    if(fallbackDb && fallbackMarkers.length){
      console.log(`Attempting DB fallback for ${fallbackMarkers.length} unmatched rows...`);
      // Reprocessar rows para tentar localizar especificamente as que falharam.
      // (Simplificação: percorre novamente rows, poderia armazenar dados antes.)
      for (const r of rows){
        const ufRaw = getField(r,['UF','Estado','SiglaUF','SG_UF','ESTADO']);
        const cityName = getField(r,['Cidade','Municipio','Município','City','Municipality','Nome_Municipio','NomeMunicípio','NM_MUNICIPIO']);
        const iso = getField(r,['ISOPLETA','Isopleta','Isopletas','Vento Básico','VentoBasico','Vento_Basico','VENTO_BASICO']);
        const val = toNum(iso ?? '');
        if(!ufRaw || !cityName || val == null) continue;
        let stateId = stateCodeToId.get(ufRaw.toUpperCase());
        if(!stateId){
          const norm = normalizeCityName(ufRaw);
          stateId = stateNameNormToId.get(norm) || (fullNameToUF[norm] ? stateCodeToId.get(fullNameToUF[norm]) : undefined);
        }
        if(!stateId) continue;
        const key = stateId + '|' + normalizeCityName(cityName);
        if(cityMap.has(key)) continue; // já tratada
        const res = await client.query('SELECT c.id, c.vento_basico_m_s FROM cities c WHERE c.state_id = $1 AND lower(c.name) = lower($2) LIMIT 1', [stateId, cityName]);
        if(res.rows.length===0) continue;
        const rowDb = res.rows[0];
        if(rowDb.vento_basico_m_s != null && !overwrite) continue;
        await client.query('UPDATE cities SET vento_basico_m_s = $1 WHERE id = $2', [val, rowDb.id]);
        fallbackUpdated++;
      }
    }

    console.log({ updated: normalUpdates.length, fallbackUpdated, skippedNoMatch, skippedNoValue, preservedExisting, duplicateCityRows });
  } finally {
    client.release(); await pool.end();
  }
}

main().catch(e=> { console.error(e); process.exit(1); });
