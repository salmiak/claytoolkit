<template>
  <section
    class="relative bg-paper overflow-auto min-h-[70vh] md:min-h-0 flex items-center justify-center p-[26px]"
    :style="{ backgroundImage: 'radial-gradient(#E4D6C3 1px, transparent 1px)', backgroundSize: '14px 14px' }"
  >
    <div
      v-if="svgHtml"
      class="bg-paper border border-paper-edge max-w-full max-h-full"
      style="box-shadow: 0 1px 0 rgba(0,0,0,.04), 0 18px 40px -22px rgba(0,0,0,.4)"
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
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps({
  svgHtml:    { type: String,  default: null },
  pdfLoading: { type: Boolean, default: false },
  disabled:   { type: Boolean, default: false },
})

defineEmits(['downloadPdf'])
</script>

<style scoped>
:deep(svg) {
  display: block;
  max-width: 100%;
  max-height: 78vh;
  height: auto;
}
</style>
