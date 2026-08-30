<template>
  <div
    ref="iconRef"
    class="desktop-icon drag-top"
    :style="iconStyle"
    v-draggable="onIconClick"
  >
    <div class="desktop-icon__visual">
      <slot name="icon" />
    </div>
    <div class="desktop-icon__label">
      <slot name="label" />
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  initialLeft: {
    type: String,
    default: '0',
  },
  initialTop: {
    type: String,
    default: '0',
  },
})

const emit = defineEmits(['click'])

const iconRef = ref(null)

const iconStyle = computed(() => ({
  position: 'absolute',
  left: props.initialLeft,
  top: props.initialTop,
}))

function onIconClick() {
  emit('click')
}
</script>

<style scoped>
.desktop-icon {
  position: absolute;
  width: 84px;
  height: 84px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 4px;
  box-sizing: border-box;
  cursor: pointer;
  /* drag offset comes from v-draggable (CSS vars) */
  transform: translate(var(--ddx, 0px), var(--ddy, 0px));
}

.desktop-icon.is-dragging {
  background: rgba(255, 255, 255, 0.35);
  border-radius: 8px;
  cursor: move;
}

.desktop-icon__visual {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.desktop-icon__label {
  color: #808080;
  font-size: clamp(12px, 1.1vw, 18px);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  text-align: center;
  line-height: 1.2;
  max-width: 100%;
  overflow-wrap: break-word;
}
</style>
