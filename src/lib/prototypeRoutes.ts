/** Hash-route helpers — keep GitHub Pages base path (/SmartReview-AIc2/) in sync. */

export const REVIEWER_DATA_REVIEW_PATH =
  '/data-review?entry=review-return&role=reviewer&startReview=true'

export const PREPARER_DATA_REVIEW_PATH =
  '/data-review?entry=input-return&role=preparer'

export const VALID_DATA_REVIEW_ENTRIES = new Set(['input-return', 'review-return'])

/** Origin + Vite base path (trailing slash). */
export function getPrototypeBaseUrl(): string {
  const basePath = import.meta.env.BASE_URL || '/'
  if (basePath === '/') {
    return `${window.location.origin}/`
  }
  const normalized = basePath.endsWith('/') ? basePath : `${basePath}/`
  return `${window.location.origin}${normalized}`
}

/** Open a hash route in a new tab — preserves repo subpath on GitHub Pages. */
export function openHashRoute(route: string, target = '_blank'): void {
  const normalized = route.startsWith('/') ? route : `/${route}`
  const url = `${getPrototypeBaseUrl()}#${normalized}`
  window.open(url, target, 'noopener,noreferrer')
}

/** Decode malformed hashes like #%2Fdata-review → #/data-review */
export function normalizeHashRoute(): string | null {
  const raw = window.location.hash.replace(/^#/, '')
  if (!raw.includes('%2F') && !raw.includes('%2f')) return null
  try {
    const decoded = decodeURIComponent(raw)
    return decoded.startsWith('/') ? decoded : `/${decoded}`
  } catch {
    return null
  }
}
