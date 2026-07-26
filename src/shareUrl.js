// The whole shape lives in the query string, so a URL is a shareable,
// bookmarkable shape.
//
// Two deliberate choices:
//   - readable keys rather than an encoded blob, so a link can be understood,
//     hand-edited and debugged
//   - values equal to the default are omitted, so the default mug has a clean
//     URL and a typical share stays short

const KEYS = [
  // key, state field, kind
  ['u',   'unit',       'str'],
  ['dt',  'dTop',       'num'],
  ['db',  'dBot',       'num'],
  ['h',   'h',          'num'],
  ['rt',  'roundTop',   'bool'],
  ['rb',  'roundBot',   'bool'],
  ['nt',  'nTop',       'num'],
  ['nb',  'nBot',       'num'],
  ['ct',  'cornerRTop', 'num'],
  ['cb',  'cornerRBot', 'num'],
  ['rot', 'rotDeg',     'num'],
  ['bd',  'discBot',    'bool'],
  ['td',  'discTop',    'bool'],
  // The two optional allowances read better as "present means on".
  ['sk',  'shrinkP',    'num', 'shrinkOn'],
  ['sm',  'seamW',      'num', 'seamOn'],
]

const UNITS = ['mm', 'cm', 'in']

export function encodeState(state, defaults) {
  const q = new URLSearchParams()
  for (const [key, field, kind, gate] of KEYS) {
    if (gate) {
      // Only written when its toggle is on; absence means off.
      if (!state[gate]) continue
      q.set(key, String(+state[field] || 0))
      continue
    }
    const v = state[field]
    if (v === defaults[field]) continue
    q.set(key, kind === 'bool' ? (v ? '1' : '0') : String(v))
  }
  return q.toString()
}

/** Only fields present and valid in the URL, so callers can merge over defaults. */
export function decodeState(search) {
  const q = new URLSearchParams(search)
  const out = {}
  for (const [key, field, kind, gate] of KEYS) {
    if (!q.has(key)) {
      if (gate) out[gate] = false      // absent means the toggle is off
      continue
    }
    const raw = q.get(key)
    if (kind === 'num') {
      const n = Number(raw)
      if (!Number.isFinite(n)) continue
      out[field] = n
      if (gate) out[gate] = true
    } else if (kind === 'bool') {
      out[field] = raw === '1' || raw === 'true'
    } else if (UNITS.includes(raw)) {
      out[field] = raw
    }
  }
  return out
}

/** Absolute link to this exact shape — what gets shared, and what the QR encodes. */
export function shapeUrl(state, defaults) {
  const q = encodeState(state, defaults)
  const { origin, pathname } = window.location
  return q ? `${origin}${pathname}?${q}` : `${origin}${pathname}`
}

/**
 * Keep the address bar in step with the shape. replaceState rather than
 * pushState: pushing on every keystroke would bury the user's real history.
 */
export function syncUrl(state, defaults) {
  const q = encodeState(state, defaults)
  const next = q ? `${window.location.pathname}?${q}` : window.location.pathname
  if (next !== window.location.pathname + window.location.search) {
    window.history.replaceState(null, '', next)
  }
}
