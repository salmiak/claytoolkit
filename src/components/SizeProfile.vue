<template>
  <div
    ref="host"
    class="relative w-full h-full bg-frame-3 border border-frame-line rounded-[9px] overflow-hidden"
  >
    <svg v-if="box.w" :viewBox="`0 0 ${box.w} ${box.h}`" :width="box.w" :height="box.h"
         class="block" :aria-label="label">
      <!-- Banana first, so it reads as a backdrop behind the profile. -->
      <path v-if="banana" :d="BANANA_D" :transform="banana.transform"
            fill="#B98D63" fill-opacity="0.22" />
      <text v-if="banana" :x="banana.labelX" :y="banana.labelY"
            fill="#B98D63" fill-opacity="0.85" font-family="ui-monospace,monospace" font-size="9">
        {{ bananaLabel }}
      </text>

      <template v-if="shape">
        <!-- Outline with only a whisper of fill, so the banana stays visible
             through it however wide the form gets. -->
        <polygon :points="shape.points" fill="#7C9473" fill-opacity="0.14"
                 stroke="#E4D6C3" stroke-width="1.2" />
        <line :x1="shape.dimX" :y1="shape.top" :x2="shape.dimX" :y2="shape.base"
              stroke="#7C9473" stroke-width="0.8" />
        <text :x="shape.dimX + 4" :y="(shape.top + shape.base) / 2"
              fill="#7C9473" font-family="ui-monospace,monospace" font-size="9"
              :transform="`rotate(-90 ${shape.dimX + 4} ${(shape.top + shape.base) / 2})`"
              text-anchor="middle">{{ shape.hLabel }}</text>
        <text :x="shape.cx" :y="shape.base + 11" text-anchor="middle"
              fill="#E4D6C3" font-family="ui-monospace,monospace" font-size="9">
          {{ shape.wLabel }}
        </text>
      </template>
    </svg>

    <p v-if="!shape"
       class="absolute inset-0 flex items-center justify-center text-[12px] text-clay-terracotta px-4 text-center">
      {{ emptyLabel }}
    </p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { fmt } from '../composables/useGeometry.js'

// Banana silhouette (SVG Repo, emojione-monotone). Measured from the artwork:
// its two tips lie 66.37 path units apart, which the user gives as ~18 cm, so
// one unit is 2.712 mm. Everything here is drawn from that one conversion.
const BANANA_D = 'M53.943 35.448c6.394-12.03 6.377-22.327 3.456-27.264C56.184 6.131 54.461 5 52.548 5c-.188 0-.379.011-.567.034c-3.137.376-4.355 3.938-6.043 8.867c-1.195 3.491-2.679 7.783-5.124 12.001c-1.357-1.775-3.068-3.262-4.911-4.138l.018-.01c-.058-.023-.111-.039-.169-.063a9.344 9.344 0 0 0-1.537-.564c-.178-.045-.352-.08-.526-.117c-13.103-3.456-17.258 13.266-10.228 11.16c2.048-.614 3.431-3.963 7.608-7.329c3.143 1.908 5.211 5.305 4.493 7.787c-2.387 8.254-9.596 12.007-17.848 12.007c-1.859 0-3.771-.19-5.692-.563a22.38 22.38 0 0 1-2.223-.563a24.21 24.21 0 0 1-4.345-1.776L2 44.684a29.073 29.073 0 0 0 2.878 3.801c3.841 4.305 8.941 7.406 14.845 8.551c9.261 1.795 18.278-1.621 24.4-8.291c3.388-4.271 6.648-6.051 9.438-6.588C53.021 49.418 47.438 59 51.193 59c.143 0 .301-.015.472-.043c6.652-1.111 10.548-9.469 10.326-14.765c-.237-5.677-4.655-7.884-8.048-8.744'
const BB = { x: 2, y: 5, w: 60, h: 54 }
const MM_PER_UNIT = 180 / 66.37
const BANANA_MM = { w: BB.w * MM_PER_UNIT, h: BB.h * MM_PER_UNIT }

const PAD = 14
const LABEL_ROOM = 16   // for the width caption under the baseline

const props = defineProps({
  geo:         { type: Object, required: true },
  unit:        { type: String, default: 'mm' },
  label:       { type: String, default: '' },
  bananaLabel: { type: String, default: '' },
  emptyLabel:  { type: String, default: '' },
})

const host = ref(null)
const box = ref({ w: 0, h: 0 })
let ro = null

function measure() {
  const e = host.value
  if (e) box.value = { w: e.clientWidth, h: e.clientHeight }
}
onMounted(() => { measure(); ro = new ResizeObserver(measure); ro.observe(host.value) })
onUnmounted(() => ro?.disconnect())

// Finished size, not template size: with shrinkage on, the template is larger
// than the pot you end up holding, and it's the pot being compared here.
const real = computed(() => {
  const g = props.geo
  if (!g?.ok) return null
  const k = g.shrink?.k || 1
  const h = (g.h || 0) / k
  const rT = (g.rTop || 0) / k, rB = (g.rBot || 0) / k
  if (h <= 0 || Math.max(rT, rB) <= 0) return null
  return { h, wTop: rT * 2, wBot: rB * 2, wMax: Math.max(rT, rB) * 2 }
})

// One scale for both, which is the whole point: the banana only says anything
// about size if it is drawn at the same mm-per-pixel as the pot.
const scale = computed(() => {
  const r = real.value
  if (!r || !box.value.w) return 0
  const reqW = Math.max(BANANA_MM.w, r.wMax)
  const reqH = Math.max(BANANA_MM.h, r.h)
  return Math.min((box.value.w - PAD * 2) / reqW,
                  (box.value.h - PAD * 2 - LABEL_ROOM) / reqH)
})

const baseline = computed(() => box.value.h - PAD - LABEL_ROOM)

const banana = computed(() => {
  const s = scale.value
  if (!s) return null
  const u = s * MM_PER_UNIT              // path units -> view units
  const top = baseline.value - BB.h * u
  return {
    transform: `translate(${(PAD - BB.x * u).toFixed(2)} ${(top - BB.y * u).toFixed(2)}) scale(${u.toFixed(4)})`,
    labelX: PAD,
    labelY: baseline.value + 11,
  }
})

const shape = computed(() => {
  const r = real.value, s = scale.value
  if (!r || !s) return null
  const cx = box.value.w / 2
  const base = baseline.value
  const top = base - r.h * s
  const ht = r.wTop * s / 2, hb = r.wBot * s / 2
  const u = props.unit
  return {
    points: `${(cx-ht).toFixed(1)},${top.toFixed(1)} ${(cx+ht).toFixed(1)},${top.toFixed(1)} ` +
            `${(cx+hb).toFixed(1)},${base.toFixed(1)} ${(cx-hb).toFixed(1)},${base.toFixed(1)}`,
    cx, top, base,
    dimX: cx + Math.max(ht, hb) + 8,
    hLabel: `${fmt(r.h, u)} ${u}`,
    wLabel: `⌀${fmt(r.wBot, u)} ${u}`,
  }
})
</script>
