<template>
  <PixelWindow
    ref="detailRef"
    class="image-detail-window"
    :show-title-bar="false"
    :controls="{ minimize: false, maximize: false, close: false }"
    :bring-to-front-on-click="false"
    :top-most="true"
    :click-outside-to-close="true"
    :right="side === 'right' ? '24px' : ''"
    :left="side === 'left' ? '24px' : ''"
    :width="'66%'"
    :height="'86vh'"
    @close="$emit('close')"
  >
    <div class="detail-body">
      <div class="detail-header" @mousedown="onHeaderDown">
        <h2 class="detail-title">{{ item.title }}</h2>
        <time class="detail-date">{{ item.date }}</time>
      </div>

      <div class="detail-columns">
        <div class="detail-image-wrap">
          <img
            class="detail-image"
            draggable="false"
            :src="item.preview || item.highResSrc || item.thumb"
            :alt="item.alt || item.title"
          />
        </div>

        <div class="detail-info">
          <div class="detail-scroll">
            <p class="detail-desc" v-html="item.detail"></p>

            <div class="detail-tags">
              <span
                v-for="tag in parsedTags"
                :key="tag"
                class="detail-tag"
              >{{ tag }}</span>
            </div>
          </div>

          <div class="detail-actions">
            <button
              class="detail-btn"
              @click="$emit('download')"
            >
              HIGH-RES
            </button>
            <button
              class="detail-btn"
              @click="$emit('random')"
            >
              TO RANDOM
            </button>
          </div>

          <div class="detail-pagination">
            <button
              class="page-arrow"
              aria-label="previous"
              @click="$emit('prev')"
            >
              ◀
            </button>
            <span class="page-indicator">{{ currentIndex + 1 }} / {{ total }}</span>
            <button
              class="page-arrow"
              aria-label="next"
              @click="$emit('next')"
            >
              ▶
            </button>
          </div>
        </div>
      </div>
    </div>
  </PixelWindow>
</template>

<script setup>
import { computed, ref } from 'vue'
import PixelWindow from './PixelWindow.vue'

const props = defineProps({
  item: {
    type: Object,
    required: true,
  },
  currentIndex: {
    type: Number,
    default: 0,
  },
  total: {
    type: Number,
    default: 1,
  },
  side: {
    type: String,
    default: 'right',
  },
})

const emit = defineEmits(['close', 'prev', 'next', 'random', 'download'])

const detailRef = ref(null)

// 标题栏仅用于拖动窗口（关闭统一由 PixelWindow 的 click-outside-to-close 处理，不在此处关）
function onHeaderDown(e) {
  if (e.button !== 0) return
  detailRef.value?.startDrag(e)
}

const parsedTags = computed(() => {
  const t = props.item?.tags
  if (!t) return []
  const arr = Array.isArray(t) ? t : String(t).split(/\s+/).filter(Boolean)
  return arr.map((x) => `#${String(x).replace(/^#/, '')}`)
})
</script>

<style scoped>
.image-detail-window {
  max-width: 1020px;
  min-width: 320px;
}

.image-detail-window :deep(.pixel-window__content) {
  padding: 28px 32px;
  overflow: hidden;
}

.detail-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-shrink: 0;
  cursor: move;
  user-select: none;
}

.detail-title {
  font-size: clamp(28px, 3vw, 44px);
  font-weight: bold;
  margin: 0;
  letter-spacing: 1px;
}

.detail-date {
  font-size: clamp(20px, 2vw, 30px);
  color: #ffffff;
  white-space: nowrap;
}

.detail-columns {
  display: flex;
  gap: 20px;
  flex: 1;
  min-height: 0;
}

.detail-image-wrap {
  flex: 1.2;
  display: flex;
  justify-content: center;
  align-items: center;
  border: 2px solid #ffffff;
  background: #111;
  overflow: hidden;
  min-width: 0;
}

.detail-image {
  width: 100%;
  height: 100%;
  max-height: 72vh;
  object-fit: contain;
  image-rendering: pixelated;
  -webkit-user-drag: none;
  user-drag: none;
  user-select: none;
}

.detail-info {
  flex: 1.3;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

/* 仅描述 + 标签这一块独立滚动，左图与按钮/分页保持固定 */
.detail-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

.detail-desc {
  font-size: clamp(16px, 1.5vw, 22px);
  line-height: 1.7;
  color: #ffffff;
  margin: 0;
  user-select: text;
  -webkit-user-select: text;
  cursor: text;
}

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 12px;
}

.detail-tag {
  font-size: clamp(14px, 1.2vw, 18px);
  color: #808080;
}

.detail-actions {
  display: flex;
  gap: 12px;
  flex-shrink: 0;
}

.detail-btn {
  flex: 1 1 0;
  min-width: 120px;
  background: #000000;
  color: #ffffff;
  border: 3px solid #ffffff;
  border-radius: 0;
  padding: 12px 16px;
  font-family: var(--font-pixel);
  font-size: clamp(14px, 1.4vw, 20px);
  font-weight: bold;
  cursor: pointer;
  text-transform: uppercase;
}

.detail-btn:hover {
  background: #ffffff;
  color: #000000;
}

.detail-pagination {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
  flex-shrink: 0;
}

.page-arrow {
  background: transparent;
  border: none;
  color: #ffffff;
  font-family: var(--font-pixel);
  font-size: clamp(16px, 1.5vw, 22px);
  cursor: pointer;
  padding: 4px 8px;
}

.page-arrow:hover {
  color: #00ffff;
}

.page-indicator {
  font-size: clamp(16px, 1.5vw, 22px);
  min-width: 90px;
  text-align: center;
}

/* 与 FP 详情一致：宽度不足时不再左右分栏，改为上下流式
   （图在上、描述/标签/按钮在下，文字仍只在其自身区域滚动） */
@media (max-width: 860px) {
  .detail-columns {
    flex-direction: column;
    gap: 16px;
  }

  .detail-image-wrap {
    flex: none;
    width: 100%;
    height: 38vh;
    max-height: 38vh;
  }

  .detail-info {
    flex: 1;
    min-height: 0;
  }
}
</style>
