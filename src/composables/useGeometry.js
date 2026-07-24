const TAU = Math.PI * 2
const n = x => Math.round(x * 100) / 100

export function fmt(mm, unit, dec = 1) {
  const v = unit === 'cm' ? mm / 10 : mm
  return v.toFixed(unit === 'cm' ? dec + (Math.abs(v) < 10 ? 1 : 0) : 0)
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

function ruler(bb, x0, labels) {
  const y = bb.maxy + 9
  const x = x0 === Infinity ? 0 : x0
  let s = `<line class="ruler" x1="${n(x)}" y1="${n(y)}" x2="${n(x + 100)}" y2="${n(y)}"/>`
  for (let i = 0; i <= 100; i += 10) {
    const big = i % 50 === 0
    s += `<line class="ruler" x1="${n(x + i)}" y1="${n(y)}" x2="${n(x + i)}" y2="${n(y - (big ? 3.5 : 2))}"/>`
  }
  s += `<text class="ruler-txt" x="${n(x)}" y="${n(y + 4.5)}">0</text>`
  s += `<text class="ruler-txt" x="${n(x + 100)}" y="${n(y + 4.5)}" text-anchor="end">${labels.control}</text>`
  bb.maxy = y + 6
  return s
}

function finalize(inner, bb, pad) {
  const x = bb.minx - pad, y = bb.miny - pad
  const w = (bb.maxx - bb.minx) + pad * 2
  const h = (bb.maxy - bb.miny) + pad * 2
  return { inner, vb: `${n(x)} ${n(y)} ${n(w)} ${n(h)}`, w: n(w), h: n(h) }
}

export function calcGeometry({ dTop, dBot, h: hVal, unit, shrinkOn, shrinkP, seamOn, seamW }) {
  const f = unit === 'cm' ? 10 : 1
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

  if (dR < 1e-6) {
    const W = TAU * Rbig
    return {
      ok: true, cyl: true, W, H: h, seam, shrink: { p: sp, k },
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
    ok: true, cyl: false, Ro, Ri, theta, seam, rTop, rBot, Rbig, Rsmall, shrink: { p: sp, k },
    metrics: {
      L, Ri, Ro, thetaDeg: theta * 180 / Math.PI,
      arcTop: TAU * rTop, arcBot: TAU * rBot,
    },
  }
}

export function buildTemplate(g, unit, labels) {
  if (!g.ok) return null
  const pad = 14
  let inner = ''
  const bb = { minx: Infinity, miny: Infinity, maxx: -Infinity, maxy: -Infinity }
  const track = p => {
    bb.minx = Math.min(bb.minx, p.x); bb.miny = Math.min(bb.miny, p.y)
    bb.maxx = Math.max(bb.maxx, p.x); bb.maxy = Math.max(bb.maxy, p.y)
  }

  if (g.cyl) {
    const { W, H, seam } = g
    inner += `<rect class="cut-fill" x="0" y="0" width="${n(W)}" height="${n(H)}"/>`
    if (seam > 0) inner += `<rect class="seam" x="${n(-seam)}" y="0" width="${n(seam)}" height="${n(H)}"/>`
    track({ x: -seam, y: 0 }); track({ x: W, y: H })
    inner += `<text class="lbl-txt" x="${n(W / 2)}" y="${n(H + 7)}" text-anchor="middle">${labels.circ} ${fmt(W, unit)} ${unit}</text>`
    inner += `<text class="lbl-sub" x="${n(W / 2)}" y="-4" text-anchor="middle">${labels.cylinder}</text>`
    inner += heightDim(-4, 0, H, unit, labels)
    inner += ruler(bb, 0, labels)
    return finalize(inner, bb, pad)
  }

  const { Ro, Ri, theta, seam } = g
  const Cx = 0, Cy = 0, ht = theta / 2
  const Pol = P(Cx, Cy, Ro, -ht), Por = P(Cx, Cy, Ro, ht)
  const Pil = P(Cx, Cy, Ri, -ht), Pir = P(Cx, Cy, Ri, ht)
  const large = theta > Math.PI ? 1 : 0

  for (let i = 0; i <= 120; i++) {
    const phi = -ht + theta * i / 120
    track(P(Cx, Cy, Ro, phi)); track(P(Cx, Cy, Ri, phi))
  }

  let seamPath = ''
  if (seam > 0) {
    const nl = { x: -Math.cos(ht), y: -Math.sin(ht) }
    const nr = { x: Math.cos(ht), y: -Math.sin(ht) }
    const PolL = { x: Pol.x + seam * nl.x, y: Pol.y + seam * nl.y }
    const PilL = { x: Pil.x + seam * nl.x, y: Pil.y + seam * nl.y }
    const PorR = { x: Por.x + seam * nr.x, y: Por.y + seam * nr.y }
    const PirR = { x: Pir.x + seam * nr.x, y: Pir.y + seam * nr.y }
    ;[PolL, PilL, PorR, PirR].forEach(track)
    seamPath =
      `<path class="seam" d="M ${n(Pol.x)} ${n(Pol.y)} L ${n(Pil.x)} ${n(Pil.y)} L ${n(PilL.x)} ${n(PilL.y)} L ${n(PolL.x)} ${n(PolL.y)} Z"/>` +
      `<path class="seam" d="M ${n(Por.x)} ${n(Por.y)} L ${n(Pir.x)} ${n(Pir.y)} L ${n(PirR.x)} ${n(PirR.y)} L ${n(PorR.x)} ${n(PorR.y)} Z"/>`
  }

  const d =
    `M ${n(Pol.x)} ${n(Pol.y)} ` +
    `A ${n(Ro)} ${n(Ro)} 0 ${large} 0 ${n(Por.x)} ${n(Por.y)} ` +
    `L ${n(Pir.x)} ${n(Pir.y)} ` +
    `A ${n(Ri)} ${n(Ri)} 0 ${large} 1 ${n(Pil.x)} ${n(Pil.y)} Z`

  inner += seamPath
  inner += `<path class="cut-fill" d="${d}"/>`

  const bIn = P(Cx, Cy, Ri, 0), bOut = P(Cx, Cy, Ro, 0)
  inner += `<line class="dim" x1="${n(bIn.x)}" y1="${n(bIn.y)}" x2="${n(bOut.x)}" y2="${n(bOut.y)}"/>`
  inner += tick(bIn, 3)
  inner += tick(bOut, 3)
  inner += `<text class="dim-txt" x="${n(bOut.x + 3)}" y="${n((bIn.y + bOut.y) / 2)}">${labels.slant} ${fmt(g.metrics.L, unit)} ${unit}</text>`
  inner += `<text class="lbl-txt" x="${n(bOut.x)}" y="${n(bOut.y + 7)}" text-anchor="middle">${labels.bot} ⌀${fmt(g.metrics.arcBot / Math.PI, unit)} · ${labels.arc} ${fmt(g.metrics.arcBot, unit)} ${unit}</text>`
  inner += `<text class="lbl-sub" x="${n(bIn.x)}" y="${n(bIn.y - 3)}" text-anchor="middle">${labels.top} ⌀${fmt(g.metrics.arcTop / Math.PI, unit)} · ${labels.arc} ${fmt(g.metrics.arcTop, unit)} ${unit}</text>`
  inner += `<text class="dim-txt" x="${n(Pol.x - 2)}" y="${n(Pol.y - 3)}" text-anchor="end">${labels.angle} ${g.metrics.thetaDeg.toFixed(1)}°</text>`

  inner += ruler(bb, bb.minx, labels)
  return finalize(inner, bb, pad)
}

export const SVG_STYLE = `
  .cut{fill:none;stroke:#23221F;stroke-width:.5}
  .cut-fill{fill:#ffffff;fill-opacity:.55;stroke:#23221F;stroke-width:.5}
  .seam{fill:#2F6F73;fill-opacity:.10;stroke:#2F6F73;stroke-width:.4;stroke-dasharray:2.4 1.8}
  .dim{stroke:#2F6F73;stroke-width:.3}
  .dim-txt{fill:#2F6F73;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:4.4px}
  .lbl-txt{fill:#23221F;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:4.4px}
  .lbl-sub{fill:#6B665C;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:3.4px}
  .ruler{stroke:#23221F;stroke-width:.35}
  .ruler-txt{fill:#23221F;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:3.6px}`

export function svgString(t, physical) {
  const size = physical ? `width="${t.w}mm" height="${t.h}mm"` : `width="100%"`
  return `<svg xmlns="http://www.w3.org/2000/svg" ${size} viewBox="${t.vb}"><style>${SVG_STYLE}</style>${t.inner}</svg>`
}
