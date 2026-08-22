<template>
  <Teleport to="body">
    <div
      class="win-toast"
      :style="toastStyle"
      @mousedown="onMouseDown"
    >
      <!-- 标题栏：可拖动 -->
      <div class="win-toast__titlebar">
        <span v-if="icon" class="win-toast__icon">{{ icon }}</span>
        <span class="win-toast__title">{{ title }}</span>
        <div class="win-toast__controls">
          <button
            v-if="closable"
            class="win-toast__close"
            @click.stop="$emit('action', 'close')"
          >×</button>
        </div>
      </div>

      <!-- 正文区（支持 HTML，可用内联 style 做局部字体/高亮） -->
      <div class="win-toast__body">
        <p class="win-toast__message" v-html="message"></p>
        <p v-if="description" class="win-toast__desc" v-html="description"></p>
      </div>

      <!-- 按钮行（右对齐，neta Windows） -->
      <div class="win-toast__actions">
        <button
          v-for="btn in normalizedButtons"
          :key="btn.value"
          class="win-toast__btn"
          @click="$emit('action', btn.value)"
        >{{ btn.label }}</button>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { nextZ } from '@/stores/windowZ.js'

const props = defineProps({
  // 标题文字
  title: {
    type: String,
    default: '',
  },
  // 主问题/消息
  message: {
    type: String,
    default: '',
  },
  // 补充说明（第二段），支持 HTML（可用内联样式做局部字体/高亮等）
  description: {
    type: String,
    default: '',
  },
  // 标题栏左侧图标字符（如 ℹ、⚠、🔧）
  icon: {
    type: String,
    default: '',
  },
  // 按钮数组：[{ label: 'Yes', value: 'yes' }]，点击 emit('action', value)
  buttons: {
    type: Array,
    default: () => [{ label: 'OK', value: 'ok' }],
  },
  // 是否显示右上角关闭按钮
  closable: {
    type: Boolean,
    default: false,
  },
  // 定位
  top: {
    type: String,
    default: '24px',
  },
  left: {
    type: String,
    default: '24px',
  },
  // 宽度（默认较宽以容纳多行文本）
  width: {
    type: String,
    default: '420px',
  },
})

defineEmits(['action'])

// 层级走全局窗口计数器，会被 focus 规则影响
const zIndex = ref(nextZ())

// 拖动状态
const drag = reactive({
  isDragging: false,
  startX: 0,
  startY: 0,
  offsetX: 0,
  offsetY: 0,
})

function bringToFront() {
  zIndex.value = nextZ()
}

function onMouseDown(e) {
  bringToFront()
  // 只在标题栏区域触发拖动
  if (!e.target.closest('.win-toast__titlebar')) return
  if (e.target.closest('.win-toast__close') || e.target.closest('.win-toast__btn')) return

  drag.isDragging = true
  drag.startX = e.clientX
  drag.startY = e.clientY
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
}

function onDrag(e) {
  if (!drag.isDragging) return
  const dx = e.clientX - drag.startX
  const dy = e.clientY - drag.startY
  drag.offsetX += dx
  drag.offsetY += dy
  drag.startX = e.clientX
  drag.startY = e.clientY
}

function stopDrag() {
  drag.isDragging = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

const normalizedButtons = computed(() =>
  props.buttons && props.buttons.length
    ? props.buttons
    : [{ label: 'OK', value: 'ok' }]
)

const toastStyle = computed(() => ({
  top: `calc(${props.top} + ${drag.offsetY}px)`,
  left: `calc(${props.left} + ${drag.offsetX}px)`,
  width: props.width,
  zIndex: zIndex.value,
}))
</script>

<style scoped>
.win-toast {
  position: fixed;
  box-sizing: border-box;
  background: #000000;
  border: 3px solid #ffffff;
  box-shadow: 6px 6px 0 rgba(255, 255, 255, 0.18);
  color: #ffffff;
  font-family: var(--font-pixel);
  /* 经典 Windows 弹出动效 */
  animation: winToastPop 240ms cubic-bezier(0.18, 0.89, 0.32, 1.28);
  pointer-events: auto;
}

/* ---- 标题栏（拖动手柄）---- */
.win-toast__titlebar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  cursor: move;
  user-select: none;
  border-bottom: 2px solid #ffffff;
}

.win-toast__icon {
  font-size: clamp(16px, 1.5vw, 20px);
  flex-shrink: 0;
}

.win-toast__title {
  font-size: clamp(15px, 1.4vw, 19px);
  font-weight: bold;
  margin: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.win-toast__controls {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.win-toast__close {
  background: transparent;
  border: none;
  color: #ffffff;
  font-size: clamp(14px, 1.3vw, 18px);
  cursor: pointer;
  padding: 2px 6px;
  line-height: 1;
}

.win-toast__close:hover {
  color: #808080;
}

/* ---- 正文区 ---- */
.win-toast__body {
  padding: 14px 18px;
  user-select: text;
  -webkit-user-select: text;
}

.win-toast__message {
  font-size: clamp(13px, 1.3vw, 17px);
  line-height: 1.65;
  margin: 0 0 8px;
}

.win-toast__desc {
  font-size: clamp(12px, 1.2vw, 15px);
  line-height: 1.6;
  margin: 0;
  color: #cccccc;
}

/* ---- 按钮行 ---- */
.win-toast__actions {
  display: flex;
  gap: 12px;
  padding: 10px 18px 14px;
  justify-content: flex-end;
}

.win-toast__btn {
  background: #000000;
  color: #ffffff;
  border: 3px solid #ffffff;
  border-radius: 0;
  padding: 8px 22px;
  font-family: var(--font-pixel);
  font-size: clamp(13px, 1.3vw, 17px);
  font-weight: bold;
  cursor: pointer;
  text-transform: uppercase;
  min-width: 88px;
}

.win-toast__btn:hover {
  background: #ffffff;
  color: #000000;
}

@keyframes winToastPop {
  0% {
    opacity: 0;
    transform: translateY(-18px) scale(0.96);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
