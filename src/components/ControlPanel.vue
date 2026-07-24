<template>
  <section class="bg-frame-2 text-[#E7E3DA] px-5 pt-5 pb-7 md:overflow-y-auto border-b border-black md:border-b-0 md:border-r">

    <!-- Unit toggle -->
    <div class="mb-[22px]">
      <div class="group-lbl">{{ t('unit.label') }}</div>
      <div class="flex border border-[#4a4842] rounded-[7px] overflow-hidden w-max">
        <button
          v-for="u in ['mm','cm']"
          :key="u"
          @click="unit = u"
          :class="['font-mono text-[13px] px-4 py-1.5 transition-colors', unit === u ? 'bg-teal text-white' : 'bg-transparent text-line hover:text-white']"
        >{{ u }}</button>
      </div>
    </div>

    <!-- Dimension fields -->
    <div class="mb-[22px]">
      <div class="group-lbl">{{ t('dims.label') }}</div>
      <div v-for="field in dimFields" :key="field.key" class="mb-[14px]">
        <label :for="field.key" class="block text-[13px] mb-[5px] text-[#d8d4ca]">
          {{ field.label }} <small class="text-[#8f8a7e]">{{ field.hint }}</small>
        </label>
        <div class="relative flex items-center">
          <input
            :id="field.key"
            type="number" min="0" step="1"
            :value="field.model.value"
            @input="field.model.value = $event.target.valueAsNumber"
            class="field-input"
          />
          <span class="field-unit">{{ unit }}</span>
        </div>
      </div>
    </div>

    <!-- Shrink compensation -->
    <div class="mb-[22px]">
      <div class="group-lbl">{{ t('shrink.label') }}</div>
      <div class="flex items-center gap-2.5 mt-0.5">
        <input id="shrinkOn" type="checkbox" v-model="shrinkOn" class="w-[17px] h-[17px] accent-teal shrink-0" />
        <label for="shrinkOn" class="text-[13px] text-[#d8d4ca] flex-1">{{ t('shrink.toggle') }}</label>
        <div class="relative w-24">
          <input
            type="number" min="0" max="30" step="0.5"
            :value="shrinkP"
            @input="shrinkP = $event.target.valueAsNumber"
            :disabled="!shrinkOn"
            class="field-input"
          />
          <span class="field-unit">%</span>
        </div>
      </div>
      <p v-if="shrinkOn && shrinkFactor" class="text-[12px] text-[#9c968a] mt-2.5 leading-[1.45]">
        {{ t('shrink.note', { factor: shrinkFactor }) }}
      </p>
    </div>

    <!-- Seam allowance -->
    <div class="mb-[22px]">
      <div class="group-lbl">{{ t('seam.label') }}</div>
      <div class="flex items-center gap-2.5 mt-0.5">
        <input id="seamOn" type="checkbox" v-model="seamOn" class="w-[17px] h-[17px] accent-teal shrink-0" />
        <label for="seamOn" class="text-[13px] text-[#d8d4ca] flex-1">{{ t('seam.toggle') }}</label>
        <div class="relative w-24">
          <input
            type="number" min="0" step="1"
            :value="seamW"
            @input="seamW = $event.target.valueAsNumber"
            :disabled="!seamOn"
            class="field-input"
          />
          <span class="field-unit">{{ unit }}</span>
        </div>
      </div>
    </div>

    <!-- Schematic -->
    <div class="mb-[22px]">
      <div class="group-lbl">{{ t('shape.label') }}</div>
      <div class="bg-[#1b1a17] border border-[#3a382f] rounded-[9px] px-2.5 pt-3 pb-1.5 mt-1">
        <svg viewBox="0 0 300 180" class="w-full h-auto block" :aria-label="t('shape.label')" v-html="schematicSvg" />
      </div>
    </div>

    <!-- Readouts -->
    <div class="mb-[22px]">
      <div class="group-lbl">{{ t('computed.label') }}</div>
      <div v-if="!geo.ok" class="grid grid-cols-2 gap-px bg-[#3a382f] border border-[#3a382f] rounded-[9px] overflow-hidden">
        <div class="col-span-2 bg-frame-2 px-[11px] py-[9px]">
          <div class="readout-k">{{ t('computed.label') }}</div>
          <div class="readout-v text-[#c9aa66]">{{ t('computed.statusError') }}</div>
        </div>
      </div>
      <div v-else class="grid grid-cols-2 gap-px bg-[#3a382f] border border-[#3a382f] rounded-[9px] overflow-hidden">
        <div v-for="([k, v]) in readoutRows" :key="k" class="bg-frame-2 px-[11px] py-[9px]">
          <div class="readout-k">{{ k }}</div>
          <div class="readout-v">{{ v }}</div>
        </div>
      </div>
    </div>

    <!-- Action buttons -->
    <div class="flex flex-col gap-[9px] mt-1.5">
      <button
        @click="$emit('downloadPdf')"
        :disabled="!geo.ok || pdfLoading"
        class="btn btn-primary"
      >{{ pdfLoading ? t('actions.pdfCreating') : t('actions.pdf') }}</button>
      <button @click="$emit('downloadSvg')" :disabled="!geo.ok" class="btn btn-ghost">
        {{ t('actions.svg') }}
      </button>
      <button @click="$emit('print')" :disabled="!geo.ok" class="btn btn-ghost">
        {{ t('actions.print') }}
      </button>
    </div>

  </section>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { fmt } from '../composables/useGeometry.js'

const { t } = useI18n()

const unit     = defineModel('unit')
const dTop     = defineModel('dTop')
const dBot     = defineModel('dBot')
const h        = defineModel('h')
const shrinkOn = defineModel('shrinkOn')
const shrinkP  = defineModel('shrinkP')
const seamOn   = defineModel('seamOn')
const seamW    = defineModel('seamW')

const props = defineProps({
  geo:        { type: Object,  required: true },
  pdfLoading: { type: Boolean, default: false },
})

defineEmits(['downloadSvg', 'downloadPdf', 'print'])

const dimFields = computed(() => [
  { key: 'dTop', label: t('dims.dTop'), hint: t('dims.dTopHint'), model: dTop },
  { key: 'dBot', label: t('dims.dBot'), hint: t('dims.dBotHint'), model: dBot },
  { key: 'h',    label: t('dims.height'), hint: t('dims.heightHint'), model: h },
])

const shrinkFactor = computed(() => {
  if (!shrinkOn.value) return null
  const sp = Math.min(99, Math.max(0, +shrinkP.value || 0))
  return (100 / (100 - sp)).toFixed(3)
})

const schematicSvg = computed(() => {
  const top = Math.max(0, +dTop.value || 0)
  const bot = Math.max(0, +dBot.value || 0)
  const hh  = Math.max(0, +h.value || 0)
  if (!(Math.max(top, bot) > 0 && hh > 0)) return ''
  const W = 300, H = 180, cx = 150, mT = 26, mB = 44
  const maxW = Math.max(top, bot, 1), sc = 150 / maxW
  const tw = top * sc / 2, bw = bot * sc / 2, yT = mT, yB = H - mB
  const pts = `${cx-tw},${yT} ${cx+tw},${yT} ${cx+bw},${yB} ${cx-bw},${yB}`
  const ac = '#2F6F73', mf = `ui-monospace,monospace`
  const hmx = cx + Math.max(tw, bw) + 16
  const hmy = (yT + yB) / 2
  return (
    `<polygon points="${pts}" fill="#2F6F73" fill-opacity="0.12" stroke="#c9c4b6" stroke-width="1.2"/>` +
    `<line x1="${cx-tw}" y1="${yT-9}" x2="${cx+tw}" y2="${yT-9}" stroke="${ac}" stroke-width="1"/>` +
    `<text x="${cx}" y="${yT-13}" fill="${ac}" font-family="${mf}" font-size="11" text-anchor="middle">${t('schematic.top', { v: top })}</text>` +
    `<line x1="${cx-bw}" y1="${yB+11}" x2="${cx+bw}" y2="${yB+11}" stroke="${ac}" stroke-width="1"/>` +
    `<text x="${cx}" y="${yB+25}" fill="${ac}" font-family="${mf}" font-size="11" text-anchor="middle">${t('schematic.bot', { v: bot })}</text>` +
    `<line x1="${hmx}" y1="${yT}" x2="${hmx}" y2="${yB}" stroke="${ac}" stroke-width="1"/>` +
    `<text x="${hmx+4}" y="${hmy}" fill="${ac}" font-family="${mf}" font-size="11" transform="rotate(-90 ${hmx+4} ${hmy})" text-anchor="middle">${t('schematic.height', { v: hh })}</text>`
  )
})

const readoutRows = computed(() => {
  const g = props.geo
  const u = unit.value
  if (!g.ok) return []
  const m = g.metrics
  const rows = []
  if (g.shrink && g.shrink.p > 0)
    rows.push([t('computed.shrinkReadout'), `${g.shrink.p} % · ×${g.shrink.k.toFixed(3)}`])
  if (g.cyl) {
    rows.push(
      [t('computed.form'),   t('computed.rect')],
      [t('computed.slant'),  `${fmt(m.L, u)} ${u}`],
      [t('computed.width'),  `${fmt(m.arcBot, u)} ${u}`],
      [t('computed.height'), `${fmt(m.sizeH, u)} ${u}`],
    )
  } else {
    rows.push(
      [t('computed.slant'),  `${fmt(m.L, u)} ${u}`],
      [t('computed.angle'),  `${m.thetaDeg.toFixed(1)}°`],
      [t('computed.innerR'), `${fmt(m.Ri, u)} ${u}`],
      [t('computed.outerR'), `${fmt(m.Ro, u)} ${u}`],
      [t('computed.arcTop'), `${fmt(m.arcTop, u)} ${u}`],
      [t('computed.arcBot'), `${fmt(m.arcBot, u)} ${u}`],
    )
  }
  return rows
})
</script>

<style scoped>
.group-lbl {
  @apply text-[11px] uppercase tracking-[0.12em] text-[#9c968a] mb-2.5 font-semibold;
}
.field-input {
  @apply w-full bg-field border border-[#d8d3c6] rounded-[7px] py-[9px] pr-[42px] pl-[11px] font-mono text-[15px] text-ink;
  @apply focus:outline-none focus:ring-2 focus:ring-teal focus:border-teal;
  @apply disabled:opacity-40;
}
.field-unit {
  @apply absolute right-[11px] text-ink-soft font-mono text-[12px] pointer-events-none;
}
.readout-k {
  @apply text-[10.5px] uppercase tracking-[0.06em] text-[#8f8a7e];
}
.readout-v {
  @apply font-mono text-[15px] text-[#EDEAE1] mt-0.5;
}
.btn {
  @apply flex items-center justify-center gap-2 px-3 py-[11px] rounded-lg text-[14px] font-[550] cursor-pointer border transition-colors;
  @apply disabled:opacity-40 disabled:cursor-not-allowed;
}
.btn-primary {
  @apply bg-teal text-white border-transparent hover:bg-teal-dark;
}
.btn-ghost {
  @apply bg-transparent text-[#d8d4ca] border-[#4a4842] hover:border-[#6a685f] hover:text-white;
}
</style>
