import fs from 'fs';
import path from 'path';

/*
  Analisa um CSV (Isopletas) e produz estatísticas sobre:
    - Percentual de linhas onde a cidade está toda em MAIÚSCULAS
    - Se há presença de acentos (caracteres unicode com diacríticos)
    - Lista de amostras com possíveis problemas de encoding (caractere �)
    - Distribuição de casos (UPPER, Title Case, Mixed)

  Uso:
    tsx scripts/check/analyze-isopletas-csv.ts <arquivo.csv>
*/

function readFileSmart(p: string): string {
  let data = fs.readFileSync(p, 'utf8');
  if (data.includes('\uFFFD') || data.includes('�')) {
    // tentar latin1
    const latin = fs.readFileSync(p, 'latin1');
    // converte latin1 para utf8 (Node já interpreta como latin1->utf8 string)
    data = latin;
  }
  return data;
}

interface Row { [k: string]: string }

function parseCSV(content: string, forcedDelim?: string): Row[] {
  const lines = content.replace(/\r\n?/g,'\n').split('\n');
  const nonEmpty = lines.filter(l=> l.trim().length>0);
  if(nonEmpty.length===0) return [];
  const headerLine = nonEmpty[0];
  let delim: string;
  if(forcedDelim){
    if([',','comma','COMMA'].includes(forcedDelim)) delim=','; else if([';','semicolon','SEMICOLON'].includes(forcedDelim)) delim=';'; else delim=',';
  } else {
    const c=(headerLine.match(/,/g)||[]).length; const s=(headerLine.match(/;/g)||[]).length; delim = s>c?';':','; 
  }
  const parseLine = (line: string): string[] => {
    const out: string[] = []; let cur=''; let q=false; for(let i=0;i<line.length;i++){ const ch=line[i]; if(q){ if(ch==='"'){ if(line[i+1]==='"'){ cur+='"'; i++; } else { q=false; } } else cur+=ch; } else { if(ch==='"'){ q=true; } else if(ch===delim){ out.push(cur); cur=''; } else cur+=ch; } } out.push(cur); return out; };
  const header = parseLine(headerLine).map(h=>h.trim());
  const rows: Row[] = [];
  for (let i=1;i<nonEmpty.length;i++){
    const cols = parseLine(nonEmpty[i]);
    if(cols.length===1 && cols[0].trim()==='') continue;
    const r: Row = {};
    header.forEach((h,idx)=> r[h]= (cols[idx]??'').trim());
    rows.push(r);
  }
  return rows;
}

function normKey(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/[^a-z0-9]+/g,'').trim();
}

function getField(row: Row, names: string[]): string | undefined {
  const idx: Record<string,string> = {}; Object.keys(row).forEach(k=> idx[normKey(k)] = k);
  for (const n of names){ const nk=normKey(n); const real=idx[nk]; if(real){ const v=row[real]; if(v) return v; } }
  for (const n of names){ const nk=normKey(n); const k = Object.keys(row).find(k0=> normKey(k0).includes(nk) || nk.includes(normKey(k0))); if(k){ const v=row[k]; if(v) return v; } }
  return undefined;
}

function hasAccent(s: string): boolean {
  return /[\u00C0-\u017F]/.test(s.normalize('NFC')) && /[\u0300-\u036f]/.test(s.normalize('NFD')) || /[ÁÀÂÃÄÉÊÍÏÓÔÕÖÚÜÇÑáàâãäéêíïóôõöúüçñ]/.test(s);
}

function classifyCase(s: string): 'UPPER' | 'LOWER' | 'TITLE' | 'MIXED' {
  if(!s) return 'MIXED';
  const letters = s.replace(/[^A-Za-zÁÀÂÃÄÉÊÍÏÓÔÕÖÚÜÇÑáàâãäéêíïóôõöúüçñ]/g,'');
  if(!letters) return 'MIXED';
  if(letters === letters.toUpperCase()) return 'UPPER';
  if(letters === letters.toLowerCase()) return 'LOWER';
  // título simples: cada palavra inicia maiúscula e demais minúsculas
  const words = s.split(/\s+/).filter(Boolean);
  const titleLike = words.every(w=> w[0]===w[0]?.toUpperCase() && w.slice(1)===w.slice(1).toLowerCase());
  if(titleLike) return 'TITLE';
  return 'MIXED';
}

async function main(){
  const file = process.argv[2];
  if(!file){ console.error('Uso: tsx scripts/check/analyze-isopletas-csv.ts <arquivo.csv>'); process.exit(1); }
  const abs = path.isAbsolute(file)? file : path.resolve(process.cwd(), file);
  if(!fs.existsSync(abs)){ console.error('Arquivo não encontrado:', abs); process.exit(1); }
  const csv = readFileSmart(abs);
  const delimFlag = process.argv.find(a=> a.startsWith('--delimiter='));
  const forcedDelim = delimFlag ? delimFlag.split('=')[1] : undefined;
  const rows = parseCSV(csv, forcedDelim);
  console.log('Linhas (sem header):', rows.length);

  let upper=0, lower=0, title=0, mixed=0, withAccent=0;
  const encodingIssues: string[] = [];
  const samplesUpper: string[] = [];
  for (const r of rows){
    const cidade = getField(r,['Cidade','Municipio','Município','City','Nome_Municipio','NM_MUNICIPIO']);
    if(!cidade) continue;
    const cls = classifyCase(cidade);
    if(cls==='UPPER'){ upper++; if(samplesUpper.length<5) samplesUpper.push(cidade); }
    else if(cls==='LOWER') lower++; else if(cls==='TITLE') title++; else mixed++;
    if(hasAccent(cidade)) withAccent++;
    if(/�/.test(cidade) && encodingIssues.length<20) encodingIssues.push(cidade);
  }
  const total = rows.length || 1;
  const pct = (n:number)=> (n*100/total).toFixed(2)+'%';
  console.log('Distribuição de capitalização:');
  console.table({ UPPER: upper, LOWER: lower, TITLE: title, MIXED: mixed });
  console.log('Percentuais:', { UPPER: pct(upper), LOWER: pct(lower), TITLE: pct(title), MIXED: pct(mixed) });
  console.log('Com acentos:', withAccent, '('+pct(withAccent)+')');
  console.log('Amostras UPPER:', samplesUpper);
  if(encodingIssues.length){
    console.log('Possíveis problemas de encoding (�):', encodingIssues);
  } else {
    console.log('Nenhum caractere � detectado nas primeiras ocorrências.');
  }
}

main().catch(e=> { console.error(e); process.exit(1); });
