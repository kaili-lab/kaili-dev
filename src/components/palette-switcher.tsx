import { useSyncExternalStore } from 'react'

import type { Palette } from '#/features/palette'
import {
  getPalette,
  getServerPalette,
  setPalette,
  subscribePalette,
} from '#/lib/palette-store'

const options: Array<{ value: Palette; zh: string; en: string }> = [
  { value: 'warm', zh: '暖白', en: 'Warm' },
  { value: 'cool', zh: '冷色', en: 'Cool' },
  { value: 'fix', zh: '修正', en: 'Adjusted' },
]

export function PaletteSwitcher({
  language = 'zh',
}: {
  language?: 'zh' | 'en'
}) {
  const palette = useSyncExternalStore(
    subscribePalette,
    getPalette,
    getServerPalette,
  )

  return (
    <div
      className="palette-switcher"
      role="group"
      aria-label={language === 'zh' ? '配色' : 'Palette'}
      data-palette-switcher
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={palette === option.value}
          onClick={() => setPalette(option.value)}
        >
          {language === 'zh' ? option.zh : option.en}
        </button>
      ))}
    </div>
  )
}
