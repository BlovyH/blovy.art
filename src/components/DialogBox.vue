<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="dialog-box"
      :style="{ zIndex }"
      @click="onClick"
    >
      <div class="dialog-box__content">
        <span class="dialog-box__prompt">&gt;&gt;</span>
        <span class="dialog-box__text" v-html="content"></span>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { onMounted, onUnmounted, watch } from 'vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  content: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['click'])

const zIndex = 10000

function onClick() {
  emit('click')
}

function onKeydown(e) {
  if (!props.visible) return
  if (e.key === 'Enter') {
    e.preventDefault()
    emit('click')
  }
}

function bind() {
  window.addEventListener('keydown', onKeydown)
}

function unbind() {
  window.removeEventListener('keydown', onKeydown)
}

watch(() => props.visible, (visible) => {
  if (visible) {
    bind()
  } else {
    unbind()
  }
})

onMounted(() => {
  if (props.visible) bind()
})

onUnmounted(() => {
  unbind()
})
</script>

<style scoped>
.dialog-box {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  width: calc(100% - 48px);
  max-width: 1400px;
  height: clamp(220px, 28vh, 320px);
  box-sizing: border-box;
  display: flex;
  align-items: flex-start;
  background: #000000;
  border: 6px solid transparent;
  border-image-source: url('/assets/window_frame.png');
  border-image-slice: 6;
  border-image-width: 6px;
  border-image-repeat: round;
  border-radius: 8px;
  padding: 28px 36px;
  color: #ffffff;
  font-family: var(--font-pixel);
  font-size: clamp(18px, 1.8vw, 30px);
  line-height: 1.7;
  cursor: default;
  user-select: none;
  overflow: hidden;
}

.dialog-box__content {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  width: 100%;
  overflow: hidden;
}

.dialog-box__prompt {
  color: #ffffff;
  font-weight: bold;
  flex-shrink: 0;
}

.dialog-box__text {
  color: #ffffff;
  overflow-wrap: break-word;
}

.dialog-box__text :deep(a) {
  color: #00ffff;
  text-decoration: underline;
}

.dialog-box__text :deep(a):hover {
  color: #ff69b4;
}
</style>
