<template>
  <!-- Definite height so the sheet's measurements resolve, and extra room at the
       bottom so a full-size sheet never slides under the hint or the CTA. -->
  <!-- The paper-and-dot-grid desk belongs to the 1:1 drawing. The 3D view gets a
       plain dark field instead: uniform, edge to edge, nothing framing it. -->
  <section
    class="relative overflow-hidden h-[70vh] md:h-auto transition-colors flex flex-col
           px-[26px] pt-[26px] pb-[76px] md:px-8 md:pt-8"
    :class="isShape ? 'bg-frame-3' : 'bg-paper'"
    :style="isShape ? {} : {
      backgroundImage: 'radial-gradient(#E4D6C3 1px, transparent 1px)',
      backgroundSize: '14px 14px',
    }"
  >
    <!-- Mixing a round ring with a faceted one has no exact flat solution, so the
         round side is approximated and the result is unproven. Shown in both
         views, since the CTA can be reached from either. Kept in the flow rather
         than floated, so it never covers the drawing on a short pane; the right
         margin keeps it clear of the swap button. -->
    <div
      v-if="mixed"
      class="shrink-0 mb-3 mr-[46px] md:mr-[150px] flex items-start gap-2
             text-[12px] leading-snug rounded-[6px] px-2.5 py-2 border"
      :class="isShape
        ? 'bg-frame-2/90 border-clay-fired text-clay-sand'
        : 'bg-paper/90 border-warn text-ink-soft'"
      role="status"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2.2" stroke-linecap="round" class="shrink-0 mt-px text-warn"
           aria-hidden="true">
        <path d="M12 9v4" /><path d="M12 17h.01" />
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      </svg>
      <span><strong class="font-semibold">{{ t('warn.experimentalTag') }}:</strong> {{ t('warn.mixed') }}</span>
    </div>

    <div class="flex-1 min-h-0">
      <TemplateSheet
        v-if="!isShape"
        :svgHtml="svgHtml"
        :aspect="aspect"
        :emptyLabel="t('canvas.empty')"
      />
      <ShapeWireframe
        v-else
        bare
        :geo="geo"
        :label="t('shape.label')"
        :hint="t('shape.dragHint')"
        :emptyLabel="t('shape.empty')"
      />
    </div>

    <!-- Swaps this pane with the sidebar slot, so either view can have the room. -->
    <button
      @click="$emit('swapViews')"
      :title="t('actions.swapViews')"
      :aria-label="t('actions.swapViews')"
      class="absolute right-[18px] top-[18px] flex items-center gap-1.5
             rounded-lg px-2.5 py-1.5 text-[11px] font-medium border transition-colors"
      :class="isShape
        ? 'bg-frame-2/80 text-clay-sand hover:text-clay-bisque border-frame-line'
        : 'bg-paper/85 text-ink-soft hover:text-ink border-paper-edge'"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M16 3h5v5" /><path d="M21 3l-7 7" />
        <path d="M8 21H3v-5" /><path d="M3 21l7-7" />
      </svg>
      {{ isShape ? t('actions.showTemplate') : t('actions.show3d') }}
    </button>

    <!-- Only meaningful for the 1:1 drawing, so it follows the template. -->
    <div
      v-if="!isShape"
      class="absolute left-[18px] bottom-[14px] text-[12px] text-ink-soft bg-paper/80 px-2.5 py-[5px] rounded-[6px] border border-paper-edge leading-snug max-w-[44ch] md:max-w-[min(44ch,calc(100%-230px))]"
    >
      <i18n-t keypath="canvas.hint" tag="span">
        <template #ruler><strong class="text-sage-deep">{{ t('canvas.hintRuler', { len: rulerLen }) }}</strong></template>
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
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import TemplateSheet from './TemplateSheet.vue'
import ShapeWireframe from './ShapeWireframe.vue'

const { t } = useI18n()

const props = defineProps({
  svgHtml:    { type: String,  default: null },
  aspect:     { type: Number,  default: 1 },
  geo:        { type: Object,  required: true },
  view:       { type: String,  default: 'template' },
  rulerLen:   { type: String,  default: '10 cm' },
  pdfLoading: { type: Boolean, default: false },
  disabled:   { type: Boolean, default: false },
})

defineEmits(['downloadPdf', 'swapViews'])

const isShape = computed(() => props.view === 'shape')
// Set only on the faceted path, and only when exactly one ring is round — which
// is precisely the mixed case with no exact flat solution.
const mixed = computed(() => !!props.geo?.approximated)
</script>
