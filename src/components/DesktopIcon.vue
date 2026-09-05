<template>
  <div
    ref="iconRef"
    class="desktop-icon"
    :class="{ 'drag-top': alwaysTop, 'is-transforming': isTransforming }"
    :style="iconStyle"
    v-draggable="onIconClick"
  >
    <div class="desktop-icon__content">
      <div class="desktop-icon__visual">
        <slot name="icon" />
      </div>
      <div class="desktop-icon__label">
        <slot name="label" />
      </div>
    </div>
    <!-- Transform handles ONLY — 8 drag dots, NO border-image. The 9-sprite
         frame is drawn by global .frame-on-hover::after. Because scale() lives
         on the root, the frame, handles and content all scale together as one
         unit, so there is exactly one frame and no stretching math needed. -->
    <div v-if="transformable" class="desktop-icon__handles" @mousedown.stop.prevent>
      <span class="ft-handle ft-handle--nw" @pointerdown.stop.prevent="onHandleDown('nw', $event)"></span>
      <span class="ft-handle ft-handle--n"  @pointerdown.stop.prevent="onHandleDown('n', $event)"></span>
      <span class="ft-handle ft-handle--ne" @pointerdown.stop.prevent="onHandleDown('ne', $event)"></span>
      <span class="ft-handle ft-handle--e"  @pointerdown.stop.prevent="onHandleDown('e', $event)"></span>
      <span class="ft-handle ft-handle--se" @pointerdown.stop.prevent="onHandleDown('se', $event)"></span>
      <span class="ft-handle ft-handle--s"  @pointerdown.stop.prevent="onHandleDown('s', $event)"></span>
      <span class="ft-handle ft-handle--sw" @pointerdown.stop.prevent="onHandleDown('sw', $event)"></span>
      <span class="ft-handle ft-handle--w"  @pointerdown.stop.prevent="onHandleDown('w', $event)"></span>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onBeforeUnmount } from 'vue'

const props = defineProps({
  initialLeft: {
    type: String,
    default: '0',
  },
  initialTop: {
    type: String,
    default: '0',
  },
  // 是否常驻最顶层(9998)。默认 true。torch 等不需要置顶的图标传 false。
  alwaysTop: {
    type: Boolean,
    default: true,
  },
  // 是否启用自由变换（hover 显示 9sprite 框 + 8 手柄，拖拽变形并保持）。默认 false。
  transformable: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['click'])

const iconRef = ref(null)
const isTransforming = ref(false)

const iconStyle = computed(() => ({
  position: 'absolute',
  left: props.initialLeft,
  top: props.initialTop,
}))

function onIconClick() {
  emit('click')
}

// --- Free transform (transformable) ---
// 角 = 等比缩放（按到中心距离比）；边 = 单轴拉伸。变形后保持，不复位。
// scale() is applied on the ROOT via --ft-sx/--ft-sy, so frame + handles +
// content all scale as one unit (no per-element sizing needed).
const MIN_SCALE = 0.1
const MAX_SCALE = 10
// 变形灵敏度：1 = 鼠标位移 1:1 反映到元素边界；调低（如 0.5）只响应一半位移，
// 拖同样距离变化更小，便于精细调整。想更迟钝往 0 调，想恢复 1:1 设 1。
const SENSITIVITY = 0.5
const clampScale = (v) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, v))
const sx = ref(1)
const sy = ref(1)
let drag = null

function applyTransform() {
  const el = iconRef.value
  if (el) {
    el.style.setProperty('--ft-sx', sx.value)
    el.style.setProperty('--ft-sy', sy.value)
  }
}

function onHandleDown(dir, e) {
  e.preventDefault()
  e.stopPropagation()
  const el = iconRef.value
  const rect = el.getBoundingClientRect()
  drag = {
    dir,
    startX: e.clientX,
    startY: e.clientY,
    startSx: sx.value,
    startSy: sy.value,
    cx: rect.left + rect.width / 2,
    cy: rect.top + rect.height / 2,
    w: rect.width,
    h: rect.height,
  }
  isTransforming.value = true
  window.addEventListener('pointermove', onHandleMove)
  window.addEventListener('pointerup', onHandleUp)
}

function onHandleMove(e) {
  if (!drag) return
  const { dir, startX, startY, startSx, startSy, cx, cy, w, h } = drag
  const dx = e.clientX - startX
  const dy = e.clientY - startY
  if (dir.length === 2) {
    // 角：等比。按鼠标到中心的距离比缩放，SENSITIVITY 只对「变化量」打折。
    const sd = Math.hypot(startX - cx, startY - cy) || 1
    const cd = Math.hypot(e.clientX - cx, e.clientY - cy)
    const f = 1 + (cd / sd - 1) * SENSITIVITY
    sx.value = clampScale(startSx * f)
    sy.value = clampScale(startSy * f)
  } else if (dir === 'e' || dir === 'w') {
    // 边：单轴拉伸。增量 = 鼠标位移 / 元素原始宽度（1:1 跟随视觉边界）。
    // 旧写法 startSx * (w+dx)/w 会把位移放大 startSx 倍 —— 元素越大越失控。
    const delta = ((dir === 'e' ? dx : -dx) / w) * SENSITIVITY
    sx.value = clampScale(startSx + delta)
  } else {
    const delta = ((dir === 's' ? dy : -dy) / h) * SENSITIVITY
    sy.value = clampScale(startSy + delta)
  }
  applyTransform()
}

function onHandleUp() {
  drag = null
  isTransforming.value = false
  window.removeEventListener('pointermove', onHandleMove)
  window.removeEventListener('pointerup', onHandleUp)
}

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onHandleMove)
  window.removeEventListener('pointerup', onHandleUp)
})
</script>

<style scoped>
.desktop-icon {
  position: absolute;
  width: 84px;
  height: 84px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  /* Root only translates (v-draggable). Scale lives on __content, while the
     frame/handles overlays size themselves via --ft-sx/--ft-sy so the 9-slice
     border-image RE-TILES at the new size (corners stay sharp, edges stretch)
     instead of being transform-stretched. */
  transform: translate(var(--ddx, 0px), var(--ddy, 0px));
}

/* Drag visual lives on __content so it follows the scale transform. */
.desktop-icon.is-dragging {
  cursor: move;
}
.desktop-icon.is-dragging .desktop-icon__content {
  background: rgba(255, 255, 255, 0.35);
  border-radius: 8px;
}

/* scaled content (icon + label). Grows symmetrically from center. */
.desktop-icon__content {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 4px;
  box-sizing: border-box;
  transform: scale(var(--ft-sx, 1), var(--ft-sy, 1));
  transform-origin: center;
}

.desktop-icon__visual {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.desktop-icon__label {
  color: #808080;
  font-size: clamp(12px, 1.1vw, 18px);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  text-align: center;
  line-height: 1.2;
  max-width: 100%;
  overflow-wrap: break-word;
}

/* Transform handle overlay: NO border-image. Sized to the current (scaled)
   bounds via --ft-sx/--ft-sy so handles sit at the corners/edges of the
   transformed content. Hidden until hover OR while transforming. */
.desktop-icon__handles {
  position: absolute;
  left: 50%;
  top: 50%;
  width: calc(100% * var(--ft-sx, 1));
  height: calc(100% * var(--ft-sy, 1));
  transform: translate(-50%, -50%);
  pointer-events: none;
  opacity: 0;
}
.desktop-icon:hover .desktop-icon__handles,
.desktop-icon.is-transforming .desktop-icon__handles {
  opacity: 1;
}
.desktop-icon:hover .ft-handle,
.desktop-icon.is-transforming .ft-handle {
  pointer-events: auto;
}
/* Invisible hit areas for transform dragging. The sprite (deskicon_frame.png)
   already draws corner blocks + edge-mid markers — handles must NOT add any
   visible pixels on top, or they create a "double frame" at corners/edge-mids. */
.ft-handle {
  position: absolute;
  width: 16px;
  height: 16px;
  background: transparent;
  border: none;
}
.ft-handle--nw { top: -8px; left: -8px; cursor: nwse-resize; }
.ft-handle--n  { top: -8px; left: 50%; margin-left: -8px; cursor: ns-resize; }
.ft-handle--ne { top: -8px; right: -8px; cursor: nesw-resize; }
.ft-handle--e  { top: 50%; right: -8px; margin-top: -8px; cursor: ew-resize; }
.ft-handle--se { bottom: -8px; right: -8px; cursor: nwse-resize; }
.ft-handle--s  { bottom: -8px; left: 50%; margin-left: -8px; cursor: ns-resize; }
.ft-handle--sw { bottom: -8px; left: -8px; cursor: nesw-resize; }
.ft-handle--w  { top: 50%; left: -8px; margin-top: -8px; cursor: ew-resize; }
</style>
