<template>
  <div
    ref="windowRef"
    class="pixel-window"
    :style="windowStyle"
    @mousedown="onWindowMouseDown"
  >
    <div
      v-if="showTitleBar"
      class="pixel-titlebar"
      @mousedown.stop="startDrag"
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

const windowStyle = computed(() => {
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
  return style
})

function onWindowMouseDown() {
  if (props.bringToFrontOnClick && !props.topMost) {
    bringToFront()
  }
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
  drag.isDragging = true
  drag.startMouseX = e.clientX
  drag.startMouseY = e.clientY
  drag.startX = drag.x
  drag.startY = drag.y
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
}

function moveBy(dx, dy) {
  drag.x += dx
  drag.y += dy
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

onBeforeUnmount(() => {
  stopDrag()
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
</style>
