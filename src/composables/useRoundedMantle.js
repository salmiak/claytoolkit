// Rounded-corner faceted frustums, unrolled as ONE continuous mantle.
//
// Why one piece is possible here at all: a rounded-corner frustum is fully
// developable. Its flat panels are planar, and each rounded corner is a section
// of a cone — any two rulings of a cone meet at the apex, so they are coplanar,
// which makes every quad between consecutive rulings exactly flat. The whole
// lateral surface therefore unrolls with no distortion, and the pieces can be
// laid end to end instead of cut apart.
//
// That is only true when the rings correspond ruling-for-ruling: same corner
// count, no relative rotation. A rotated or mismatched frustum has skew quads
// and stays in the triangulated path.

const TAU = Math.PI * 2

const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

/**
 * Largest corner radius a ring can take: its apothem. At exactly the apothem the
 * straight segments vanish and the outline becomes a circle.
 */
export function maxCornerRadius(n, sideLen) {
  if (n < 3) return 0
  return sideLen / (2 * Math.tan(Math.PI / n))
}

/**
 * A regular n-gon of circumradius R with its corners filleted to radius rc,
 * sampled as a closed polyline.
 *
 * The fillet centre sits on the corner bisector at R - rc/cos(pi/n), which puts
 * it exactly rc from both adjacent edges, and the arc spans the exterior angle
 * 2*pi/n. At rc = 0 the arc collapses to the sharp vertex, so one code path
 * covers both sharp and rounded.
 *
 * Sampling is structural — every ring uses the same station layout — so index i
 * on the bottom and index i on the top are the two ends of one ruling.
 */
export function roundedRing(n, R, rc, z, phase, steps) {
  const half = Math.PI / n
  const sharp = rc < 1e-9
  const d = R - rc / Math.cos(half)
  const pts = []
  const kind = []          // 'corner' while on an arc, 'flat' for the segment that follows
  for (let i = 0; i < n; i++) {
    const beta = phase + TAU * i / n
    const cx = d * Math.cos(beta), cy = d * Math.sin(beta)
    for (let s = 0; s <= steps; s++) {
      const a = beta - half + (2 * half) * (steps ? s / steps : 0.5)
      // At rc = 0 this reduces to the vertex itself, whatever the angle.
      pts.push({ x: cx + rc * Math.cos(a), y: cy + rc * Math.sin(a), z })
      kind.push('corner')
    }
  }
  return { pts, kind, steps, sharp }
}

// Indices where a corner arc starts and ends. These are the rulings a maker
// scores or starts bending on; the rulings between them are a smooth curve.
export function foldIndices(n, steps, sharp) {
  const per = steps + 1
  const out = []
  for (let i = 0; i < n; i++) {
    if (sharp) out.push(i * per)          // one crease per corner
    else { out.push(i * per); out.push(i * per + steps) }
  }
  return out
}

// Two circle intersections; `pick` chooses between them.
function intersect(p0, r0, p1, r1, pick) {
  const dx = p1.x - p0.x, dy = p1.y - p0.y
  const d = Math.hypot(dx, dy)
  if (d < 1e-12) return null
  const a = (r0 * r0 - r1 * r1 + d * d) / (2 * d)
  const h = Math.sqrt(Math.max(0, r0 * r0 - a * a))
  const mx = p0.x + a * dx / d, my = p0.y + a * dy / d
  const ox = -dy * h / d, oy = dx * h / d
  return pick({ x: mx + ox, y: my + oy }, { x: mx - ox, y: my - oy })
}

/**
 * Unroll the strip between two corresponding rings into one flat piece.
 *
 * Each quad is laid down from its own 3D edge lengths plus a diagonal, hinged on
 * the ruling shared with the previous quad. Because every quad here is exactly
 * planar, that reproduces it without distortion rather than approximating it.
 *
 * Returns the bottom and top edges of the unrolled piece as point lists, so the
 * outline is bottom-forwards then top-backwards.
 */
export function unrollStrip(bot, top) {
  const m = bot.length
  const B = [{ x: 0, y: 0 }]
  const T = [{ x: 0, y: dist3(bot[0], top[0]) }]
  let sign = 0

  for (let i = 1; i <= m; i++) {
    const j = i % m                       // closes the loop back onto the seam
    const eb = dist3(bot[j], bot[i - 1])
    const et = dist3(top[j], top[i - 1])
    const lr = dist3(bot[j], top[j])
    const dg = dist3(bot[j], top[i - 1])
    const prevB = B[i - 1], prevT = T[i - 1]

    // A sharp corner on one ring gives zero-length edges there, and the station
    // simply doesn't move. Short-circuit rather than trilaterate from a
    // zero-radius circle: that is ill-conditioned, because the sqrt turns
    // rounding-level error into visible error.
    // Otherwise keep the strip advancing — the new bottom point must stay on the
    // same side of the previous ruling, or the piece folds back on itself.
    const nb = eb < 1e-9 ? prevB : intersect(prevB, eb, prevT, dg, (s1, s2) => {
      const cr = c => (prevT.x - prevB.x) * (c.y - prevB.y) - (prevT.y - prevB.y) * (c.x - prevB.x)
      const c1 = cr(s1)
      if (Math.abs(c1) < 1e-9) return s1
      if (!sign) { sign = Math.sign(c1); return s1 }
      return Math.sign(c1) === sign ? s1 : s2
    })
    if (!nb) return null

    const nt = et < 1e-9 ? prevT : intersect(nb, lr, prevT, et, (s1, s2) => {
      // The top point sits on the far side of the bottom edge from the strip.
      const cr = c => (nb.x - prevB.x) * (c.y - prevB.y) - (nb.y - prevB.y) * (c.x - prevB.x)
      return Math.sign(cr(s1)) === Math.sign(cr(prevT)) ? s1 : s2
    })
    if (!nt) return null

    B.push(nb); T.push(nt)
  }
  return { B, T }
}

/**
 * The unrolled mantle as a drawable outline: bottom edge forwards, top edge
 * back, plus the fold rulings and the two seam edges where the ends meet.
 * y is negated so the top edge sits above the bottom in screen coordinates.
 */
export function mantleOutline(sol) {
  if (!sol) return null
  const f = p => ({ x: p.x, y: -p.y })
  const B = sol.B.map(f), T = sol.T.map(f)
  const poly = [...B, ...T.slice().reverse()]
  const folds = sol.folds.map(i => ({ a: B[i], b: T[i] }))
  const last = B.length - 1
  return {
    poly, folds,
    seamEdges: [[B[0], T[0]], [B[last], T[last]]],
    B, T,
  }
}

/** A rounded regular n-gon as a flat outline, normalised into the first quadrant. */
export function roundedDisc(n, R, rc, arcSteps = 8) {
  const { pts } = roundedRing(n, R, rc, 0, -Math.PI / 2, rc > 1e-9 ? arcSteps : 0)
  const minX = Math.min(...pts.map(p => p.x)), minY = Math.min(...pts.map(p => p.y))
  const out = pts.map(p => ({ x: p.x - minX, y: p.y - minY }))
  return { pts: out, w: Math.max(...out.map(p => p.x)), h: Math.max(...out.map(p => p.y)) }
}

/**
 * Full one-piece solution: 3D rings, the unrolled outline, fold lines, and the
 * measurements worth reporting.
 */
export function mantleSolution({ n, rBotCirc, rTopCirc, h, cornerRBot, cornerRTop, arcSteps = 8 }) {
  if (n < 3) return null
  const sideBot = 2 * rBotCirc * Math.sin(Math.PI / n)
  const sideTop = 2 * rTopCirc * Math.sin(Math.PI / n)
  // Each ring clamps to its own apothem: a radius beyond that leaves no straight
  // segment, and the outline is simply a circle.
  const maxBot = maxCornerRadius(n, sideBot), maxTop = maxCornerRadius(n, sideTop)
  const rcBot = Math.max(0, Math.min(cornerRBot ?? 0, maxBot))
  const rcTop = Math.max(0, Math.min(cornerRTop ?? 0, maxTop))
  // Station count is shared so index i is one ruling on both rings, even when
  // only one end is filleted — the sharp ring then repeats its vertex.
  const steps = (rcBot > 1e-9 || rcTop > 1e-9) ? Math.max(1, arcSteps) : 0

  const bot = roundedRing(n, rBotCirc, rcBot, 0, -Math.PI / 2, steps)
  const top = roundedRing(n, rTopCirc, rcTop, h, -Math.PI / 2, steps)
  const flat = unrollStrip(bot.pts, top.pts)
  if (!flat) return null

  const folds = foldIndices(n, steps, steps === 0)
  const perim = (r) => {
    let s = 0
    for (let i = 0; i < r.length; i++) s += dist3(r[i], r[(i + 1) % r.length])
    return s
  }
  return {
    rcBot, rcTop,
    clampedBot: rcBot < (cornerRBot ?? 0) - 1e-9,
    clampedTop: rcTop < (cornerRTop ?? 0) - 1e-9,
    bot3: bot.pts, top3: top.pts,
    B: flat.B, T: flat.T,
    folds, sharp: steps === 0, arcSteps: steps,
    perimBot: perim(bot.pts), perimTop: perim(top.pts),
    straightBot: Math.max(0, sideBot - 2 * rcBot * Math.tan(Math.PI / n)),
    straightTop: Math.max(0, sideTop - 2 * rcTop * Math.tan(Math.PI / n)),
    maxBot, maxTop,
  }
}
