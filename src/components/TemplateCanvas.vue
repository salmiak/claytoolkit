<template>
  <!-- Definite height so the sheet's measurements resolve, and extra room at the
       bottom so a full-size sheet never slides under the hint or the CTA. -->
  <section
    class="relative bg-paper overflow-hidden h-[70vh] md:h-auto
           px-[26px] pt-[26px] pb-[76px] md:px-8 md:pt-8"
    :style="{ backgroundImage: 'radial-gradient(#E4D6C3 1px, transparent 1px)', backgroundSize: '14px 14px' }"
  >
    <TemplateSheet
      v-if="view === 'template'"
      :svgHtml="svgHtml"
      :aspect="aspect"
      :emptyLabel="t('canvas.empty')"
    />
    <ShapeWireframe
      v-else
      :geo="geo"
      :label="t('shape.label')"
      :hint="t('shape.dragHint')"
      :emptyLabel="t('shape.empty')"
    />

    <!-- Swaps this pane with the sidebar slot, so either view can have the room. -->
    <button
      @click="$emit('swapViews')"
      :title="t('actions.swapViews')"
      :aria-label="t('actions.swapViews')"
      class="absolute right-[18px] top-[18px] flex items-center gap-1.5
             bg-paper/85 text-ink-soft hover:text-ink border border-paper-edge
             rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M16 3h5v5" /><path d="M21 3l-7 7" />
        <path d="M8 21H3v-5" /><path d="M3 21l7-7" />
      </svg>
      {{ view === 'template' ? t('actions.show3d') : t('actions.showTemplate') }}
    </button>

    <!-- Only meaningful for the 1:1 drawing, so it follows the template. -->
    <div
      v-if="view === 'template'"
      class="absolute left-[18px] bottom-[14px] text-[12px] text-ink-soft bg-paper/80 px-2.5 py-[5px] rounded-[6px] border border-paper-edge leading-snug max-w-[44ch] md:max-w-[min(44ch,calc(100%-230px))]"
    >
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
import TemplateSheet from './TemplateSheet.vue'
import ShapeWireframe from './ShapeWireframe.vue'

const { t } = useI18n()

defineProps({
  svgHtml:    { type: String,  default: null },
  aspect:     { type: Number,  default: 1 },
  geo:        { type: Object,  required: true },
  view:       { type: String,  default: 'template' },
  pdfLoading: { type: Boolean, default: false },
  disabled:   { type: Boolean, default: false },
})

defineEmits(['downloadPdf', 'swapViews'])
</script>
