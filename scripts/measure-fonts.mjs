/* global document, performance, PerformanceObserver, requestAnimationFrame, window */
import console from 'node:console'
import { URL } from 'node:url'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import { Buffer } from 'node:buffer'
import { chromium } from '@playwright/test'
import {
  installFontProbes,
  loadFontProbes,
  renderedProbeFonts,
} from './font-browser-probes.mjs'
import { SLOW_3G_NETWORK } from './measurement-network.mjs'

const mode = process.argv[2] ?? 'slow-3g'
if (!['slow-3g', 'fallback'].includes(mode))
  throw new Error(
    'Usage: node scripts/measure-fonts.mjs [slow-3g|fallback] [baseURL] [outputDirectory]',
  )
const baseURL =
  process.argv[3] ?? process.env.FONT_BASE_URL ?? 'http://127.0.0.1:4173'
const outputDirectory = resolve(process.argv[4] ?? `test-results/fonts-${mode}`)
await mkdir(outputDirectory, { recursive: true })
const browser = await chromium.launch()
try {
  // Fresh context, no service workers, no HTTP cache: every run is cold.
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    serviceWorkers: 'block',
  })
  const page = await context.newPage()
  page.setDefaultTimeout(180_000)
  page.setDefaultNavigationTimeout(180_000)
  const session = await context.newCDPSession(page)
  await session.send('Network.enable')
  await session.send('Network.clearBrowserCache')
  await session.send('Network.setCacheDisabled', { cacheDisabled: true })
  const network = SLOW_3G_NETWORK
  if (mode === 'slow-3g')
    await session.send('Network.emulateNetworkConditions', network)
  const requests = new Map()
  session.on('Network.requestWillBeSent', (event) => {
    requests.set(event.requestId, {
      url: event.request.url,
      type: event.type,
      startedSeconds: event.timestamp,
    })
  })
  session.on('Network.responseReceived', (event) => {
    Object.assign(requests.get(event.requestId) ?? {}, {
      status: event.response.status,
      fromDiskCache: event.response.fromDiskCache,
      fromServiceWorker: event.response.fromServiceWorker,
    })
  })
  session.on('Network.loadingFinished', (event) => {
    Object.assign(requests.get(event.requestId) ?? {}, {
      finishedSeconds: event.timestamp,
      encodedBytes: event.encodedDataLength,
    })
  })
  session.on('Network.loadingFailed', (event) => {
    Object.assign(requests.get(event.requestId) ?? {}, {
      error: event.errorText,
    })
  })
  if (mode === 'fallback') {
    await page.route('**/*', async (route) => {
      if (route.request().resourceType() !== 'font') return route.continue()
      await route.fulfill({
        status: 404,
        contentType: 'text/plain',
        body: 'Font intentionally unavailable',
      })
    })
  }
  await page.addInitScript(() => {
    window.fontMeasurement = { lcpMs: null }
    new PerformanceObserver((list) => {
      const latest = list.getEntries().at(-1)
      if (latest) window.fontMeasurement.lcpMs = latest.startTime
    }).observe({ type: 'largest-contentful-paint', buffered: true })
  })
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' })
  const probesInsertedMs = await page.evaluate(() => performance.now())
  await installFontProbes(page)
  await page.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  )
  // CDP screenshots do not wait for document.fonts.ready, unlike Playwright screenshots.
  const firstScreenshot = resolve(outputDirectory, 'first-probe-paint.png')
  const capture = async (path) => {
    const { data } = await session.send('Page.captureScreenshot', {
      format: 'png',
    })
    await writeFile(path, Buffer.from(data, 'base64'))
  }
  await capture(firstScreenshot)
  let loaded = null
  if (mode === 'slow-3g') loaded = await loadFontProbes(page)
  else
    await page.evaluate(async () => {
      await document.fonts.ready
    })
  await page.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  )
  const fontsReadyMs = await page.evaluate(() => performance.now())
  const rendered = await renderedProbeFonts(page, session)
  const finalScreenshot = resolve(outputDirectory, 'fonts-settled.png')
  await capture(finalScreenshot)
  const timing = await page.evaluate(() => ({
    fcpMs:
      performance.getEntriesByName('first-contentful-paint')[0]?.startTime ??
      null,
    lcpMs: window.fontMeasurement.lcpMs,
    observedUntilMs: performance.now(),
  }))
  const fontRequests = [...requests.values()].filter(
    (request) => request.type === 'Font',
  )
  const requestPath = resolve(outputDirectory, 'requests.json')
  await writeFile(
    requestPath,
    `${JSON.stringify([...requests.values()], null, 2)}\n`,
  )
  const report = {
    mode,
    browserVersion: browser.version(),
    scope:
      'Current root entry with injected font-family probes; this is NOT a migrated home-page performance result.',
    baseURL,
    viewport: { width: 1440, height: 1000 },
    coldCache: true,
    throttling:
      mode === 'slow-3g'
        ? {
            ...network,
            units:
              'latency in ms; throughput in bytes/second (400 kbit/s down and up)',
          }
        : null,
    definitions: {
      fcpMs:
        'Navigation start to first-contentful-paint of the entry document, which can occur before probe insertion.',
      lcpMs:
        'Latest largest-contentful-paint observed after font settlement and two animation frames; includes visible entry/probe content.',
      fontsReadyMs:
        'Navigation start to all requested probe fonts settling, document.fonts.ready, and subsequent rendering-frame waits. Sampled after the final two animation frames; fallback mode measures 404 settlement with the same final frame wait.',
      probesInsertedMs:
        'Navigation-relative time immediately before inserting the font probes after DOMContentLoaded.',
    },
    ...timing,
    probesInsertedMs,
    fontsReadyMs,
    fontRequestCount: fontRequests.length,
    fontEncodedBytes: fontRequests.reduce(
      (sum, request) => sum + (request.encodedBytes ?? 0),
      0,
    ),
    loaded,
    rendered,
    artifacts: { requests: requestPath, firstScreenshot, finalScreenshot },
  }
  const reportPath = resolve(outputDirectory, 'report.json')
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
  console.log(
    JSON.stringify(
      {
        reportPath,
        ...report.artifacts,
        fcpMs: timing.fcpMs,
        lcpMs: timing.lcpMs,
        fontsReadyMs,
        fontRequestCount: fontRequests.length,
      },
      null,
      2,
    ),
  )
  assert(fontRequests.length > 0, 'No font requests were observed')
  assert(
    fontRequests.every(
      (request) => new URL(request.url).origin === new URL(baseURL).origin,
    ),
    'Third-party font request',
  )
  for (const probe of rendered) {
    assert(probe.visible, `${probe.family} probe is hidden`)
    assert(
      probe.fonts.some(
        (font) =>
          font.glyphCount > 0 && font.isCustomFont === (mode === 'slow-3g'),
      ),
      `${probe.family} did not render expected glyphs`,
    )
    if (mode === 'fallback')
      assert(
        probe.fonts.every((font) => !font.isCustomFont),
        `${probe.family} unexpectedly used a webfont`,
      )
  }
  if (mode === 'slow-3g') {
    assert(
      fontRequests.every((request) => request.status === 200 && !request.error),
      'A font request failed',
    )
    assert(
      loaded.every(
        (probe) =>
          probe.faces.length > 0 &&
          probe.faces.every(
            (face) =>
              face.status === 'loaded' &&
              face.weight === String(probe.weight) &&
              face.style === probe.style &&
              face.display === 'swap',
          ),
      ),
      'A requested font face did not load',
    )
    assert(
      timing.fcpMs !== null && timing.lcpMs !== null,
      'Paint timing was not observed',
    )
  } else
    assert(
      fontRequests.every((request) => request.status === 404),
      'Not every font request received the intended 404',
    )
} finally {
  await browser.close()
}
