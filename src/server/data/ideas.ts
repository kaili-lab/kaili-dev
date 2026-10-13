// Prototype Idea store (D-042, D-066, D-068, D-073). Dev-only writes.

export type StoredIdea = {
  id: string
  text: string
  createdAt: string
  updatedAt: string
}

const seed: StoredIdea[] = [
  {
    id: 'idea-boundaries',
    text: '边界的本质是归属：谁改、谁负责。也许可以写成一篇关于服务边界的文章。',
    createdAt: '2026-09-01T08:00:00.000Z',
    updatedAt: '2026-09-01T08:00:00.000Z',
  },
]

const store = new Map<string, StoredIdea>()

export function resetIdeas(ideas: StoredIdea[] = seed): void {
  store.clear()
  for (const idea of ideas) store.set(idea.id, { ...idea })
}
resetIdeas()

export function listStoredIdeas(): StoredIdea[] {
  return [...store.values()].map((idea) => ({ ...idea }))
}

export function getStoredIdea(id: string): StoredIdea | undefined {
  const idea = store.get(id)
  return idea && { ...idea }
}

export function putStoredIdea(idea: StoredIdea): void {
  store.set(idea.id, { ...idea })
}

export function deleteStoredIdea(id: string): void {
  store.delete(id)
}
