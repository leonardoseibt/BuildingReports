import 'dotenv/config';
import fs from 'fs';
import pg from 'pg';
const { Pool } = pg;

/*
  Lista cidades com vento_basico_m_s NULL e gera uma saída CSV.
  Agora suporta:
    --file=arquivo.csv   Escreve direto no arquivo (UTF-8)
    --bom                Inclui BOM (útil para Excel no Windows reconhecer acentuação)

  Uso exemplos:
    tsx scripts/check/cities-missing-wind.ts --file=missing_wind.csv --bom
    npm run check:missing-wind -- --file=missing_wind.csv --bom
*/

async function main(){
  const args = process.argv.slice(2);
  const fileArg = args.find(a=> a.startsWith('--file='));
  const outFile = fileArg ? fileArg.split('=')[1] : undefined;
  const withBOM = args.includes('--bom');

  const url = process.env.DATABASE_URL;
  if(!url){ console.error('DATABASE_URL não definido'); process.exit(1); }
  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT c.id, s.code AS uf, s.name AS state_name, c.name AS city
      FROM cities c
      JOIN states s ON s.id = c.state_id
      WHERE c.vento_basico_m_s IS NULL
      ORDER BY s.code, c.name
    `);
    const lines: string[] = [];
    lines.push('uf,state_name,city,suggested_wind_m_s,fonte');
    for (const r of res.rows){
      const uf = r.uf;
      // Mantemos acentuação; apenas removemos vírgula para não quebrar CSV simples.
      const stateName = (r.state_name || '').replace(/,/g,' ');
      const city = String(r.city).replace(/,/g,' ');
      lines.push(`${uf},${stateName},${city},,`);
    }
    if(outFile){
      const content = (withBOM ? '\uFEFF' : '') + lines.join('\n') + '\n';
      fs.writeFileSync(outFile, content, { encoding: 'utf8' });
      console.error(`Gerado ${outFile} com ${res.rows.length} cidades (BOM=${withBOM}).`);
    } else {
      // stdout (sem BOM por padrão)
      console.error(`Encontradas ${res.rows.length} cidades sem vento_basico_m_s. (Use --file=... --bom para Excel)`);
      lines.forEach(l=> console.log(l));
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e=> { console.error(e); process.exit(1); });
