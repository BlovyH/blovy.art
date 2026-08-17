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
      <div class="detail-header">
        <h2 class="detail-title">{{ item.title }}</h2>
        <time class="detail-date">{{ item.date }}</time>
      </div>

      <div class="detail-columns">
        <div class="detail-image-wrap">
          <img
            class="detail-image"
            :src="item.src"
            :alt="item.alt || item.title"
          />
        </div>

        <div class="detail-info">
          <p class="detail-desc">{{ item.detail }}</p>

          <div class="detail-tags">
            <span
              v-for="tag in parsedTags"
              :key="tag"
              class="detail-tag"
            >{{ tag }}</span>
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
import { computed } from 'vue'
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

defineEmits(['close', 'prev', 'next', 'random', 'download'])

const parsedTags = computed(() => {
  if (!props.item.tags) return []
  return props.item.tags.split(/\s+/).filter(Boolean)
})
</script>

<style scoped>
.image-detail-window {
  max-width: 1020px;
  min-width: 320px;
}

.image-detail-window :deep(.pixel-window__content) {
  padding: 28px 32px;
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
}

.detail-title {
  font-size: clamp(28px, 3vw, 44px);
  font-weight: bold;
  margin: 0;
  text-transform: uppercase;
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
}

.detail-info {
  flex: 1.3;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.detail-desc {
  font-size: clamp(16px, 1.5vw, 22px);
  line-height: 1.7;
  color: #00ffff;
  margin: 0;
}

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.detail-tag {
  font-size: clamp(14px, 1.2vw, 18px);
  color: #808080;
}

.detail-actions {
  display: flex;
  gap: 12px;
  margin-top: auto;
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
</style>
