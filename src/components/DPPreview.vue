<template>
  <!-- 各条目的预览区内容：按 JSON 里 item.preview 给的名字挑一块渲染，
       未命中的分支不会创建 DOM。新增条目 = 在这里加一块 v-else-if。 -->
  <template v-if="name === 'floweryPreview'">
    <img
      class="dp-preview-image"
      :src="item.src"
      :alt="item.title"
      @click="toggleMask"
      @mouseenter="hovering = true"
      @mouseleave="hovering = false"
    />
    <img
      v-if="item.mask"
      class="flowery-cursory-textbox"
      :class="{ 'is-visible': maskVisible }"
      :src="item.mask"
      alt="easter egg overlay"
    />
  </template>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  // 条目在 content.json 里声明的视图名
  name: {
    type: String,
    default: '',
  },
  item: {
    type: Object,
    required: true,
  },
})

// 遮罩跟着预览图走：hover 时显示，点击钉住，再点收起
const showMask = ref(false)
const hovering = ref(false)

const maskVisible = computed(() => showMask.value || hovering.value)

function toggleMask() {
  showMask.value = !showMask.value
  if (!showMask.value) hovering.value = false
}
</script>

<style scoped>
.dp-preview-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
}

/* 绝对定位相对 .dp-preview-frame（它在 DPDetailWindow 里是 position: relative） */
.flowery-cursory-textbox {
  position: absolute;
  left: 50%;
  bottom: 12px;
  transform: translateX(-50%);
  width: 70%;
  height: auto;
  object-fit: contain;
  image-rendering: pixelated;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s ease, visibility 0.2s ease;
  z-index: 2;
  /* 遮罩压在预览图上会抢走指针：鼠标一进入遮罩，预览图的 mouseleave 就触发
     → 遮罩隐藏 → 指针又回到预览图 → 再显示，来回闪。让它整块不吃指针事件，
     hover 判定只看预览图，点它上面的位置也照常落到预览图的 click 上。 */
  pointer-events: none;
}

.flowery-cursory-textbox.is-visible {
  opacity: 1;
  visibility: visible;
}
</style>
