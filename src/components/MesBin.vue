<template>
  <!-- mesbin：更新提示和 iy 的 callback 按钮各有一份，抽出来共用。
       位置 / 贴图 / 高亮与吞掉的演出都在这一层，调用方只给状态和时长 -->
  <Teleport to="body">
    <div
      ref="binEl"
      class="mes-bin"
      :class="{ 'is-visible': visible, 'is-hot': hot, 'is-swallowed': swallowed }"
      :style="{ '--mb-swallow-ms': swallowMs + 'ms', zIndex: z }"
    >
      <img class="mes-bin__img" :src="MESBIN_ART[0]" alt="" draggable="false" />
      <!-- 两张叠着放，避免拖到上面时才开始下载 open 图闪一下 -->
      <img class="mes-bin__img mes-bin__img--open" :src="MESBIN_ART[1]" alt="" draggable="false" />
      <span class="mes-bin__label">DISMISS</span>
    </div>
  </Teleport>
</template>

<script>
// 贴图路径只留这一处：预载名单也从这里取，免得换图时只改了一半
export const MESBIN_ART = ['/assets/mesbin.png', '/assets/mesbin_open.png']
</script>

<script setup>
import { ref } from 'vue'
import { Z } from '@/stores/windowZ.js'

defineProps({
  visible: { type: Boolean, default: false },
  hot: { type: Boolean, default: false },
  swallowed: { type: Boolean, default: false },
  // 吞掉的动画时长：调用方收尾的计时器跟它是同一个数，所以由调用方传进来
  swallowMs: { type: Number, default: 460 },
  // 各调用方压在不同的层上，层级表在 windowZ.js
  z: { type: Number, default: Z.UPDATE },
})

const binEl = ref(null)

// 命中判定归 mesbin 自己：松手时鼠标常常正好在边外一点，不留余量会「看着扔进去了却没中」
const DROP_PAD = 12

function over(x, y) {
  const el = binEl.value
  if (!el) return false
  const r = el.getBoundingClientRect()
  return (
    x >= r.left - DROP_PAD &&
    x <= r.right + DROP_PAD &&
    y >= r.top - DROP_PAD &&
    y <= r.bottom + DROP_PAD
  )
}

defineExpose({ over })
</script>

<style scoped>
.mes-bin {
  --mes-bin-red: #e24b4a;
  position: fixed;
  left: 50%;
  bottom: 40px;
  width: 88px;
  height: 88px;
  display: grid;
  translate: -50% 0;
  transform: translateY(12px);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition:
    opacity 160ms ease,
    transform 160ms ease,
    scale 160ms ease;
  image-rendering: pixelated;
}

.mes-bin.is-visible {
  opacity: 1;
  visibility: visible;
  transform: none;
}

.mes-bin.is-hot {
  scale: 1.15;
}

.mes-bin__img {
  grid-area: 1 / 1;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
}

.mes-bin__img--open {
  opacity: 0;
  transition: opacity 120ms ease;
}

.mes-bin.is-hot .mes-bin__img--open {
  opacity: 1;
}

.mes-bin__label {
  position: absolute;
  top: 100%;
  left: 50%;
  translate: -50% 0;
  margin-top: 6px;
  font-size: clamp(12px, 1vw, 14px);
  color: var(--mes-bin-red);
  opacity: 0;
  transition: opacity 160ms ease;
}

.mes-bin.is-hot .mes-bin__label {
  opacity: 1;
}

.mes-bin.is-swallowed {
  animation: mes-bin-swallow var(--mb-swallow-ms) ease-out forwards;
}

@keyframes mes-bin-swallow {
  to {
    scale: 0.3;
    opacity: 0;
  }
}
</style>
