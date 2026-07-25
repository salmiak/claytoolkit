// Rotatable wireframe of the solid, drawn as plain SVG lines.
//
// Deliberately not a 3D engine: a wireframe needs only vertex rotation and a
// perspective divide, so this avoids adding a renderer many times the size of
// the whole app. Depth is conveyed by fading distant edges rather than by
// hidden-line removal, which would need face sorting and clipping for very
// little gain at this size.

import { ringPoints, buildFaces, isAligned } from './usePolyhedron.js'

const TAU = Math.PI * 2
// A round ring has no corners to draw, so it is sampled finely enough to read
// as a curve.
const ROUND_SEG = 48
// Round rings get a few verticals purely as shape hints — they are not seams.
const HINT_LINES = 12

/**
 * Vertices plus a typed edge list. For a faceted solid the connecting edges are
 * the real panel joints, taken from the same buildFaces() the templates use, so
 * the preview shows how the piece is actually assembled.
 */
export function buildWireframe(g) {
  if (!g || !g.ok) return null
  const h = g.h || 0
  const rBot = g.rBot || 0
  const rTop = g.rTop || 0
  if (h <= 0 || Math.max(rBot, rTop) <= 0) return null

  const nBot = g.nBot >= 3 ? g.nBot : 0
  const nTop = g.nTop >= 3 ? g.nTop : 0
  const segBot = nBot || ROUND_SEG
  const segTop = nTop || ROUND_SEG
  const rotTurns = (((g.rotDeg || 0) / 360) % 1 + 1) % 1

  const bot = ringPoints(segBot, rBot, 0, 0)
  const top = ringPoints(segTop, rTop, h, rotTurns * TAU)
  const verts = [...bot, ...top]
  const T = i => segBot + i          // index of top vertex i
  const edges = []

  for (let i = 0; i < segBot; i++) edges.push([i, (i + 1) % segBot, 'ring'])
  for (let i = 0; i < segTop; i++) edges.push([T(i), T((i + 1) % segTop), 'ring'])

  if (nBot && nTop) {
    // Real joints, and for a rotated or mismatched solid the triangulation too,
    // so the wireframe matches the set of templates produced.
    const seen = new Set()
    buildFaces(bot, top, rotTurns).forEach(f => {
      const idx = f.pts.map(p => {
        const b = bot.indexOf(p)
        return b >= 0 ? b : T(top.indexOf(p))
      })
      f.jointEdges.forEach(e => {
        const a = idx[e], b = idx[(e + 1) % idx.length]
        const key = a < b ? `${a}_${b}` : `${b}_${a}`
        if (seen.has(key)) return
        seen.add(key)
        edges.push([a, b, 'seam'])
      })
    })
  } else {
    const k = Math.min(HINT_LINES, Math.max(segBot, segTop))
    for (let i = 0; i < k; i++) {
      const bi = Math.round(i * segBot / k) % segBot
      const ti = Math.round(i * segTop / k + rotTurns * segTop) % segTop
      edges.push([bi, T(ti), 'hint'])
    }
  }

  // True bounding radius about the centre, so the camera distance below scales
  // with the actual model rather than with whichever dimension happens to lead.
  const centre = { x: 0, y: 0, z: h / 2 }
  const radius = Math.max(
    1e-6,
    ...verts.map(v => Math.hypot(v.x - centre.x, v.y - centre.y, v.z - centre.z)),
  )
  return { verts, edges, centre, radius }
}

/**
 * Rotate, project and fit to the view box. Returns screen-space segments
 * ordered back to front, each with a 0..1 depth for fading.
 */
export function projectWireframe(model, { az, el, w, h, pad = 14 }) {
  if (!model) return []
  const { verts, edges, centre, radius } = model
  const ca = Math.cos(az), sa = Math.sin(az)
  const ce = Math.cos(el), se = Math.sin(el)
  // Far enough back that perspective reads as depth without distorting the
  // taper, which is the thing being judged here.
  const D = radius * 4.5

  const p = verts.map(v => {
    const x0 = v.x - centre.x, y0 = v.y - centre.y, z0 = v.z - centre.z
    const x1 = x0 * ca - y0 * sa
    const y1 = x0 * sa + y0 * ca
    const y2 = y1 * ce - z0 * se
    const z2 = y1 * se + z0 * ce
    const f = D / (D - y2)
    return { x: x1 * f, y: -z2 * f, d: y2 }
  })

  const xs = p.map(q => q.x), ys = p.map(q => q.y), ds = p.map(q => q.d)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const minD = Math.min(...ds), maxD = Math.max(...ds)
  const s = Math.min((w - pad * 2) / Math.max(maxX - minX, 1e-6),
                     (h - pad * 2) / Math.max(maxY - minY, 1e-6))
  const ox = w / 2 - ((minX + maxX) / 2) * s
  const oy = h / 2 - ((minY + maxY) / 2) * s
  const at = q => ({ x: q.x * s + ox, y: q.y * s + oy })
  const span = Math.max(maxD - minD, 1e-6)

  return edges
    .map(([a, b, kind]) => {
      const A = at(p[a]), B = at(p[b])
      return { a: A, b: B, kind, depth: ((p[a].d + p[b].d) / 2 - minD) / span }
    })
    .sort((m, n) => m.depth - n.depth)
}
