<template>
  <div
    ref="panelRef"
    class="ski-slider"
    :style="{ left: x + 'px', top: y + 'px' }"
    @pointerdown.stop
  >
    <div class="ski-slider__body">
      <span class="ski-slider__f">f</span>

      <div class="ski-slider__track">
        <div ref="railRef" class="ski-slider__rail">
          <span ref="knobRef" class="ski-slider__knob" />
        </div>
      </div>
    </div>

    <span class="ski-slider__half ski-slider__half--l" @pointerdown.prevent="onPress(-1)" />
    <span class="ski-slider__half ski-slider__half--r" @pointerdown.prevent="onPress(1)" />
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { skiSlip } from '@/skiMode.js'

defineProps({
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
})
const emit = defineEmits(['close'])

// 按到底时轨道倾斜的角度（deg）
const MAX_TILT = 16
// 满倾斜时沿轨道的重力加速度（px/s²）
const GRAVITY = 6000
const TILT_EASE = 20
// 滑块摩擦力（每秒剩下的速度）
const KNOB_FRICTION = 0.35
const STOP_SPEED = 6

const panelRef = ref(null)
const railRef = ref(null)
const knobRef = ref(null)

let travel = 0 // 滑块能走的像素长度（轨道减去滑块自身宽度）
let p = 0 // 当前位置（px，0 = 最左）
let v = 0 // px/s
let tilt = 0 // -1 左沉 / 0 平 / 1 右沉
let hold = 0
let raf = 0
let last = 0

function writeP() {
  knobRef.value?.style.setProperty('--ski-knob-p', p + 'px')
  if (travel) skiSlip.value = Math.min(1, Math.max(0, p / travel))
}

function onPress(dir) {
  hold = dir
  start()
}

function onRelease() {
  hold = 0
}

function start() {
  if (raf) return
  last = performance.now()
  raf = requestAnimationFrame(step)
}

function step(now) {
  const dt = Math.min((now - last) / 1000, 0.05)
  last = now
  tilt += (hold - tilt) * Math.min(1, TILT_EASE * dt)
  panelRef.value?.style.setProperty('--ski-tilt', tilt * MAX_TILT + 'deg')
  // 斜面上的重力分量：tilt 为负（左边沉）→ 加速度为负 → 往左滑
  const a = GRAVITY * Math.sin((tilt * MAX_TILT * Math.PI) / 180)
  v += a * dt
  v *= Math.pow(KNOB_FRICTION, dt)
  p += v * dt
  // 撞到端点就停在那儿
  if (p <= 0) {
    p = 0
    v = 0
  } else if (p >= travel) {
    p = travel
    v = 0
  }
  writeP()
  if (hold === 0 && Math.abs(tilt) < 0.01 && Math.abs(v) < STOP_SPEED) {
    raf = 0
    return
  }
  raf = requestAnimationFrame(step)
}

function measure() {
  travel = railRef.value?.clientWidth || 0
  p = travel * skiSlip.value
  writeP()
}

function onOutsideDown(e) {
  if (panelRef.value?.contains(e.target)) return
  emit('close')
}

function onKey(e) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => {
  measure()
  window.addEventListener('pointerup', onRelease)
  window.addEventListener('pointerdown', onOutsideDown)
  window.addEventListener('keydown', onKey)
})

onBeforeUnmount(() => {
  if (raf) cancelAnimationFrame(raf)
  raf = 0
  window.removeEventListener('pointerup', onRelease)
  window.removeEventListener('pointerdown', onOutsideDown)
  window.removeEventListener('keydown', onKey)
})
</script>

<style scoped>
.ski-slider {
  /* 滑条的长度 */
  --ski-slider-w: 180px;
  position: fixed;
  /* 整个框是一块跷跷板 */
  rotate: var(--ski-tilt, 0deg);
  /* (x, y) 是图标的中心 / 上沿 —— 浮层挂在图标正上方。
     定位必须用独立的 translate，不能并进 transform
     合成顺序是 translate → rotate → scale → transform（右边先作用于点），
     写进 transform 的位移会先于 rotate 生效，于是旋转发生在位移之前的位置上，支点被推到框外右下角 */
  translate: -50% calc(-100% - 10px);
  padding: 10px 12px;
  background: var(--color-bg);
  /* 装饰性边框走 inset shadow，不写 border：盒高不受线宽影响 */
  box-shadow: inset 0 0 0 2px var(--color-border);
  user-select: none;
  z-index: var(--z-menu);
}

.ski-slider__body {
  position: relative;
  display: flex;
  align-items: center;
  width: var(--ski-slider-w);
  height: 22px;
}

.ski-slider__f {
  flex: 0 0 auto;
  padding-right: 6px;
  font-style: italic;
  line-height: 1;
  color: var(--color-text-dim);
}

.ski-slider__track {
  position: relative;
  width: 100%;
  height: 6px;
  background: var(--color-text-dim);
}

/* 轨道两端各让出半个滑块宽，滑块才不会探出轨道外 */
.ski-slider__rail {
  position: absolute;
  inset: 0 7px;
}

.ski-slider__knob {
  position: absolute;
  top: 50%;
  left: var(--ski-knob-p, 0px);
  width: 14px;
  height: 14px;
  margin: -7px 0 0 -7px;
  background: var(--color-border);
}

.ski-slider__half {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 50%;
  cursor: pointer;
}

.ski-slider__half--l {
  left: 0;
}

.ski-slider__half--r {
  right: 0;
}
</style>
