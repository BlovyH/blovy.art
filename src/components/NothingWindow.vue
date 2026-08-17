<template>
  <PixelWindow
    class="nothing-window"
    title="NOTHING"
    :centered="true"
    :top="'35%'"
    width="60%"
    height="auto"
    :top-most="true"
    :click-outside-to-close="true"
    @close="$emit('close')"
  >
    <div class="nothing-body">
      <div class="nothing-search">
        <input
          v-model="query"
          class="nothing-input"
          type="text"
          placeholder="type to search..."
          @keydown.enter.prevent
        />
      </div>
      <div v-if="query.length > 0" class="nothing-results">
        <div v-if="isLoading" class="nothing-loading">
          Searching<span class="nothing-dots">...</span>
        </div>
        <div v-else class="nothing-result-row">
          <span class="nothing-icon">✕</span>
          <span class="nothing-text">Sorry, we found nothing！</span>
        </div>
      </div>
      <div v-else class="nothing-results nothing-empty">
        <span class="nothing-hint">type something to begin the search</span>
      </div>
    </div>
  </PixelWindow>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import PixelWindow from './PixelWindow.vue'

const query = ref('')
const isLoading = ref(false)
let loadingTimer = null

watch(query, (val) => {
  if (val.length === 0) {
    isLoading.value = false
    clearTimeout(loadingTimer)
    return
  }
  isLoading.value = true
  clearTimeout(loadingTimer)
  loadingTimer = setTimeout(() => {
    isLoading.value = false
  }, 400)
})

onBeforeUnmount(() => {
  clearTimeout(loadingTimer)
})

defineEmits(['close'])
</script>

<style scoped>
.nothing-window {
  max-width: 900px;
}

.nothing-window :deep(.pixel-window__content) {
  padding: 24px;
}

.nothing-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.nothing-search {
  display: flex;
  align-items: center;
  gap: 10px;
}

.nothing-input {
  flex: 1;
  background: #000000;
  color: #ffffff;
  border: 2px solid #808080;
  border-radius: 0;
  padding: 12px 14px;
  font-family: var(--font-pixel);
  font-size: clamp(14px, 1.3vw, 20px);
}

.nothing-input:focus {
  outline: none;
  border-color: #ffffff;
}

.nothing-results {
  min-height: 220px;
  border: 2px solid #808080;
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nothing-result-row {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #808080;
  font-size: clamp(16px, 1.5vw, 24px);
}

.nothing-icon {
  font-size: clamp(20px, 1.8vw, 28px);
}

.nothing-loading {
  color: #808080;
  font-size: clamp(16px, 1.5vw, 24px);
}

.nothing-dots {
  display: inline-block;
  width: 1.2em;
  text-align: left;
  animation: blink 1s steps(1, end) infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.nothing-empty {
  color: #555555;
}

.nothing-hint {
  font-size: clamp(14px, 1.3vw, 20px);
}
</style>
