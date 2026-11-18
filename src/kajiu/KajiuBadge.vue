<template>
  <button
    type="button"
    class="kajiu-badge"
    :class="{
      'is-closed': !isKajiuOpen && !isKajiuBreak,
      'is-break': isKajiuBreak,
      'is-coffee': isKajiuOpen && !isKajiuBar,
    }"
    @mousedown.stop
    @mousemove.stop
    @click.stop="openOptions"
  >
    <img class="kajiu-badge__logo" src="/assets/kajiu_logo.png" alt="" draggable="false" />
    <span class="kajiu-badge__sign">{{ signText }}</span>
  </button>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useDialogFlow } from '@/dialogs/useDialogFlow.js'
import {
  isKajiuBar,
  isKajiuBreak,
  isKajiuOpen,
  kajiuWindowOpen,
  unwatchKajiuHours,
  watchKajiuHours,
} from './kajiuHours.js'

const dlg = useDialogFlow()
const emit = defineEmits(['focus'])

onMounted(watchKajiuHours)
onBeforeUnmount(unwatchKajiuHours)

const signText = computed(() => {
  if (isKajiuBreak.value) return 'BREAK'
  return isKajiuOpen.value ? 'OPENING' : 'CLOSED'
})

function openOptions() {
  // 原 kajiu 对话暂不挂载，flow 保留在 flows.js
  // dlg.start('kajiu')
  if (isKajiuBreak.value) {
    dlg.start('kajiuBreak')
    return
  }
  if (!isKajiuOpen.value) {
    dlg.start('kajiuClosed')
    return
  }
  kajiuWindowOpen.value = true
  // 点击 badge 也 bring 窗口 to the front
  emit('focus')
}
</script>

<style scoped>
.kajiu-badge {
  --kajiu-right: 10%;
  --kajiu-lift: clamp(4px, 1vh, 8px);
  position: absolute;
  bottom: 100%;
  right: var(--kajiu-right);
  margin-bottom: var(--kajiu-lift);
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  cursor: pointer;
}

.kajiu-badge__logo {
  display: block;
  width: auto;
  height: clamp(40px, 6vh, 64px);
  image-rendering: pixelated;
}

.kajiu-badge__sign {
  translate: 0 0;
  color: var(--kajiu-sign, #00ffff);
  font-size: clamp(18px, 2.8vh, 30px);
  letter-spacing: 1px;
  white-space: nowrap;
  text-shadow: 0 0 4px currentColor, 0 0 10px currentColor, 0 0 20px color-mix(in srgb, currentColor 55%, transparent);
  animation: kajiu-wobble 1.6s ease-in-out infinite;
}

.kajiu-badge.is-coffee {
  --kajiu-sign: #ffd447;
}

.kajiu-badge.is-closed .kajiu-badge__sign {
  color: #808080;
  text-shadow: none;
  animation: none;
}

.kajiu-badge.is-break .kajiu-badge__sign {
  color: #ffffff;
  text-shadow: none;
  animation: none;
}

@keyframes kajiu-wobble {
  0%, 100% { translate: 0 0; }
  25% { translate: 3px -2px; }
  50% { translate: -2px 3px; }
  75% { translate: -3px -2px; }
}
</style>
