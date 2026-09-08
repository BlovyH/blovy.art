<template>
  <PixelWindow
    ref="windowRef"
    class="nothing-window"
    :style="{ '--slide-x': slideX + 'px' }"
    title="NOTHING"
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
          type="text"
          placeholder="type to search..."
          @keydown.enter.prevent
        />
      </div>
      <div v-if="query.length > 0" class="nothing-results">
        <div v-if="isLoading" class="nothing-loading">
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
  </PixelWindow>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import PixelWindow from './PixelWindow.vue'
import { NOTHING_BRANCHES, PARTIAL_TEXT } from '@/nothing/branches'

const SEARCH_MS = 300 // 「Searching...」持续多久
const WORD_MS = 100 // 第一个单词冒出来的间隔
const WORD_STEP_MS = 50 // 之后每个单词递增的间隔，越说越慢、像说到一半哽住
const DOT_MS = 380 // 省略号每个点冒出来的间隔
const DOT_COUNT = 3
const BEAT_MS = 550 // 点打完之后愣一下
const SURPRISE_MS = 1400 // 「Oh, let me see...」停留多久
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

onBeforeUnmount(clearTimers)
</script>

<style scoped>
.nothing-window {
  max-width: 900px;
  /* 用独立的 translate 属性而不是 transform：PixelWindow 用 transform 做居中/拖拽，
     两者各自生效、互不覆盖，这里才能单独给 translate 加过渡。 */
  translate: var(--slide-x, 0px) 0;
  transition: translate 600ms ease;
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
