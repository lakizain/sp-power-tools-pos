export function normalizeText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizeToken(value: string | number | null | undefined): string {
  return normalizeText(value).replace(/[^a-z0-9]/g, '');
}

export function matchesField(
  fieldValue: string | number | null | undefined,
  searchTerm: string
): boolean {
  if (!searchTerm) return true;
  const normalizedField = normalizeText(fieldValue);
  const normalizedSearch = normalizeText(searchTerm);
  if (!normalizedSearch) return true;
  if (normalizedField.includes(normalizedSearch)) return true;
  const tokenField = normalizeToken(fieldValue);
  const tokenSearch = normalizeToken(searchTerm);
  if (tokenSearch && tokenField.includes(tokenSearch)) return true;
  const searchWords = normalizedSearch.split(' ').filter(Boolean);
  if (searchWords.length > 1) {
    return searchWords.every(word => normalizedField.includes(word));
  }
  return false;
}

export function matchesAnyField(
  fields: Array<string | number | null | undefined>,
  searchTerm: string
): boolean {
  if (!searchTerm) return true;
  return fields.some(field => matchesField(field, searchTerm));
}

export function fuzzyScore(
  fieldValue: string | number | null | undefined,
  searchTerm: string
): number {
  if (!searchTerm) return 0;
  const normalizedField = normalizeText(fieldValue);
  const normalizedSearch = normalizeText(searchTerm);
  if (!normalizedSearch || !normalizedField) return 0;
  let score = 0;
  if (normalizedField === normalizedSearch) score += 100;
  else if (normalizedField.startsWith(normalizedSearch)) score += 50;
  else if (normalizedField.includes(normalizedSearch)) score += 25;
  const tokenField = normalizeToken(fieldValue);
  const tokenSearch = normalizeToken(searchTerm);
  if (tokenSearch && tokenField) {
    if (tokenField === tokenSearch) score += 80;
    else if (tokenField.startsWith(tokenSearch)) score += 40;
    else if (tokenField.includes(tokenSearch)) score += 20;
  }
  return score;
}

export function sortBySearchRelevance<T>(
  items: T[],
  searchTerm: string,
  getField: (item: T) => string | number | null | undefined
): T[] {
  if (!searchTerm) return items;
  return [...items].sort((a, b) => {
    const scoreA = fuzzyScore(getField(a), searchTerm);
    const scoreB = fuzzyScore(getField(b), searchTerm);
    return scoreB - scoreA;
  });
}
