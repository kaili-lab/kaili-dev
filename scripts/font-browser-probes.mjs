/* global document, getComputedStyle, requestAnimationFrame */

export const fontProbes = [
  ...[400, 500, 600].map((weight) => ({
    family: 'Inter',
    weight,
    style: 'normal',
    text: 'Kai Li · Writing Ā é',
    fallback: 'sans-serif',
  })),
  ...[400, 500].map((weight) => ({
    family: 'IBM Plex Mono',
    weight,
    style: 'normal',
    text: '2026.10.12 Ā é',
    fallback: 'monospace',
  })),
  {
    family: 'Cormorant Garamond',
    weight: 500,
    style: 'normal',
    text: 'Kai Li Ā é',
    fallback: 'serif',
  },
  ...[400, 600, 800].map((weight) => ({
    family: 'Source Serif 4',
    weight,
    style: 'normal',
    text: 'Writing Ā é',
    fallback: 'Georgia, serif',
  })),
  {
    family: 'Source Serif 4',
    weight: 400,
    style: 'italic',
    text: 'Writing Ā é',
    fallback: 'Georgia, serif',
  },
  ...[400, 600, 900].map((weight) => ({
    family: 'Noto Serif SC',
    weight,
    style: 'normal',
    text: '思源宋体文章正文',
    fallback: '"Songti SC", serif',
  })),
  {
    family: 'LXGW WenKai',
    weight: 400,
    style: 'normal',
    text: '我自己要练英语',
    fallback: '"Kaiti SC", STKaiti, KaiTi, serif',
  },
]

export async function installFontProbes(page) {
  await page.evaluate((probes) => {
    const panel = document.createElement('section')
    panel.id = 'font-probes'
    panel.setAttribute('aria-label', 'Font verification probes')
    panel.style.cssText =
      'padding:16px;background:white;color:black;display:grid;grid-template-columns:1fr 1fr;gap:8px;'
    probes.forEach((probe, index) => {
      const element = document.createElement('p')
      element.id = `font-probe-${index}`
      element.textContent = probe.text
      element.style.cssText =
        'margin:0;min-height:36px;line-height:1.5;font-size:20px;font-synthesis:none;'
      element.style.fontFamily = `"${probe.family}", ${probe.fallback}`
      element.style.fontWeight = String(probe.weight)
      element.style.fontStyle = probe.style
      panel.append(element)
    })
    document.body.prepend(panel)
  }, fontProbes)
}

export async function loadFontProbes(page) {
  return page.evaluate(async (probes) => {
    const loaded = await Promise.all(
      probes.map(async (probe) => {
        const faces = await document.fonts.load(
          `${probe.style} ${probe.weight} 20px "${probe.family}"`,
          probe.text,
        )
        return {
          ...probe,
          faces: faces.map((face) => ({
            family: face.family,
            weight: face.weight,
            style: face.style,
            status: face.status,
            display: face.display,
          })),
        }
      }),
    )
    await document.fonts.ready
    await new Promise((done) =>
      requestAnimationFrame(() => requestAnimationFrame(done)),
    )
    return loaded
  }, fontProbes)
}

export async function renderedProbeFonts(page, session) {
  await session.send('DOM.enable')
  await session.send('CSS.enable')
  const { root } = await session.send('DOM.getDocument')
  const results = []
  for (let index = 0; index < fontProbes.length; index += 1) {
    const { nodeId } = await session.send('DOM.querySelector', {
      nodeId: root.nodeId,
      selector: `#font-probe-${index}`,
    })
    const { fonts } = await session.send('CSS.getPlatformFontsForNode', {
      nodeId,
    })
    const visible = await page
      .locator(`#font-probe-${index}`)
      .evaluate((element) => {
        const style = getComputedStyle(element)
        const rect = element.getBoundingClientRect()
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility === 'visible' &&
          Number(style.opacity) > 0
        )
      })
    results.push({ ...fontProbes[index], fonts, visible })
  }
  return results
}
