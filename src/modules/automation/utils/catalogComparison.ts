import type { CatalogCase } from '../services/catalogService';

const words = (value: string) => new Set(value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(word => word.length >= 3));
export function suggestCatalogCases(reference: string, cases: CatalogCase[]): CatalogCase[] {
  const title = reference.slice(reference.indexOf('::') + 2);
  const target = words(title);
  if (!target.size) return [];
  // Suggestions must never silently replace another test's existing link.
  // Deliberate replacements remain available through the manual case selector.
  return cases.filter(item => !item.reference).map(item => {
    const tokens = words(item.title);
    const overlap = [...target].filter(token => tokens.has(token)).length;
    return { item, score: 2 * overlap / (target.size + tokens.size) };
  }).filter(item => item.score >= 0.5)
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title) || a.item.id.localeCompare(b.item.id))
    .slice(0, 3).map(item => item.item);
}
export function compareCatalog(references: string[], cases: CatalogCase[]) {
  const counts = new Map<string, number>();
  const owners = new Map<string, CatalogCase[]>();
  for (const reference of references) counts.set(reference, (counts.get(reference) || 0) + 1);
  for (const item of cases) {
    if (!item.reference) continue;
    owners.set(item.reference, [...(owners.get(item.reference) || []), item]);
  }
  const duplicated = [...new Set([...counts.keys(), ...owners.keys()])]
    .filter(reference => (counts.get(reference) || 0) > 1 || (owners.get(reference)?.length || 0) > 1)
    .map(reference => ({ reference, catalogCount: counts.get(reference) || 0, cases: owners.get(reference) || [] }));
  return {
    registered: [...counts.keys()].filter(reference => owners.has(reference))
      .map(reference => ({ reference, cases: owners.get(reference)! })),
    unassigned: [...counts.keys()].filter(reference => !owners.has(reference) && counts.get(reference) === 1),
    missing: cases.filter(item => item.status === 'automated' && (!item.reference || !counts.has(item.reference))),
    duplicated,
  };
}
