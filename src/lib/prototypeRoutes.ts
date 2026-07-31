/** Hash-route helpers — keep GitHub Pages base path (/SmartReview-AIc2/) in sync. */

export const REVIEWER_DATA_REVIEW_PATH =
  '/data-review?entry=review-return&role=reviewer&startReview=true'

export const PREPARER_DATA_REVIEW_PATH =
  '/data-review?entry=input-return&role=preparer'

export const VALID_DATA_REVIEW_ENTRIES = new Set(['input-return', 'review-return'])

export const DEMO_ROLE_STORAGE_KEY = 'protoc-demo-role'

/** Known hash routes (longest match first). */
const KNOWN_HASH_ROUTES = [
  '/check-return/insights',
  '/check-return',
  '/import-confirmation',
  '/data-review',
  '/smart-return',
] as const

/** Origin + Vite base path (trailing slash). */
export function getPrototypeBaseUrl(): string {
  const basePath = import.meta.env.BASE_URL || '/'
  if (basePath === '/') {
    return `${window.location.origin}/`
  }
  const normalized = basePath.endsWith('/') ? basePath : `${basePath}/`
  return `${window.location.origin}${normalized}`
}

/** Full URL for a hash route, e.g. origin + base + #/data-review?… */
export function buildHashRouteUrl(route: string): string {
  const normalized = route.startsWith('/') ? route : `/${route}`
  return `${getPrototypeBaseUrl()}#${normalized}`
}

/** Open a hash route in a new tab — preserves repo subpath on GitHub Pages. */
export function openHashRoute(route: string, target = '_blank'): void {
  window.open(buildHashRouteUrl(route), target, 'noopener,noreferrer')
}

/** Persist demo role for catch-all redirects when hash has no role param. */
export function setStoredDemoRole(role: 'preparer' | 'reviewer'): void {
  try {
    localStorage.setItem(DEMO_ROLE_STORAGE_KEY, role)
  } catch {
    /* ignore */
  }
}

export function getStoredDemoRole(): 'preparer' | 'reviewer' | null {
  try {
    const v = localStorage.getItem(DEMO_ROLE_STORAGE_KEY)
    return v === 'reviewer' || v === 'preparer' ? v : null
  } catch {
    return null
  }
}

/** Unknown hash routes → reviewer data-review or SmartReturn landing. */
export function resolveCatchAllRoute(search = ''): string {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  if (params.get('role') === 'reviewer' || params.get('startReview') === 'true') {
    return REVIEWER_DATA_REVIEW_PATH
  }
  if (getStoredDemoRole() === 'reviewer') {
    return REVIEWER_DATA_REVIEW_PATH
  }
  return '/smart-return'
}

/**
 * GitHub Pages 404.html can serve index.html while the pathname stays polluted
 * (e.g. /SmartReview-AIc2/data-review with no hash). Repair to #/data-review.
 */
export function repairBarePathRoute(): string | null {
  const hash = window.location.hash.replace(/^#/, '')
  if (hash.length > 0 && !hash.startsWith('%2F') && !hash.startsWith('%2f')) {
    return null
  }

  const pathname = window.location.pathname
  for (const route of KNOWN_HASH_ROUTES) {
    if (pathname.endsWith(route) || pathname.endsWith(`${route}/`)) {
      const baseEnd = pathname.length - route.length
      const basePath = pathname.slice(0, baseEnd)
      const search = window.location.search || ''
      const hashRoute = `${route}${search}`
      const cleanBase = basePath.endsWith('/') ? basePath : `${basePath}/`
      window.history.replaceState(null, '', `${cleanBase}#${hashRoute}`)
      return hashRoute.startsWith('/') ? hashRoute : `/${hashRoute}`
    }
  }
  return null
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

/** Run all hash/path repairs; returns route to navigate or null. */
export function repairIncomingRoute(): string | null {
  return repairBarePathRoute() ?? normalizeHashRoute()
}
