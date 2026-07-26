import { discList, DISC_GAP, rulerSpec } from './useGeometry.js'
import { facetedPieces, edgeStrip } from './usePolyhedron.js'
import { roundedDisc, maxCornerRadius } from './useRoundedMantle.js'

const TAU = Math.PI * 2
const n = x => Math.round(x * 100) / 100

function P(cx, cy, rho, phi) {
  return { x: cx + rho * Math.sin(phi), y: cy + rho * Math.cos(phi) }
}

const A4 = { w: 210, h: 297 }
const MARGIN = 8, HEADER = 13, FOOTER = 9
// Clay-firing palette, as PDF RGB. SAGE draws lines; SAGE_TXT is the darker
// accent for type, since sage on white is only 3.3:1.
const INK = [36, 31, 28]        // #241F1C
const SAGE = [124, 148, 115]    // #7C9473
const SAGE_TXT = [90, 110, 82]  // #5A6E52
const RULE = [185, 141, 99]     // #B98D63 — faint frames and grid
const SOFT = [107, 74, 54]      // #6B4A36 — secondary type

function contentSize(o) {
  const pw = o === 'l' ? A4.h : A4.w, ph = o === 'l' ? A4.w : A4.h
  return { o, pw, ph, ox: MARGIN, oy: MARGIN + HEADER, cw: pw - 2 * MARGIN, ch: ph - 2 * MARGIN - HEADER - FOOTER }
}

// Circle as a polygon, segmented finely enough that the tiling and clipping
// code can treat it like any other cut outline.
function circlePoly(cx, cy, r) {
  const seg = Math.max(48, Math.ceil(TAU * r / 0.8))
  const pts = []
  for (let i = 0; i < seg; i++) {
    const a = TAU * i / seg
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
  }
  return pts
}

// Returns every closed cut outline: the unrolled wall first, then any discs
// laid out in a row beneath it.
function cutPolygon(g) {
  const polys = []
  const seams = []

  // One continuous mantle plus its base/lid. Fold lines are returned separately
  // so they can be drawn as creases rather than cut.
  if (g.onePiece) {
    const o = g.outline
    polys.push(o.poly)
    if (g.seam > 0) {
      o.seamEdges.forEach(([a, b], i) => {
        const dx = b.x - a.x, dy = b.y - a.y
        const l = Math.hypot(dx, dy) || 1
        const sgn = i === 0 ? 1 : -1
        const nx = sgn * dy / l, ny = -sgn * dx / l
        seams.push([a, b,
          { x: b.x + nx * g.seam, y: b.y + ny * g.seam },
          { x: a.x + nx * g.seam, y: a.y + ny * g.seam }])
      })
    }
    let bx = Math.min(...o.poly.map(p => p.x))
    const by = Math.max(...o.poly.map(p => p.y)) + DISC_GAP
    discList(g).forEach(d => {
      const side = 2 * d.r * Math.sin(Math.PI / d.n)
      const ringR = d.key === 'bot' ? g.cornerRBot : g.cornerRTop
      const piece = roundedDisc(d.n, d.r, Math.min(ringR, maxCornerRadius(d.n, side)))
      polys.push(piece.pts.map(p => ({ x: p.x + bx, y: p.y + by })))
      bx += piece.w + DISC_GAP
    })
    return { polys, seams, folds: o.folds }
  }

  // Faceted shapes are already flat pieces laid out in template space; the
  // tiling below treats them like any other set of outlines.
  if (g.faceted) {
    facetedPieces(g, discList(g)).forEach(p => {
      if (p.poly) polys.push(p.poly)
      else polys.push(circlePoly(p.cx, p.cy, p.r))
      if (p.type === 'face' && g.seam > 0) {
        p.jointEdges.forEach(ei => {
          const strip = edgeStrip(p.poly, ei, g.seam)
          if (strip) seams.push(strip)
        })
      }
    })
    return { polys, seams }
  }

  if (g.cyl) {
    const { W, H, seam } = g
    polys.push([{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }])
    if (seam > 0) seams.push([{ x: -seam, y: 0 }, { x: 0, y: 0 }, { x: 0, y: H }, { x: -seam, y: H }])
  } else {
    const { Ro, Ri, theta, seam } = g, ht = theta / 2, C = { x: 0, y: 0 }
    // Same vertical mirror as the preview, taken from the geometry so the two
    // can't drift apart: the pot's base is always at the base of the drawing.
    const flip = g.flip ?? 1
    const F = p => ({ x: p.x, y: p.y * flip })
    const segO = Math.max(24, Math.ceil(theta * Ro / 0.8))
    const segI = Math.max(24, Math.ceil(theta * Ri / 0.8))
    const poly = []
    for (let i = 0; i <= segO; i++) poly.push(F(P(C.x, C.y, Ro, -ht + theta * i / segO)))
    for (let i = 0; i <= segI; i++) poly.push(F(P(C.x, C.y, Ri, ht - theta * i / segI)))
    polys.push(poly)
    if (seam > 0) {
      const nl = { x: -Math.cos(ht), y: -Math.sin(ht) }, nr = { x: Math.cos(ht), y: -Math.sin(ht) }
      const Pol = P(C.x, C.y, Ro, -ht), Pil = P(C.x, C.y, Ri, -ht)
      const Por = P(C.x, C.y, Ro, ht), Pir = P(C.x, C.y, Ri, ht)
      seams.push([Pol, Pil, { x: Pil.x + seam * nl.x, y: Pil.y + seam * nl.y }, { x: Pol.x + seam * nl.x, y: Pol.y + seam * nl.y }].map(F))
      seams.push([Por, Pir, { x: Pir.x + seam * nr.x, y: Pir.y + seam * nr.y }, { x: Por.x + seam * nr.x, y: Por.y + seam * nr.y }].map(F))
    }
  }

  const discs = discList(g)
  if (discs.length) {
    const b = bboxOf([...polys, ...seams])
    const top = b.maxy + DISC_GAP
    let x = b.minx
    discs.forEach(d => {
      polys.push(circlePoly(x + d.r, top + d.r, d.r))
      x += d.r * 2 + DISC_GAP
    })
  }

  return { polys, seams }
}

function bboxOf(list) {
  const b = { minx: Infinity, miny: Infinity, maxx: -Infinity, maxy: -Infinity }
  list.forEach(poly => poly.forEach(p => {
    b.minx = Math.min(b.minx, p.x); b.miny = Math.min(b.miny, p.y)
    b.maxx = Math.max(b.maxx, p.x); b.maxy = Math.max(b.maxy, p.y)
  }))
  return b
}

function clipPoly(poly, R) {
  const lx = (a, b, X) => { const t = (X - a.x) / (b.x - a.x); return { x: X, y: a.y + t * (b.y - a.y) } }
  const ly = (a, b, Y) => { const t = (Y - a.y) / (b.y - a.y); return { x: a.x + t * (b.x - a.x), y: Y } }
  const pass = (pts, inside, inter) => {
    const o = []; if (pts.length < 2) return o
    for (let i = 0; i < pts.length; i++) {
      const cur = pts[i], prev = pts[(i + pts.length - 1) % pts.length]
      const ci = inside(cur), pi = inside(prev)
      if (ci) { if (!pi) o.push(inter(prev, cur)); o.push(cur) }
      else if (pi) o.push(inter(prev, cur))
    }
    return o
  }
  let o = poly
  o = pass(o, p => p.x >= R.l, (a, b) => lx(a, b, R.l))
  o = pass(o, p => p.x <= R.r, (a, b) => lx(a, b, R.r))
  o = pass(o, p => p.y >= R.t, (a, b) => ly(a, b, R.t))
  o = pass(o, p => p.y <= R.b, (a, b) => ly(a, b, R.b))
  return o
}

function classify(a, b, R) {
  const e = 0.08
  if (Math.abs(a.x - R.l) < e && Math.abs(b.x - R.l) < e) return { seam: true, side: 'L' }
  if (Math.abs(a.x - R.r) < e && Math.abs(b.x - R.r) < e) return { seam: true, side: 'R' }
  if (Math.abs(a.y - R.t) < e && Math.abs(b.y - R.t) < e) return { seam: true, side: 'T' }
  if (Math.abs(a.y - R.b) < e && Math.abs(b.y - R.b) < e) return { seam: true, side: 'B' }
  return { seam: false }
}

function toRuns(poly, R) {
  const nv = poly.length, ed = []
  for (let k = 0; k < nv; k++) {
    const a = poly[k], b = poly[(k + 1) % nv]
    ed.push({ a, b, c: classify(a, b, R) })
  }
  const same = (x, y) => x.c.seam === y.c.seam && (!x.c.seam || x.c.side === y.c.side)
  let s = 0
  for (let k = 0; k < nv; k++) { if (!same(ed[k], ed[(k - 1 + nv) % nv])) { s = k; break } }
  const runs = []; let cur = null
  for (let t = 0; t < nv; t++) {
    const e = ed[(s + t) % nv]
    if (cur && same({ c: cur.c }, e)) cur.pts.push(e.b)
    else { cur = { c: e.c, pts: [e.a, e.b] }; runs.push(cur) }
  }
  return runs
}

const dset = (doc, arr) => doc.setLineDashPattern(arr, 0)
const stroke = (doc, rgb, w) => { doc.setDrawColor(...rgb); doc.setLineWidth(w) }

function polyline(doc, pts, close) {
  for (let i = 0; i < pts.length - 1; i++) doc.line(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y)
  if (close && pts.length > 2) doc.line(pts[pts.length - 1].x, pts[pts.length - 1].y, pts[0].x, pts[0].y)
}

function cross(doc, x, y, t) {
  doc.line(x - t, y, x + t, y); doc.line(x, y - t, x, y + t)
}

// Vector QR: drawn as filled squares rather than an embedded bitmap, so it stays
// crisp at any print scale. The encoder is imported lazily with the PDF itself,
// so it costs nothing until someone exports.
const QR_MM = 20

async function qrMatrix(text) {
  try {
    const mod = await import('qrcode-generator')
    const qrcode = mod.default || mod
    // Type 0 auto-sizes; level M tolerates a printed template getting scuffed.
    const q = qrcode(0, 'M')
    q.addData(text)
    q.make()
    const n = q.getModuleCount()
    const cells = []
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) cells.push([r, c])
    return { n, cells }
  } catch {
    return null   // a missing encoder must not stop the template being produced
  }
}

function drawQr(doc, m, x, y, size, caption) {
  if (!m) return
  const cell = size / m.n
  doc.setFillColor(...INK)
  // Nudge each cell a hair oversize so adjacent modules meet without hairlines.
  m.cells.forEach(([r, c]) =>
    doc.rect(x + c * cell, y + r * cell, cell * 1.02, cell * 1.02, 'F'))
  if (caption) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6)
    doc.setTextColor(...SOFT)
    doc.text(caption, x + size / 2, y + size + 2.6, { align: 'center', maxWidth: size + 8 })
  }
}

function pdfHeader(doc, C, title, sub) {
  doc.setTextColor(...INK); doc.setFont('helvetica', 'bold'); doc.setFontSize(11)
  doc.text(title, MARGIN, MARGIN + 5)
  if (sub) {
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...SOFT); doc.setFontSize(8.5)
    doc.text(sub, C.pw - MARGIN, MARGIN + 5, { align: 'right' })
  }
  stroke(doc, RULE, 0.2); dset(doc, [])
  doc.line(MARGIN, MARGIN + 7.5, C.pw - MARGIN, MARGIN + 7.5)
}

function footerLegend(doc, C, right, labels) {
  doc.setFont('helvetica', 'normal'); doc.setTextColor(...SOFT); doc.setFontSize(7.5)
  doc.text(labels.legend, MARGIN, C.ph - 4)
  if (right) doc.text(right, C.pw - MARGIN, C.ph - 4, { align: 'right' })
}

// Drawn in the reader's own units, so an inch user can check print scale with
// an inch rule rather than having to own a metric one.
function controlRuler(doc, x, y, labels, spec) {
  const { mm: L, major, minor } = spec
  stroke(doc, INK, 0.3); dset(doc, [])
  doc.line(x, y, x + L, y)
  const ticks = Math.round(L / minor)
  for (let i = 0; i <= ticks; i++) {
    const at = i * minor
    const big = Math.abs(at % major) < 1e-6 || Math.abs((at % major) - major) < 1e-6
    doc.line(x + at, y, x + at, y - (big ? 3 : 1.8))
  }
  doc.setTextColor(...INK); doc.setFontSize(7)
  doc.text('0', x, y + 3.4)
  doc.text(labels.control, x + L, y + 3.4, { align: 'right' })
}

export async function generatePDF(g, inputVals, labels) {
  const { jsPDF } = await import('jspdf')
  const { unit, dTop, dBot, h: height, shareUrl } = inputVals
  const qr = shareUrl ? await qrMatrix(shareUrl) : null
  const spec = rulerSpec(unit)
  const { polys, seams, folds = [] } = cutPolygon(g)
  const raw = bboxOf([...polys, ...seams])
  const tw = raw.maxx - raw.minx, th = raw.maxy - raw.miny
  const M = 6
  const bmin = { x: raw.minx - M, y: raw.miny - M }
  const W = tw + 2 * M, H = th + 2 * M

  const cand = ['p', 'l'].map(o => {
    const c = contentSize(o)
    return { c, nx: Math.ceil(W / c.cw), ny: Math.ceil(H / c.ch) }
  })
  cand.forEach(v => v.pages = v.nx * v.ny)
  cand.sort((a, b) => a.pages - b.pages || (a.c.o === 'p' ? -1 : 1))
  const best = cand[0], C = best.c, nx = best.nx, ny = best.ny
  const multi = best.pages > 1

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: C.o })
  doc.setFont('helvetica', 'normal')

  const tiles = [], pageOf = {}
  let num = 0
  for (let r = 0; r < ny; r++) {
    for (let c = 0; c < nx; c++) {
      const tL = bmin.x + c * C.cw, tT = bmin.y + r * C.ch
      const rect = { l: tL, t: tT, r: tL + C.cw, b: tT + C.ch }
      const cps = polys.map(p => clipPoly(p, rect)).filter(p => p.length >= 3)
      const sp = seams.map(s => clipPoly(s, rect)).filter(s => s.length >= 3)
      // fold lines kept whole only when both ends fall on this tile
      const fl = folds.filter(f =>
        f.a.x >= rect.l && f.a.x <= rect.r && f.a.y >= rect.t && f.a.y <= rect.b &&
        f.b.x >= rect.l && f.b.x <= rect.r && f.b.y >= rect.t && f.b.y <= rect.b)
      if (cps.length || sp.length) {
        num++; pageOf[`${r}_${c}`] = num
        tiles.push({ r, c, tL, tT, rect, cps, sp, fl })
      }
    }
  }
  const N = tiles.length

  if (multi) {
    pdfHeader(doc, C, labels.overview, '')
    const mapX = MARGIN, mapY = C.oy + 2
    const mapW = Math.min(C.cw * 0.52, 110), mapH = C.ch - 40
    const sc = Math.min(mapW / W, mapH / H)
    const mp = p => ({ x: mapX + (p.x - bmin.x) * sc, y: mapY + (p.y - bmin.y) * sc })

    stroke(doc, INK, 0.4); dset(doc, [])
    polys.forEach(p => polyline(doc, p.map(mp), true))
    seams.forEach(s => { stroke(doc, SAGE, 0.3); dset(doc, [1.2, 1]); polyline(doc, s.map(mp), true); dset(doc, []) })

    for (let c = 0; c <= nx; c++) {
      const x = bmin.x + c * C.cw
      const a = mp({ x, y: bmin.y }), b = mp({ x, y: bmin.y + H })
      stroke(doc, RULE, 0.2); dset(doc, [0.8, 0.8]); doc.line(a.x, a.y, b.x, b.y)
    }
    for (let r = 0; r <= ny; r++) {
      const y = bmin.y + r * C.ch
      const a = mp({ x: bmin.x, y }), b = mp({ x: bmin.x + W, y })
      doc.line(a.x, a.y, b.x, b.y)
    }
    dset(doc, [])

    doc.setTextColor(...SAGE_TXT)
    tiles.forEach(t => {
      const cx = bmin.x + (t.c + 0.5) * C.cw, cy = bmin.y + (t.r + 0.5) * C.ch
      const m = mp({ x: cx, y: cy })
      doc.setFontSize(11)
      doc.text(String(pageOf[`${t.r}_${t.c}`]), m.x, m.y, { align: 'center', baseline: 'middle' })
    })

    const ix = MARGIN + mapW + 8, iw = C.cw - mapW - 8
    let iy = C.oy + 4
    doc.setTextColor(...INK)
    const lines = [
      [labels.assemblyTitle, 11, true],
      [labels.step1(N), 9, false],
      [labels.step2, 9, false],
      [labels.step3, 9, false],
      [labels.step4, 9, false],
      [labels.step5, 9, false],
      [labels.step6, 9, false],
      ['', 6, false],
      [labels.finalDim, 9, true],
      [labels.shrinkNote, 9, false],
      [labels.seamNote, 9, false],
      [labels.discsNote, 9, false],
      [labels.facetedNote, 9, false],
      [labels.slant, 9, false],
      [labels.getSize(tw, th, N), 9, false],
    ]
    lines.forEach(([text, sz, bold]) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(sz)
      if (text) doc.text(text, ix, iy, { maxWidth: iw })
      iy += sz * 0.42 + 1.6
    })
    doc.setFont('helvetica', 'normal')
    drawQr(doc, qr, MARGIN, iy + 4, QR_MM, labels.qrCaption)
    controlRuler(doc, MARGIN, C.oy + C.ch - 4, labels, spec)
    footerLegend(doc, C, labels.overview_label, labels)
    doc.addPage()
  }

  tiles.forEach((t, idx) => {
    if (idx > 0) doc.addPage()
    const title = multi ? labels.getPageTitle(pageOf[`${t.r}_${t.c}`], N) : labels.title
    const subt = multi ? labels.getRowCol(t.r + 1, t.c + 1) : ''
    pdfHeader(doc, C, title, subt)

    let offx = 0, offy = 0
    // On a single page the QR shares the sheet with the drawing, so the template
    // centres in a shortened area rather than being overlapped.
    const qrRoom = (!multi && qr) ? QR_MM + 8 : 0
    if (!multi) {
      offx = (C.cw - tw) / 2 - (raw.minx - t.tL)
      offy = (C.ch - qrRoom - th) / 2 - (raw.miny - t.tT)
    }
    const map = p => ({ x: C.ox + (p.x - t.tL) + offx, y: C.oy + (p.y - t.tT) + offy })

    stroke(doc, RULE, 0.15); dset(doc, [0.6, 0.9])
    doc.rect(C.ox, C.oy, C.cw, C.ch)
    dset(doc, [])

    stroke(doc, SAGE, 0.35); dset(doc, [1.6, 1.2])
    t.sp.forEach(s => polyline(doc, s.map(map), true))
    dset(doc, [])

    // Creases: drawn inside the outline, never to be cut.
    if (t.fl?.length) {
      stroke(doc, SOFT, 0.3); dset(doc, [4, 1.4, 0.8, 1.4])
      t.fl.forEach(f => { const a = map(f.a), b = map(f.b); doc.line(a.x, a.y, b.x, b.y) })
      dset(doc, [])
    }

    t.cps.forEach(cp => {
      const runs = toRuns(cp, t.rect)
      stroke(doc, INK, 0.5); dset(doc, [])
      runs.filter(r => !r.c.seam).forEach(r => polyline(doc, r.pts.map(map), false))
      runs.filter(r => r.c.seam).forEach(r => {
        const nb = r.c.side === 'R' ? [t.r, t.c + 1]
          : r.c.side === 'L' ? [t.r, t.c - 1]
          : r.c.side === 'T' ? [t.r - 1, t.c]
          : [t.r + 1, t.c]
        const pg = pageOf[`${nb[0]}_${nb[1]}`]
        stroke(doc, SAGE, 0.55); dset(doc, [3, 1.3, 0.6, 1.3])
        polyline(doc, r.pts.map(map), false)
        dset(doc, [])
        const a = r.pts[0], b = r.pts[r.pts.length - 1]
        ;[0, 0.25, 0.5, 0.75, 1].forEach(f => {
          const m = map({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f })
          stroke(doc, SAGE, 0.4); cross(doc, m.x, m.y, 1.6)
        })
        if (pg) {
          const mid = map({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
          doc.setTextColor(...SAGE_TXT); doc.setFontSize(8)
          const vert = r.c.side === 'L' || r.c.side === 'R'
          const dx = r.c.side === 'L' ? 4 : r.c.side === 'R' ? -4 : 0
          const dy = r.c.side === 'T' ? 4 : r.c.side === 'B' ? -4 : 0
          doc.text(labels.getTape(pg), mid.x + dx, mid.y + dy,
            { align: 'center', baseline: 'middle', angle: vert ? 90 : 0 })
        }
      })
    })

    // Bottom-right of the first sheet only: one scan is enough, and repeating it
    // on every tile would just crowd the cut lines.
    if (!multi && qr) {
      drawQr(doc, qr, C.ox + C.cw - QR_MM, C.oy + C.ch - QR_MM - 7, QR_MM, labels.qrCaption)
    }
    controlRuler(doc, C.ox, C.oy + C.ch - 3.5, labels, spec)
    footerLegend(doc, C, multi ? labels.getPageLabel(pageOf[`${t.r}_${t.c}`], N) : '', labels)
  })

  const sfx = g.shrink.p > 0 ? `_shrink${g.shrink.p}pct` : ''
  doc.save(`konform_${dTop}-${dBot}-${height}${unit}${sfx}_A4.pdf`)
}
