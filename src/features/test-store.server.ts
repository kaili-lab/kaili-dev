import { resetArticles, type StoreFixture } from '#/server/data/articles'
import { resetIdeas } from '#/server/data/ideas'
import { resetTaxonomy } from '#/server/data/taxonomy'

const fixtures: StoreFixture[] = ['default', 'en-only', 'empty']

/** Development / e2e only: restore every prototype store. */
export function resetStores(fixture: string): boolean {
  if (!fixtures.includes(fixture as StoreFixture)) return false
  resetArticles(fixture as StoreFixture)
  resetIdeas()
  resetTaxonomy()
  return true
}
