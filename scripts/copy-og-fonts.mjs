// Copies the OG renderer's WOFF files into public/og-fonts so the Worker can
// read them from its own static assets (`?url` imports land in the server
// bundle, which the ASSETS binding does not serve).  Output is gitignored.
import console from 'node:console'
import { copyFile, mkdir, rm } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import process from 'node:process'

import { ogFontAssets } from '../src/server/og-fonts.ts'

const root = resolve(import.meta.dirname, '..')
const target = resolve(root, 'public/og-fonts')

await rm(target, { force: true, recursive: true })
await mkdir(target, { recursive: true })
for (const asset of ogFontAssets) {
  await copyFile(
    resolve(root, 'node_modules/@fontsource', asset.source),
    resolve(target, basename(asset.source)),
  )
}
console.log(`Copied ${ogFontAssets.length} OG fonts to public/og-fonts`)
process.exitCode = 0
