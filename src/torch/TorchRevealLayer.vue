<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { torchOn, torchPointer, runTorchFrame } from './torchState.js'

// 显现半径，与暗房探照的亮区对齐
const REVEAL_RADIUS = 130
// 开关灯的淡入淡出时长
const FADE_MS = 260

const fieldEl = ref(null)
let raf = 0
let lastX = NaN
let lastY = NaN

function paint() {
  raf = 0
  if (!torchOn.value) return
  // 先量锚点再写光斑变量，避免写了样式又读 rect 触发同步布局
  runTorchFrame()
  const { x, y } = torchPointer
  if (x !== lastX || y !== lastY) {
    lastX = x
    lastY = y
    if (fieldEl.value) {
      fieldEl.value.style.setProperty('--tx', x + 'px')
      fieldEl.value.style.setProperty('--ty', y + 'px')
    }
  }
  raf = requestAnimationFrame(paint)
}

watch(torchOn, (on) => {
  if (on) {
    lastX = NaN
    lastY = NaN
    if (!raf) raf = requestAnimationFrame(paint)
  } else if (raf) {
    cancelAnimationFrame(raf)
    raf = 0
  }
}, { immediate: true })

onBeforeUnmount(() => { if (raf) cancelAnimationFrame(raf) })
</script>

<template>
  <Teleport to="body">
    <div
      ref="fieldEl"
      class="torch-reveal"
      :class="{ 'is-on': torchOn }"
      :style="{ '--reveal-radius': REVEAL_RADIUS + 'px', '--reveal-fade': FADE_MS + 'ms' }"
      aria-hidden="true"
    >
      <slot />
    </div>
  </Teleport>
</template>

<style scoped>
.torch-reveal {
  position: fixed;
  inset: 0;
  z-index: var(--z-torch);
  pointer-events: none;
  opacity: 0;
  mix-blend-mode: multiply;
  transition: opacity var(--reveal-fade) ease;
  --tx: 50%;
  --ty: 50%;
  -webkit-mask-image: radial-gradient(circle var(--reveal-radius) at var(--tx) var(--ty), #000 0%, #000 30%, transparent 100%);
  mask-image: radial-gradient(circle var(--reveal-radius) at var(--tx) var(--ty), #000 0%, #000 30%, transparent 100%);
}

.torch-reveal.is-on {
  opacity: 1;
}
</style>
