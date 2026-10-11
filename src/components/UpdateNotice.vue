<template>
  <Teleport to="body">
    <div
      class="update-notice"
      :class="{ 'is-dragging': dragging, 'is-leaving': leaving }"
      :style="{
        '--un-x': offset.x + 'px',
        '--un-y': offset.y + 'px',
        '--un-leave-ms': LEAVE_MS + 'ms',
        '--un-swallow-ms': SWALLOW_MS + 'ms',
      }"
      @pointerdown="onDown"
      @click.capture="onClickCapture"
    >
      <p class="update-notice__text">new version is out.</p>
      <div class="update-notice__actions">
        <button class="pixel-btn pixel-btn--sm" type="button" @click="refresh">refresh</button>
        <button class="pixel-btn pixel-btn--sm" type="button" @click="later">later</button>
      </div>
    </div>

    <div
      ref="bin"
      class="update-bin"
      :class="{
        'is-visible': dragging || swallowed,
        'is-hot': hot,
        'is-swallowed': swallowed,
      }"
      :style="{ '--un-swallow-ms': SWALLOW_MS + 'ms' }"
    >
      <img class="update-bin__img" src="/assets/mesbin.png" alt="" draggable="false" />
      <img
        class="update-bin__img update-bin__img--open"
        src="/assets/mesbin_open.png"
        alt=""
        draggable="false"
      />
      <span class="update-bin__label">DISMISS</span>
    </div>
  </Teleport>
</template>

<script setup>
import { onBeforeUnmount, ref } from 'vue'
import { useDialogFlow } from '@/dialogs/useDialogFlow'

const emit = defineEmits(['later'])
const dlg = useDialogFlow()

const dragging = ref(false)
const leaving = ref(false)
// 扔进垃圾桶 = later = 本次会话不再提示
const swallowed = ref(false) 
const hot = ref(false)
const offset = ref({ x: 0, y: 0 })
const bin = ref(null)

const LEAVE_MS = 200
const SWALLOW_MS = 460
const DIALOG_DELAY_MS = 620
const DRAG_THRESHOLD = 4
const DROP_PAD = 12

let start = null
let moved = false

function overBin(x, y) {
  const el = bin.value
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
  if (e.button !== 0) return
  start = { x: e.clientX, y: e.clientY, ox: offset.value.x, oy: offset.value.y }
  moved = false
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

function onMove(e) {
  const dx = e.clientX - start.x
  const dy = e.clientY - start.y
  if (!moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
    moved = true
    dragging.value = true
    document.body.style.cursor = 'move'
  }
  if (!moved) return
  offset.value = { x: start.ox + dx, y: start.oy + dy }
  hot.value = overBin(e.clientX, e.clientY)
}

function onUp(e) {
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
  if (!moved) return
  const dropped = overBin(e.clientX, e.clientY)
  dragging.value = false
  hot.value = false
  document.body.style.cursor = ''
  if (dropped) {
    swallowed.value = true
    leaving.value = true
    dialogTimer = setTimeout(() => dlg.start('updateDismissed'), DIALOG_DELAY_MS)
    leaveTimer = setTimeout(() => emit('later'), SWALLOW_MS)
    return
  }
  offset.value = { x: 0, y: 0 }
}

// 拖动之后浏览器仍会补一个 click，不吞掉的话松手落在 refresh 上会当场刷新
function onClickCapture(e) {
  if (!moved) return
  moved = false
  e.stopPropagation()
  e.preventDefault()
}

function refresh() {
  location.reload()
}

let leaveTimer = null
let dialogTimer = null

// 播完退场再通知父级卸载，否则组件会当场消失、动画看不到
function later() {
  leaving.value = true
  leaveTimer = setTimeout(() => emit('later'), LEAVE_MS)
}

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
  document.body.style.cursor = ''
  clearTimeout(leaveTimer)
  // dialogTimer 不清
})
</script>

<style scoped>
.update-notice {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: var(--z-update);
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 12px;
  background: #000000;
  border: 3px solid #ffffff;
  color: #ffffff;
  font-family: var(--font-pixel);
  cursor: default;
  user-select: none;
  translate: var(--un-x, 0px) var(--un-y, 0px);
  transition: translate 220ms ease-out;
  animation:
    update-notice-in 200ms ease-out,
    update-notice-tilt 6s ease-in-out infinite;
}

.update-notice.is-dragging {
  z-index: calc(var(--z-update) + 1);
  transition: none;
}

.update-notice.is-leaving {
  rotate: 0deg;
  animation: update-notice-out var(--un-leave-ms) ease-in forwards;
  pointer-events: none;
}

.update-notice__text {
  margin: 0;
  font-size: clamp(13px, 1vw, 15px);
}

.update-notice__actions {
  display: flex;
  gap: 8px;
}

.update-bin {
  --update-bin-red: #e24b4a;
  position: fixed;
  left: 50%;
  bottom: 40px;
  z-index: var(--z-update);
  width: 88px;
  height: 88px;
  display: grid;
  translate: -50% 0;
  transform: translateY(12px);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 160ms ease, transform 160ms ease, scale 160ms ease;
  image-rendering: pixelated;
}

.update-bin.is-visible {
  opacity: 1;
  visibility: visible;
  transform: none;
}

.update-bin.is-hot {
  scale: 1.15;
}

.update-bin__img {
  grid-area: 1 / 1;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
}

/* 两张叠着放，避免拖到上面时才开始下载 open 图闪一下 */
.update-bin__img--open {
  opacity: 0;
  transition: opacity 120ms ease;
}

.update-bin.is-hot .update-bin__img--open {
  opacity: 1;
}

.update-bin__label {
  position: absolute;
  top: 100%;
  left: 50%;
  translate: -50% 0;
  margin-top: 6px;
  font-size: clamp(12px, 1vw, 14px);
  color: var(--update-bin-red);
  opacity: 0;
  transition: opacity 160ms ease;
}

.update-bin.is-hot .update-bin__label {
  opacity: 1;
}

@keyframes update-notice-in {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
}

.update-bin.is-swallowed {
  animation: update-bin-swallow var(--un-swallow-ms) ease-out forwards;
}

@keyframes update-bin-swallow {
  to {
    scale: 0.3;
    opacity: 0;
  }
}

@keyframes update-notice-out {
  to {
    opacity: 0;
    transform: translateY(-6px);
  }
}

/* 摇摆通知 */
@keyframes update-notice-tilt {
  0%,
  42% {
    rotate: 0deg;
  }
  47% {
    rotate: -7deg;
  }
  52% {
    rotate: 7deg;
  }
  57% {
    rotate: -7deg;
  }
  62% {
    rotate: 7deg;
  }
  67%,
  100% {
    rotate: 0deg;
  }
}
</style>
