<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="dialog-box"
      :style="{ zIndex }"
      @click="onClick"
    >
      <div class="dialog-box__content">
        <span
          class="dialog-box__prompt"
          :class="{ 'is-star': isStar, 'is-launched': launched }"
          @click="onPromptClick"
          >{{ isStar ? '*' : '&gt;&gt;' }}</span
        >
        <span class="dialog-box__text" v-html="content"></span>
      </div>
      <div v-if="$slots.aside" class="dialog-box__aside">
        <slot name="aside" />
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { Z } from '@/stores/windowZ.js'
import { playSnow } from '@/snowTrigger.js'
import { skiImpostor } from '@/skiMode.js'

// 每次出现一个对话框就抽一次：三成概率把提示符换成 *，点它放一次飘雪
const STAR_CHANCE = 0.3

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  content: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['click'])

const zIndex = Z.OVERLAY

// 按「对话框」抽而不是按组件实例抽一次：这一层是复用的单例，只在挂载时抽的话整场访问只有一次结果
const isStar = ref(false)
// 点过之后这颗 * 就「飞走」了，让位给飘雪层里那颗接着变的（本体不藏会变成两颗）
const launched = ref(false)
watch(
  () => [props.visible, props.content],
  ([visible]) => {
    // 冒牌 SKI MODE 在场时永远不会出现
    isStar.value = visible && !skiImpostor ? Math.random() < STAR_CHANCE : false
    launched.value = false
  },
  { immediate: true },
)

function onClick() {
  emit('click')
}

function onPromptClick(e) {
  if (!isStar.value) return
  // 它是独立的交互目标，别顺手把「点对话框任意处推进对话」也触发了 —— 不然点完雪在放、字已经翻页
  e.stopPropagation()
  // 量的是文字本身而不是整个 span：span 被锁成两个字符宽（* 只占一个），
  // 用元素矩形算出来的中心会偏半格，种子盖上去就对不齐
  const range = document.createRange()
  range.selectNodeContents(e.currentTarget)
  const box = range.getBoundingClientRect()
  launched.value = true
  playSnow({
    x: box.left + box.width / 2,
    y: box.top + box.height / 2,
    size: getComputedStyle(e.currentTarget).fontSize,
  })
}

function onKeydown(e) {
  if (!props.visible) return
  if (e.key === 'Enter') {
    e.preventDefault()
    emit('click')
  }
}

function bind() {
  window.addEventListener('keydown', onKeydown)
}

function unbind() {
  window.removeEventListener('keydown', onKeydown)
}

watch(() => props.visible, (visible) => {
  if (visible) {
    bind()
  } else {
    unbind()
  }
})

onMounted(() => {
  if (props.visible) bind()
})

onUnmounted(() => {
  unbind()
})
</script>

<style scoped>
.dialog-box {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  width: calc(100% - 48px);
  max-width: 1400px;
  height: clamp(220px, 28vh, 320px);
  box-sizing: border-box;
  display: flex;
  align-items: flex-start;
  background: #000000;
  border: 6px solid transparent;
  border-image-source: url('/assets/window_frame.png');
  border-image-slice: 6;
  border-image-width: 6px;
  border-image-repeat: round;
  border-radius: 8px;
  padding: 28px 36px;
  color: #ffffff;
  font-family: var(--font-pixel);
  font-size: clamp(18px, 1.8vw, 30px);
  line-height: 1.7;
  cursor: default;
  user-select: none;
  overflow: hidden;
}

.dialog-box__content {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  width: 100%;
  overflow: hidden;
}

.dialog-box__prompt {
  color: #ffffff;
  font-weight: bold;
  flex-shrink: 0;
  /* 提示符会换成 *（1 个字符）而当红的 >> 是两个，不锁宽的话正文会跟着左移一格 ——
     一眼就看出来哪个对话框被换过。等宽字体下 1ch 就是一个字符的步进 */
  width: 2ch;
}

/* 可点的那个提示符：预览侧同一批类名登记在 dpActions 的 pointer 组 */
.dialog-box__prompt.is-star {
  cursor: pointer;
}

/* 起飞后留着占位、只把字藏掉：不然宽度塌了，正文又会左移一格 */
.dialog-box__prompt.is-launched {
  opacity: 0;
}

.dialog-box__text {
  color: #ffffff;
  overflow-wrap: break-word;
}

/* 右下角附加位：浮在主文本之上、不参与排版，主文本因此保持满宽 */
.dialog-box__aside {
  position: absolute;
  right: 36px;
  bottom: 28px;
}

.dialog-box__text :deep(a) {
  color: #00ffff;
  text-decoration: underline;
}

.dialog-box__text :deep(a):hover {
  color: #ff69b4;
}
</style>
