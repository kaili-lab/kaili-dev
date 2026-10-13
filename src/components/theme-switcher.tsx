import { useSyncExternalStore } from 'react'

import type { ThemePreference } from '#/features/theme'
import {
  getThemePreference,
  getServerThemePreference,
  setThemePreference,
  subscribeTheme,
} from '#/lib/theme-store'

const options: Array<{ value: ThemePreference; label: string }> = [
  { value: 'light', label: '浅' },
  { value: 'dark', label: '深' },
  { value: 'auto', label: '自动' },
]

export function ThemeSwitcher({ language = 'zh' }: { language?: 'zh' | 'en' }) {
  const preference = useSyncExternalStore(
    subscribeTheme,
    getThemePreference,
    getServerThemePreference,
  )

  return (
    <div
      className="theme-switcher"
      role="group"
      aria-label={language === 'zh' ? '主题' : 'Theme'}
      data-theme-switcher
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={preference === option.value}
          onClick={() => setThemePreference(option.value)}
        >
          {language === 'zh'
            ? option.label
            : { light: 'Light', dark: 'Dark', auto: 'Auto' }[option.value]}
        </button>
      ))}
    </div>
  )
}
