import fs from 'fs';

function normKey(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '').trim();
}

type Row = Record<string, string>;

function parseCSV(content: string): { header: string[]; rows: Row[] } {
  const lines = content.replace(/\r\n?/g, '\n').split('\n').filter(l => l.trim().length > 0);
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
          if (i + 1 < line.length && line[i + 1] === '"') { cur += '"'; i++; }
          else { inQuotes = false; }
        } else { cur += ch; }
      } else {
        if (ch === '"') inQuotes = true; else if (ch === delim) { out.push(cur); cur=''; } else cur += ch;
      }
    }
    out.push(cur);
    return out.map(s => s.trim());
  };
  const header = parseLine(lines[0]);
  const rows: Row[] = [];
  for (let i = 1; i < Math.min(lines.length, 20); i++) {
    const cols = parseLine(lines[i]);
    const row: Row = {};
    header.forEach((h, idx) => row[h] = cols[idx] ?? '');
    rows.push(row);
  }
  return { header, rows };
}

function main() {
  const file = process.argv[2];
  if (!file) { console.error('Usage: tsx scripts/import/inspect-csv.ts <file.csv>'); process.exit(1); }
  const csv = fs.readFileSync(file, 'utf8');
  const { header, rows } = parseCSV(csv);
  console.log('Header columns (raw):', header);
  console.log('Header columns (normalized):', header.map(h => ({ raw: h, norm: normKey(h) })));
  const first = rows[0] || {};
  console.log('First row sample values for suspected fields:');
  const suspects = ['NM_MUN','Municipio','Município','Nome_Municipio','NM_MUNICIPIO','MUNICIPIO','MUNICÍPIO','Radiação_Wm2','Radiacao_Wm2','Radiação (W/m2)','Radiação (W/m²)','RADIACAO_WM2','RADIACAO_HG_DM_WM2','RADIACAO_HG_DM_W_M2','RADIACAO_MEDIA_WM2','RADIACAO','RADIACAO_HG'];
  for (const s of suspects) {
    const key = Object.keys(first).find(k => normKey(k) === normKey(s));
    if (key) console.log(`  ${s} => header '${key}' -> '${first[key]}'`);
  }
}

main();
