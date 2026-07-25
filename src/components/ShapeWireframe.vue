<template>
  <div
    ref="host"
    class="relative w-full h-full overflow-hidden touch-none select-none"
    :class="[
      segments.length ? 'cursor-grab active:cursor-grabbing' : '',
      // Framed in the sidebar slot, where it needs an edge against the panel;
      // bare when it fills the preview pane, which supplies its own background.
      bare ? '' : 'bg-frame-3 border border-frame-line rounded-[9px]',
    ]"
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onUp"
    @dblclick="reset"
  >
    <svg
      v-if="box.w"
      :viewBox="`0 0 ${box.w} ${box.h}`"
      :width="box.w"
      :height="box.h"
      class="block"
      :aria-label="label"
    >
      <line
        v-for="(s, i) in segments"
        :key="i"
        :x1="s.a.x" :y1="s.a.y" :x2="s.b.x" :y2="s.b.y"
        :stroke="s.kind === 'ring' ? '#E4D6C3' : s.kind === 'seam' ? '#7C9473' : '#6B4A36'"
        :stroke-width="s.kind === 'hint' ? 0.7 : 1.2"
        :stroke-opacity="0.25 + 0.75 * s.depth"
        stroke-linecap="round"
      />
    </svg>

    <p v-if="!segments.length"
       class="absolute inset-0 flex items-center justify-center text-[12px] text-clay-terracotta px-4 text-center">
      {{ emptyLabel }}
    </p>
    <p v-else-if="!touched"
       class="absolute left-2.5 bottom-2 text-[10px] text-clay-fired pointer-events-none">
      {{ hint }}
    </p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { buildWireframe, projectWireframe } from '../composables/useWireframe.js'

const props = defineProps({
  geo:        { type: Object, required: true },
  label:      { type: String, default: '' },
  hint:       { type: String, default: '' },
  emptyLabel: { type: String, default: '' },
  bare:       { type: Boolean, default: false },
})

const DEFAULT_AZ = -0.55, DEFAULT_EL = 0.32
const az = ref(DEFAULT_AZ)
const el = ref(DEFAULT_EL)
const touched = ref(false)

const host = ref(null)
// The view box tracks the container, so the projection fits whatever space this
// is given — the small sidebar slot or the full preview pane.
const box = ref({ w: 0, h: 0 })
let drag = null
let ro = null

function measure() {
  const e = host.value
  if (e) box.value = { w: e.clientWidth, h: e.clientHeight }
}

onMounted(() => {
  measure()
  ro = new ResizeObserver(measure)
  ro.observe(host.value)
})
onUnmounted(() => { ro?.disconnect(); drag = null })

const model = computed(() => buildWireframe(props.geo))
const segments = computed(() => box.value.w
  ? projectWireframe(model.value, { az: az.value, el: el.value, w: box.value.w, h: box.value.h, pad: 18 })
  : [])

function onDown(e) {
  if (!segments.value.length) return
  drag = { x: e.clientX, y: e.clientY }
  touched.value = true
  host.value.setPointerCapture(e.pointerId)
}

function onMove(e) {
  if (!drag) return
  const k = 0.011
  az.value += (e.clientX - drag.x) * k
  // Clamped short of straight down, where the wireframe collapses to a disc.
  el.value = Math.max(-1.45, Math.min(1.45, el.value - (e.clientY - drag.y) * k))
  drag = { x: e.clientX, y: e.clientY }
}

function onUp(e) {
  drag = null
  host.value?.releasePointerCapture?.(e.pointerId)
}

function reset() {
  az.value = DEFAULT_AZ
  el.value = DEFAULT_EL
}
</script>
