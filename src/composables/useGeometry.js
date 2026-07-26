import { facetedSolution, facetedPieces, edgeStrip, PIECE_GAP, isAligned } from './usePolyhedron.js'
import { mantleSolution, mantleOutline, roundedDisc, maxCornerRadius } from './useRoundedMantle.js'

const TAU = Math.PI * 2
const n = x => Math.round(x * 100) / 100

// Single source of truth for units. Geometry is computed in millimetres
// throughout; these only govern what goes in and what is displayed.
export const UNITS = ['mm', 'cm', 'in']
export const MM_PER_UNIT = { mm: 1, cm: 10, in: 25.4 }
// Enough digits to be useful at each unit's magnitude: whole millimetres, and
// hundredths of an inch (0.01in is a quarter of a millimetre).
const DECIMALS = { mm: 0, cm: 1, in: 2 }
// Arrow-key increment. An inch a press would be far too coarse.
export const STEP = { mm: 1, cm: 1, in: 0.25 }

export function fmt(mm, unit) {
  const v = mm / (MM_PER_UNIT[unit] || 1)
  const d = DECIMALS[unit] ?? 0
  // Centimetres gain a digit below 10, where one decimal loses too much.
  return v.toFixed(unit === 'cm' && Math.abs(v) < 10 ? d + 1 : d)
}

export function toMm(value, unit) {
  return (+value || 0) * (MM_PER_UNIT[unit] || 1)
}

// Convert a displayed value between units, rounded to that unit's precision so
// switching back and forth doesn't accumulate noise.
export function convertUnit(value, from, to) {
  const num = +value
  if (isNaN(num)) return value
  const mm = num * (MM_PER_UNIT[from] || 1)
  const out = mm / (MM_PER_UNIT[to] || 1)
  return +out.toFixed(to === 'mm' ? 0 : 2)
}

// The printed control ruler, in the reader's own units — an inch user should be
// able to check print scale with an inch rule.
export function rulerSpec(unit) {
  return unit === 'in'
    ? { mm: 101.6, major: 25.4, minor: 25.4 / 4, text: '4 in' }
    : { mm: 100, major: 50, minor: 10, text: '10 cm' }
}

// Point on annular sector: phi is half-angle from downward bisector
function P(cx, cy, rho, phi) {
  return { x: cx + rho * Math.sin(phi), y: cy + rho * Math.cos(phi) }
}

function tick(p, r) {
  return `<line class="dim" x1="${n(p.x - r)}" y1="${n(p.y)}" x2="${n(p.x + r)}" y2="${n(p.y)}"/>`
}

function heightDim(x, y, H, unit, labels) {
  return (
    `<line class="dim" x1="${n(x)}" y1="${n(y)}" x2="${n(x)}" y2="${n(y + H)}"/>` +
    tick({ x, y }, 2) +
    tick({ x, y: y + H }, 2) +
    `<text class="dim-txt" x="${n(x - 3)}" y="${n(y + H / 2)}" text-anchor="end" ` +
    `transform="rotate(-90 ${n(x - 3)} ${n(y + H / 2)})">${labels.height} ${fmt(H, unit)} ${unit}</text>`
  )
}

// Lay the discs out in a row under the unrolled wall. Reads bb.maxy once up
// front, so tracking each disc afterwards cannot shift the row downward.
function drawDiscs(g, bb, track, unit, labels) {
  const list = discList(g)
  if (!list.length) return ''
  const top = bb.maxy + 12
  let x = bb.minx
  let s = ''
  list.forEach(d => {
    const cx = x + d.r, cy = top + d.r
    s += `<circle class="cut-fill" cx="${n(cx)}" cy="${n(cy)}" r="${n(d.r)}"/>`
    s += `<text class="lbl-txt" x="${n(cx)}" y="${n(cy)}" text-anchor="middle">` +
         `${d.key === 'bot' ? labels.bot : labels.top} ⌀${fmt(d.r * 2, unit)} ${unit}</text>`
    track({ x, y: top })
    track({ x: x + d.r * 2, y: top + d.r * 2 })
    x += d.r * 2 + DISC_GAP
  })
  return s
}

// Every faceted piece, labelled with how many to cut. Seam allowance goes on
// the joint edges only — the edges that meet a neighbouring face.
function drawFaceted(g, bb, track, unit, labels) {
  const pieces = facetedPieces(g, discList(g))
  let s = ''
  pieces.forEach(p => {
    if (p.type === 'face') {
      if (g.seam > 0) {
        p.jointEdges.forEach(ei => {
          const strip = edgeStrip(p.poly, ei, g.seam)
          if (!strip) return
          strip.forEach(track)
          s += `<path class="seam" d="M ${strip.map(q => `${n(q.x)} ${n(q.y)}`).join(' L ')} Z"/>`
        })
      }
      s += `<path class="cut-fill" d="M ${p.poly.map(q => `${n(q.x)} ${n(q.y)}`).join(' L ')} Z"/>`
      p.poly.forEach(track)
      s += `<text class="lbl-txt" x="${n(p.cx)}" y="${n(p.cy)}" text-anchor="middle">` +
           `${labels.side} ×${p.count}</text>`
    } else if (p.n >= 3) {
      s += `<path class="cut-fill" d="M ${p.poly.map(q => `${n(q.x)} ${n(q.y)}`).join(' L ')} Z"/>`
      p.poly.forEach(track)
      s += `<text class="lbl-txt" x="${n(p.cx)}" y="${n(p.cy)}" text-anchor="middle">` +
           `${p.key === 'bot' ? labels.bot : labels.top} ⌀${fmt(p.r * 2, unit)} ${unit}</text>`
    } else {
      s += `<circle class="cut-fill" cx="${n(p.cx)}" cy="${n(p.cy)}" r="${n(p.r)}"/>`
      track({ x: p.ox, y: p.oy }); track({ x: p.ox + p.r * 2, y: p.oy + p.r * 2 })
      s += `<text class="lbl-txt" x="${n(p.cx)}" y="${n(p.cy)}" text-anchor="middle">` +
           `${p.key === 'bot' ? labels.bot : labels.top} ⌀${fmt(p.r * 2, unit)} ${unit}</text>`
    }
  })
  return s
}

// The mantle as one continuous piece: a single cut outline, fold rulings where
// each corner begins and ends, and seam allowance on the two end rulings where
// the strip closes on itself.
function drawOnePiece(g, bb, track, unit, labels) {
  const o = g.outline
  let s = ''

  if (g.seam > 0) {
    o.seamEdges.forEach(([a, b], i) => {
      // Offset away from the piece, so the two ends overlap when joined.
      const dx = b.x - a.x, dy = b.y - a.y
      const l = Math.hypot(dx, dy) || 1
      const sgn = i === 0 ? 1 : -1
      const nx = sgn * dy / l, ny = -sgn * dx / l
      const strip = [a, b,
        { x: b.x + nx * g.seam, y: b.y + ny * g.seam },
        { x: a.x + nx * g.seam, y: a.y + ny * g.seam }]
      strip.forEach(track)
      s += `<path class="seam" d="M ${strip.map(q => `${n(q.x)} ${n(q.y)}`).join(' L ')} Z"/>`
    })
  }

  s += `<path class="cut-fill" d="M ${o.poly.map(q => `${n(q.x)} ${n(q.y)}`).join(' L ')} Z"/>`
  o.poly.forEach(track)

  // Fold lines are inside the outline, so they must not be cut lines.
  o.folds.forEach(f => {
    s += `<line class="fold" x1="${n(f.a.x)}" y1="${n(f.a.y)}" x2="${n(f.b.x)}" y2="${n(f.b.y)}"/>`
  })

  const mid = Math.floor(o.B.length / 2)
  s += `<text class="lbl-txt" x="${n(o.B[mid].x)}" y="${n(o.B[mid].y + 7)}" text-anchor="middle">` +
       `${labels.bot} ${fmt(g.mantle.perimBot, unit)} ${unit}</text>`
  s += `<text class="lbl-sub" x="${n(o.T[mid].x)}" y="${n(o.T[mid].y - 4)}" text-anchor="middle">` +
       `${labels.top} ${fmt(g.mantle.perimTop, unit)} ${unit}</text>`

  s += drawRoundedDiscs(g, bb, track, unit, labels)
  return s
}

// Base and lid follow the wall: rounded polygons at the same corner radius.
function drawRoundedDiscs(g, bb, track, unit, labels) {
  const list = discList(g)
  if (!list.length) return ''
  const top = bb.maxy + 12
  let x = bb.minx
  let s = ''
  list.forEach(d => {
    const piece = roundedDisc(d.n, d.r, Math.min(g.cornerR, maxCornerRadius(d.n, 2 * d.r * Math.sin(Math.PI / d.n))))
    const pts = piece.pts.map(p => ({ x: p.x + x, y: p.y + top }))
    s += `<path class="cut-fill" d="M ${pts.map(q => `${n(q.x)} ${n(q.y)}`).join(' L ')} Z"/>`
    pts.forEach(track)
    s += `<text class="lbl-txt" x="${n(x + piece.w / 2)}" y="${n(top + piece.h / 2)}" text-anchor="middle">` +
         `${d.key === 'bot' ? labels.bot : labels.top} ⌀${fmt(d.r * 2, unit)} ${unit}</text>`
    x += piece.w + DISC_GAP
  })
  return s
}

function ruler(bb, x0, labels, unit) {
  const { mm: L, major, minor } = rulerSpec(unit)
  const y = bb.maxy + 9
  const x = x0 === Infinity ? 0 : x0
  let s = `<line class="ruler" x1="${n(x)}" y1="${n(y)}" x2="${n(x + L)}" y2="${n(y)}"/>`
  // Step in whole ticks to avoid float drift landing the last tick off the end.
  const ticks = Math.round(L / minor)
  for (let i = 0; i <= ticks; i++) {
    const at = i * minor
    const big = Math.abs(at % major) < 1e-6 || Math.abs((at % major) - major) < 1e-6
    s += `<line class="ruler" x1="${n(x + at)}" y1="${n(y)}" x2="${n(x + at)}" y2="${n(y - (big ? 3.5 : 2))}"/>`
  }
  s += `<text class="ruler-txt" x="${n(x)}" y="${n(y + 4.5)}">0</text>`
  s += `<text class="ruler-txt" x="${n(x + L)}" y="${n(y + 4.5)}" text-anchor="end">${labels.control}</text>`
  bb.maxy = y + 6
  return s
}

function finalize(inner, bb, pad) {
  const x = bb.minx - pad, y = bb.miny - pad
  const w = (bb.maxx - bb.minx) + pad * 2
  const h = (bb.maxy - bb.miny) + pad * 2
  return { inner, vb: `${n(x)} ${n(y)} ${n(w)} ${n(h)}`, w: n(w), h: n(h) }
}

export function calcGeometry({ dTop, dBot, h: hVal, unit, shrinkOn, shrinkP, seamOn, seamW, discTop, discBot, nTop = 0, nBot = 0, rotDeg = 0, cornerR = 0 }) {
  const f = MM_PER_UNIT[unit] || 1
  const sp = shrinkOn ? Math.min(99, Math.max(0, shrinkP || 0)) : 0
  const k = 100 / (100 - sp)
  const D1 = Math.max(0, (dTop || 0)) * f * k
  const D2 = Math.max(0, (dBot || 0)) * f * k
  const h = Math.max(0, (hVal || 0)) * f * k
  const seam = seamOn ? Math.max(0, (seamW || 0)) * f : 0

  const rTop = D1 / 2, rBot = D2 / 2
  const Rbig = Math.max(rTop, rBot), Rsmall = Math.min(rTop, rBot)
  if (Rbig <= 0 || h <= 0) return { ok: false }

  const dR = Rbig - Rsmall
  const L = Math.hypot(h, dR)

  // Discs are cut at the given diameter, shrink-scaled like the wall but with no
  // seam allowance — a disc has no vertical joint to overlap.
  const discs = { top: !!discTop, bot: !!discBot }

  // Rounded corners are only developable when the rings correspond ruling for
  // ruling: same corner count, no relative rotation. That case unrolls as one
  // continuous mantle; anything else keeps the triangulated per-face path.
  const rc = Math.max(0, (cornerR || 0)) * f * k
  const onePiece = nTop >= 3 && nTop === nBot &&
    isAligned(nBot, nTop, (((rotDeg || 0) / 360) % 1 + 1) % 1)

  if (onePiece) {
    const mantle = mantleSolution({ n: nTop, rBotCirc: rBot, rTopCirc: rTop, h, cornerR: rc })
    if (mantle) {
      const outline = mantleOutline(mantle)
      return {
        ok: true, faceted: true, onePiece: true, cyl: false,
        mantle, outline, seam, rTop, rBot, h, nTop, nBot, rotDeg,
        cornerR: mantle.rc, cornerClamped: mantle.clamped, maxCornerR: mantle.maxR,
        discs, shrink: { p: sp, k },
        metrics: {
          L: Math.hypot(h, Math.abs(rBot - rTop) * Math.cos(Math.PI / nTop)),
          Ri: null, Ro: null, thetaDeg: null,
          arcTop: mantle.perimTop, arcBot: mantle.perimBot,
        },
      }
    }
  }

  // Any faceted ring takes the polyhedral path; two round rings keep the
  // original cone/cylinder unrolling, which is exact and far more compact.
  if (nTop >= 3 || nBot >= 3) {
    const sol = facetedSolution({ nTop, nBot, rTop, rBot, h, rotDeg })
    return {
      ok: true, faceted: true, cyl: false, ...sol,
      seam, rTop, rBot, h, nTop, nBot, rotDeg, discs, shrink: { p: sp, k },
      metrics: {
        L: sol.faces.length ? Math.max(...sol.faces.map(f => f.hh)) : 0,
        Ri: null, Ro: null, thetaDeg: null,
        arcTop: TAU * rTop, arcBot: TAU * rBot,
      },
    }
  }

  if (dR < 1e-6) {
    const W = TAU * Rbig
    return {
      ok: true, cyl: true, W, H: h, h, seam, rTop, rBot, nTop, nBot, rotDeg, discs, shrink: { p: sp, k },
      metrics: {
        L: h, Ri: null, Ro: null, thetaDeg: null,
        arcTop: TAU * rTop, arcBot: TAU * rBot,
        sizeW: W + seam, sizeH: h,
      },
    }
  }

  const Ro = Rbig * L / dR
  const Ri = Rsmall * L / dR
  const theta = TAU * dR / L
  return {
    // The unrolled sector always puts the wider ring on the outer arc. When the
    // TOP is the wider one, drawing it as-is would put the pot's top edge along
    // the bottom of the sheet, so the whole sector is mirrored vertically and the
    // pot's base always ends up at the base of the drawing.
    flip: rTop > rBot ? -1 : 1,
    ok: true, cyl: false, Ro, Ri, theta, h, seam, rTop, rBot, Rbig, Rsmall, nTop, nBot, rotDeg, discs, shrink: { p: sp, k },
    metrics: {
      L, Ri, Ro, thetaDeg: theta * 180 / Math.PI,
      arcTop: TAU * rTop, arcBot: TAU * rBot,
    },
  }
}

// Discs to include, largest first so the row below the wall packs tightly.
// Shared by the SVG and PDF paths so both cut the same set.
// `n` is the corner count for that ring: 0 means a round disc, 3+ a polygon
// matching the faceted wall.
export function discList(g) {
  if (!g.ok || !g.discs) return []
  const out = []
  if (g.discs.bot && g.rBot > 0) out.push({ key: 'bot', r: g.rBot, n: g.nBot >= 3 ? g.nBot : 0 })
  if (g.discs.top && g.rTop > 0) out.push({ key: 'top', r: g.rTop, n: g.nTop >= 3 ? g.nTop : 0 })
  return out.sort((a, b) => b.r - a.r)
}

export const DISC_GAP = 8

export function buildTemplate(g, unit, labels) {
  if (!g.ok) return null
  const pad = 14
  let inner = ''
  const bb = { minx: Infinity, miny: Infinity, maxx: -Infinity, maxy: -Infinity }
  const track = p => {
    bb.minx = Math.min(bb.minx, p.x); bb.miny = Math.min(bb.miny, p.y)
    bb.maxx = Math.max(bb.maxx, p.x); bb.maxy = Math.max(bb.maxy, p.y)
  }

  if (g.onePiece) {
    inner += drawOnePiece(g, bb, track, unit, labels)
    inner += ruler(bb, bb.minx, labels, unit)
    return finalize(inner, bb, pad)
  }

  if (g.faceted) {
    inner += drawFaceted(g, bb, track, unit, labels)
    inner += ruler(bb, bb.minx, labels, unit)
    return finalize(inner, bb, pad)
  }

  if (g.cyl) {
    const { W, H, seam } = g
    inner += `<rect class="cut-fill" x="0" y="0" width="${n(W)}" height="${n(H)}"/>`
    if (seam > 0) inner += `<rect class="seam" x="${n(-seam)}" y="0" width="${n(seam)}" height="${n(H)}"/>`
    track({ x: -seam, y: 0 }); track({ x: W, y: H })
    inner += `<text class="lbl-txt" x="${n(W / 2)}" y="${n(H + 7)}" text-anchor="middle">${labels.circ} ${fmt(W, unit)} ${unit}</text>`
    inner += `<text class="lbl-sub" x="${n(W / 2)}" y="-4" text-anchor="middle">${labels.cylinder}</text>`
    inner += heightDim(-4, 0, H, unit, labels)
    inner += drawDiscs(g, bb, track, unit, labels)
    inner += ruler(bb, 0, labels, unit)
    return finalize(inner, bb, pad)
  }

  const { Ro, Ri, theta, seam, flip } = g
  const Cx = 0, Cy = 0, ht = theta / 2
  // Mirror vertically when the top is the wider ring, so the pot's base is
  // always drawn at the base of the sheet. Offsets are computed unmirrored and
  // then flipped, so the seam normals stay correct either way.
  const F = p => ({ x: p.x, y: p.y * flip })
  const Pol0 = P(Cx, Cy, Ro, -ht), Por0 = P(Cx, Cy, Ro, ht)
  const Pil0 = P(Cx, Cy, Ri, -ht), Pir0 = P(Cx, Cy, Ri, ht)
  const Pol = F(Pol0), Por = F(Por0), Pil = F(Pil0), Pir = F(Pir0)
  const large = theta > Math.PI ? 1 : 0
  // A vertical mirror reverses arc direction, so the sweep flags invert with it.
  const [swOut, swIn] = flip > 0 ? [0, 1] : [1, 0]

  for (let i = 0; i <= 120; i++) {
    const phi = -ht + theta * i / 120
    track(F(P(Cx, Cy, Ro, phi))); track(F(P(Cx, Cy, Ri, phi)))
  }

  let seamPath = ''
  if (seam > 0) {
    const nl = { x: -Math.cos(ht), y: -Math.sin(ht) }
    const nr = { x: Math.cos(ht), y: -Math.sin(ht) }
    const PolL = F({ x: Pol0.x + seam * nl.x, y: Pol0.y + seam * nl.y })
    const PilL = F({ x: Pil0.x + seam * nl.x, y: Pil0.y + seam * nl.y })
    const PorR = F({ x: Por0.x + seam * nr.x, y: Por0.y + seam * nr.y })
    const PirR = F({ x: Pir0.x + seam * nr.x, y: Pir0.y + seam * nr.y })
    ;[PolL, PilL, PorR, PirR].forEach(track)
    seamPath =
      `<path class="seam" d="M ${n(Pol.x)} ${n(Pol.y)} L ${n(Pil.x)} ${n(Pil.y)} L ${n(PilL.x)} ${n(PilL.y)} L ${n(PolL.x)} ${n(PolL.y)} Z"/>` +
      `<path class="seam" d="M ${n(Por.x)} ${n(Por.y)} L ${n(Pir.x)} ${n(Pir.y)} L ${n(PirR.x)} ${n(PirR.y)} L ${n(PorR.x)} ${n(PorR.y)} Z"/>`
  }

  const d =
    `M ${n(Pol.x)} ${n(Pol.y)} ` +
    `A ${n(Ro)} ${n(Ro)} 0 ${large} ${swOut} ${n(Por.x)} ${n(Por.y)} ` +
    `L ${n(Pir.x)} ${n(Pir.y)} ` +
    `A ${n(Ri)} ${n(Ri)} 0 ${large} ${swIn} ${n(Pil.x)} ${n(Pil.y)} Z`

  inner += seamPath
  inner += `<path class="cut-fill" d="${d}"/>`

  // The outer arc carries whichever ring is wider — not always the bottom.
  const outerIsTop = g.rTop > g.rBot
  const outer = { name: outerIsTop ? labels.top : labels.bot,
                  arc: outerIsTop ? g.metrics.arcTop : g.metrics.arcBot }
  const innerR = { name: outerIsTop ? labels.bot : labels.top,
                   arc: outerIsTop ? g.metrics.arcBot : g.metrics.arcTop }
  const arcText = r => `${r.name} ⌀${fmt(r.arc / Math.PI, unit)} · ${labels.arc} ${fmt(r.arc, unit)} ${unit}`

  const bIn = F(P(Cx, Cy, Ri, 0)), bOut = F(P(Cx, Cy, Ro, 0))
  inner += `<line class="dim" x1="${n(bIn.x)}" y1="${n(bIn.y)}" x2="${n(bOut.x)}" y2="${n(bOut.y)}"/>`
  inner += tick(bIn, 3)
  inner += tick(bOut, 3)
  inner += `<text class="dim-txt" x="${n(bOut.x + 3)}" y="${n((bIn.y + bOut.y) / 2)}">${labels.slant} ${fmt(g.metrics.L, unit)} ${unit}</text>`
  // Labels sit outside their own arc, which swaps sides along with the mirror.
  inner += `<text class="lbl-txt" x="${n(bOut.x)}" y="${n(bOut.y + (flip > 0 ? 7 : -4))}" text-anchor="middle">${arcText(outer)}</text>`
  inner += `<text class="lbl-sub" x="${n(bIn.x)}" y="${n(bIn.y + (flip > 0 ? -3 : 8))}" text-anchor="middle">${arcText(innerR)}</text>`
  inner += `<text class="dim-txt" x="${n(Pol.x - 2)}" y="${n(Pol.y + (flip > 0 ? -3 : 8))}" text-anchor="end">${labels.angle} ${g.metrics.thetaDeg.toFixed(1)}°</text>`

  inner += drawDiscs(g, bb, track, unit, labels)
  inner += ruler(bb, bb.minx, labels, unit)
  return finalize(inner, bb, pad)
}

export const SVG_STYLE = `
  .cut{fill:none;stroke:#241F1C;stroke-width:.5}
  .cut-fill{fill:#ffffff;fill-opacity:.55;stroke:#241F1C;stroke-width:.5}
  .seam{fill:#7C9473;fill-opacity:.10;stroke:#7C9473;stroke-width:.4;stroke-dasharray:2.4 1.8}
  .fold{fill:none;stroke:#6B4A36;stroke-width:.35;stroke-dasharray:5 2 1 2}
  .dim{stroke:#7C9473;stroke-width:.3}
  .dim-txt{fill:#5A6E52;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:4.4px}
  .lbl-txt{fill:#241F1C;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:4.4px}
  .lbl-sub{fill:#6B4A36;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:3.4px}
  .ruler{stroke:#241F1C;stroke-width:.35}
  .ruler-txt{fill:#241F1C;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:3.6px}`

export function svgString(t, physical) {
  // On screen the sheet is sized for us, so fill it in both axes; exports keep
  // real millimetre dimensions for 1:1 printing.
  const size = physical ? `width="${t.w}mm" height="${t.h}mm"` : `width="100%" height="100%"`
  return `<svg xmlns="http://www.w3.org/2000/svg" ${size} viewBox="${t.vb}"><style>${SVG_STYLE}</style>${t.inner}</svg>`
}
