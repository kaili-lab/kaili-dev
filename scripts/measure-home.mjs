/* global document, getComputedStyle, innerHeight, performance, PerformanceObserver, requestAnimationFrame, window */
import console from 'node:console'
import { clearTimeout, setTimeout } from 'node:timers'
import { URL } from 'node:url'
import { Buffer } from 'node:buffer'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import { chromium } from '@playwright/test'
import {
  applyMeasurementNetwork,
  SLOW_3G_NETWORK,
} from './measurement-network.mjs'

const VIEWPORT = Object.freeze({ width: 1440, height: 1000 })
const MEASUREMENT_TIMEOUT_MS = 180_000

function twoFrames() {
  return new Promise((done) =>
    requestAnimationFrame(() => requestAnimationFrame(done)),
  )
}

function withTimeout(promise, timeoutMs, message) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

function removeListener(session, event, listener) {
  if (typeof session.off === 'function') session.off(event, listener)
  else if (typeof session.removeListener === 'function')
    session.removeListener(event, listener)
}

function nowInSeconds() {
  return Date.now() / 1000
}

async function installPaintObserver(page) {
  const source = () => {
    window.__measureHome = { lcpMs: null }
    if (typeof PerformanceObserver !== 'function') return
    try {
      new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const latest = entries[entries.length - 1]
        if (latest) window.__measureHome.lcpMs = latest.startTime
      }).observe({ type: 'largest-contentful-paint', buffered: true })
    } catch {
      // Older Chromium versions may not expose LCP. The final metric check reports it.
    }
  }
  if (typeof page.addInitScript === 'function') await page.addInitScript(source)
  else if (typeof page.evaluateOnNewDocument === 'function')
    await page.evaluateOnNewDocument(source)
  else throw new Error('The supplied page cannot install a navigation observer')
}

async function captureScreenshot(session, path) {
  const result = await session.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
  })
  await writeFile(path, Buffer.from(result.data, 'base64'))
}

async function inspectPlatformFonts(page, session) {
  const selectors = ['h1', 'h2', 'h3', 'p', 'nav a', 'main a']
  const visible = await page.evaluate((candidateSelectors) => {
    const output = []
    for (const selector of candidateSelectors) {
      const elements = [...document.querySelectorAll(selector)]
      elements.forEach((element, index) => {
        const rect = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        if (
          rect.width > 0 &&
          rect.height > 0 &&
          rect.bottom > 0 &&
          rect.top < window.innerHeight &&
          style.visibility !== 'hidden' &&
          Number(style.opacity) > 0
        ) {
          output.push({
            selector,
            index,
            text: element.textContent?.trim().slice(0, 160) ?? '',
          })
        }
      })
    }
    return output.slice(0, 20)
  }, selectors)

  await session.send('DOM.enable')
  await session.send('CSS.enable')
  const { root } = await session.send('DOM.getDocument')
  const results = []
  for (const item of visible) {
    const { nodeIds } = await session.send('DOM.querySelectorAll', {
      nodeId: root.nodeId,
      selector: item.selector,
    })
    const nodeId = nodeIds[item.index]
    if (!nodeId) continue
    try {
      const { fonts } = await session.send('CSS.getPlatformFontsForNode', {
        nodeId,
      })
      results.push({
        ...item,
        fonts,
        fallbackDetected: fonts.some(
          (font) => font.glyphCount > 0 && font.isCustomFont === false,
        ),
      })
    } catch (error) {
      results.push({
        ...item,
        fonts: [],
        fallbackDetected: null,
        inspectionError: String(error),
      })
    }
  }
  return results
}

async function settleInitialViewport(page) {
  return page.evaluate(async () => {
    const images = [...document.images].filter((image) => {
      const rect = image.getBoundingClientRect()
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        rect.top < innerHeight &&
        rect.bottom > 0
      )
    })
    const imageResults = await Promise.all(
      images.map(
        (image) =>
          new Promise((done) => {
            const finish = async () => {
              let decodeError = null
              if (image.decode) {
                try {
                  await image.decode()
                } catch (error) {
                  decodeError = String(error)
                }
              }
              done({
                src: image.currentSrc || image.src,
                complete: image.complete,
                naturalWidth: image.naturalWidth,
                naturalHeight: image.naturalHeight,
                decodeError,
              })
            }
            if (image.complete) void finish()
            else {
              image.addEventListener('load', () => void finish(), {
                once: true,
              })
              image.addEventListener(
                'error',
                () =>
                  done({
                    src: image.currentSrc || image.src,
                    complete: true,
                    naturalWidth: image.naturalWidth,
                    naturalHeight: image.naturalHeight,
                    decodeError: 'image error event',
                  }),
                { once: true },
              )
            }
          }),
      ),
    )
    let fontsError = null
    let fontsReadyMs = null
    try {
      // The @font-face sheet loads without blocking render (media="print"
      // until loaded); fonts.ready only means something once it is active.
      const fontSheet = document.getElementById('k2-fonts')
      if (fontSheet && fontSheet.media !== 'all') {
        await new Promise((done) =>
          fontSheet.addEventListener('load', done, { once: true }),
        )
      }
      await new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      )
      await document.fonts.ready
      fontsReadyMs = performance.now()
    } catch (error) {
      fontsError = String(error)
    }
    await new Promise((done) =>
      requestAnimationFrame(() => requestAnimationFrame(done)),
    )
    const lcpEntries = performance.getEntriesByType('largest-contentful-paint')
    const latestLcp = lcpEntries[lcpEntries.length - 1]
    const observerLcp = window.__measureHome?.lcpMs ?? null
    return {
      fontsReadyMs,
      fontsStatus: document.fonts.status,
      fonts: [...document.fonts].map((font) => ({
        family: font.family,
        style: font.style,
        weight: font.weight,
        status: font.status,
      })),
      fontsError,
      images: imageResults,
      firstScreenReadyMs: performance.now(),
      lcpMs: latestLcp?.startTime ?? observerLcp,
    }
  })
}

/**
 * Measure one published home page. The caller owns the page/context lifecycle.
 * `cold` clears the browser cache but leaves HTTP caching enabled; `warm` does
 * not clear it, so callers can navigate away and back to seed a genuine cache.
 */
export async function measureHome(
  page,
  session,
  { url, outputDirectory, cache, network = SLOW_3G_NETWORK },
) {
  if (cache !== 'cold' && cache !== 'warm')
    throw new Error(`Unknown cache mode: ${cache}`)
  if (!url || !outputDirectory)
    throw new Error('url and outputDirectory are required')

  const directory = resolve(outputDirectory)
  await mkdir(directory, { recursive: true })
  const firstScreenshot = resolve(directory, 'first-paint.png')
  const finalScreenshot = resolve(directory, 'final-settled.png')
  const requestsPath = resolve(directory, 'requests.json')
  const reportPath = resolve(directory, 'report.json')
  const requests = []
  const activeRequests = new Map()
  const listeners = []
  const addListener = (event, listener) => {
    session.on(event, listener)
    listeners.push([event, listener])
  }
  const startedAt = nowInSeconds()

  const newRequestRow = (event) => {
    const row = {
      requestId: event.requestId,
      loaderId: event.loaderId,
      documentURL: event.documentURL,
      url: event.request.url,
      method: event.request.method,
      type: event.type,
      startedSeconds: event.timestamp,
      wallTime: event.wallTime,
      request: event.request,
      redirectResponse: event.redirectResponse ?? null,
    }
    requests.push(row)
    activeRequests.set(event.requestId, row)
    return row
  }

  addListener('Network.requestWillBeSent', newRequestRow)
  addListener('Network.requestWillBeSentExtraInfo', (event) => {
    const row = activeRequests.get(event.requestId)
    if (row) row.requestExtraInfo = event
  })
  addListener('Network.responseReceived', (event) => {
    const row = activeRequests.get(event.requestId)
    if (!row) return
    row.responseTimestamp = event.timestamp
    row.status = event.response.status
    row.statusText = event.response.statusText
    row.responseURL = event.response.url
    row.mimeType = event.response.mimeType
    row.protocol = event.response.protocol
    row.fromDiskCache = event.response.fromDiskCache
    row.fromMemoryCache = event.response.fromMemoryCache
    row.fromServiceWorker = event.response.fromServiceWorker
    row.fromPrefetchCache = event.response.fromPrefetchCache
    row.response = event.response
  })
  addListener('Network.responseReceivedExtraInfo', (event) => {
    const row = activeRequests.get(event.requestId)
    if (row) row.responseExtraInfo = event
  })
  addListener('Network.requestServedFromCache', (event) => {
    const row = activeRequests.get(event.requestId)
    if (row) row.servedFromCache = true
  })
  addListener('Network.loadingFinished', (event) => {
    const row = activeRequests.get(event.requestId)
    if (!row) return
    row.finishedSeconds = event.timestamp
    row.encodedBytes = event.encodedDataLength
    row.loadingFinished = event
  })
  addListener('Network.loadingFailed', (event) => {
    const row = activeRequests.get(event.requestId)
    if (!row) return
    row.failedSeconds = event.timestamp
    row.transportError = event.errorText
    row.canceled = event.canceled ?? false
    row.blockedReason = event.blockedReason ?? null
    row.loadingFailed = event
  })

  let browserVersion = null
  let firstPaintCaptured = false
  let finalPaintCaptured = false
  let settlement = null
  let navigationError = null
  let measurementError = null
  try {
    await session.send('Network.enable')
    if (cache === 'cold') await session.send('Network.clearBrowserCache')
    await session.send('Network.setCacheDisabled', { cacheDisabled: false })
    await applyMeasurementNetwork(session, network)
    const version = await session.send('Browser.getVersion')
    browserVersion = version.product ?? version.userAgent ?? null
    await installPaintObserver(page)
    if (typeof page.setDefaultTimeout === 'function')
      page.setDefaultTimeout(MEASUREMENT_TIMEOUT_MS)
    if (typeof page.setDefaultNavigationTimeout === 'function')
      page.setDefaultNavigationTimeout(MEASUREMENT_TIMEOUT_MS)

    try {
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: MEASUREMENT_TIMEOUT_MS,
      })
      await page.evaluate(twoFrames)
      await captureScreenshot(session, firstScreenshot)
      firstPaintCaptured = true
      settlement = await withTimeout(
        settleInitialViewport(page),
        MEASUREMENT_TIMEOUT_MS,
        'Timed out waiting for homepage fonts and initial-viewport images',
      )
      await captureScreenshot(session, finalScreenshot)
      finalPaintCaptured = true
    } catch (error) {
      navigationError = String(error)
    }

    const timing = await page
      .evaluate(() => {
        const fcp = performance.getEntriesByName('first-contentful-paint')[0]
        const lcpEntries = performance.getEntriesByType(
          'largest-contentful-paint',
        )
        const latest = lcpEntries[lcpEntries.length - 1]
        return {
          fcpMs: fcp?.startTime ?? null,
          lcpMs: latest?.startTime ?? window.__measureHome?.lcpMs ?? null,
          observedUntilMs: performance.now(),
        }
      })
      .catch((error) => ({
        fcpMs: null,
        lcpMs: null,
        observedUntilMs: null,
        error: String(error),
      }))
    const platformFonts = await inspectPlatformFonts(page, session).catch(
      (error) => [{ inspectionError: String(error) }],
    )
    const origin = new URL(url).origin
    const completedRequests = requests.filter(
      (request) => request.finishedSeconds != null,
    )
    const failedRequests = requests.filter((request) => request.transportError)
    // 304 is the expected answer on a same-context revisit; anything below
    // 200 or from 400 up is a failed resource (T3.5 review).
    const failedResponses = requests.filter(
      (request) =>
        request.status != null &&
        (request.status < 200 || request.status >= 400),
    )
    const sameOriginViolations = requests.filter((request) => {
      try {
        const parsed = new URL(request.url)
        return parsed.protocol !== 'data:' && parsed.origin !== origin
      } catch {
        return false
      }
    })
    const fontRequests = requests.filter((request) => request.type === 'Font')
    const imageFailures =
      settlement?.images?.filter(
        (image) => image.naturalWidth === 0 || image.decodeError,
      ) ?? []
    if (navigationError) measurementError = navigationError
    else if (!settlement)
      measurementError = 'Initial viewport settlement was not observed'
    else if (failedResponses.length > 0)
      measurementError = `${failedResponses.length} resource(s) answered ${failedResponses.map((request) => request.status).join(', ')}`
    else if (imageFailures.length > 0)
      measurementError = `${imageFailures.length} initial-viewport image(s) failed`
    else if (timing.fcpMs == null || timing.lcpMs == null)
      measurementError = 'FCP or LCP was not observed'
    else if (
      settlement.fontsReadyMs == null ||
      settlement.firstScreenReadyMs == null
    )
      measurementError = 'Font or first-screen timing was not observed'

    const report = {
      schemaVersion: 1,
      url,
      cache,
      browserVersion,
      viewport: VIEWPORT,
      startedAtSeconds: startedAt,
      completedAtSeconds: nowInSeconds(),
      network: {
        ...network,
        units: 'latency in ms; throughput in bytes/second',
      },
      timing: {
        ...timing,
        fontsReadyMs: settlement?.fontsReadyMs ?? null,
        firstScreenReadyMs: settlement?.firstScreenReadyMs ?? null,
        observedUntilMs: timing.observedUntilMs,
      },
      settlement,
      requests: {
        count: requests.length,
        completedCount: completedRequests.length,
        failed: failedRequests,
        failedResponses,
        transportErrors: failedRequests.map((request) => ({
          url: request.url,
          error: request.transportError,
        })),
        fontCount: fontRequests.length,
        fontEncodedBytes: fontRequests.reduce(
          (total, request) => total + (request.encodedBytes ?? 0),
          0,
        ),
        memoryCacheHits: requests.filter((request) => request.fromMemoryCache)
          .length,
        diskCacheHits: requests.filter((request) => request.fromDiskCache)
          .length,
        serviceWorkerHits: requests.filter(
          (request) => request.fromServiceWorker,
        ).length,
      },
      platformFonts,
      assertions: {
        sameOriginViolations,
        dataSchemeExcludedFromSameOrigin: true,
      },
      measurementFailure: measurementError,
      paths: {
        requests: requestsPath,
        report: reportPath,
        firstScreenshot: firstPaintCaptured ? firstScreenshot : null,
        finalScreenshot: finalPaintCaptured ? finalScreenshot : null,
      },
      definitions: {
        fcpMs: 'Navigation start to the first-contentful-paint entry.',
        lcpMs:
          'Latest largest-contentful-paint entry observed after initial-viewport images, document fonts, and two animation frames settled.',
        fontsReadyMs:
          'Navigation-relative performance.now() immediately after the actual page document.fonts.ready promise resolves.',
        firstScreenReadyMs:
          'Navigation-relative performance.now() after visible initial-viewport images decoded, document fonts settled, and two animation frames.',
        cache:
          'Cold clears browser cache while HTTP caching stays enabled. Warm is a same-context revisit after navigating to about:blank: the browser revalidates with If-None-Match and the server answers 304, so it measures revalidation, not a pure cache hit.',
      },
    }
    await writeFile(requestsPath, `${JSON.stringify(requests, null, 2)}\n`)
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
    if (measurementError) throw new Error(measurementError)
    return report
  } finally {
    for (const [event, listener] of listeners)
      removeListener(session, event, listener)
    await session
      .send('Network.setCacheDisabled', { cacheDisabled: false })
      .catch(() => {})
  }
}

async function runCli() {
  const baseURL =
    process.argv[2] ?? process.env.HOME_BASE_URL ?? 'http://127.0.0.1:4197'
  const outputDirectory = resolve(process.argv[3] ?? 'test-results/home')
  await mkdir(outputDirectory, { recursive: true })
  const browser = await chromium.launch()
  try {
    for (const language of ['zh', 'en']) {
      const context = await browser.newContext({
        viewport: VIEWPORT,
        serviceWorkers: 'block',
        colorScheme: 'light',
      })
      const page = await context.newPage()
      try {
        const session = await context.newCDPSession(page)
        const url = new URL(`/${language}`, baseURL).toString()
        await measureHome(page, session, {
          url,
          outputDirectory: resolve(outputDirectory, `${language}-cold`),
          cache: 'cold',
        })
        await page.goto('about:blank', {
          waitUntil: 'load',
          timeout: MEASUREMENT_TIMEOUT_MS,
        })
        await measureHome(page, session, {
          url,
          outputDirectory: resolve(outputDirectory, `${language}-warm`),
          cache: 'warm',
        })
      } finally {
        await page.close().catch(() => {})
        await context.close().catch(() => {})
      }
    }
  } finally {
    await browser.close()
  }
}

if (process.argv[1] && process.argv[1].endsWith('/measure-home.mjs')) {
  try {
    await runCli()
  } catch (error) {
    console.error(error)
    process.exitCode = 1
  }
}
