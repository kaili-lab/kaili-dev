import path from 'node:path'
import { fileURLToPath, URL } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const src = path.join(root, 'src')
const data = path.join(src, 'server/data')
const within = (file, directory) =>
  file === directory || file.startsWith(`${directory}${path.sep}`)

export default {
  rules: {
    'no-ui-data-import': {
      meta: {
        type: 'problem',
        schema: [],
        messages: {
          forbidden:
            'D-127: pages and components must access data through src/features, not src/server/data.',
        },
      },
      create(context) {
        const filename = context.filename
        if (
          within(filename, path.join(src, 'features')) ||
          within(filename, path.join(src, 'server'))
        )
          return {}
        function check(source) {
          if (typeof source?.value !== 'string') return
          const specifier = source.value
          const target =
            specifier.startsWith('@/') || specifier.startsWith('#/')
              ? path.resolve(src, specifier.slice(2))
              : specifier.startsWith('.')
                ? path.resolve(path.dirname(filename), specifier)
                : path.resolve(root, specifier)
          if (within(target, data))
            context.report({ node: source, messageId: 'forbidden' })
        }
        return {
          ImportDeclaration: (node) => check(node.source),
          ExportNamedDeclaration: (node) => check(node.source),
          ExportAllDeclaration: (node) => check(node.source),
          ImportExpression: (node) => check(node.source),
          CallExpression: (node) => {
            if (node.callee.name === 'require') check(node.arguments[0])
          },
        }
      },
    },
  },
}
