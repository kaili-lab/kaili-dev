export type ThemePreference = 'light' | 'dark' | 'auto'
export type ResolvedTheme = Exclude<ThemePreference, 'auto'>

export const THEME_STORAGE_KEY = 'kaili-theme'

export function resolveTheme(
  preference: ThemePreference,
  systemDark: boolean,
): ResolvedTheme {
  return preference === 'auto' ? (systemDark ? 'dark' : 'light') : preference
}

export function readThemePreference(
  storage: Storage | undefined,
): ThemePreference {
  if (!storage) return 'auto'
  const value = storage.getItem(THEME_STORAGE_KEY)
  return value === 'light' || value === 'dark' ? value : 'auto'
}

export function saveThemePreference(
  storage: Storage,
  preference: ThemePreference,
) {
  if (preference === 'auto') {
    storage.removeItem(THEME_STORAGE_KEY)
    return
  }
  storage.setItem(THEME_STORAGE_KEY, preference)
}
