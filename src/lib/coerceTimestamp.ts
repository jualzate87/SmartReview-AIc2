/**
 * Normalize persisted activity timestamps — legacy sessions may store numbers,
 * nested objects, Date-like values, or full ActivityEntry shapes in `at` fields.
 */

export function formatActivityTimestamp(date: Date = new Date()): string {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/** Coerce any persisted `at` value to a display-safe timestamp string. */
export function coerceTimestamp(at: unknown, fallback = 'earlier'): string {
  if (typeof at === 'string' && at.trim()) return at.trim()
  if (typeof at === 'number' && Number.isFinite(at)) {
    return formatActivityTimestamp(new Date(at))
  }
  if (at instanceof Date && !Number.isNaN(at.getTime())) {
    return formatActivityTimestamp(at)
  }
  if (at && typeof at === 'object') {
    if ('at' in at) {
      return coerceTimestamp((at as { at: unknown }).at, fallback)
    }
    if ('toString' in at && typeof (at as { toString: unknown }).toString === 'function') {
      const text = String(at)
      if (text && text !== '[object Object]') return text
    }
  }
  return fallback
}

export type ActivityLike = { by: string; at: string }

/** Ensure an activity entry always has string `by` and coerced `at`. */
export function sanitizeActivityEntry(
  entry: unknown,
  fallbackBy: string,
  fallbackAt = 'earlier',
): ActivityLike {
  if (!entry || typeof entry !== 'object') {
    return { by: fallbackBy, at: fallbackAt }
  }
  const e = entry as Partial<ActivityLike>
  const by = typeof e.by === 'string' && e.by.trim() ? e.by : fallbackBy
  return { by, at: coerceTimestamp(e.at, fallbackAt) }
}

/** Extract date-only portion from a coerced timestamp — safe for milestone attribution. */
export function timestampDatePart(at: unknown, fallback = 'earlier'): string {
  const normalized = coerceTimestamp(at, fallback)
  const byDot = normalized.split(' · ')[0]
  if (byDot !== normalized) return byDot.trim()
  const byComma = normalized.split(',')[0]
  return (byComma ?? normalized).trim() || normalized
}
