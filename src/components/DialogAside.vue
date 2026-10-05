<script setup>
// 对话框右下角附加位的内容：一张图，或几行吐槽小字。
// 形状由 flows.js 的步给出（aside.image / aside.text），这里只负责渲染，不含编排。
const props = defineProps({
  aside: {
    type: Object,
    required: true,
  },
})
</script>

<template>
  <img v-if="props.aside.image" class="dialog-aside__image" :src="props.aside.image" alt="" />
  <div v-else-if="props.aside.text" class="dialog-aside__text">
    <p v-for="(line, i) in props.aside.text" :key="i" v-html="line"></p>
  </div>
</template>

<style scoped>
.dialog-aside__image {
  display: block;
  image-rendering: pixelated;
  width: 120px;
  height: auto;
}

.dialog-aside__text {
  /* 跟着主文本的字号缩放，不另设断点 */
  font-size: 0.6em;
}

.dialog-aside__text p {
  margin: 0;
}
</style>
