export type OgFontAsset = {
  readonly family: string
  readonly weight: 400 | 500 | 800 | 900
  /** Path under node_modules/@fontsource; copied to public/og-fonts. */
  readonly source: string
}

/**
 * These are WOFF (not WOFF2) because Satori's font parser only supports the
 * former.  Satori ignores a second font with the same name and weight, so
 * only the first file of each family/weight keeps the family name and the
 * rest are registered as fallbacks under their own names (see og-card.ts).
 * The order is also the fallback order: the Simplified Chinese files come
 * first so Chinese text in an Inter or mono line falls back to Noto Serif SC
 * 400 rather than the 900 title cut.
 */
export const ogFontAssets: readonly OgFontAsset[] = [
  {
    family: 'Noto Serif SC',
    weight: 400,
    source:
      'noto-serif-sc/files/noto-serif-sc-chinese-simplified-400-normal.woff',
  },
  {
    family: 'Noto Serif SC',
    weight: 400,
    source: 'noto-serif-sc/files/noto-serif-sc-latin-400-normal.woff',
  },
  {
    family: 'Noto Serif SC',
    weight: 400,
    source: 'noto-serif-sc/files/noto-serif-sc-latin-ext-400-normal.woff',
  },
  {
    family: 'Noto Serif SC',
    weight: 900,
    source:
      'noto-serif-sc/files/noto-serif-sc-chinese-simplified-900-normal.woff',
  },
  {
    family: 'Noto Serif SC',
    weight: 900,
    source: 'noto-serif-sc/files/noto-serif-sc-latin-900-normal.woff',
  },
  {
    family: 'Noto Serif SC',
    weight: 900,
    source: 'noto-serif-sc/files/noto-serif-sc-latin-ext-900-normal.woff',
  },
  {
    family: 'Inter',
    weight: 400,
    source: 'inter/files/inter-latin-400-normal.woff',
  },
  {
    family: 'Inter',
    weight: 400,
    source: 'inter/files/inter-latin-ext-400-normal.woff',
  },
  {
    family: 'IBM Plex Mono',
    weight: 400,
    source: 'ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff',
  },
  {
    family: 'IBM Plex Mono',
    weight: 400,
    source: 'ibm-plex-mono/files/ibm-plex-mono-latin-ext-400-normal.woff',
  },
  {
    family: 'Source Serif 4',
    weight: 800,
    source: 'source-serif-4/files/source-serif-4-latin-800-normal.woff',
  },
  {
    family: 'Source Serif 4',
    weight: 800,
    source: 'source-serif-4/files/source-serif-4-latin-ext-800-normal.woff',
  },
  {
    family: 'Cormorant Garamond',
    weight: 500,
    source: 'cormorant-garamond/files/cormorant-garamond-latin-500-normal.woff',
  },
  {
    family: 'Cormorant Garamond',
    weight: 500,
    source:
      'cormorant-garamond/files/cormorant-garamond-latin-ext-500-normal.woff',
  },
]

/** Same-origin static URL the Worker reads through its ASSETS binding. */
export function ogFontUrl(asset: OgFontAsset): string {
  return `/og-fonts/${asset.source.split('/').pop()}`
}
