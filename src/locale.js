export const SUPPORTED = ['sv', 'en']
export const FALLBACK = 'en'
const STORAGE_KEY = 'konform-locale'

// localStorage throws in some privacy modes — never let it break startup.
export function readStoredLocale() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return SUPPORTED.includes(v) ? v : null
  } catch {
    return null
  }
}

export function storeLocale(locale) {
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    /* ignore — the choice just won't survive a reload */
  }
}

// Swedish for Swedish systems, English for everyone else. navigator.languages is
// ordered by user preference, so the first supported entry wins: a system set to
// ['de','sv','en'] prefers Swedish over English and gets sv.
export function detectLocale() {
  const prefs = navigator.languages?.length ? navigator.languages : [navigator.language]
  for (const tag of prefs) {
    const base = String(tag || '').toLowerCase().split('-')[0]
    if (SUPPORTED.includes(base)) return base
  }
  return FALLBACK
}
