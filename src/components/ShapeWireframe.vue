<template>
  <div
    ref="host"
    class="relative bg-frame-3 border border-frame-line rounded-[9px] overflow-hidden
           touch-none select-none"
    :class="segments.length ? 'cursor-grab active:cursor-grabbing' : ''"
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onUp"
    @dblclick="reset"
  >
    <svg :viewBox="`0 0 ${W} ${H}`" class="w-full h-auto block" :aria-label="label">
      <line
        v-for="(s, i) in segments"
        :key="i"
        :x1="s.a.x" :y1="s.a.y" :x2="s.b.x" :y2="s.b.y"
        :stroke="s.kind === 'ring' ? '#E4D6C3' : s.kind === 'seam' ? '#7C9473' : '#6B4A36'"
        :stroke-width="s.kind === 'hint' ? 0.7 : 1.1"
        :stroke-opacity="0.25 + 0.75 * s.depth"
        stroke-linecap="round"
      />
    </svg>

    <p v-if="!segments.length"
       class="absolute inset-0 flex items-center justify-center text-[12px] text-clay-terracotta px-4 text-center">
      {{ emptyLabel }}
    </p>
    <p v-else-if="!touched"
       class="absolute left-2 bottom-1.5 text-[10px] text-clay-fired pointer-events-none">
      {{ hint }}
    </p>
  </div>
</template>

<script setup>
import { ref, computed, onUnmounted } from 'vue'
import { buildWireframe, projectWireframe } from '../composables/useWireframe.js'

const W = 300, H = 190

const props = defineProps({
  geo:        { type: Object, required: true },
  label:      { type: String, default: '' },
  hint:       { type: String, default: '' },
  emptyLabel: { type: String, default: '' },
})

const DEFAULT_AZ = -0.55, DEFAULT_EL = 0.32
const az = ref(DEFAULT_AZ)
const el = ref(DEFAULT_EL)
const touched = ref(false)

const host = ref(null)
let drag = null

const model = computed(() => buildWireframe(props.geo))
const segments = computed(() =>
  projectWireframe(model.value, { az: az.value, el: el.value, w: W, h: H }))

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

onUnmounted(() => { drag = null })
</script>
