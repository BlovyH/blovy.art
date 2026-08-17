<template>
  <Teleport to="body">
    <div class="center-toast-overlay">
      <div class="center-toast">
        <h3 class="center-toast__title">{{ title }}</h3>
        <p class="center-toast__content">{{ message }}</p>
        <button class="center-toast__btn" @click="$emit('close')">Got it</button>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    default: 'Notice',
  },
  message: {
    type: String,
    default: '',
  },
})

defineEmits(['close'])
</script>

<style scoped>
.center-toast-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20000;
  padding: 20px;
}

.center-toast {
  background: #000000;
  border: 3px solid #ffffff;
  border-radius: 8px;
  padding: 24px;
  max-width: 340px;
  width: 100%;
  text-align: center;
  color: #ffffff;
  font-family: var(--font-pixel);
}

.center-toast__title {
  font-size: clamp(18px, 5vw, 22px);
  margin: 0 0 12px;
}

.center-toast__content {
  font-size: clamp(13px, 4vw, 15px);
  line-height: 1.6;
  margin: 0 0 20px;
}

.center-toast__btn {
  flex: 1 1 0;
  min-width: 140px;
  background: #000000;
  color: #ffffff;
  border: 3px solid #ffffff;
  border-radius: 0;
  padding: 16px 20px;
  font-family: var(--font-pixel);
  font-size: clamp(14px, 4vw, 18px);
  font-weight: bold;
  cursor: pointer;
  text-transform: uppercase;
}

.center-toast__btn:hover {
  background: #ffffff;
  color: #000000;
}
</style>
