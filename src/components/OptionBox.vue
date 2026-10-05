<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="option-box"
      :style="{ zIndex }"
    >
      <p v-if="content" class="option-box__content" v-html="content"></p>
      <div class="option-box__row" :class="{ 'option-box__row--split': isPair }">
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
      <div v-if="$slots.aside" class="option-box__aside">
        <slot name="aside" />
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { Z } from '@/stores/windowZ.js'

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
  // 选项上方的提示文案（支持 <br> / <span style>，组件内 v-html）。不传则不渲染。
  content: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['update:modelValue', 'select'])

const zIndex = Z.BANNER
// 均分只对两项成立；三项以上的排法另定
const isPair = computed(() => props.options.length === 2)
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
  /* refactor: 高度受内容影响，长选项换行撑高时不会被裁，短选项由 min-height 向后兼容 */
  min-height: clamp(220px, 28vh, 320px);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 24px;
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

.option-box__content {
  margin: 0;
  color: #ffffff;
  font-family: var(--font-pixel);
  font-size: clamp(20px, 2vw, 34px);
  line-height: 1.3;
  text-align: center;
}

.option-box__row {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 32px;
  width: 100%;
}

.option-box__item {
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

/* refactor: 宽度受内容影响，2 个选项的布局为五五开 */
.option-box__row--split .option-box__item {
  flex: 1;
}

.option-box__item.active {
  color: #ffffff;
}

.option-box__prefix {
  /* # 不参与正文的换行计算 */
  flex: 0 0 1ch;
  min-width: 0;
  text-align: center;
  font-weight: bold;
}

.option-box__label {
  letter-spacing: 2px;
}

.option-box__aside {
  position: absolute;
  right: 36px;
  bottom: 0px;
}
</style>
