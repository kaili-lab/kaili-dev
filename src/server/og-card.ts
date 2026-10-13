import type { ReactNode } from 'react'
import satori, { init as initSatori } from 'satori/standalone'
import { initWasm as initResvg, Resvg } from '@resvg/resvg-wasm'
import { layoutWasm, resvgWasm, tokens } from './og-assets'
import { ogFontAssets, ogFontUrl, type OgFontAsset } from './og-fonts'

export type OgCardInput = {
  language: 'zh' | 'en'
  title: string
  summary: string
  category: string
  publishedAt: string
}

export type OgCardResult = {
  png: Uint8Array
  titleFontSize: 60 | 50
  titleLines: number
  /** Lines the summary occupies in the final card (layout-measured). */
  summaryLines: number
  titleTruncated: boolean
  renderedTitle: string
  renderedSummary: string
}

type Style = Record<string, string | number | boolean>
type CardNode = {
  type: string
  props: {
    id?: string
    children?: CardNode | CardNode[] | string
    style?: Style
    [key: string]: unknown
  }
}

type LoadedFont = {
  name: string
  data: ArrayBuffer
  weight: 400 | 500 | 800 | 900
  style: 'normal'
}

const WIDTH = 1200
const HEIGHT = 630
const COVER_WIDTH = 420
const TEXT_WIDTH = WIDTH - COVER_WIDTH - 72 - 72
const ELLIPSIS = '…'

let wasmReady: Promise<void> | undefined

function ensureWasm(): Promise<void> {
  wasmReady ??= Promise.all([
    initSatori(layoutWasm),
    // resvg keeps its own module-level instance; a re-evaluated module (dev
    // HMR) finds it already initialised, which is the state we want.
    initResvg(resvgWasm).catch((error: unknown) => {
      if (!(
        error instanceof Error &&
        error.message.startsWith('Already initialized')
      ))
        throw error
    }),
  ]).then(() => undefined)
  return wasmReady
}

function token(name: string): string {
  const match = tokens.match(new RegExp(`${name}\\s*:\\s*([^;]+);`))
  if (!match?.[1]) {
    throw new Error(`OG renderer token ${name} is missing from tokens.css`)
  }
  return match[1].trim()
}

const colors = {
  paper: token('--paper'),
  ink: token('--ink'),
  ink2: token('--ink-2'),
  mute: token('--mute'),
  line: token('--line'),
  cinnabar: token('--cinnabar'),
  cover: token('--cover'),
  coverInk: token('--cover-ink'),
  sealInk: token('--seal-ink'),
  grain: token('--grain'),
}

function node(
  type: string,
  style: Style,
  children?: CardNode | CardNode[] | string,
  props: Record<string, unknown> = {},
): CardNode {
  return { type, props: { ...props, children, style } }
}

// Satori accepts plain `{ type, props }` objects; React's element type adds
// fields (key, $$typeof) that this renderer never needs.
function asReactNode(tree: CardNode): ReactNode {
  return tree as unknown as ReactNode
}

async function loadFonts(
  fetchAsset: (url: string) => Promise<ArrayBuffer>,
): Promise<LoadedFont[]> {
  const seen = new Set<string>()
  return Promise.all(
    ogFontAssets.map(async (asset: OgFontAsset, index) => {
      const key = `${asset.family}/${asset.weight}`
      const name = seen.has(key)
        ? `${asset.family} fallback ${index}`
        : asset.family
      seen.add(key)
      const url = ogFontUrl(asset)
      const data = await fetchAsset(url)
      if (data.byteLength === 0) {
        throw new Error(`OG renderer received an empty font asset: ${url}`)
      }
      return {
        name,
        data,
        weight: asset.weight,
        style: 'normal' as const,
      }
    }),
  )
}

function titleStyle(
  language: OgCardInput['language'],
  fontSize: number,
): Style {
  return {
    color: colors.ink,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: language === 'zh' ? 'Noto Serif SC' : 'Source Serif 4',
    fontSize,
    fontWeight: language === 'zh' ? 900 : 800,
    letterSpacing: language === 'zh' ? 0 : -fontSize * 0.01,
    lineHeight: language === 'zh' ? 1.3 : 1.16,
    maxWidth: TEXT_WIDTH,
    width: TEXT_WIDTH,
  }
}

// Chinese summaries use Noto Serif SC throughout: `--ui` relies on a system
// CJK sans the Worker cannot load, and Satori picks a font per word by its
// first character, so Latin words after Chinese punctuation would switch
// between Inter and the serif mid-sentence (design.md §7).
function summaryStyle(language: OgCardInput['language']): Style {
  return {
    color: colors.ink2,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: language === 'zh' ? 'Noto Serif SC' : 'Inter',
    fontSize: 26,
    fontWeight: 400,
    lineHeight: 1.6,
    maxWidth: TEXT_WIDTH,
    width: TEXT_WIDTH,
  }
}

function cardTree(
  input: OgCardInput,
  title: string,
  summary: string,
  titleSize: number,
): CardNode {
  const initial =
    Array.from(input.category)[0] ?? (input.language === 'zh' ? '文' : 'W')
  const titleFont = input.language === 'zh' ? 'Noto Serif SC' : 'Source Serif 4'
  return node(
    'div',
    {
      backgroundColor: colors.paper,
      color: colors.ink,
      display: 'flex',
      height: HEIGHT,
      overflow: 'hidden',
      position: 'relative',
      width: WIDTH,
    },
    [
      node(
        'div',
        {
          backgroundColor: colors.cover,
          color: colors.coverInk,
          display: 'flex',
          height: HEIGHT,
          overflow: 'hidden',
          position: 'relative',
          width: COVER_WIDTH,
        },
        [
          node(
            'div',
            {
              bottom: 44,
              color: colors.coverInk,
              fontFamily: titleFont,
              fontSize: 300,
              fontWeight: input.language === 'zh' ? 900 : 800,
              left: 48,
              lineHeight: 0.9,
              opacity: 0.95,
              position: 'absolute',
            },
            initial,
          ),
          node('div', {
            border: '54px solid rgba(255,255,255,0.07)',
            borderRadius: 360,
            bottom: -110,
            height: 360,
            position: 'absolute',
            right: -110,
            width: 360,
          }),
        ],
      ),
      node(
        'div',
        {
          // The paper grain sits only behind the text side, as in k2-og.html.
          backgroundColor: colors.paper,
          backgroundImage: colors.grain,
          backgroundRepeat: 'repeat',
          backgroundSize: '180px 180px',
          display: 'flex',
          flexDirection: 'column',
          height: HEIGHT,
          minWidth: 0,
          padding: '60px 72px 48px',
          width: WIDTH - COVER_WIDTH,
        },
        [
          node(
            'div',
            {
              alignItems: 'center',
              color: colors.mute,
              display: 'flex',
              fontFamily: 'IBM Plex Mono',
              fontSize: 22,
              gap: 22,
              lineHeight: 1,
            },
            [
              node('span', { color: colors.cinnabar }, input.category),
              node('span', {}, input.publishedAt),
            ],
          ),
          node(
            'div',
            { marginTop: 26, ...titleStyle(input.language, titleSize) },
            title,
            {
              id: 'og-title',
            },
          ),
          node(
            'div',
            { marginTop: 22, ...summaryStyle(input.language) },
            summary,
            { id: 'og-summary' },
          ),
          node(
            'div',
            {
              alignItems: 'center',
              borderTop: `1px solid ${colors.line}`,
              display: 'flex',
              marginTop: 'auto',
              paddingTop: 24,
              width: TEXT_WIDTH,
            },
            [
              node(
                'div',
                {
                  alignItems: 'center',
                  backgroundColor: colors.cinnabar,
                  borderRadius: 4,
                  boxShadow: 'inset 0 0 0 3px rgba(255,255,255,0.18)',
                  color: colors.sealInk,
                  display: 'flex',
                  fontFamily: 'Cormorant Garamond',
                  fontSize: 22,
                  height: 46,
                  justifyContent: 'center',
                  marginRight: 16,
                  width: 46,
                },
                'KL',
              ),
              node(
                'span',
                {
                  fontFamily: 'Cormorant Garamond',
                  fontSize: 34,
                  lineHeight: 1,
                },
                'Kai Li',
              ),
              node(
                'span',
                {
                  color: colors.mute,
                  fontFamily: 'IBM Plex Mono',
                  fontSize: 22,
                  lineHeight: 1,
                  marginLeft: 'auto',
                },
                'kaili.dev',
              ),
            ],
          ),
        ],
      ),
    ],
  )
}

function probeTree(text: string, style: Style, marker: string): CardNode {
  // flex-start keeps the probe at its natural height instead of stretching it.
  return node(
    'div',
    {
      alignItems: 'flex-start',
      display: 'flex',
      height: 2000,
      width: TEXT_WIDTH,
    },
    [node('div', style, text, { id: marker })],
  )
}

type Measurement = { markers: Map<string, number> }

function recordMarkers(measurement: Measurement) {
  return (detected: { height: number; props: Record<string, unknown> }) => {
    const id = detected.props.id
    if (typeof id === 'string') measurement.markers.set(id, detected.height)
  }
}

function linesFromHeight(
  height: number | undefined,
  style: Style,
  marker: string,
): number {
  if (height === undefined) {
    throw new Error(`OG renderer could not locate measurement marker ${marker}`)
  }
  const lineHeight = Number(style.fontSize) * Number(style.lineHeight)
  return Math.round(height / lineHeight)
}

async function measureLines(
  text: string,
  style: Style,
  marker: string,
  fonts: LoadedFont[],
): Promise<number> {
  const measurement: Measurement = { markers: new Map() }
  await satori(asReactNode(probeTree(text, style, marker)), {
    fonts,
    height: 2000,
    width: TEXT_WIDTH,
    onNodeDetected: recordMarkers(measurement),
  })
  return linesFromHeight(measurement.markers.get(marker), style, marker)
}

async function fitText(
  text: string,
  maxLines: number,
  style: Style,
  marker: string,
  fonts: LoadedFont[],
): Promise<{ value: string; truncated: boolean }> {
  if ((await measureLines(text, style, marker, fonts)) <= maxLines) {
    return { value: text, truncated: false }
  }

  const chars = Array.from(text)
  let low = 0
  let high = chars.length
  let best = ELLIPSIS
  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    const candidate = `${chars.slice(0, middle).join('')}${ELLIPSIS}`
    if ((await measureLines(candidate, style, marker, fonts)) <= maxLines) {
      best = candidate
      low = middle + 1
    } else {
      high = middle - 1
    }
  }
  return { value: best, truncated: true }
}

export async function renderOgCard(
  input: OgCardInput,
  fetchAsset: (url: string) => Promise<ArrayBuffer>,
): Promise<OgCardResult> {
  await ensureWasm()
  const fonts = await loadFonts(fetchAsset)
  const title60 = await measureLines(
    input.title,
    titleStyle(input.language, 60),
    'og-title',
    fonts,
  )
  const titleFontSize: 60 | 50 = title60 > 3 ? 50 : 60
  const titleFit = await fitText(
    input.title,
    3,
    titleStyle(input.language, titleFontSize),
    'og-title',
    fonts,
  )
  const summaryFit = await fitText(
    input.summary,
    2,
    summaryStyle(input.language),
    'og-summary',
    fonts,
  )
  const measurement: Measurement = { markers: new Map() }
  const svg = await satori(
    asReactNode(
      cardTree(input, titleFit.value, summaryFit.value, titleFontSize),
    ),
    {
      fonts,
      height: HEIGHT,
      width: WIDTH,
      onNodeDetected: recordMarkers(measurement),
    },
  )
  const titleLines = linesFromHeight(
    measurement.markers.get('og-title'),
    titleStyle(input.language, titleFontSize),
    'og-title',
  )
  const summaryLines = linesFromHeight(
    measurement.markers.get('og-summary'),
    summaryStyle(input.language),
    'og-summary',
  )
  const image = new Resvg(svg, {
    fitTo: { mode: 'original' },
    font: { loadSystemFonts: false },
  }).render()
  try {
    return {
      png: image.asPng(),
      titleFontSize,
      titleLines,
      summaryLines,
      titleTruncated: titleFit.truncated,
      renderedTitle: titleFit.value,
      renderedSummary: summaryFit.value,
    }
  } finally {
    image.free()
  }
}
