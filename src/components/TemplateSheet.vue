<template>
  <div ref="host" class="w-full h-full flex items-center justify-center">
    <!-- Sized in JS: CSS can't express "largest box of this ratio that fits" for
         a plain element. aspect-ratio with width:100% leaves the width definite,
         so max-height clamps the height and stretches the sheet instead of
         scaling it down. -->
    <div
      v-if="svgHtml && fitted.w"
      class="template-sheet bg-paper border border-paper-edge"
      :style="{
        width: fitted.w + 'px',
        height: fitted.h + 'px',
        boxShadow: '0 1px 0 rgba(0,0,0,.04), 0 18px 40px -22px rgba(0,0,0,.4)',
      }"
      v-html="svgHtml"
    />
    <p v-else-if="!svgHtml" class="text-ink-soft text-[15px] text-center max-w-[34ch] leading-relaxed px-4">
      {{ emptyLabel }}
    </p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  svgHtml:    { type: String, default: null },
  // Template width / height, so the sheet takes the drawing's own shape.
  aspect:     { type: Number, default: 1 },
  emptyLabel: { type: String, default: '' },
})

const host = ref(null)
const avail = ref({ w: 0, h: 0 })

function measure() {
  const el = host.value
  if (el) avail.value = { w: el.clientWidth, h: el.clientHeight }
}

let ro = null
onMounted(() => {
  measure()
  ro = new ResizeObserver(measure)
  ro.observe(host.value)
})
onUnmounted(() => ro?.disconnect())

// Largest box of the drawing's ratio that fits: fill the width, and if that
// overflows vertically, fall back to filling the height.
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
/* Scoped to the sheet so it can't affect icons elsewhere in the host. */
.template-sheet :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
