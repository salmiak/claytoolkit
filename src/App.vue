<template>
  <div class="flex flex-col min-h-screen md:h-screen md:overflow-hidden bg-frame text-ink antialiased">

    <header class="bg-frame border-b border-black px-5 py-[18px] flex items-baseline gap-4 flex-wrap">
      <h1 class="text-xl font-[650] tracking-[-0.01em] text-[#EDEAE1] m-0 leading-none">
        <span class="text-teal font-mono font-normal mr-2">◠</span>{{ t('app.name') }}
      </h1>
      <p class="text-[#9c968a] text-[13px] leading-snug max-w-[60ch]">{{ t('app.sub') }}</p>
      <button
        @click="toggleLocale"
        class="ml-auto text-[12px] font-mono text-[#9c968a] hover:text-[#EDEAE1] border border-[#4a4842] rounded-md px-3 py-1 transition-colors shrink-0"
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
        :geo="geo"
        :pdfLoading="pdfLoading"
        @downloadSvg="handleDownloadSvg"
        @downloadPdf="handleDownloadPdf"
        @print="handlePrint"
      />
      <TemplateCanvas :svgHtml="svgHtml" />
    </main>

    <div id="printarea" style="display:none"></div>
  </div>
</template>

<script setup>
import { reactive, computed, ref, watch } from 'vue'
import { storeLocale } from './locale.js'
import { useI18n } from 'vue-i18n'
import ControlPanel from './components/ControlPanel.vue'
import TemplateCanvas from './components/TemplateCanvas.vue'
import { calcGeometry, buildTemplate, svgString, fmt, discList } from './composables/useGeometry.js'
import { generatePDF } from './composables/usePDF.js'

const { t, locale } = useI18n()

// Keep <html lang> in step with the active locale, for screen readers,
// hyphenation and translation prompts.
watch(locale, l => { document.documentElement.lang = l }, { immediate: true })

const state = reactive({
  unit: 'mm',
  dTop: 60,
  dBot: 120,
  h: 100,
  shrinkOn: false,
  shrinkP: 12,
  seamOn: false,
  seamW: 10,
  discTop: false,
  discBot: false,
})

watch(() => state.unit, (newUnit, oldUnit) => {
  if (newUnit === oldUnit) return
  const convert = v => {
    const num = +v
    if (isNaN(num)) return v
    return newUnit === 'cm' ? +(num / 10).toFixed(2) : Math.round(num * 10)
  }
  state.dTop = convert(state.dTop)
  state.dBot = convert(state.dBot)
  state.h = convert(state.h)
  state.seamW = convert(state.seamW)
})

const svgLabels = computed(() => ({
  slant:    t('svg.slant'),
  bot:      t('svg.bot'),
  top:      t('svg.top'),
  arc:      t('svg.arc'),
  angle:    t('svg.angle'),
  circ:     t('svg.circ'),
  cylinder: t('svg.cylinder'),
  height:   t('svg.height'),
  control:  t('svg.control'),
}))

const geo     = computed(() => calcGeometry(state))
const tpl     = computed(() => geo.value.ok ? buildTemplate(geo.value, state.unit, svgLabels.value) : null)
const svgHtml = computed(() => tpl.value ? svgString(tpl.value, false) : null)

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

const pdfLoading = ref(false)

async function handleDownloadPdf() {
  if (!geo.value.ok || pdfLoading.value) return
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
    control:        t('pdf.control'),
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
                      (!g.cyl ? t('pdf.angleNote', { deg: g.metrics.thetaDeg.toFixed(1) }) : ''),
    getSize:        (tw, th, n) => t('pdf.size', { w: fmt(tw, u), h: fmt(th, u), u, n }),
  }
  try {
    await generatePDF(g, { unit: u, dTop: state.dTop, dBot: state.dBot, h: state.h }, labels)
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
