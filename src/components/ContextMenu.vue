<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="ctx-menu"
      :style="{ left: x + 'px', top: y + 'px', zIndex: Z.MENU }"
    >
      <button
        v-for="item in items"
        :key="item.value"
        class="ctx-menu__item"
        @click="emit('select', item.value)"
      >
        {{ item.label }}
      </button>
    </div>
  </Teleport>
</template>

<script setup>
import { onBeforeUnmount, onMounted } from 'vue'
import { Z } from '@/stores/windowZ.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  items: { type: Array, default: () => [] },
})

const emit = defineEmits(['select', 'close'])

function onDocMouseDown(e) {
  if (!props.visible || e.target.closest('.ctx-menu')) return
  emit('close')
}

function onKeydown(e) {
  if (props.visible && e.key === 'Escape') emit('close')
}

onMounted(() => {
  document.addEventListener('mousedown', onDocMouseDown)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocMouseDown)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.ctx-menu {
  position: fixed;
  min-width: 104px;
  padding: 2px;
  background: #c0c0c0;
  border: 2px solid;
  border-color: #fff #808080 #808080 #fff;
  box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.35);
}

.ctx-menu__item {
  display: block;
  width: 100%;
  padding: 4px 10px;
  border: 0;
  background: transparent;
  font: inherit;
  color: #000;
  text-align: left;
  cursor: pointer;
}

.ctx-menu__item:hover {
  background: #000080;
  color: #fff;
}
</style>
