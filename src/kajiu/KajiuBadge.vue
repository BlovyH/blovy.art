<template>
  <button
    type="button"
    class="kajiu-badge"
    @mousedown.stop
    @mousemove.stop
    @click.stop="openOptions"
  >
    <img class="kajiu-badge__logo" src="/assets/kajiu_logo.png" alt="" draggable="false" />
    <span class="kajiu-badge__sign">OPENING</span>
  </button>
</template>

<script setup>
import { useDialogFlow } from '@/dialogs/useDialogFlow.js'

const dlg = useDialogFlow()

function openOptions() {
  dlg.start('kajiu')
}
</script>

<style scoped>
.kajiu-badge {
  --kajiu-right: 10%;
  --kajiu-lift: 8px;
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
  height: 64px;
  image-rendering: pixelated;
}

.kajiu-badge__sign {
  translate: 0 0;
  color: #00ffff;
  font-size: 30px;
  letter-spacing: 1px;
  white-space: nowrap;
  text-shadow: 0 0 4px #00ffff, 0 0 10px #00ffff, 0 0 20px rgba(0, 255, 255, 0.55);
  animation: kajiu-wobble 1.6s ease-in-out infinite;
}

@keyframes kajiu-wobble {
  0%, 100% { translate: 0 0; }
  25% { translate: 3px -2px; }
  50% { translate: -2px 3px; }
  75% { translate: -3px -2px; }
}
</style>
