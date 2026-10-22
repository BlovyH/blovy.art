<template>
  <!-- 拎起来的这一段要 Teleport 出去：按钮在窗口里，层级被窗口锁死，会被 mesbin 盖住 -->
  <Teleport to="body" :disabled="!carried">
    <div
      ref="rootEl"
      class="indirecty-callback"
      :class="{ 'is-dragging': dragging, 'is-carried': carried, 'is-leaving': leaving }"
      :style="{
        '--cb-x': offset.x + 'px',
        '--cb-y': offset.y + 'px',
        '--cb-cx': carryCenter.x + 'px',
        '--cb-cy': carryCenter.y + 'px',
        '--cb-swallow-ms': SWALLOW_MS + 'ms',
      }"
    >
      <div ref="boxEl" class="cb-box">
        <button
          type="button"
          class="pixel-btn pixel-btn--sm cb-face"
          :class="{ 'is-pressed': pressed }"
          @pointerdown="onDown"
        >
          callback<span class="cb-key">[C]</span>
        </button>
        <!-- 侧面和背面，侧面加点厚度 -->
        <span class="cb-side cb-side--left" aria-hidden="true" />
        <span class="cb-side cb-side--right" aria-hidden="true" />
        <span class="cb-back" aria-hidden="true" />
      </div>
    </div>
  </Teleport>

  <Teleport to="body">
    <div
      ref="binEl"
      class="callback-bin"
      :class="{
        'is-visible': dragging || swallowed,
        'is-hot': hot,
        'is-swallowed': swallowed,
      }"
      :style="{ '--cb-swallow-ms': SWALLOW_MS + 'ms' }"
    >
      <img
        class="callback-bin__img"
        src="/assets/mesbin.png"
        alt=""
        draggable="false"
      />
      <img
        class="callback-bin__img callback-bin__img--open"
        src="/assets/mesbin_open.png"
        alt=""
        draggable="false"
      />
      <span class="callback-bin__label">DISMISS</span>
    </div>
  </Teleport>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { createSpinControl } from '@/spinControl.js'

defineProps({
  leaving: { type: Boolean, default: false },
})
const emit = defineEmits(['hit', 'dismissed', 'gone'])

const rootEl = ref(null)
// 转动的只有这一层：位移（拖 / 上升）留在外面，透视也挂在外面上
const boxEl = ref(null)
const binEl = ref(null)
const offset = ref({ x: 0, y: 0 })
// 拎起来 Teleport 到 body 之后 left/top 要另外根据这个算
const carryCenter = ref({ x: 0, y: 0 })
const dragging = ref(false)
const carried = ref(false)
const hot = ref(false)
const swallowed = ref(false)
// 这个变量是给按 C 的时候加点击样式用的
const pressed = ref(false)

const CB_DEG_PER_FRAME = 45
// 三种行为靠位移倾向区分
const DRAG_THRESHOLD = 4
const DROP_PAD = 12
const SWALLOW_MS = 460
const CB_PRESS_MS = 110 // 一次点击的按下反馈时长
const CB_NUDGE_MS = 220 // 没达到 qte 门槛的弹动时长
const CARRY_RELEASE_MS = 240 // 松手后多久撤离 Teleport，给 translate 过渡
// 多久没转后可以开始惯性处理，时间短点否则会感觉到停顿
const CB_SETTLE_DELAY_MS = 64
const CB_SETTLE_BASE_MS = 160 // 惯性动画的固定部分
const CB_SETTLE_DEG_MS = 0.55 // 每多转 1° 加多少毫秒（顺着方向补，最多补满一圈）

const {
  locked,
  gone,
  down: onSpinDown,
  move: onSpinMove,
  up: onSpinUp,
  start: startSpin,
  dispose: disposeSpin,
} = createSpinControl({
  frames: 8,
  el: rootEl,
  varName: '--cb-frame',
  // 把累计帧数折算成角度
  onFrame: (_frame, total) => {
    if (lastTotal !== null && total !== lastTotal) spinDir = Math.sign(total - lastTotal)
    writeTurn(total)
    if (total === lastTotal) return
    lastTotal = total
    armSettle()
  },
})

// 显示角度 = (total - turnBase) * 每帧度数
let turnBase = 0
let shownDeg = 0
let lastTotal = null
// 最近一次转动的方向（+1 / -1），用于惯性方向
let spinDir = 1
let alignedDeg = null
let settleTimer = 0
let settleRaf = 0

function applyDeg(deg) {
  shownDeg = deg
  boxEl.value?.style.setProperty('--cb-turn', deg + 'deg')
}

function writeTurn(total) {
  if (alignedDeg !== null) {
    turnBase = total - alignedDeg / CB_DEG_PER_FRAME
    applyDeg(alignedDeg)
    return
  }
  applyDeg((total - turnBase) * CB_DEG_PER_FRAME)
}

function armSettle() {
  clearTimeout(settleTimer)
  settleTimer = setTimeout(settleTurn, CB_SETTLE_DELAY_MS)
}

function settleTurn() {
  settleTimer = 0
  if (start || locked.value || swallowed.value || lastTotal === null) return
  const from = shownDeg
  const to = (spinDir < 0 ? Math.floor(from / 360) : Math.ceil(from / 360)) * 360
  const delta = to - from
  if (Math.abs(delta) < 2) return
  const dur = CB_SETTLE_BASE_MS + Math.abs(delta) * CB_SETTLE_DEG_MS
  const t0 = performance.now()
  cancelAnimationFrame(settleRaf)
  const step = (now) => {
    const p = Math.min(1, (now - t0) / dur)
    applyDeg(from + delta * (1 - (1 - p) ** 3))
    if (p < 1) {
      settleRaf = requestAnimationFrame(step)
      return
    }
    settleRaf = 0
    alignedDeg = to
    turnBase = lastTotal - to / CB_DEG_PER_FRAME
  }
  settleRaf = requestAnimationFrame(step)
}

// 中途被重新抓起
function cancelSettle() {
  clearTimeout(settleTimer)
  settleTimer = 0
  cancelAnimationFrame(settleRaf)
  settleRaf = 0
  alignedDeg = null
  if (lastTotal !== null) turnBase = lastTotal - shownDeg / CB_DEG_PER_FRAME
}

let start = null
// null 未知 / spin 被旋转 / carry 被拎起
let mode = null
let swallowTimer = 0
let carryTimer = 0
let pressTimer = 0
let nudgeAnim = null

watch(dragging, (v) => {
  clearTimeout(carryTimer)
  if (v) {
    carried.value = true
    return
  }
  carryTimer = setTimeout(() => {
    carried.value = false
  }, CARRY_RELEASE_MS)
})

onMounted(() => {
  startSpin()
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  disposeSpin()
  removeListeners()
  window.removeEventListener('keydown', onKeydown)
  document.body.style.cursor = ''
  clearTimeout(swallowTimer)
  clearTimeout(settleTimer)
  clearTimeout(carryTimer)
  clearTimeout(pressTimer)
  nudgeAnim?.cancel()
  cancelAnimationFrame(settleRaf)
})

// C 键的判断，按住不放是键盘自动重复输入，不算
function onKeydown(e) {
  if (locked.value || swallowed.value) return
  if (e.key !== 'c' && e.key !== 'C') return
  if (e.repeat) return
  const t = e.target
  const tag = t?.tagName
  if (t?.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    return
  }
  flashHit()
  emit('hit')
}

// 给点大小变化来暗示要 qte，不然估计看不出来。下同
// 写 CSS 变量而不是走 prop，是因为它每帧都变，不能为此完全重渲
function setCharge(v) {
  rootEl.value?.style.setProperty('--cb-charge', v.toFixed(3))
}

// 因为至少连点三次才能看到变大，所以第一下额外弹一下来增强提示需要 qte
function nudge() {
  const el = rootEl.value
  if (!el) return
  nudgeAnim?.cancel()
  nudgeAnim = el.animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }],
    { duration: CB_NUDGE_MS, easing: 'ease-out' },
  )
}

defineExpose({ setCharge, nudge })

function flashHit() {
  pressed.value = true
  clearTimeout(pressTimer)
  pressTimer = setTimeout(() => {
    pressed.value = false
  }, CB_PRESS_MS)
}

watch(gone, (v) => {
  if (v) emit('gone')
})

function overBin(x, y) {
  const el = binEl.value
  if (!el) return false
  const r = el.getBoundingClientRect()
  return (
    x >= r.left - DROP_PAD &&
    x <= r.right + DROP_PAD &&
    y >= r.top - DROP_PAD &&
    y <= r.bottom + DROP_PAD
  )
}

function onDown(e) {
  if (e.button !== 0 || locked.value || swallowed.value) return
  cancelSettle()
  start = { x: e.clientX, y: e.clientY, ox: offset.value.x, oy: offset.value.y }
  mode = null
  // 先接上转的那条路，等定性了再决定要不要把 move 转发给它
  onSpinDown(e)
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
}

function onMove(e) {
  if (!start) return
  const dx = e.clientX - start.x
  const dy = e.clientY - start.y
  if (!mode) {
    if (Math.hypot(dx, dy) <= DRAG_THRESHOLD) return
    // 横向为主 = 原地转，纵向为主 = 拎起来往垃圾桶去。两边共用一个手势，只能按主轴分
    mode = Math.abs(dx) >= Math.abs(dy) ? 'spin' : 'carry'
    if (mode === 'carry') {
      // 先量再搬：Teleport 出去之后定位基准从内容区换成 body，位置得按此刻的视口坐标钉住。
      // 量最外层（没被转动过），转着的盒子外接矩形会变大
      const r = rootEl.value.getBoundingClientRect()
      carryCenter.value = { x: r.left + r.width / 2, y: r.top + r.height / 2 }
      dragging.value = true
      document.body.style.cursor = 'move'
    }
  }
  if (mode === 'spin') {
    onSpinMove(e)
    return
  }
  offset.value = { x: start.ox + dx, y: start.oy + dy }
  hot.value = overBin(e.clientX, e.clientY)
}

function onUp(e) {
  removeListeners()
  // finally 行为
  onSpinUp()
  // 松手后惯性会继续写 onFrame，那些帧自己会重新计时；原地松手没有后续帧，得补一次
  armSettle()
  const decided = mode
  mode = null
  start = null
  if (decided === 'carry') {
    dragging.value = false
    hot.value = false
    document.body.style.cursor = ''
    if (overBin(e.clientX, e.clientY)) {
      swallow()
      return
    }
    offset.value = { x: 0, y: 0 }
    return
  }
  if (!decided) {
    flashHit()
    emit('hit')
  }
}

function swallow() {
  swallowed.value = true
  dragging.value = false
  document.body.style.cursor = ''
  offset.value = { x: 0, y: 0 }
  swallowTimer = setTimeout(() => emit('dismissed'), SWALLOW_MS)
}

function removeListeners() {
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
  window.removeEventListener('pointercancel', onUp)
}
</script>

<style scoped>
.indirecty-callback {
  --cb-w: 140px;
  --cb-h: 38px;
  --cb-t: 10px; /* 模拟的侧面厚度 */
  --cb-side-bg: #808080;
  --cb-grow: 0.35; /* 拽到最近时比原尺寸大多少 */
  position: absolute;
  inset: 0;
  margin: auto;
  width: var(--cb-w);
  height: var(--cb-h);
  /* 透视挂在盒子上、不写在 transform 里，正面 / 侧壁 / 背面要共用同一个灭点，
     各投影各的时接缝对不齐。父级没有透视，rotateY 才会只压扁不转 */
  perspective: 900px;
  /* 位移 / 上升各占一个独立属性：--fly-y 由起飞的 rAF 逐帧写 */
  translate: var(--cb-x, 0px) calc(var(--cb-y, 0px) + var(--fly-y, 0px));
  /* 按钮大小提示 QTE 的进度 */
  scale: calc(1 + var(--cb-charge, 0) * var(--cb-grow));
  transition: translate 220ms ease-out;
  animation: callback-in 320ms ease-out;
}

.cb-box {
  position: absolute;
  inset: 0;
  transform-style: preserve-3d;
  transform: rotateY(var(--cb-turn, 0deg));
}

.cb-face {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  text-transform: none;
  user-select: none;
  touch-action: none;
  /* 转过 90° 之后正面就别画了，否则看到的是镜像的字，背面由 .cb-back 渲染 */
  backface-visibility: hidden;
}

.cb-key {
  color: #808080;
}

.cb-face.is-pressed {
  background: #ffffff;
  color: #000000;
}

/* 拎起来层级抬到 mesbin 上面 */
.indirecty-callback.is-carried {
  position: fixed;
  inset: auto;
  left: var(--cb-cx);
  top: var(--cb-cy);
  margin: 0;
  translate: calc(-50% + var(--cb-x)) calc(-50% + var(--cb-y));
  z-index: var(--z-callback-item);
}

/* 背面 */
.cb-back {
  position: absolute;
  inset: 0;
  background: #000;
  border: 3px solid #fff;
  transform: translateZ(calc(-1 * var(--cb-t)));
  pointer-events: none;
}

/* 模拟的侧面 */
.cb-side {
  position: absolute;
  top: 0;
  left: 50%;
  width: var(--cb-t);
  height: 100%;
  margin-left: calc(var(--cb-t) / -2);
  background: var(--cb-side-bg);
  pointer-events: none;
}

.cb-side--right {
  transform: translateX(calc(var(--cb-w) / 2)) translateZ(calc(var(--cb-t) / -2))
    rotateY(90deg);
}

.cb-side--left {
  transform: translateX(calc(var(--cb-w) / -2)) translateZ(calc(var(--cb-t) / -2))
    rotateY(90deg);
}

.indirecty-callback.is-dragging {
  transition: none;
}

.indirecty-callback.is-leaving {
  opacity: 0;
  transition: opacity var(--cb-swallow-ms) ease-out;
  pointer-events: none;
}

@keyframes callback-in {
  from {
    opacity: 0;
    scale: 0.8;
  }
}

.callback-bin {
  --callback-bin-red: #e24b4a;
  position: fixed;
  left: 50%;
  bottom: 40px;
  z-index: var(--z-callback);
  width: 88px;
  height: 88px;
  display: grid;
  translate: -50% 0;
  transform: translateY(12px);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition:
    opacity 160ms ease,
    transform 160ms ease,
    scale 160ms ease;
  image-rendering: pixelated;
}

.callback-bin.is-visible {
  opacity: 1;
  visibility: visible;
  transform: none;
}

.callback-bin.is-hot {
  scale: 1.15;
}

.callback-bin__img {
  grid-area: 1 / 1;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
}

.callback-bin__img--open {
  opacity: 0;
  transition: opacity 120ms ease;
}

.callback-bin.is-hot .callback-bin__img--open {
  opacity: 1;
}

.callback-bin__label {
  position: absolute;
  top: 100%;
  left: 50%;
  translate: -50% 0;
  margin-top: 6px;
  font-size: clamp(12px, 1vw, 14px);
  color: var(--callback-bin-red);
  opacity: 0;
  transition: opacity 160ms ease;
}

.callback-bin.is-hot .callback-bin__label {
  opacity: 1;
}

.callback-bin.is-swallowed {
  animation: callback-bin-swallow var(--cb-swallow-ms) ease-out forwards;
}

@keyframes callback-bin-swallow {
  to {
    scale: 0.3;
    opacity: 0;
  }
}
</style>
