import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  buildHashRouteUrl,
  repairBarePathRoute,
  resolveCatchAllRoute,
  REVIEWER_DATA_REVIEW_PATH,
  DEMO_ROLE_STORAGE_KEY,
} from '../src/lib/prototypeRoutes'

describe('prototypeRoutes', () => {
  beforeEach(() => {
    vi.stubGlobal('import.meta', { env: { BASE_URL: '/SmartReview-AIc2/' } })
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('buildHashRouteUrl uses origin + base + hash', () => {
    Object.defineProperty(window, 'location', {
      value: { origin: 'https://jualzate87.github.io' },
      writable: true,
    })
    expect(buildHashRouteUrl(REVIEWER_DATA_REVIEW_PATH)).toBe(
      'https://jualzate87.github.io/SmartReview-AIc2/#/data-review?entry=review-return&role=reviewer&startReview=true',
    )
  })

  it('repairBarePathRoute fixes path-only data-review URLs', () => {
    const replaceState = vi.fn()
    Object.defineProperty(window, 'history', { value: { replaceState }, writable: true })
    Object.defineProperty(window, 'location', {
      value: {
        pathname: '/SmartReview-AIc2/data-review',
        search: '?entry=review-return&role=reviewer',
        hash: '',
      },
      writable: true,
    })

    const route = repairBarePathRoute()
    expect(route).toBe('/data-review?entry=review-return&role=reviewer')
    expect(replaceState).toHaveBeenCalledWith(
      null,
      '',
      '/SmartReview-AIc2/#/data-review?entry=review-return&role=reviewer',
    )
  })

  it('resolveCatchAllRoute sends reviewers to data-review', () => {
    localStorage.setItem(DEMO_ROLE_STORAGE_KEY, 'reviewer')
    expect(resolveCatchAllRoute('')).toBe(REVIEWER_DATA_REVIEW_PATH)
    expect(resolveCatchAllRoute('?role=reviewer')).toBe(REVIEWER_DATA_REVIEW_PATH)
    expect(resolveCatchAllRoute('?startReview=true')).toBe(REVIEWER_DATA_REVIEW_PATH)
  })

  it('resolveCatchAllRoute defaults to smart-return for preparer', () => {
    localStorage.setItem(DEMO_ROLE_STORAGE_KEY, 'preparer')
    expect(resolveCatchAllRoute('')).toBe('/smart-return')
  })
})
