<template>
  <div
    ref="windowRef"
    class="pixel-window"
    :class="edgeClasses"
    :style="windowStyle"
    @mousedown="onWindowMouseDown"
    @mousemove="onWindowMouseMove"
    @mouseleave="onWindowMouseLeave"
  >
    <div
      v-if="showTitleBar"
      class="pixel-titlebar"
    >
      <div class="pixel-titlebar__left">
        <span v-if="icon" class="pixel-titlebar__icon">{{ icon }}</span>
        <span class="pixel-titlebar__title">{{ title }}</span>
      </div>
      <div class="pixel-titlebar__controls">
        <button
          v-if="controlFlags.minimize"
          class="pixel-control"
          aria-label="minimize"
          @mousedown.stop
        >
          <img src="/assets/window_btn_min.png" alt="" />
        </button>
        <button
          v-if="controlFlags.maximize"
          class="pixel-control"
          aria-label="maximize"
          @mousedown.stop
        >
          <img src="/assets/window_btn_max.png" alt="" />
        </button>
        <button
          v-if="controlFlags.close"
          class="pixel-control"
          aria-label="close"
          @mousedown.stop
          @click.stop="onCloseClick"
        >
          <img src="/assets/window_btn_c.png" alt="" />
        </button>
      </div>
    </div>
    <div class="pixel-window__content">
      <slot />
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { nextZ } from '@/stores/windowZ.js'

const props = defineProps({
  title: {
    type: String,
    default: '',
  },
  icon: {
    type: String,
    default: '',
  },
  showTitleBar: {
    type: Boolean,
    default: true,
  },
  controls: {
    type: Object,
    default: () => ({}),
  },
  width: {
    type: String,
    default: 'auto',
  },
  height: {
    type: String,
    default: 'auto',
  },
  bringToFrontOnClick: {
    type: Boolean,
    default: true,
  },
  initialZIndex: {
    type: Number,
    default: 0,
  },
  parentZIndex: {
    type: Number,
    default: 0,
  },
  clickOutsideToClose: {
    type: Boolean,
    default: false,
  },
  topMost: {
    type: Boolean,
    default: false,
  },
  centered: {
    type: Boolean,
    default: false,
  },
  right: {
    type: String,
    default: '',
  },
  left: {
    type: String,
    default: '',
  },
  top: {
    type: String,
    default: '',
  },
  bottom: {
    type: String,
    default: '',
  },
  topAnchor: {
    type: Boolean,
    default: false,
  },
  resizable: {
    type: Boolean,
    default: false,
  },
  minWidth: {
    type: Number,
    default: 240,
  },
  minHeight: {
    type: Number,
    default: 160,
  },
  maxWidth: {
    type: Number,
    default: 1600,
  },
  maxHeight: {
    type: Number,
    default: 1200,
  },
})

const emit = defineEmits(['close', 'dragend'])

const controlFlags = computed(() => ({
  minimize: props.controls.minimize ?? true,
  maximize: props.controls.maximize ?? true,
  close: props.controls.close ?? true,
}))

function resolveInitialZIndex() {
  if (props.topMost) return 9999
  if (props.parentZIndex) return props.parentZIndex + 1
  return props.initialZIndex || nextZ()
}

const windowRef = ref(null)
const drag = reactive({
  isDragging: false,
  x: 0,
  y: 0,
  startMouseX: 0,
  startMouseY: 0,
  startX: 0,
  startY: 0,
})
const zIndex = ref(resolveInitialZIndex())

// ── Resize / drag takeover ──
// Resizable windows freeze to pixel-space positioning on the first interaction
// (titlebar drag OR edge resize). From then on we drive left/top/width/height in
// px directly, so resize math never has to reason about CSS anchors (gallery's
// left:2% vs comments' right:2%). This keeps the resize path identical for every
// window and makes it trivial to abstract out later.
const manual = reactive({
  active: false,
  dragging: false,
  x: 0,
  y: 0,
  w: 0,
  h: 0,
  startMouseX: 0,
  startMouseY: 0,
  startX: 0,
  startY: 0,
})
const edgeDir = ref('') // '' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
const EDGE = 8 // edge hit-zone in px (slightly larger than the 6px border for usability)

// 边缘命中时除了切系统原生 --rc 光标（.is-edge *{cursor:var(--rc)}），还要挂上
// .resize-* class，让 FP 指针预览（applyCursorPreview 注入的全局 CSS）能命中并
// 显示自定义 PNG 指针，而不是系统原生箭头。非预览状态时这些 class 无规则匹配，
// 边缘照常显示 --rc，零副作用。
function resizeClassOf(dir) {
  if (dir === 'n' || dir === 's') return 'resize-ns'
  if (dir === 'e' || dir === 'w') return 'resize-ew'
  if (dir === 'ne' || dir === 'sw') return 'resize-nesw'
  if (dir === 'nw' || dir === 'se') return 'resize-nwse'
  return ''
}
const edgeClasses = computed(() => {
  if (!edgeDir.value) return {}
  return { 'is-edge': true, [resizeClassOf(edgeDir.value)]: true }
})
const resize = reactive({
  active: false,
  dir: '',
  startX: 0,
  startY: 0,
  // resize 开始瞬间抓的渲染矩形（视口 px），resize 全程只在像素坐标算
  // 「被拖边跟手 / 对边钉死」，结果直接写回 manual.x/y/w/h。
  startLeft: 0,
  startTop: 0,
  startW: 0,
  startH: 0,
})

// 把当前渲染位置冻结成像素矩形（left/top 相对 offsetParent，与 offsetLeft 语义一致，
// 因此接管瞬间视觉零跳变）。一旦 active，窗口就由 manual 像素坐标接管，不再依赖
// CSS 锚定或 translate(drag)。
function ensureManual() {
  if (manual.active || !windowRef.value) return
  const el = windowRef.value
  const rect = el.getBoundingClientRect()
  const op = el.offsetParent
  if (op && op !== document.body && op !== document.documentElement) {
    const opRect = op.getBoundingClientRect()
    manual.x = rect.left - opRect.left - (op.clientLeft || 0)
    manual.y = rect.top - opRect.top - (op.clientTop || 0)
  } else {
    manual.x = rect.left + (window.scrollX || 0)
    manual.y = rect.top + (window.scrollY || 0)
  }
  manual.w = rect.width
  manual.h = rect.height
  manual.active = true
}

const windowStyle = computed(() => {
  // Resizable windows, once they've been interacted with, are driven entirely in
  // pixel space. No CSS anchor / translate(drag) math — resize works for any
  // window uniformly (gallery left:2%, comments right:2%, ...).
  if (manual.active) {
    const s = {
      position: 'absolute',
      left: manual.x + 'px',
      top: manual.y + 'px',
      width: manual.w + 'px',
      height: manual.h + 'px',
      right: 'auto',
      bottom: 'auto',
      transform: 'none',
      zIndex: zIndex.value,
    }
    if (edgeDir.value) s['--rc'] = resizeCursor(edgeDir.value)
    return s
  }
  const style = {
    zIndex: zIndex.value,
  }
  const verticalBase = props.top || '50%'
  const yShift = props.topAnchor ? `${drag.y}px` : `calc(-50% + ${drag.y}px)`

  if (props.bottom) {
    style.position = 'fixed'
    style.bottom = props.bottom
    style.left = '50%'
    style.transform = `translate(calc(-50% + ${drag.x}px), ${drag.y}px)`
  } else if (props.top && props.topAnchor) {
    style.position = 'fixed'
    style.top = props.top
    style.left = '50%'
    style.transform = `translate(calc(-50% + ${drag.x}px), ${drag.y}px)`
  } else if (props.centered) {
    style.position = 'fixed'
    style.top = verticalBase
    style.left = '50%'
    style.transform = `translate(calc(-50% + ${drag.x}px), calc(-50% + ${drag.y}px))`
  } else if (props.right) {
    style.position = 'fixed'
    style.top = verticalBase
    style.right = props.right
    style.transform = `translate(${drag.x}px, ${yShift})`
  } else if (props.left) {
    style.position = 'fixed'
    style.top = verticalBase
    style.left = props.left
    style.transform = `translate(${drag.x}px, ${yShift})`
  } else {
    style.transform = `translate(${drag.x}px, ${drag.y}px)`
  }
  if (props.width && props.width !== 'auto') {
    style.width = props.width
  }
  if (props.height && props.height !== 'auto') {
    style.height = props.height
  }
  if (edgeDir.value) {
    style['--rc'] = resizeCursor(edgeDir.value)
  }
  return style
})

function onWindowMouseDown(e) {
  if (props.bringToFrontOnClick && !props.topMost) {
    bringToFront()
  }
  // control buttons carry their own @mousedown.stop, so they never reach here;
  // this guard is just a safety net.
  if (e.target.closest('.pixel-control')) return
  if (props.resizable) {
    const dir = hitTest(e)
    if (dir) {
      e.preventDefault()
      startResize(e, dir)
      return
    }
  }
  if (e.target.closest('.pixel-titlebar')) {
    startDrag(e)
  }
}

// 鼠标移到窗口边缘 → 像 Windows 一样自动变 resize 光标（不画任何可见手柄）
function hitTest(e) {
  const el = windowRef.value
  if (!el) return ''
  const rect = el.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  let dir = ''
  if (y <= EDGE) dir += 'n'
  else if (y >= rect.height - EDGE) dir += 's'
  if (x <= EDGE) dir += 'w'
  else if (x >= rect.width - EDGE) dir += 'e'
  return dir
}

function onWindowMouseMove(e) {
  if (!props.resizable || resize.active || drag.isDragging || manual.dragging) return
  edgeDir.value = hitTest(e)
}

function onWindowMouseLeave() {
  edgeDir.value = ''
}

function onCloseClick() {
  emit('close')
}

function onDocumentMouseDown(e) {
  if (!props.clickOutsideToClose || !windowRef.value) return
  if (!windowRef.value.contains(e.target)) {
    emit('close')
  }
}

onMounted(() => {
  if (props.clickOutsideToClose) {
    // 捕获阶段：必须在任意子元素 @mousedown.stop（如其它窗口标题栏的拖动）掐断冒泡之前触发，
    // 否则点到那些标题栏时 click-outside 永远收不到事件 → 详情窗关不掉
    document.addEventListener('mousedown', onDocumentMouseDown, true)
  }
})

function startDrag(e) {
  if (!props.topMost) {
    bringToFront()
  }
  // Resizable windows drive their position in pixel space once interacted with,
  // so the titlebar drag also updates manual.x/y instead of translate(drag).
  if (props.resizable) {
    ensureManual()
    manual.dragging = true
    manual.startMouseX = e.clientX
    manual.startMouseY = e.clientY
    manual.startX = manual.x
    manual.startY = manual.y
    document.addEventListener('mousemove', onManualDrag)
    document.addEventListener('mouseup', stopManualDrag)
    return
  }
  drag.isDragging = true
  drag.startMouseX = e.clientX
  drag.startMouseY = e.clientY
  drag.startX = drag.x
  drag.startY = drag.y
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
}

function onManualDrag(e) {
  if (!manual.dragging) return
  const dx = e.clientX - manual.startMouseX
  const dy = e.clientY - manual.startMouseY
  manual.x = manual.startX + dx
  manual.y = manual.startY + dy
}

function stopManualDrag() {
  const wasDragging = manual.dragging
  manual.dragging = false
  document.removeEventListener('mousemove', onManualDrag)
  document.removeEventListener('mouseup', stopManualDrag)
  if (wasDragging) {
    emit('dragend')
  }
}

function moveBy(dx, dy) {
  if (manual.active) {
    manual.x += dx
    manual.y += dy
  } else {
    drag.x += dx
    drag.y += dy
  }
}

defineExpose({
  startDrag,
  moveBy,
})

function onDrag(e) {
  if (!drag.isDragging) return
  const dx = e.clientX - drag.startMouseX
  const dy = e.clientY - drag.startMouseY
  drag.x = drag.startX + dx
  drag.y = drag.startY + dy
}

function stopDrag() {
  const wasDragging = drag.isDragging
  drag.isDragging = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
  if (wasDragging) {
    emit('dragend')
  }
}

function bringToFront() {
  zIndex.value = nextZ()
}

// ── Resize handles ──
function resizeCursor(dir) {
  // 单行方向优先于对角：原逻辑里 n/s/e/w 都不命中 n&&s / e&&w / ne||sw，
  // 会落到默认 nwse-resize，导致四条边全显示对角指针。
  if (dir === 'n' || dir === 's') return 'ns-resize'
  if (dir === 'e' || dir === 'w') return 'ew-resize'
  if (dir === 'ne' || dir === 'sw') return 'nesw-resize'
  if (dir === 'nw' || dir === 'se') return 'nwse-resize'
  return 'default'
}

function startResize(e, dir) {
  if (!windowRef.value) return
  if (!props.topMost) bringToFront()
  // Freeze into pixel space (also covers the case where the user resizes before
  // dragging: ensures manual.x/y/w/h carry the real rendered rect).
  ensureManual()
  resize.active = true
  resize.dir = dir
  resize.startX = e.clientX
  resize.startY = e.clientY
  resize.startLeft = manual.x
  resize.startTop = manual.y
  resize.startW = manual.w
  resize.startH = manual.h
  document.body.style.userSelect = 'none'
  document.body.style.cursor = resizeCursor(dir)
  document.addEventListener('mousemove', onResizeMove)
  document.addEventListener('mouseup', stopResize)
}

// Pure pixel-space resize. The grabbed edge follows the mouse; the opposite edge
// stays pinned. No knowledge of CSS anchors — works for left/right/top/bottom
// anchored windows identically. Result is written straight back to manual.
function onResizeMove(e) {
  if (!resize.active) return
  const dx = e.clientX - resize.startX
  const dy = e.clientY - resize.startY
  const dir = resize.dir
  let left = resize.startLeft
  let top = resize.startTop
  let width = resize.startW
  let height = resize.startH
  if (dir.includes('w')) { left = resize.startLeft + dx; width = resize.startW - dx }
  if (dir.includes('e')) { width = resize.startW + dx } // left edge pinned
  if (dir.includes('n')) { top = resize.startTop + dy; height = resize.startH - dy }
  if (dir.includes('s')) { height = resize.startH + dy } // top edge pinned
  width = Math.max(props.minWidth, Math.min(props.maxWidth, width))
  height = Math.max(props.minHeight, Math.min(props.maxHeight, height))
  // keep the opposite (un-grabbed) edge pinned
  if (dir.includes('w') && !dir.includes('e')) left = resize.startLeft + resize.startW - width
  if (dir.includes('n') && !dir.includes('s')) top = resize.startTop + resize.startH - height
  manual.x = Math.round(left)
  manual.y = Math.round(top)
  manual.w = Math.round(width)
  manual.h = Math.round(height)
}

function stopResize() {
  if (!resize.active) return
  resize.active = false
  edgeDir.value = ''
  document.body.style.userSelect = ''
  document.body.style.cursor = ''
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', stopResize)
}

onBeforeUnmount(() => {
  stopDrag()
  stopResize()
  if (props.clickOutsideToClose) {
    document.removeEventListener('mousedown', onDocumentMouseDown, true)
  }
})
</script>

<style scoped>
.pixel-window {
  background: #000000;
  border: 6px solid transparent;
  border-image-source: url('/assets/window_frame.png');
  border-image-slice: 6;
  border-image-width: 6px;
  border-image-repeat: round;
  border-radius: 8px;
  color: #ffffff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.pixel-titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 18px;
  gap: 12px;
  user-select: none;
  cursor: move;
}

.pixel-titlebar__left {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
}

.pixel-titlebar__icon {
  font-size: 24px;
  line-height: 1;
  flex-shrink: 0;
}

.pixel-titlebar__title {
  font-size: clamp(24px, 2.2vw, 34px);
  font-weight: bold;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.pixel-titlebar__controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.pixel-control {
  background: transparent;
  border: none;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  cursor: pointer;
}

.pixel-control img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
}

.pixel-control:hover {
  opacity: 0.7;
}

.pixel-window__content {
  padding: 18px;
  flex: 1;
  overflow: auto;
}

/* ── Edge resize: Windows-style cursor change on hover, no visible handles ── */
.pixel-window.is-edge,
.pixel-window.is-edge .pixel-titlebar,
.pixel-window.is-edge .pixel-window__content {
  cursor: var(--rc);
}
</style>
