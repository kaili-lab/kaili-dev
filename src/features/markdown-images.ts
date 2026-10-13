import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'

type Node = {
  type: string
  url?: string
  identifier?: string
  children?: Node[]
}

/**
 * D-048: image object keys a Markdown body really displays. Uses the same
 * remark parser as the public renderer, so `![a](url)` and reference images
 * `![a][id]` with `[id]: url` count, while text inside code does not.
 */
export function referencedImages(body: string): string[] {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(body) as Node
  const definitions = new Map<string, string>()
  const images: { url?: string; identifier?: string }[] = []
  const walk = (node: Node) => {
    // First definition wins, as in the renderer (mdast-util-to-hast).
    if (
      node.type === 'definition' &&
      node.identifier &&
      node.url &&
      !definitions.has(node.identifier)
    )
      definitions.set(node.identifier, node.url)
    if (node.type === 'image') images.push({ url: node.url })
    if (node.type === 'imageReference')
      images.push({ identifier: node.identifier })
    node.children?.forEach(walk)
  }
  walk(tree)
  const found = new Set<string>()
  for (const image of images) {
    const url =
      image.url ?? (image.identifier && definitions.get(image.identifier))
    if (url) found.add(url)
  }
  return [...found]
}
