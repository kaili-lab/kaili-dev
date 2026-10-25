export type Palette = 'cool' | 'fix' | 'warm'

export const PALETTE_STORAGE_KEY = 'kaili-palette'

export function readPalette(storage: Storage | undefined): Palette {
  if (!storage) return 'warm'
  const value = storage.getItem(PALETTE_STORAGE_KEY)
  return value === 'cool' || value === 'fix' ? value : 'warm'
}

export function savePalette(storage: Storage, palette: Palette) {
  if (palette === 'warm') {
    storage.removeItem(PALETTE_STORAGE_KEY)
    return
  }
  storage.setItem(PALETTE_STORAGE_KEY, palette)
}
