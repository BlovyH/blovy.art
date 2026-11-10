<template>
  <Teleport to="body">
    <div class="sorry-blackout" :style="{ '--sorry-ms': BLACKOUT_MS + 'ms' }">
      <span>Sorry...</span>
    </div>
  </Teleport>
</template>

<script setup>
import { onMounted } from 'vue'

const BLACKOUT_MS = 1500

onMounted(() => {
  setTimeout(() => window.location.reload(), BLACKOUT_MS)
})
</script>

<style scoped>
.sorry-blackout {
  position: fixed;
  inset: 0;
  z-index: var(--z-blackout);
  display: grid;
  place-items: center;
  background: #000;
}

.sorry-blackout span {
  color: #fff;
  font-size: 20px;
  font-style: italic;
  opacity: 0;
  animation:
    sorry-flash var(--sorry-ms) linear forwards,
    sorry-glitch var(--sorry-ms) steps(1, end) forwards;
}

@keyframes sorry-flash {
  0% { opacity: 0; }
  12% { opacity: 0.9; }
  100% { opacity: 0.9; }
}

@keyframes sorry-glitch {
  0%, 88% { transform: none; text-shadow: 0 0 transparent; }
  91%, 100% { transform: translateX(5px) skewX(-22deg); text-shadow: -2px 0 #ac3535; filter: blur(0.6px); }
}
</style>
