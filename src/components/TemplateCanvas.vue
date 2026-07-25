<template>
  <!-- Definite height so the sheet's percentage limits below resolve, and extra
       room at the bottom so the growing sheet never slides under the hint or
       the floating CTA. -->
  <section
    ref="pane"
    class="relative bg-paper overflow-hidden h-[70vh] md:h-auto flex items-center justify-center
           px-[26px] pt-[26px] pb-[76px] md:px-8 md:pt-8"
    :style="{ backgroundImage: 'radial-gradient(#E4D6C3 1px, transparent 1px)', backgroundSize: '14px 14px' }"
  >
    <!-- Sized in JS: CSS can't express "largest box of this ratio that fits" for
         a plain element. aspect-ratio with width:100% leaves the width definite,
         so max-height clamps the height and stretches the sheet instead of
         scaling it down. -->
    <div
      v-if="svgHtml"
      class="template-sheet bg-paper border border-paper-edge"
      :style="{
        width: fitted.w + 'px',
        height: fitted.h + 'px',
        boxShadow: '0 1px 0 rgba(0,0,0,.04), 0 18px 40px -22px rgba(0,0,0,.4)',
      }"
      v-html="svgHtml"
    />
    <div v-else class="text-ink-soft text-[15px] text-center max-w-[34ch] leading-relaxed">
      {{ t('canvas.empty') }}
    </div>

    <!-- Width is capped so the hint can never run under the floating CTA. -->
    <div class="absolute left-[18px] bottom-[14px] text-[12px] text-ink-soft bg-paper/80 px-2.5 py-[5px] rounded-[6px] border border-paper-edge leading-snug max-w-[44ch] md:max-w-[min(44ch,calc(100%-230px))]">
      <i18n-t keypath="canvas.hint" tag="span">
        <template #ruler><strong class="text-sage-deep">{{ t('canvas.hintRuler') }}</strong></template>
        <template #pct><strong class="text-sage-deep">{{ t('canvas.hintPct') }}</strong></template>
      </i18n-t>
    </div>

    <!-- Primary CTA, kept in view over the preview. Desktop only: on mobile the
         export buttons already sit in the panel's scroll flow. -->
    <button
      @click="$emit('downloadPdf')"
      :disabled="disabled || pdfLoading"
      class="hidden md:flex absolute right-[18px] bottom-[14px] items-center gap-2
             bg-sage text-ink font-[550] text-[14px] px-4 py-2.5 rounded-lg
             shadow-[0_6px_20px_-6px_rgba(36,31,28,0.5)]
             hover:bg-sage-light transition-colors
             disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 3v12" /><path d="m7 12 5 5 5-5" /><path d="M4 21h16" />
      </svg>
      {{ pdfLoading ? t('actions.pdfCreating') : t('actions.pdfShort') }}
    </button>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const pane = ref(null)
const avail = ref({ w: 0, h: 0 })

function measure() {
  const el = pane.value
  if (!el) return
  const cs = getComputedStyle(el)
  avail.value = {
    w: el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
    h: el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom),
  }
}

let ro = null
onMounted(() => {
  measure()
  ro = new ResizeObserver(measure)
  ro.observe(pane.value)
})
onUnmounted(() => ro?.disconnect())

const props = defineProps({
  svgHtml:    { type: String,  default: null },
  pdfLoading: { type: Boolean, default: false },
  disabled:   { type: Boolean, default: false },
  // Template width / height. Gives the sheet the drawing's own shape, so it can
  // be scaled up without letterboxing inside it.
  aspect:     { type: Number,  default: 1 },
})

defineEmits(['downloadPdf'])

// The largest box of the drawing's ratio that fits the padded pane: fill the
// width, and if that overflows vertically, fall back to filling the height.
const fitted = computed(() => {
  const { w: aw, h: ah } = avail.value
  const r = props.aspect > 0 ? props.aspect : 1
  if (aw <= 0 || ah <= 0) return { w: 0, h: 0 }
  let w = aw, h = aw / r
  if (h > ah) { h = ah; w = ah * r }
  return { w: Math.floor(w), h: Math.floor(h) }
})
</script>

<style scoped>
/* Scoped to the sheet: an unqualified :deep(svg) would also stretch the icon
   inside the download button. Fills the sheet exactly, since the sheet already
   matches the viewBox ratio. */
.template-sheet :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
