import {
  resolveTheme,
  saveThemePreference,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from '#/features/theme'

// Runs before styles and React. Storage may be unavailable in private contexts.
export const themeBootstrap = `(() => {
  let preference = 'auto';
  try {
    const stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    if (stored === 'light' || stored === 'dark') preference = stored;
  } catch {}
  const root = document.documentElement;
  root.dataset.themePreference = preference;
  root.dataset.theme = preference === 'auto'
    ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : preference;
})()`

export function getThemePreference(): ThemePreference {
  const preference = document.documentElement.dataset.themePreference
  return preference === 'dark' || preference === 'light' ? preference : 'auto'
}

export function getServerThemePreference(): ThemePreference {
  return 'auto'
}

export function setThemePreference(preference: ThemePreference) {
  try {
    saveThemePreference(window.localStorage, preference)
  } catch {
    // Still apply the choice for this page when browser storage is disabled.
  }
  document.documentElement.dataset.themePreference = preference
  document.documentElement.dataset.theme = resolveTheme(
    preference,
    window.matchMedia('(prefers-color-scheme: dark)').matches,
  )
  window.dispatchEvent(new Event('themechange'))
}

export function subscribeTheme(onChange: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const updateSystem = () => {
    document.documentElement.dataset.theme = resolveTheme(
      getThemePreference(),
      media.matches,
    )
  }
  updateSystem()
  media.addEventListener('change', updateSystem)
  window.addEventListener('themechange', onChange)
  return () => {
    media.removeEventListener('change', updateSystem)
    window.removeEventListener('themechange', onChange)
  }
}
