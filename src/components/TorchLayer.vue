<script setup>
// 手电筒 / 光标跟随光晕叠加层。
// 设计：全屏固定层，pointer-events:none（不挡点击、不挡 FP 预览光标），
// 用 radial-gradient 在光标处画一圈暖光，mix-blend-mode 提亮底层模拟发光。
// 封装要点：
//  - enabled 控制开关——后续接触发条件（桌面图标 / 快捷键）只需绑定这个 prop。
//  - armed 预备态：只挂监听记录光标坐标、不重绘。用在「即将点亮但还没点亮」的
//    窗口期（例如 YES/NO 选项期间），这样点亮瞬间光晕就落在光标处；
//    平时 armed / enabled 都为假，监听完全不挂，零开销。
//  - mode 控制形态：'glow' 柔光（宽过渡）/ 'spot' 折中（近白热核 + 收紧过渡，默认）/ 'dark' 暗房探照。
//  - 半径 / 颜色 / 强度 / 层级 / 混合模式全部 props 化，调参不动逻辑。
//  - 用 Teleport 挂到 body，规避祖先元素 transform/filter 导致 fixed 失效的坑。
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'

const props = defineProps({
  enabled:   { type: Boolean, default: true },
  // 预备态：挂监听、只记录光标坐标，不重绘、不显示光晕。
  armed:     { type: Boolean, default: false },
  mode:      { type: String,  default: 'spot' },        // glow | spot | dark
  radius:    { type: Number,  default: 110 },            // 光晕半径(px)
  color:     { type: String,  default: '255,244,214' }, // 暖光 RGB 分量（不含 alpha）
  intensity: { type: Number,  default: 0.8 },           // 圆心不透明度（spot/glow/dark 共用，调强）
  falloff:   { type: Number,  default: 0.4 },           // glow 中段不透明度（仅 glow 模式用）
  zIndex:    { type: Number,  default: 10000 },         // 高于 top-most 窗 9999 即盖全桌
  blend:     { type: String,  default: 'screen' },      // 叠加混合：screen/lighten/normal
})

const el = ref(null)
let mx = typeof window !== 'undefined' ? window.innerWidth / 2 : 0
let my = typeof window !== 'undefined' ? window.innerHeight / 2 : 0
let raf = 0
let listening = false

const HOT = '255,250,238' // spot 热核近白色，制造“强烈”的中心高光

// 光晕渐变（glow / spot 共用）
const glowBg = computed(() => {
  const r = props.radius
  const c = props.color
  const I = props.intensity
  if (props.mode === 'glow') {
    // 柔光：比 spot 宽、更柔，但收窄长尾避免“朦胧”
    return `radial-gradient(circle ${r}px at var(--mx) var(--my), ` +
      `rgba(${HOT}, ${I}) 0%, ` +
      `rgba(${c}, ${(I * 0.5).toFixed(3)}) 30%, ` +
      `rgba(${c}, ${(I * 0.16).toFixed(3)}) 52%, ` +
      `transparent 66%)`
  }
  // spot（默认折中）：近白热核 + 快速收紧过渡，明显强于柔光、无环、不朦胧
  return `radial-gradient(circle ${r}px at var(--mx) var(--my), ` +
    `rgba(${HOT}, ${I}) 0%, ` +
    `rgba(${c}, ${(I * 0.72).toFixed(3)}) 18%, ` +
    `rgba(${c}, ${(I * 0.28).toFixed(3)}) 38%, ` +
    `transparent 55%)`
})

// 暗房探照：暗背景上以光标为圆心画一圈亮核（真·手电筒），外圈压暗。
// 用单张 radial-gradient 即可，无需 mask。
// 渐变结构（由内到外三个色标）：
//   0%          中心热核：近白 HOT，alpha = 满强度 I（圆心最亮）
//   <亮核收口>   暖色 c 的中段渐弱：alpha = I * 0.65，这一档的「位置」决定亮核大小——
//               把它往后推 = 亮区更大，往前收 = 亮区更小（配合 radius 一起调）
//   60%         外圈暗幕：近不透明深暗色，盖住光晕外的页面，只留中心一圈可见
const darkBg = computed(() => {
  const r = props.radius
  const c = props.color
  const I = props.intensity
  return `radial-gradient(circle ${r}px at var(--mx) var(--my), ` +
    `rgba(${HOT}, ${I}) 0%, ` +
    `rgba(${c}, ${(I * 0.65).toFixed(3)}) 35%, ` +
    `rgba(6,6,10,0.86) 60%)`
})

const styleObj = computed(() => {
  if (props.mode === 'dark') {
    return {
      background: darkBg.value,
      zIndex: props.zIndex,
      mixBlendMode: 'normal',
    }
  }
  return {
    background: glowBg.value,
    zIndex: props.zIndex,
    mixBlendMode: props.blend,
  }
})

function paint() {
  raf = 0
  if (!el.value) return
  el.value.style.setProperty('--mx', mx + 'px')
  el.value.style.setProperty('--my', my + 'px')
}
function onMove(e) {
  mx = e.clientX
  my = e.clientY
  if (!props.enabled) return // 未点亮：只记录坐标，不重绘
  if (!raf) raf = requestAnimationFrame(paint)
}
function start() {
  if (listening) return
  listening = true
  window.addEventListener('mousemove', onMove, { passive: true })
}
function stop() {
  listening = false
  window.removeEventListener('mousemove', onMove)
  if (raf) {
    cancelAnimationFrame(raf)
    raf = 0
  }
}

// 后续接触发条件：把 torchOn 绑到图标点击 / 键盘事件即可，组件内部已处理监听的生命周期。
// 点亮的瞬间用已记录的光标位置立刻重绘，避免光晕先出现在屏幕中心再跳过来。
watch([() => props.armed, () => props.enabled], ([a, e]) => {
  if (a || e) start()
  else stop()
  if (e) paint()
})
onMounted(() => {
  if (props.armed || props.enabled) start()
  if (props.enabled) paint()
})
onBeforeUnmount(stop)
</script>

<template>
  <Teleport to="body">
    <div
      v-show="enabled"
      ref="el"
      class="torch"
      :style="styleObj"
      aria-hidden="true"
    ></div>
  </Teleport>
</template>

<style scoped>
.torch {
  position: fixed;
  inset: 0;
  pointer-events: none;
  --mx: 50%;
  --my: 50%;
}
</style>
