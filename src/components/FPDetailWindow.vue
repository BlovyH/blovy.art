<template>
  <PixelWindow
    ref="detailRef"
    class="fp-detail-window"
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
    <div class="fp-detail-body">
      <div class="fp-detail-header">
        <h2 class="fp-detail-title">{{ item.title }}</h2>
        <time class="fp-detail-date">{{ item.date }}</time>
      </div>

      <div class="fp-detail-columns">
        <div class="fp-detail-left">
          <div
            class="fp-preview-frame"
            @mouseenter="onPreviewEnter"
            @mouseleave="onPreviewLeave"
          >
            <img
              class="fp-preview-image"
              :src="item.src"
              :alt="item.title"
              @click="toggleFloweryCursoryTextbox"
            />
            <img
              v-if="isFlowery"
              class="flowery-cursory-textbox"
              :class="{ 'is-visible': maskVisible }"
              :src="maskUrl"
              alt="easter egg overlay"
              @click.stop="toggleFloweryCursoryTextbox"
            />
          </div>
        </div>

        <div class="fp-detail-right">
          <div class="fp-detail-text" v-html="item.content"></div>

          <div class="fp-detail-actions">
            <button
              class="fp-detail-btn fp-detail-btn--download"
              @click="$emit('download')"
            >
              DOWNLOAD
            </button>
            <button
              v-if="hasPreview"
              class="fp-detail-btn fp-detail-btn--preview"
              :class="{ 'fp-detail-btn--active': previewActive }"
              @click="togglePreview"
            >
              <span>{{ previewActive ? 'RESET' : 'PREVIEW' }}</span>
              <span class="fp-help-icon" @click.stop>
                <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
                  <circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" stroke-width="2" />
                  <text x="10" y="15" text-anchor="middle" fill="currentColor" font-size="12">?</text>
                </svg>
              </span>
            </button>
            <span class="fp-help-tooltip">{{ item.tooltip }}</span>
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
  vertical: {
    type: String,
    default: 'above',
  },
  previewActive: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close', 'download', 'preview'])

const hasPreview = computed(() => {
  return !!(props.item.previewUrl || (props.item.cursors && Object.keys(props.item.cursors).length))
})

const FLOWERY_MASK_URL = 'https://cdn.blovy.art/fandom-projects/flowery-cursory/textbox.png'

const isFlowery = computed(() => {
  const t = props.item?.title
  return typeof t === 'string' && t.toUpperCase().includes('FLOWERY')
})

const maskUrl = FLOWERY_MASK_URL
const showMask = ref(false)
const hovering = ref(false)

const maskVisible = computed(() => isFlowery.value && (showMask.value || hovering.value))

function onPreviewEnter() {
  if (isFlowery.value) hovering.value = true
}

function onPreviewLeave() {
  if (isFlowery.value) hovering.value = false
}

function toggleFloweryCursoryTextbox() {
  if (!isFlowery.value) return
  showMask.value = !showMask.value
  if (!showMask.value) hovering.value = false
}

function togglePreview() {
  emit('preview', { active: !props.previewActive })
}
</script>

<style scoped>
.fp-detail-window {
  max-width: none;
}

.fp-detail-window :deep(.pixel-window__content) {
  padding: 20px 24px;
  overflow: hidden;
}

.fp-detail-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  height: 100%;
  overflow-x: hidden;
}

.fp-detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-shrink: 0;
}

.fp-detail-title {
  font-size: clamp(24px, 2.6vw, 40px);
  font-weight: bold;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.fp-detail-date {
  font-size: clamp(18px, 1.8vw, 28px);
  color: #ffffff;
  white-space: nowrap;
}

.fp-detail-columns {
  display: flex;
  gap: 24px;
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
}

.fp-detail-left {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.fp-preview-frame {
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

.fp-preview-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
}

.flowery-cursory-textbox {
  position: absolute;
  left: 50%;
  bottom: 12px;
  transform: translateX(-50%);
  width: 70%;
  height: auto;
  object-fit: contain;
  image-rendering: pixelated;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s ease, visibility 0.2s ease;
  z-index: 2;
}

.flowery-cursory-textbox.is-visible {
  opacity: 1;
  visibility: visible;
}

.fp-detail-right {
  flex: 1.1;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  overflow-x: hidden;
}

.fp-detail-text {
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

.fp-detail-text :deep(p) {
  margin: 0 0 12px;
}

.fp-detail-text :deep(p:last-child) {
  margin-bottom: 0;
}

.fp-detail-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  flex-shrink: 0;
  overflow-x: hidden;
  position: relative;
}

.fp-detail-btn {
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
  text-transform: uppercase;
  transition: background 0.15s ease, color 0.15s ease;
}

.fp-detail-btn:hover {
  background: #ffffff;
  color: #000000;
}

.fp-detail-btn--active {
  background: #ffffff;
  color: #000000;
}

.fp-detail-btn--active .fp-help-icon {
  color: #000000;
}

.fp-detail-btn--preview {
  gap: 8px;
  position: relative;
}

.fp-help-icon {
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

.fp-detail-btn--preview:hover .fp-help-icon {
  color: #000000;
}

.fp-help-icon svg {
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
}

.fp-help-tooltip {
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

.fp-help-tooltip::before {
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

.fp-detail-actions:has(.fp-detail-btn--preview:hover) .fp-help-tooltip {
  opacity: 1;
  transform: translateX(0);
  visibility: visible;
}

@media (max-width: 860px) {
  .fp-detail-columns {
    flex-direction: column;
    gap: 18px;
    overflow: auto;
  }

  .fp-detail-left,
  .fp-detail-right {
    flex: none;
  }
}
</style>
