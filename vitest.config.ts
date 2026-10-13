import { createRequire } from 'node:module'
import { defineConfig } from 'vitest/config'

const require = createRequire(import.meta.url)

export default defineConfig({
  plugins: [
    {
      // Workers import pre-compiled WASM as `*.wasm?module`; Node compiles it
      // here so the OG renderer can be tested outside workerd.
      name: 'wasm-module',
      enforce: 'pre',
      resolveId(id) {
        if (!id.endsWith('.wasm?module')) return null
        return `${require.resolve(id.slice(0, -'?module'.length))}?node-wasm-module`
      },
      load(id) {
        if (!id.endsWith('?node-wasm-module')) return null
        const path = JSON.stringify(id.slice(0, -'?node-wasm-module'.length))
        return `import { readFileSync } from 'node:fs'\nexport default new WebAssembly.Module(readFileSync(${path}))`
      },
    },
  ],
  test: {
    include: ['tests/**/*.test.mjs'],
    environment: 'node',
    // Keep the generated WASM wrapper in Vite's pipeline instead of handing
    // the raw .wasm file to Node's loader.
    server: { deps: { inline: [/\?node-wasm-module$/] } },
    // Vitest blanks CSS imports by default; the OG renderer reads tokens.css?raw.
    css: { include: [/tokens\.css/] },
  },
})
