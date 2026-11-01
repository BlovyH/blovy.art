<template>
  <!-- 外飘箭头 从对话框框外指到某个目标上。
       Teleport 到 body 而不是塞进 DialogBox，因为对话框是 overflow:hidden 的 -->
  <Teleport to="body">
    <svg v-if="path" class="dialog-pointer" :style="{ zIndex }" aria-hidden="true">
      <defs>
        <!-- 箭头头部是阶梯三角（不是一个光滑三角）：像素风里斜边就该是台阶。
             三级台阶，宽度比 1:3:5，每级正好一个线宽（4 个单位）→ 台阶面和线的粗细对齐。
             markerUnits=strokeWidth 让头跟着线粗整体缩放，宽高比由 viewBox 定 -->
        <marker
          id="dialog-pointer-head"
          viewBox="0 0 12 20"
          refX="12"
          refY="10"
          markerWidth="3"
          markerHeight="5"
          markerUnits="strokeWidth"
          orient="auto"
        >
          <polygon
            points="0,0 4,0 4,4 8,4 8,8 12,8 12,12 8,12 8,16 4,16 4,20 0,20"
            fill="#fff"
          />
        </marker>
      </defs>
      <path class="dialog-pointer__line" :d="path" marker-end="url(#dialog-pointer-head)" />
    </svg>
  </Teleport>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Z } from '@/stores/windowZ.js'

const TAIL_INSET = 0.11
const TIP_Y = 0.25
const TIP_GAP = 10
const TAIL_GAP = 6
// 弧的两个量，都相对起终点连线算：
//   BOW  = 控制点向右偏多少（正数向右），决定鼓出去多少
//   RISE = 控制点在垂直方向靠到起点多近（1 = 贴到起点高度），越大起点段越接近垂直上行
const BOW = 0.12
const RISE = 0.75

const props = defineProps({
  visible: { type: Boolean, default: false },
  // 目标元素上的 data-pointer 值，来自 flows.js 的 step.point
  point: { type: String, default: null },
})

const zIndex = Z.OVERLAY
const path = ref(null)

let pending = null

function clearPending() {
  if (!pending) return
  pending.removeEventListener('load', measure)
  pending = null
}

// 随视口变不写死；角度不用算，marker 的 orient="auto" 会沿切线转
function measure() {
  clearPending()
  if (!props.visible || !props.point) {
    path.value = null
    return
  }
  const target = document.querySelector(`[data-pointer="${props.point}"]`)
  const box = document.querySelector('.dialog-box')
  if (!target || !box) {
    path.value = null
    return
  }
  // 注意预载和获取坐标的时机不然会获取到高度为0的时候从而指到下边缘（见下面watch）
  if (target.tagName === 'IMG' && !target.complete) {
    pending = target
    target.addEventListener('load', measure, { once: true })
    return
  }
  const t = target.getBoundingClientRect()
  const b = box.getBoundingClientRect()
  const x1 = b.right - b.width * TAIL_INSET
  const y1 = b.top - TAIL_GAP
  const x2 = t.right + TIP_GAP
  const y2 = t.top + t.height * TIP_Y
  const cx = x1 + (x1 - x2) * BOW
  const cy = y1 - (y1 - y2) * RISE
  path.value = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`
}

watch(
  () => [props.visible, props.point],
  ([visible, point]) => {
    clearPending()
    path.value = null
    if (!visible || !point) return
    nextTick(() => requestAnimationFrame(measure))
  },
  { immediate: true }
)

function onResize() {
  if (props.visible && props.point) measure()
}

onMounted(() => {
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  clearPending()
})
</script>

<style scoped>
.dialog-pointer {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
}

.dialog-pointer__line {
  fill: none;
  stroke: #fff;
  stroke-width: 4;
  stroke-linecap: butt;
  shape-rendering: crispEdges;
  /* 虚线流动 */
  stroke-dasharray: 14 10;
  animation: dialog-pointer-flow 0.9s linear infinite;
  /* 负延迟 一出现就已经在流 */
  animation-delay: -0.45s;
}

@keyframes dialog-pointer-flow {
  to {
    stroke-dashoffset: -24;
  }
}
</style>
