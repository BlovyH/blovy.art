<template>
  <PixelWindow
    ref="windowRef"
    class="nothing-window"
    :class="{ 'is-starfield': swapped, 'is-flip-in': flipDir === 'in', 'is-flip-out': flipDir === 'out' }"
    :style="{
      '--slide-x': slideX + 'px',
      '--nothing-transform-ms': TRANSFORM_MS + 'ms',
      '--nothing-flip-left': FLIP_LEFT_MS + 'ms',
    }"
    :title="titleText"
    :centered="true"
    :top="'35%'"
    width="60%"
    height="auto"
    :top-most="true"
    :click-outside-to-close="true"
    @close="$emit('close')"
  >
    <div class="nothing-body">
      <div class="nothing-search">
        <input
          v-model="query"
          class="nothing-input"
          :class="{ 'is-frozen': frozen }"
          type="text"
          placeholder="type to search..."
          :readonly="frozen"
          @keydown.enter.prevent
        />
      </div>
      <div v-if="query.length > 0" class="nothing-results">
        <!-- 换了装就以这把锁代替整段结果文本 -->
        <div v-if="swapped" class="nothing-lock">
          <img class="nothing-lock-img" src="/assets/wiki_lock.png" alt="" />
        </div>
        <div v-else-if="isLoading" class="nothing-loading">
          Searching<span class="nothing-dots">...</span>
        </div>
        <div v-else class="nothing-result-row">
          <span class="nothing-icon" :class="{ 'is-found': stage === 'found' }">{{ iconText }}</span>
          <span class="nothing-text">{{ resultText }}</span>
        </div>
      </div>
      <div v-else class="nothing-results nothing-empty">
        <span class="nothing-hint">type something to begin the search</span>
      </div>
    </div>
    <!-- 涟漪：两个环错开半个周期。只能用真元素 —— 伪元素被上面那层「像素边框染色」占了一个，
         剩下的一个不够两个相位 -->
    <template v-if="swapped">
      <span class="nothing-ripple"></span>
      <span class="nothing-ripple nothing-ripple--b"></span>
    </template>
  </PixelWindow>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useInputFreeze } from '@/composables/useInputFreeze'
import PixelWindow from './PixelWindow.vue'
import { NOTHING_BRANCHES, NOTHING_FX, PARTIAL_TEXT } from '@/nothing/branches'

const SEARCH_MS = 300 // 「Searching...」持续多久
const WORD_MS = 100 // 第一个单词冒出来的间隔
const WORD_STEP_MS = 50 // 之后每个单词递增的间隔，越说越慢、像说到一半哽住
const DOT_MS = 380 // 省略号每个点冒出来的间隔
const DOT_COUNT = 3
const BEAT_MS = 550 // 点打完之后愣一下
const SURPRISE_MS = 1400 // 「Oh, let me see...」停留多久
const TRANSFORM_MS = 1000
const FLIP_MID = 0.45
const FLIP_SWITCH_MS = Math.round(TRANSFORM_MS * FLIP_MID)
// something 视觉效果要等待翻转完成
const FLIP_LEFT_MS = TRANSFORM_MS - FLIP_SWITCH_MS
const SLIDE_RATIO = 0.18 // 说出结论时让位滑开的距离，占视口宽度的比例

const NOTHING_TEXT = 'Sorry, we found nothing！'
const CROSS = '✕'
const SURPRISED_FACE = '(°o°)'
const CHECK = '✓'

defineEmits(['close'])

const query = ref('')
const isLoading = ref(false)
const branch = ref(null) // 命中的分支，null = 走普通 nothing
const typed = ref('') // 已经打出来的那半句
const dots = ref(0) // 已冒出来的省略号点数
const stage = ref('typing') // typing -> surprised -> found
const slideX = ref(0) // 结论出现时横向让开的位移（px，往右为正）
const windowRef = ref(null) // PixelWindow 根元素，用来量自己当前位置

const iconText = computed(() => {
  if (!branch.value) return CROSS
  if (stage.value === 'surprised') return SURPRISED_FACE
  if (stage.value === 'found') return CHECK
  return CROSS
})

const starfield = computed(() => NOTHING_FX[query.value.trim().toLowerCase()] === 'starfield')
const { frozen, freeze, release: unfreeze } = useInputFreeze()
// 换了装才是 SOMETHING；翻转转到侧面之前窗口仍必须是原来的样子
const swapped = ref(false)
const flipDir = ref(null) // 'in' 翻过去 / 'out' 退回去 / null 没在演
const titleText = computed(() => (swapped.value ? 'SOMETHING' : 'NOTHING'))

const resultText = computed(() => {
  if (!branch.value) return NOTHING_TEXT
  if (stage.value === 'surprised') return 'Oh, let me see...'
  if (stage.value === 'found') return branch.value.found
  return typed.value + '.'.repeat(dots.value)
})

let timers = []
function clearTimers() {
  timers.forEach(clearTimeout)
  timers = []
}
function later(fn, ms) {
  timers.push(setTimeout(fn, ms))
}

// 结论出来时给命中的那个窗口让位：它在视口左半边就往右滑，反之往左。
// 拿不到元素（没配 target / 还没渲染）就不滑。
function computeSlideX(target) {
  const targetEl = target ? document.querySelector(target) : null
  const selfEl = windowRef.value?.$el
  if (!targetEl || !selfEl) return 0

  const rect = targetEl.getBoundingClientRect()
  const distance = Math.round(window.innerWidth * SLIDE_RATIO)
  const wanted = rect.left + rect.width / 2 < window.innerWidth / 2 ? distance : -distance

  // 已经被拖得有一部分在视口外时就不动：这时候无论往哪滑都像被抢回去，不如保持原样
  const selfRect = selfEl.getBoundingClientRect()
  if (selfRect.left < 0 || selfRect.right > window.innerWidth) return 0

  // 否则按自身位置夹一次，滑完不能捅出视口
  const min = -selfRect.left
  const max = window.innerWidth - selfRect.right
  return Math.max(min, Math.min(max, wanted))
}

function runBranchScript() {
  // 整词整词地冒出来，间隔逐个变长：像说到一半突然想到什么、哽在那里
  const words = PARTIAL_TEXT.split(' ')
  let typedEnd = 0
  words.forEach((word, i) => {
    typedEnd += WORD_MS + i * WORD_STEP_MS
    later(() => { typed.value += (i === 0 ? '' : ' ') + word }, typedEnd)
  })

  for (let d = 1; d <= DOT_COUNT; d++) {
    later(() => { dots.value = d }, typedEnd + d * DOT_MS)
  }

  const dotsEnd = typedEnd + DOT_COUNT * DOT_MS
  later(() => { stage.value = 'surprised' }, dotsEnd + BEAT_MS)
  later(() => {
    stage.value = 'found'
    slideX.value = computeSlideX(branch.value?.target)
  }, dotsEnd + BEAT_MS + SURPRISE_MS)
}

watch(query, (val, oldVal) => {
  // 只在尾部敲空格（含删掉尾部空格）不算一次新搜索：内容没变就保持现状
  if (val.trimEnd() === (oldVal ?? '').trimEnd()) return

  clearTimers()
  typed.value = ''
  dots.value = 0
  stage.value = 'typing'
  slideX.value = 0

  const q = val.trim().toLowerCase()
  branch.value = q ? NOTHING_BRANCHES.find(b => q === b.keyword) || null : null

  if (q.length === 0) {
    isLoading.value = false
    return
  }
  isLoading.value = true
  later(() => {
    isLoading.value = false
    if (branch.value) runBranchScript()
  }, SEARCH_MS)
})

let titleTimer = null
let settleTimer = null
watch(starfield, (on) => {
  clearTimeout(titleTimer)
  clearTimeout(settleTimer)

  if (on) {
    freeze(TRANSFORM_MS)
    flipDir.value = 'in'
    titleTimer = setTimeout(() => { swapped.value = true }, FLIP_SWITCH_MS)
    settleTimer = setTimeout(() => {
      flipDir.value = null
      unfreeze()
    }, TRANSFORM_MS)
    return
  }

  if (!swapped.value) {
    flipDir.value = null
    unfreeze()
    return
  }

  unfreeze()
  flipDir.value = 'out'
  titleTimer = setTimeout(() => { swapped.value = false }, FLIP_SWITCH_MS)
  settleTimer = setTimeout(() => { flipDir.value = null }, TRANSFORM_MS)
})

onBeforeUnmount(() => {
  clearTimers()
  clearTimeout(titleTimer)
  clearTimeout(settleTimer)
})
</script>

<style scoped>
/* @property 注册后才能被 animation 插值：自定义属性默认当字符串处理，keyframes 里改它是瞬跳 */
@property --nothing-star-angle {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}
@property --nothing-float-y {
  syntax: '<length>';
  inherits: false;
  initial-value: 0px;
}

.nothing-window {
  max-width: 900px;
  /* 用独立的 translate 属性而不是 transform：PixelWindow 用 transform 做居中/拖拽，
     两者各自生效、互不覆盖，这里才能单独给 translate 加过渡。 */
  translate: var(--slide-x, 0px) var(--nothing-float-y, 0px);
  transition: translate 600ms ease;
}

/* NOTHING_FX */
.nothing-window.is-starfield {
  /* 色卡 */
  --sky-a: #00e0ff;
  --sky-b: #7b4bff;
  --sky-c: #ff2fb3;
  --sky-d: #3f6bff;
  --sky-e: #00ffc8;
  --nothing-star-turn: 11s; /* 星空转完一圈 */
  --nothing-star-drift: 4s; /* 标题走完一个 tile */
  --nothing-star-tile: 320px;
  /* 仅复用色卡，conic-gradient(...) 在使用处写否则无法渐变 */
  --nothing-star-stops:
    var(--sky-a) 0deg,
    var(--sky-b) 51deg,
    var(--sky-c) 103deg,
    var(--sky-d) 154deg,
    var(--sky-e) 206deg,
    var(--sky-c) 257deg,
    var(--sky-b) 309deg,
    var(--sky-a) 360deg;
  /* 标题栏，线性，两端的数值对称否则会有缝 */
  --nothing-star-sky: repeating-linear-gradient(
    90deg,
    var(--sky-a) 0,
    var(--sky-b) calc(var(--nothing-star-tile) * 0.14),
    var(--sky-c) calc(var(--nothing-star-tile) * 0.28),
    var(--sky-d) calc(var(--nothing-star-tile) * 0.42),
    var(--sky-e) calc(var(--nothing-star-tile) * 0.5),
    var(--sky-d) calc(var(--nothing-star-tile) * 0.58),
    var(--sky-c) calc(var(--nothing-star-tile) * 0.72),
    var(--sky-b) calc(var(--nothing-star-tile) * 0.86),
    var(--sky-a) var(--nothing-star-tile)
  );
  overflow: visible;
}

.nothing-window.is-starfield:not(.is-flip-in):not(.is-flip-out) {
  animation: nothing-float 4444ms ease-in-out infinite;
}

.nothing-window.is-flip-in,
.nothing-window.is-flip-out {
  transform-origin: 0 0;
}

.nothing-window.is-flip-in {
  animation: nothing-flip var(--nothing-transform-ms, 1000ms) linear;
}

.nothing-window.is-flip-out {
  animation: nothing-flip-back var(--nothing-transform-ms, 1000ms) linear;
}

.nothing-window.is-manual.is-flip-in,
.nothing-window.is-manual.is-flip-out {
  transform-origin: 50% 50%;
}

.nothing-window.is-starfield :deep(.pixel-window__content) {
  overflow: visible;
}

/* @supports 防止不支持导致炸 */
@supports (-webkit-mask-box-image: url('/assets/window_frame_thick.png') 7 round) {
  .nothing-window.is-starfield::before {
    content: '';
    position: absolute;
    inset: -7.3px;
    border: 8px solid transparent;
    background-image: conic-gradient(from var(--nothing-star-angle), var(--nothing-star-stops));
    background-origin: border-box;
    -webkit-mask-box-image: url('/assets/window_frame_thick.png') 7 round;
    mask-border: url('/assets/window_frame_thick.png') 7 round;
    pointer-events: none;
    animation:
      nothing-star-spin var(--nothing-star-turn) linear infinite,
      nothing-star-fade calc(var(--nothing-transform-ms, 1000ms) * 0.5) ease-in;
    /* 等待翻转完成 */
    animation-delay: var(--nothing-flip-left, 550ms), 0s;
  }
}

.nothing-window.is-starfield :deep(.pixel-titlebar__title) {
  color: transparent;
  background-image: var(--nothing-star-sky);
  background-clip: text;
  animation: nothing-star-flow var(--nothing-star-drift) linear infinite;
}

@keyframes nothing-float {
  0% {
    --nothing-float-y: 0px;
    animation-timing-function: ease-out;
  }
  25% {
    --nothing-float-y: -14px;
  }
  75% {
    --nothing-float-y: 14px;
    animation-timing-function: ease-in;
  }
  100% {
    --nothing-float-y: 0px;
  }
}

/* 边框随翻转后半程淡入 */
@keyframes nothing-star-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* 绕垂直中轴翻 180°，在 90° 那一帧把 scale 调成 -1 实现视觉演出而非真 3D 镜像反转 */
@keyframes nothing-flip {
  0% {
    rotate: y 0deg;
    scale: 1 1;
    animation-timing-function: cubic-bezier(0.5, 0, 0.6, 1);
  }
  45% {
    rotate: y -90deg;
    scale: 1 1;
    animation-timing-function: cubic-bezier(0.2, 0.55, 0.35, 1);
  }
  /* 翻面（把原来的内容贴到背面） */
  46% {
    scale: -1 1;
  }
  80% {
    rotate: y -196deg;
    scale: -1 1;
    animation-timing-function: cubic-bezier(0.3, 0, 0.2, 1);
  }
  100% {
    rotate: y -180deg;
    scale: -1 1;
  }
}

@keyframes nothing-flip-back {
  0% {
    rotate: y -180deg;
    scale: -1 1;
    animation-timing-function: cubic-bezier(0.5, 0, 0.6, 1);
  }
  45% {
    rotate: y -90deg;
    scale: -1 1;
    animation-timing-function: cubic-bezier(0.2, 0.55, 0.35, 1);
  }
  46% {
    scale: 1 1;
  }
  80% {
    rotate: y 16deg;
    scale: 1 1;
    animation-timing-function: cubic-bezier(0.3, 0, 0.2, 1);
  }
  100% {
    rotate: y 0deg;
    scale: 1 1;
  }
}

@keyframes nothing-star-spin {
  to {
    --nothing-star-angle: 360deg;
  }
}

@keyframes nothing-star-flow {
  /* 只写一个位移值：背景层数比这个值多的时候 CSS 会把列表补齐重复，
     所以窗体上那层黑色的 padding 也被带上位移（纯色，挪了看不出来）。
     负 = 图案往负方向走，也就是从右往左流 */
  from {
    background-position: 0 0;
  }
  to {
    background-position: calc(var(--nothing-star-tile) * -1) 0;
  }
}

/* 涟漪 */
.nothing-ripple {
  position: absolute;
  /* 负值才对齐到边框外沿；绝对定位的包含块是 padding box */
  inset: -6px;
  border: 3px solid transparent;
  border-radius: 10px;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.35), rgba(255, 255, 255, 0.35)),
    conic-gradient(from var(--nothing-star-angle), var(--nothing-star-stops));
  background-origin: border-box;
  /* 剪切蒙版 */
  -webkit-mask: linear-gradient(#000 0 0) padding-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask:
    linear-gradient(#000 0 0) padding-box exclude,
    linear-gradient(#000 0 0);
  mix-blend-mode: screen;
  pointer-events: none;
  /* 注意第一帧透明 */
  opacity: 0;
  animation:
    nothing-ripple 1400ms ease-out infinite,
    nothing-star-spin var(--nothing-star-turn) linear infinite;
  /* 同上，等待翻转完成 */
  animation-delay: var(--nothing-flip-left, 550ms), 0s;
}

/* 第二环错开半个周期，用加法而不是负 delay —— 负 delay 会让它在翻转途中就以半程相位出现 */
.nothing-ripple--b {
  animation-delay: calc(var(--nothing-flip-left, 550ms) + 700ms), 0s;
}

@keyframes nothing-ripple {
  from {
    inset: -6px;
    opacity: 1;
  }
  to {
    inset: -26px;
    opacity: 0;
  }
}

.nothing-window :deep(.pixel-window__content) {
  padding: 24px;
}

.nothing-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.nothing-search {
  display: flex;
  align-items: center;
  gap: 10px;
}

.nothing-input {
  flex: 1;
  background: #000000;
  color: #ffffff;
  border: 2px solid #808080;
  border-radius: 0;
  padding: 12px 14px;
  font-family: var(--font-pixel);
  font-size: clamp(14px, 1.3vw, 20px);
}

.nothing-input:focus {
  outline: none;
  border-color: #ffffff;
}

.nothing-input.is-frozen {
  caret-color: transparent;
}

.nothing-results {
  min-height: 220px;
  border: 2px solid #808080;
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nothing-result-row {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #808080;
  font-size: clamp(16px, 1.5vw, 24px);
}

.nothing-icon {
  font-size: clamp(20px, 1.8vw, 28px);
}

/* 渐弱弹跳 */
.nothing-icon.is-found {
  animation: check-bounce 900ms ease-out;
}

@keyframes check-bounce {
  0% { transform: translateY(0); }
  12% { transform: translateY(-0.6em); }
  28% { transform: translateY(0); }
  45% { transform: translateY(-0.35em); }
  60% { transform: translateY(0); }
  75% { transform: translateY(-0.15em); }
  88%, 100% { transform: translateY(0); }
}

.nothing-lock-img {
  display: block;
  width: calc(66px * var(--nothing-lock-scale, 2));
  height: auto;
  image-rendering: pixelated;
  animation: nothing-lock-drop 400ms cubic-bezier(0.22, 0.61, 0.36, 1) var(--nothing-flip-left, 550ms) both;
}

@keyframes nothing-lock-drop {
  from {
    opacity: 0;
    transform: translateY(-16px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.nothing-loading {
  color: #808080;
  font-size: clamp(16px, 1.5vw, 24px);
}

.nothing-dots {
  display: inline-block;
  width: 1.2em;
  text-align: left;
  animation: blink 1s steps(1, end) infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.nothing-empty {
  color: #555555;
}

.nothing-hint {
  font-size: clamp(14px, 1.3vw, 20px);
}
</style>
