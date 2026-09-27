<template>
  <PixelWindow
    ref="detailRef"
    class="dp-detail-window"
    :show-title-bar="false"
    :controls="{ minimize: false, maximize: false, close: false }"
    :bring-to-front-on-click="false"
    :top-most="true"
    :click-outside-to-close="true"
    :width="'94%'"
    :height="'68vh'"
    :top="vertical === 'above' ? '24px' : ''"
    :top-anchor="vertical === 'above'"
    :bottom="vertical === 'below' ? '24px' : ''"
    @close="$emit('close')"
  >
    <div class="dp-detail-body">
      <div class="dp-detail-header">
        <h2 class="dp-detail-title">{{ item.title }}</h2>
        <time class="dp-detail-date">{{ item.date }}</time>
      </div>

      <div class="dp-detail-columns">
        <div class="dp-detail-left">
          <!-- 预览区内容完全由外部提供：各条目自己的视图（DPPreview.vue 按名字挑一块） -->
          <div class="dp-preview-frame">
            <slot name="preview"></slot>
          </div>
        </div>

        <div class="dp-detail-right">
          <div class="dp-detail-text" v-html="item.content"></div>

          <div class="dp-detail-actions">
            <button
              v-for="btn in buttons"
              :key="btn.id"
              class="dp-detail-btn"
              :class="{ 'dp-detail-btn--active': stateOf(btn).active }"
              v-on="listenersFor(btn)"
            >
              <span>{{ labelOf(btn) }}</span>
              <span v-if="btn.tooltip" class="dp-help-icon" @click.stop>
                <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
                  <circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" stroke-width="2" />
                  <text x="10" y="15" text-anchor="middle" fill="currentColor" font-size="12">?</text>
                </svg>
              </span>
            </button>
            <span class="dp-help-tooltip" :class="{ 'is-visible': tooltipText }">{{ tooltipText }}</span>
          </div>
        </div>
      </div>
    </div>
  </PixelWindow>
</template>

<script setup>
import { computed } from 'vue'
import PixelWindow from './PixelWindow.vue'

const props = defineProps({
  item: {
    type: Object,
    required: true,
  },
  vertical: {
    type: String,
    default: 'above',
  },
  overrides: {
    type: Object,
    default: () => ({}),
  },
  tooltipText: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['close', 'action'])

const buttons = computed(() => props.item?.buttons || [])

// 按钮的运行时状态由父级通过 overrides 覆盖，这里只做合并
function stateOf(btn) {
  return props.overrides[btn.id] || {}
}

function labelOf(btn) {
  const state = stateOf(btn)
  if (state.label) return state.label
  return state.active && btn.activeLabel ? btn.activeLabel : btn.label
}

// on 字段把事件名映射到函数名：每个事件统一发出 action，由父级按名字查表执行
function listenersFor(btn) {
  const listeners = {}
  for (const [event, name] of Object.entries(btn.on || {})) {
    listeners[event] = () => emit('action', { button: btn, action: name })
  }
  return listeners
}

</script>

<style scoped>
.dp-detail-window {
  max-width: none;
}

.dp-detail-window :deep(.pixel-window__content) {
  padding: 20px 24px;
  overflow: hidden;
}

.dp-detail-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  height: 100%;
  overflow-x: hidden;
}

.dp-detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-shrink: 0;
}

.dp-detail-title {
  font-size: clamp(24px, 2.6vw, 40px);
  font-weight: bold;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.dp-detail-date {
  font-size: clamp(18px, 1.8vw, 28px);
  color: #ffffff;
  white-space: nowrap;
}

.dp-detail-columns {
  display: flex;
  gap: 24px;
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
}

.dp-detail-left {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.dp-preview-frame {
  display: flex;
  justify-content: center;
  align-items: center;
  border: 2px solid #ffffff;
  background: #000000;
  overflow: hidden;
  flex: 1;
  min-height: 0;
  position: relative;
}

.dp-detail-right {
  flex: 1.1;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  overflow-x: hidden;
}

.dp-detail-text {
  flex: 1;
  font-size: clamp(14px, 1.2vw, 18px);
  line-height: 1.7;
  overflow-y: auto;
  overflow-x: hidden;
  word-break: break-word;
  min-height: 0;
  user-select: text;
  -webkit-user-select: text;
  cursor: text;
}

.dp-detail-text :deep(p) {
  margin: 0 0 12px;
}

.dp-detail-text :deep(p:last-child) {
  margin-bottom: 0;
}

.dp-detail-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  flex-shrink: 0;
  overflow-x: hidden;
  position: relative;
}

.dp-detail-btn {
  width: 180px;
  height: 46px;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  background: #000000;
  color: #ffffff;
  border: 3px solid #ffffff;
  border-radius: 0;
  padding: 0 20px;
  font-family: var(--font-pixel);
  font-size: clamp(14px, 1.3vw, 20px);
  font-weight: bold;
  cursor: pointer;
  gap: 8px;
  text-transform: uppercase;
  transition: background 0.15s ease, color 0.15s ease;
}

.dp-detail-btn:hover {
  background: #ffffff;
  color: #000000;
}

.dp-detail-btn--active {
  background: #ffffff;
  color: #000000;
}

.dp-detail-btn--active .dp-help-icon {
  color: #000000;
}

.dp-help-icon {
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: help;
  flex-shrink: 0;
  position: relative;
  color: #ffffff;
  transition: color 0.15s ease;
}

.dp-detail-btn:hover .dp-help-icon {
  color: #000000;
}

.dp-help-icon svg {
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
}

.dp-help-tooltip {
  flex: 0 1 auto;
  align-self: center;
  margin-left: 16px;
  padding: 5px 10px;
  width: max-content;
  max-width: 100%;
  box-sizing: border-box;
  background: #000000;
  color: #ffffff;
  border: 2px solid #ffffff;
  border-radius: 6px;
  font-family: var(--font-pixel);
  font-size: clamp(12px, 1.1vw, 16px);
  line-height: 1.6;
  letter-spacing: 0.5px;
  text-transform: none;
  white-space: normal;
  z-index: 20;
  /* 右侧微微滑入 + 淡入 */
  opacity: 0;
  transform: translateX(-8px);
  visibility: hidden;
  transition: opacity 0.2s ease, transform 0.2s ease, visibility 0.2s ease;
}

.dp-help-tooltip::before {
  content: '';
  position: absolute;
  right: 100%;
  top: 50%;
  transform: translateY(-50%);
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 6px 8px 6px 0;
  border-color: transparent #ffffff transparent transparent;
}

.dp-help-tooltip.is-visible {
  opacity: 1;
  transform: translateX(0);
  visibility: visible;
}

@media (max-width: 860px) {
  .dp-detail-columns {
    flex-direction: column;
    gap: 18px;
    overflow: auto;
  }

  .dp-detail-left,
  .dp-detail-right {
    flex: none;
  }
}
</style>
