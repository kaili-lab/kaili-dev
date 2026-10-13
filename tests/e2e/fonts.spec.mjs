/* global document, requestAnimationFrame */
import { URL } from 'node:url'
import { expect, test } from '@playwright/test'
import {
  fontProbes,
  installFontProbes,
  loadFontProbes,
  renderedProbeFonts,
} from '../../scripts/font-browser-probes.mjs'

test('each required font and weight loads from this origin and renders real glyphs', async ({
  page,
}) => {
  const requests = []
  const failed = []
  page.on('request', (request) => {
    if (request.resourceType() === 'font') requests.push(request.url())
  })
  page.on('response', (response) => {
    if (response.request().resourceType() === 'font' && !response.ok())
      failed.push(response.url())
  })
  page.on('requestfailed', (request) => {
    if (request.resourceType() === 'font') failed.push(request.url())
  })
  await page.goto('/')
  await installFontProbes(page)
  const loaded = await loadFontProbes(page)
  expect(loaded).toHaveLength(fontProbes.length)
  for (const probe of loaded) {
    expect(
      probe.faces.length,
      `${probe.family}/${probe.weight}/${probe.style}`,
    ).toBeGreaterThan(0)
    for (const face of probe.faces) {
      expect(face.status).toBe('loaded')
      expect(face.weight).toBe(String(probe.weight))
      expect(face.style).toBe(probe.style)
      expect(face.display).toBe('swap')
    }
  }
  const session = await page.context().newCDPSession(page)
  for (const probe of await renderedProbeFonts(page, session)) {
    expect(probe.visible).toBe(true)
    expect(
      probe.fonts.some((font) => font.isCustomFont && font.glyphCount > 0),
      probe.family,
    ).toBe(true)
  }
  expect(requests.length).toBeGreaterThan(0)
  expect(
    requests.every((url) => new URL(url).origin === new URL(page.url()).origin),
  ).toBe(true)
  expect(failed).toEqual([])
})

test('404 font responses render system glyphs instead of blank text', async ({
  page,
}, testInfo) => {
  const blocked = []
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'font') return route.continue()
    blocked.push(route.request().url())
    await route.fulfill({
      status: 404,
      contentType: 'text/plain',
      body: 'Font intentionally unavailable',
    })
  })
  await page.goto('/')
  await installFontProbes(page)
  await page.evaluate(async () => {
    await new Promise((done) =>
      requestAnimationFrame(() => requestAnimationFrame(done)),
    )
    await document.fonts.ready
  })
  const session = await page.context().newCDPSession(page)
  const rendered = await renderedProbeFonts(page, session)
  for (const probe of rendered) {
    expect(probe.visible).toBe(true)
    expect(
      probe.fonts.some((font) => !font.isCustomFont && font.glyphCount > 0),
      probe.family,
    ).toBe(true)
    expect(
      probe.fonts.some((font) => font.isCustomFont),
      probe.family,
    ).toBe(false)
  }
  expect(blocked.length).toBeGreaterThan(0)
  await page.screenshot({
    path: testInfo.outputPath('font-404-fallback.png'),
    fullPage: true,
  })
  await testInfo.attach('font-404-rendered-glyphs', {
    body: JSON.stringify({ blocked, rendered }, null, 2),
    contentType: 'application/json',
  })
})
