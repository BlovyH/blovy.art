<template>
  <!-- 门：主页地面上那扇和后院上墙那扇用的是同一张贴图，区别只在开在哪条边上 -->
  <img
    class="backyard-door"
    :class="{ 'backyard-door--exit': isExit }"
    :data-pointer="isExit ? 'backyard-exit-door' : null"
    src="/assets/door.png"
    alt="door"
    draggable="false"
    @dragstart.prevent
    @click="emit('click')"
  />
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  // 'enter' = 主页地面上那扇（贴视口下边）；'exit' = 后院上墙外侧那扇
  variant: { type: String, default: 'enter' },
})

const emit = defineEmits(['click'])
const isExit = computed(() => props.variant === 'exit')
</script>

<style scoped>
/* 两扇门共用 left，永远在同一条垂直线上 */
.backyard-door {
  position: fixed;
  bottom: 0;
  left: 30%;
  transform: translateX(-50%);
  cursor: pointer;
  image-rendering: pixelated;
  z-index: 0;
}

/* 出口开在上墙外缘：从上面进来就该从上边出去。--backyard-top 由 .backyard-stage 提供 */
.backyard-door--exit {
  top: auto;
  bottom: calc(100vh - var(--backyard-top));
}
</style>
