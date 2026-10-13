// Prototype stand-in for the admin-managed category / tag tables (D-037,
// D-053, D-158). "Exists" for D-132 / D-154 means listed here.

export type TaxonomyEntry = { slug: string; zh: string; en: string }
export type TaxonomyKind = 'categories' | 'tags'

const seed: Record<TaxonomyKind, TaxonomyEntry[]> = {
  categories: [
    { slug: 'engineering', zh: '工程', en: 'Engineering' },
    { slug: 'ai', zh: 'AI', en: 'AI' },
  ],
  tags: [
    { slug: 'typescript', zh: 'TypeScript', en: 'TypeScript' },
    { slug: 'cloudflare', zh: 'Cloudflare', en: 'Cloudflare' },
  ],
}

const store: Record<TaxonomyKind, TaxonomyEntry[]> = structuredClone(seed)

// Live arrays: readers always see the current table.
export const categories: readonly TaxonomyEntry[] = store.categories
export const tags: readonly TaxonomyEntry[] = store.tags

export function listTaxonomy(kind: TaxonomyKind): TaxonomyEntry[] {
  return store[kind].map((entry) => ({ ...entry }))
}

export function putTaxonomyEntry(
  kind: TaxonomyKind,
  entry: TaxonomyEntry,
  previousSlug?: string,
): void {
  const list = store[kind]
  const index = list.findIndex(
    (item) => item.slug === (previousSlug ?? entry.slug),
  )
  if (index >= 0) list[index] = { ...entry }
  else list.push({ ...entry })
}

export function deleteTaxonomyEntry(kind: TaxonomyKind, slug: string): void {
  const list = store[kind]
  const index = list.findIndex((item) => item.slug === slug)
  if (index >= 0) list.splice(index, 1)
}

export function resetTaxonomy(): void {
  for (const kind of ['categories', 'tags'] as const)
    store[kind].splice(0, store[kind].length, ...structuredClone(seed[kind]))
}
