<template>
  <div
    ref="iconRef"
    class="desktop-icon"
    :class="{ dragging: drag.isDragging }"
    :style="iconStyle"
    @mousedown="onMouseDown"
  >
    <div class="desktop-icon__visual">
      <slot name="icon" />
    </div>
    <div class="desktop-icon__label">
      <slot name="label" />
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'

const props = defineProps({
  initialLeft: {
    type: String,
    default: '0',
  },
  initialTop: {
    type: String,
    default: '0',
  },
})

const emit = defineEmits(['click'])

const iconRef = ref(null)
const drag = reactive({
  isDragging: false,
  startX: 0,
  startY: 0,
  x: 0,
  y: 0,
  baseX: 0,
  baseY: 0,
})

const iconStyle = computed(() => ({
  position: 'absolute',
  left: props.initialLeft,
  top: props.initialTop,
  transform: `translate(${drag.x}px, ${drag.y}px)`,
}))

function onMouseDown(e) {
  drag.isDragging = true
  drag.startX = e.clientX
  drag.startY = e.clientY
  drag.baseX = drag.x
  drag.baseY = drag.y
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function onMouseMove(e) {
  if (!drag.isDragging) return
  drag.x = drag.baseX + e.clientX - drag.startX
  drag.y = drag.baseY + e.clientY - drag.startY
}

function onMouseUp() {
  const moved = Math.abs(drag.x - drag.baseX) > 3 || Math.abs(drag.y - drag.baseY) > 3
  drag.isDragging = false
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
  if (!moved) {
    emit('click')
  }
}
</script>

<style scoped>
.desktop-icon {
  position: absolute;
  z-index: 9998;
  width: 84px;
  height: 84px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 4px;
  box-sizing: border-box;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
}

.desktop-icon.dragging {
  background: rgba(255, 255, 255, 0.35);
  border-radius: 8px;
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
</style>
