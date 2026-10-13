import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig(({ command }) => {
  const routeTreePath = fileURLToPath(
    new URL(
      command === 'build'
        ? './.tanstack/routeTree.production.ts'
        : './src/routeTree.gen.ts',
      import.meta.url,
    ),
  )
  return {
    resolve: {
      tsconfigPaths: true,
      alias: { '#/routeTree.gen': routeTreePath },
    },
    plugins: [
      cloudflare({ viteEnvironment: { name: 'ssr' } }),
      tailwindcss(),

      tanstackStart({
        router: {
          // A running dev server must not overwrite the production route tree.
          generatedRouteTree: routeTreePath,
          // Exclude development fixtures from both production route graphs.
          routeFileIgnorePattern:
            command === 'build'
              ? String.raw`^(\[_\](design\.tsx|og-smoke\.ts|writing-variants\.tsx|admin-variants\.tsx|test-reset\.ts)|admin(\.tsx)?)$`
              : undefined,
        },
      }),
      viteReact(),
    ],
  }
})

export default config
