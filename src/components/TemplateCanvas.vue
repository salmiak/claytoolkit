<template>
  <section
    class="relative bg-paper overflow-auto min-h-[70vh] md:min-h-0 flex items-center justify-center p-[26px]"
    :style="{ backgroundImage: 'radial-gradient(#E3DFD5 1px, transparent 1px)', backgroundSize: '14px 14px' }"
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

    <div class="absolute left-[18px] bottom-[14px] text-[12px] text-ink-soft bg-white/60 px-2.5 py-[5px] rounded-[6px] border border-paper-edge max-w-[44ch] leading-snug">
      <i18n-t keypath="canvas.hint" tag="span">
        <template #ruler><strong class="text-teal">{{ t('canvas.hintRuler') }}</strong></template>
        <template #pct><strong class="text-teal">{{ t('canvas.hintPct') }}</strong></template>
      </i18n-t>
    </div>
  </section>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps({
  svgHtml: { type: String, default: null },
})
</script>

<style scoped>
:deep(svg) {
  display: block;
  max-width: 100%;
  max-height: 78vh;
  height: auto;
}
</style>
