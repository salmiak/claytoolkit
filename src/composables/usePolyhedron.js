// Faceted (non-round) frustums: a top ring and a bottom ring, each an N-gon,
// with the top optionally rotated. The lateral surface is cut into flat faces
// and each face is unfolded to its exact 1:1 outline.
//
// Why the face shape depends on the inputs:
//   - Rings with the same corner count and no relative rotation give planar
//     isosceles trapezoids — one per side, all congruent.
//   - Any other combination (rotation, or differing corner counts) makes the
//     quad between two rings SKEW: its four corners do not share a plane, so it
//     cannot be flattened without distorting it. Those cases are cut into
//     triangles instead, which are always planar and so always unfold exactly.

const TAU = Math.PI * 2

const sub   = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x })
const dot   = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z
const len   = a => Math.hypot(a.x, a.y, a.z)
const norm  = a => { const l = len(a); return { x: a.x / l, y: a.y / l, z: a.z / l } }

export const dist3 = (a, b) => len(sub(a, b))
export const dist2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

// A round ring has no corners, so it is approximated by a polygon fine enough
// to read as a curve while staying a multiple of the opposite ring's corner
// count — that keeps the triangle strip regular and highly repetitive.
export function roundSegments(otherN) {
  return otherN >= 3 ? Math.max(12, otherN * 4) : 24
}

export function ringPoints(n, r, z, phase) {
  const out = []
  for (let i = 0; i < n; i++) {
    const a = phase + TAU * i / n
    out.push({ x: r * Math.cos(a), y: r * Math.sin(a), z })
  }
  return out
}

// True when the top ring's rotation lands its corners back over the bottom's,
// which is the only case where the side quads stay planar.
export function isAligned(nBot, nTop, rotTurns) {
  if (nBot !== nTop) return false
  const frac = ((rotTurns * nTop) % 1 + 1) % 1
  return frac < 1e-9 || frac > 1 - 1e-9
}

// Quads when the rings are aligned, otherwise a triangle strip. Each face
// records which of its edges lie on a ring (those are free edges) — the rest
// are joints against a neighbouring face.
export function buildFaces(bot, top, rotTurns) {
  const nb = bot.length, nt = top.length
  const faces = []

  if (isAligned(nb, nt, rotTurns)) {
    // Offset so vertex i of the top sits over vertex i of the bottom.
    const shift = Math.round(rotTurns * nt)
    for (let i = 0; i < nb; i++) {
      faces.push({
        pts: [bot[i], bot[(i + 1) % nb], top[(i + 1 + shift) % nt], top[(i + shift) % nt]],
        ringEdges: [0, 2],   // bottom edge and top edge
        jointEdges: [1, 3],  // the two legs
        kind: 'quad',
      })
    }
    return faces
  }

  let i = 0, j = 0
  const pb = k => k / nb
  const pt = k => rotTurns + k / nt
  while (i < nb || j < nt) {
    if (j >= nt || (i < nb && pb(i + 1) <= pt(j + 1))) {
      faces.push({
        pts: [bot[i % nb], bot[(i + 1) % nb], top[j % nt]],
        ringEdges: [0], jointEdges: [1, 2], kind: 'tri',
      })
      i++
    } else {
      faces.push({
        pts: [top[j % nt], bot[i % nb], top[(j + 1) % nt]],
        ringEdges: [2], jointEdges: [0, 1], kind: 'tri',
      })
      j++
    }
  }
  return faces
}

// Largest distance of any corner from the plane through the first three. Zero
// for triangles and for aligned quads; used to prove faces are flattenable.
export function planarityError(pts) {
  if (pts.length < 4) return 0
  const o = pts[0]
  const n = norm(cross(sub(pts[1], o), sub(pts[2], o)))
  return Math.max(...pts.map(p => Math.abs(dot(sub(p, o), n))))
}

// Exact isometric unfold: builds an in-plane basis, so every edge length and
// angle survives the move to 2D.
export function unfoldFace(pts) {
  const o = pts[0]
  const e1 = norm(sub(pts[1], o))
  let n = null
  for (let k = 2; k < pts.length; k++) {
    const c = cross(e1, sub(pts[k], o))
    if (len(c) > 1e-9) { n = norm(c); break }
  }
  if (!n) return null
  const e2 = cross(n, e1)
  return pts.map(p => {
    const d = sub(p, o)
    return { x: dot(d, e1), y: dot(d, e2) }
  })
}

// Lay a face down on one of its ring edges, with the body below the baseline,
// so templates read consistently and nest well.
export function orientFace(pts2, baseEdge) {
  const n = pts2.length
  const a = pts2[baseEdge], b = pts2[(baseEdge + 1) % n]
  const ang = Math.atan2(b.y - a.y, b.x - a.x)
  const c = Math.cos(-ang), s = Math.sin(-ang)
  let out = pts2.map(p => {
    const dx = p.x - a.x, dy = p.y - a.y
    return { x: dx * c - dy * s, y: dx * s + dy * c }
  })
  const lo = Math.min(...out.map(p => p.y)), hi = Math.max(...out.map(p => p.y))
  if (Math.abs(lo) > Math.abs(hi)) out = out.map(p => ({ x: p.x, y: -p.y }))
  const minX = Math.min(...out.map(p => p.x)), minY = Math.min(...out.map(p => p.y))
  return out.map(p => ({ x: p.x - minX, y: p.y - minY }))
}

// Congruence key: the multiset of edge lengths plus the area. Mirror images
// share a key, which is what we want — a clay slab can simply be flipped.
export function faceKey(pts2) {
  const n = pts2.length
  const edges = []
  let area2 = 0
  for (let i = 0; i < n; i++) {
    const p = pts2[i], q = pts2[(i + 1) % n]
    edges.push(dist2(p, q))
    area2 += p.x * q.y - q.x * p.y
  }
  return `${n}|${edges.map(e => e.toFixed(2)).sort().join(',')}|${Math.abs(area2 / 2).toFixed(1)}`
}

// Outward offset strip along one edge of a CCW-in-screen-space polygon, used to
// draw seam allowance on the joint edges.
export function edgeStrip(pts2, edgeIdx, w) {
  const n = pts2.length
  const a = pts2[edgeIdx], b = pts2[(edgeIdx + 1) % n]
  const dx = b.x - a.x, dy = b.y - a.y
  const l = Math.hypot(dx, dy)
  if (!l) return null
  // Both candidate normals; pick the one pointing away from the centroid.
  const cxy = pts2.reduce((s, p) => ({ x: s.x + p.x / n, y: s.y + p.y / n }), { x: 0, y: 0 })
  let nx = -dy / l, ny = dx / l
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  if ((mid.x + nx - cxy.x) ** 2 + (mid.y + ny - cxy.y) ** 2 < (mid.x - cxy.x) ** 2 + (mid.y - cxy.y) ** 2) {
    nx = -nx; ny = -ny
  }
  return [a, b, { x: b.x + nx * w, y: b.y + ny * w }, { x: a.x + nx * w, y: a.y + ny * w }]
}

// Shelf packing, so a shape with many distinct pieces stays a reasonable block
// instead of one very long strip.
export function packPieces(pieces, gap, maxRowWidth) {
  let x = 0, y = 0, rowH = 0
  const placed = []
  pieces.forEach(p => {
    if (x > 0 && x + p.w > maxRowWidth) { x = 0; y += rowH + gap; rowH = 0 }
    placed.push({ ...p, ox: x, oy: y })
    x += p.w + gap
    rowH = Math.max(rowH, p.h)
  })
  return placed
}

export const PIECE_GAP = 8
// Keeps a many-piece shape a compact block rather than one very long strip.
const MAX_ROW = 560

// A regular n-gon of circumscribed radius r, normalised into the first
// quadrant. Flat-side-down, so base and lid templates read like the faces.
export function polygonPiece(n, r) {
  const pts = ringPoints(n, r, 0, -Math.PI / 2 + Math.PI / n)
  const minX = Math.min(...pts.map(p => p.x)), minY = Math.min(...pts.map(p => p.y))
  const out = pts.map(p => ({ x: p.x - minX, y: p.y - minY }))
  return { pts: out, w: Math.max(...out.map(p => p.x)), h: Math.max(...out.map(p => p.y)) }
}

// Every piece to cut, positioned in template space. Shared by the preview, the
// SVG export and the PDF so all three cut exactly the same set.
export function facetedPieces(sol, discs) {
  const items = sol.faces.map((f, idx) => ({
    type: 'face', idx, pts: f.pts2, count: f.count,
    jointEdges: f.jointEdges, w: f.w, h: f.hh,
  }))
  discs.forEach(d => {
    if (d.n >= 3) {
      const p = polygonPiece(d.n, d.r)
      items.push({ type: 'disc', key: d.key, n: d.n, r: d.r, pts: p.pts, w: p.w, h: p.h, count: 1 })
    } else {
      items.push({ type: 'disc', key: d.key, n: 0, r: d.r, pts: null, w: d.r * 2, h: d.r * 2, count: 1 })
    }
  })
  const maxRow = Math.max(MAX_ROW, ...items.map(i => i.w))
  return packPieces(items, PIECE_GAP, maxRow).map(p => ({
    ...p,
    poly: p.pts ? p.pts.map(q => ({ x: q.x + p.ox, y: q.y + p.oy })) : null,
    cx: p.ox + p.w / 2, cy: p.oy + p.h / 2,
  }))
}

/**
 * Full faceted solution. Radii are circumscribed (corners sit on the circle).
 * Returns the distinct face templates with how many of each to cut.
 */
export function facetedSolution({ nTop, nBot, rTop, rBot, h, rotDeg }) {
  const roundTop = nTop < 3, roundBot = nBot < 3
  const segTop = roundTop ? roundSegments(roundBot ? 0 : nBot) : nTop
  const segBot = roundBot ? roundSegments(roundTop ? 0 : nTop) : nBot
  const rotTurns = ((rotDeg / 360) % 1 + 1) % 1

  const bot = ringPoints(segBot, rBot, 0, 0)
  const top = ringPoints(segTop, rTop, h, rotTurns * TAU)
  const faces = buildFaces(bot, top, rotTurns)

  let maxPlanarity = 0
  const groups = new Map()
  faces.forEach(f => {
    maxPlanarity = Math.max(maxPlanarity, planarityError(f.pts))
    const flat = unfoldFace(f.pts)
    if (!flat) return
    const pts2 = orientFace(flat, f.ringEdges[0])
    const key = faceKey(pts2)
    const found = groups.get(key)
    if (found) { found.count++; return }
    groups.set(key, {
      pts2, count: 1, kind: f.kind,
      jointEdges: f.jointEdges,
      w: Math.max(...pts2.map(p => p.x)),
      hh: Math.max(...pts2.map(p => p.y)),
    })
  })

  return {
    faces: [...groups.values()],
    faceCount: faces.length,
    segTop, segBot,
    approximated: roundTop || roundBot,
    aligned: isAligned(segBot, segTop, rotTurns),
    maxPlanarity,
    edgeTop: segTop >= 3 ? 2 * rTop * Math.sin(Math.PI / segTop) : null,
    edgeBot: segBot >= 3 ? 2 * rBot * Math.sin(Math.PI / segBot) : null,
  }
}
