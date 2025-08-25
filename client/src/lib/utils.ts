import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Locale-aware comparison (pt-BR) with numeric and accent sensitivity
const collator = new Intl.Collator('pt-BR', { sensitivity: 'accent', numeric: true });
export function comparePt(a: any, b: any) {
  return collator.compare(String(a ?? ''), String(b ?? ''));
}

// Stable sort helper: returns new array
export function sortBy<T>(arr: T[], selector: (item: T) => any, dir: 'asc'|'desc'='asc', tieBreakers?: Array<(a:T,b:T)=>number>): T[] {
  const copy = arr.map((item, idx) => ({ item, idx }));
  copy.sort((x, y) => {
    let cmp = comparePt(selector(x.item), selector(y.item));
    if (cmp === 0 && tieBreakers) {
      for (const tb of tieBreakers) { cmp = tb(x.item, y.item); if (cmp !== 0) break; }
    }
    if (cmp === 0) cmp = x.idx - y.idx; // keep stability
    return dir === 'asc' ? cmp : -cmp;
  });
  return copy.map(c => c.item);
}
