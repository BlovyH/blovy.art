<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="option-box"
      :style="{ zIndex }"
    >
      <button
        v-for="(option, index) in options"
        :key="option.value"
        class="option-box__item"
        :class="{ active: index === selectedIndex }"
        @click="select(index)"
        @mouseenter="hover(index)"
      >
        <span class="option-box__prefix">{{ index === selectedIndex ? '#' : ' ' }}</span>
        <span class="option-box__label">{{ option.label }}</span>
      </button>
    </div>
  </Teleport>
</template>

<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  options: {
    type: Array,
    default: () => [
      { label: 'YES', value: 'yes' },
      { label: 'NO', value: 'no' },
    ],
  },
  modelValue: {
    type: Number,
    default: 0,
  },
})

const emit = defineEmits(['update:modelValue', 'select'])

const zIndex = 10001
const selectedIndex = ref(props.modelValue)

watch(() => props.modelValue, (val) => {
  selectedIndex.value = val
})

watch(selectedIndex, (val) => {
  emit('update:modelValue', val)
})

function hover(index) {
  selectedIndex.value = index
}

function select(index) {
  selectedIndex.value = index
  emit('select', props.options[index].value, index)
}

function onKeydown(e) {
  if (!props.visible) return
  if (e.key === 'ArrowLeft') {
    e.preventDefault()
    selectedIndex.value = (selectedIndex.value - 1 + props.options.length) % props.options.length
  } else if (e.key === 'ArrowRight') {
    e.preventDefault()
    selectedIndex.value = (selectedIndex.value + 1) % props.options.length
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    emit('select', props.options[selectedIndex.value].value, selectedIndex.value)
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.option-box {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  width: calc(100% - 48px);
  max-width: 1400px;
  height: clamp(220px, 28vh, 320px);
  box-sizing: border-box;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 32px;
  background: #000000;
  border: 6px solid transparent;
  border-image-source: url('/assets/window_frame.png');
  border-image-slice: 6;
  border-image-width: 6px;
  border-image-repeat: round;
  border-radius: 8px;
  overflow: hidden;
  padding: 28px 36px;
}

.option-box__item {
  flex: 1;
  max-width: 320px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  background: transparent;
  border: none;
  border-radius: 0;
  padding: 18px 32px;
  color: #808080;
  font-family: var(--font-pixel);
  font-size: clamp(22px, 2.2vw, 38px);
  cursor: pointer;
  transition: color 0.15s;
}

.option-box__item.active {
  color: #ffffff;
}

.option-box__prefix {
  font-weight: bold;
}

.option-box__label {
  text-transform: uppercase;
  letter-spacing: 2px;
}
</style>
