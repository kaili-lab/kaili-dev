import {
  PALETTE_STORAGE_KEY,
  savePalette,
  type Palette,
} from '#/features/palette'

// Runs before styles and React, same reason as the theme script.
export const paletteBootstrap = `(() => {
  let palette = 'warm';
  try {
    const stored = localStorage.getItem(${JSON.stringify(PALETTE_STORAGE_KEY)});
    if (stored === 'cool' || stored === 'fix') palette = stored;
  } catch {}
  const root = document.documentElement;
  if (palette === 'warm') delete root.dataset.palette;
  else root.dataset.palette = palette;
})()`

export function getPalette(): Palette {
  const value = document.documentElement.dataset.palette
  return value === 'cool' || value === 'fix' ? value : 'warm'
}

export function getServerPalette(): Palette {
  return 'warm'
}

export function setPalette(palette: Palette) {
  try {
    savePalette(window.localStorage, palette)
  } catch {
    // Still apply the choice for this page when browser storage is disabled.
  }
  if (palette === 'warm') delete document.documentElement.dataset.palette
  else document.documentElement.dataset.palette = palette
  window.dispatchEvent(new Event('palettechange'))
}

export function subscribePalette(onChange: () => void) {
  window.addEventListener('palettechange', onChange)
  return () => window.removeEventListener('palettechange', onChange)
}
