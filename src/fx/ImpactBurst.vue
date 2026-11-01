<template>
  <div v-if="on" class="fx-burst" :style="{ left: `${x}px`, top: `${y}px` }" aria-hidden="true">
    <span v-for="p in particles" :key="p.id" class="fx-particle" :style="p.style">+</span>
  </div>
</template>

<script setup>
defineProps({
  on: { type: Boolean, default: false },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  particles: { type: Array, default: () => [] },
})
</script>
