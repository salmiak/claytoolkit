<template>
  <div class="flex flex-col min-h-screen md:h-screen md:overflow-hidden bg-frame text-ink antialiased">

    <header class="bg-frame border-b border-black px-5 py-2.5 flex items-center gap-4">
      <h1 class="text-[19px] font-[650] tracking-[-0.01em] text-clay-bisque m-0 leading-none">
        <span class="text-sage font-mono font-normal mr-2">◠</span>{{ t('app.name') }}
      </h1>
      <button
        @click="toggleLocale"
        class="ml-auto text-[12px] font-mono text-clay-terracotta hover:text-clay-bisque border border-frame-line rounded-md px-2.5 py-0.5 transition-colors shrink-0"
      >{{ locale === 'sv' ? 'EN' : 'SV' }}</button>
    </header>

    <main class="flex-1 grid grid-cols-1 md:grid-cols-[340px_1fr] min-h-0">
      <ControlPanel
        v-model:unit="state.unit"
        v-model:dTop="state.dTop"
        v-model:dBot="state.dBot"
        v-model:h="state.h"
        v-model:shrinkOn="state.shrinkOn"
        v-model:shrinkP="state.shrinkP"
        v-model:seamOn="state.seamOn"
        v-model:seamW="state.seamW"
        v-model:discTop="state.discTop"
        v-model:discBot="state.discBot"
        v-model:nTop="state.nTop"
        v-model:nBot="state.nBot"
        v-model:rotDeg="state.rotDeg"
        v-model:cornerRTop="state.cornerRTop"
        v-model:cornerRBot="state.cornerRBot"
        v-model:roundTop="state.roundTop"
        v-model:roundBot="state.roundBot"
        :geo="geo"
        :pdfLoading="pdfLoading"
        :svgHtml="svgHtml"
        :aspect="aspect"
        :bigView="bigView"
        :shareLink="shareLink"
        @downloadSvg="handleDownloadSvg"
        @downloadPdf="handleDownloadPdf"
        @print="handlePrint"
      />
      <TemplateCanvas
        :svgHtml="svgHtml"
        :aspect="aspect"
        :geo="geo"
        :view="bigView"
        :rulerLen="rulerLen"
        :pdfLoading="pdfLoading"
        :disabled="!geo.ok"
        @downloadPdf="handleDownloadPdf"
        @swapViews="bigView = bigView === 'template' ? 'shape' : 'template'"
      />
    </main>

    <div id="printarea" style="display:none"></div>
  </div>
</template>

<script setup>
import { reactive, computed, ref, watch } from 'vue'
import { storeLocale } from './locale.js'
import { decodeState, syncUrl, shapeUrl } from './shareUrl.js'
import { useI18n } from 'vue-i18n'
import ControlPanel from './components/ControlPanel.vue'
import TemplateCanvas from './components/TemplateCanvas.vue'
import { calcGeometry, buildTemplate, svgString, fmt, discList, convertUnit, rulerSpec } from './composables/useGeometry.js'
import { generatePDF } from './composables/usePDF.js'

const { t, locale } = useI18n()

// Keep <html lang> in step with the active locale, for screen readers,
// hyphenation and translation prompts.
watch(locale, l => { document.documentElement.lang = l }, { immediate: true })

// Defaults describe a mug: 90mm opening tapering to a 70mm base, 77mm tall.
const DEFAULTS = {
  unit: 'mm',
  dTop: 90,
  dBot: 70,
  h: 77,
  shrinkOn: false,
  shrinkP: 12,
  seamOn: false,
  seamW: 10,
  discTop: false,
  discBot: false,
  nTop: 4,
  nBot: 4,
  rotDeg: 0,
  cornerRTop: 0,
  cornerRBot: 0,
  roundTop: true,
  roundBot: true,
}

// A shape arriving by URL wins over the defaults, so shared and bookmarked
// links open on the shape they describe.
const state = reactive({ ...DEFAULTS, ...decodeState(window.location.search) })

// Keep the address bar current, debounced so typing a number doesn't rewrite it
// on every keystroke.
let urlTimer = null
watch(state, () => {
  clearTimeout(urlTimer)
  urlTimer = setTimeout(() => syncUrl(state, DEFAULTS), 250)
}, { deep: true })

// Keep the physical size when the unit changes, rather than reinterpreting the
// number. Goes through millimetres so any pair of units works.
watch(() => state.unit, (newUnit, oldUnit) => {
  if (newUnit === oldUnit) return
  const c = v => convertUnit(v, oldUnit, newUnit)
  state.dTop = c(state.dTop)
  state.dBot = c(state.dBot)
  state.h = c(state.h)
  state.seamW = c(state.seamW)
  state.cornerRTop = c(state.cornerRTop)
  state.cornerRBot = c(state.cornerRBot)
})

const rulerLen = computed(() => rulerSpec(state.unit).text)
const shareLink = computed(() => shapeUrl(state, DEFAULTS))

const svgLabels = computed(() => ({
  slant:    t('svg.slant'),
  bot:      t('svg.bot'),
  top:      t('svg.top'),
  arc:      t('svg.arc'),
  angle:    t('svg.angle'),
  circ:     t('svg.circ'),
  cylinder: t('svg.cylinder'),
  height:   t('svg.height'),
  control:  t('svg.control', { len: rulerLen.value }),
  side:     t('svg.side'),
}))

// A ticked Round box means that ring has no corners, which is what
// calcGeometry already treats as round. Faceted counts are floored at 3 here
// rather than while typing: min="3" doesn't stop someone entering 1, and a
// count below 3 would quietly turn the ring round while its box says otherwise.
const corners = (isRound, v) => isRound ? 0 : Math.max(3, +v || 3)

// A round ring is given its diameter; a faceted one is given the length of one
// side, which is what actually gets measured on the slab. calcGeometry works in
// circumscribed diameters throughout, so the side length is converted here:
// a regular n-gon of side s has circumdiameter s / sin(pi/n).
const toDiameter = (isRound, value, n) =>
  isRound ? value : (+value || 0) / Math.sin(Math.PI / n)

const geo = computed(() => {
  const nTop = corners(state.roundTop, state.nTop)
  const nBot = corners(state.roundBot, state.nBot)
  return calcGeometry({
    ...state,
    nTop,
    nBot,
    dTop: toDiameter(state.roundTop, state.dTop, nTop),
    dBot: toDiameter(state.roundBot, state.dBot, nBot),
  })
})
const tpl     = computed(() => geo.value.ok ? buildTemplate(geo.value, state.unit, svgLabels.value) : null)
const svgHtml = computed(() => tpl.value ? svgString(tpl.value, false) : null)
const aspect  = computed(() => tpl.value && tpl.value.h > 0 ? tpl.value.w / tpl.value.h : 1)

function handleDownloadSvg() {
  if (!tpl.value) return
  const blob = new Blob(
    ['<?xml version="1.0" encoding="UTF-8"?>\n' + svgString(tpl.value, true)],
    { type: 'image/svg+xml' },
  )
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const sfx = state.shrinkOn ? `_krymp${state.shrinkP}pct` : ''
  const discSfx = discList(geo.value).map(d => d.key).join('') || ''
  a.href = url
  a.download = `konform_${state.dTop}-${state.dBot}-${state.h}${state.unit}${sfx}` +
               `${discSfx ? '_' + discSfx : ''}.svg`
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
}

function handlePrint() {
  if (!tpl.value) return
  const el = document.getElementById('printarea')
  el.innerHTML = svgString(tpl.value, true)
  el.style.display = 'block'
  window.print()
  el.style.display = 'none'
  el.innerHTML = ''
}

// Which view gets the large pane; the sidebar slot shows the other.
const bigView = ref('template')

const pdfLoading = ref(false)

async function handleDownloadPdf() {
  if (!geo.value.ok || pdfLoading.value) return
  // The mixed round/faceted case has no exact flat solution, so warn before
  // producing something that gets printed and cut. Cancellable rather than a
  // bare notice, since the output may not be worth the paper.
  if (geo.value.approximated && !confirm(t('warn.mixedConfirm'))) return
  pdfLoading.value = true
  const g = geo.value
  const u = state.unit
  const labels = {
    title:          t('pdf.title'),
    overview:       t('pdf.overview'),
    getPageTitle:   (page, total) => t('pdf.pageTitle', { page, total }),
    getRowCol:      (r, c)        => t('pdf.rowCol', { r, c }),
    assemblyTitle:  t('pdf.assemblyTitle'),
    step1:          n             => t('pdf.step1', { n }),
    step2:          t('pdf.step2'),
    step3:          t('pdf.step3'),
    step4:          t('pdf.step4'),
    step5:          t('pdf.step5'),
    step6:          t('pdf.step6'),
    getTape:        page          => t('pdf.tape', { page }),
    legend:         t('pdf.legend'),
    control:        t('pdf.control', { len: rulerLen.value }),
    qrCaption:      t('pdf.qrCaption'),
    overview_label: t('pdf.overview_label'),
    getPageLabel:   (page, total) => t('pdf.pageLabel', { page, total }),
    finalDim:       t('pdf.finalDim', { top: state.dTop, bot: state.dBot, h: state.h, u }),
    shrinkNote:     g.shrink.p > 0
                      ? t('pdf.shrinkNote', { p: g.shrink.p, k: g.shrink.k.toFixed(3) })
                      : t('pdf.noShrink'),
    seamNote:       g.seam > 0
                      ? t('pdf.seamNote', { w: fmt(g.seam, u), u })
                      : t('pdf.noSeam'),
    discsNote:      (() => {
                      const d = discList(g)
                      if (!d.length) return t('pdf.noDiscs')
                      const list = d
                        .map(x => `${t(x.key === 'bot' ? 'svg.bot' : 'svg.top')} ⌀${fmt(x.r * 2, u)} ${u}`)
                        .join(' + ')
                      return t('pdf.discs', { list })
                    })(),
    slant:          t('pdf.slant', { l: fmt(g.metrics.L, u), u }) +
                      (!g.cyl && !g.faceted ? t('pdf.angleNote', { deg: g.metrics.thetaDeg.toFixed(1) }) : ''),
    facetedNote:    g.faceted
                      ? t('pdf.faceted', { info:
                          `${g.nBot >= 3 ? g.nBot : '○'}/${g.nTop >= 3 ? g.nTop : '○'}` +
                          `, ${g.faceCount} ${t('svg.side')}, ${g.faces.length} ${t('computed.distinct').toLowerCase()}` +
                          (g.rotDeg ? `, ${g.rotDeg}°` : '') })
                      : '',
    getSize:        (tw, th, n) => t('pdf.size', { w: fmt(tw, u), h: fmt(th, u), u, n }),
  }
  try {
    await generatePDF(g, { unit: u, dTop: state.dTop, dBot: state.dBot, h: state.h,
      shareUrl: shapeUrl(state, DEFAULTS) }, labels)
  } catch (err) {
    console.error(err)
    alert('PDF error: ' + err.message)
  } finally {
    pdfLoading.value = false
  }
}

function toggleLocale() {
  locale.value = locale.value === 'sv' ? 'en' : 'sv'
  storeLocale(locale.value)
}
</script>

<style>
@media print {
  body > *:not(#printarea) { visibility: hidden; }
  #printarea, #printarea * { visibility: visible; }
  #printarea { display: block !important; position: absolute; left: 0; top: 0; }
}
</style>
