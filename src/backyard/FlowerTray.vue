<template>
  <!-- 花圃左侧的消除排列图示 -->
  <Transition name="flower-rules">
    <div v-if="rulesVisible" class="flower-rules">
      <div v-for="(dots, i) in CLEAR_PATTERNS" :key="i" class="flower-rules__item">
        <img
          v-for="(dot, j) in dots"
          :key="j"
          class="flower-rules__flower"
          :src="FLOWER_SRC"
          :style="{ left: `calc(50% + ${dot[0]}%)`, top: `calc(50% + ${dot[1]}%)` }"
          alt=""
          draggable="false"
          @dragstart.prevent
        />
        <span class="flower-rules__cross" aria-hidden="true">×</span>
      </div>
    </div>
  </Transition>

  <!-- 花槽（仓库格子） -->
  <div v-if="flowerbedEditing" class="flower-slot">
    <button
      class="flower-slot__exit"
      type="button"
      aria-label="Stop arranging flowers"
      :disabled="flowerbedWon"
      @click="endFlowerEdit"
    >
      <!-- 复用窗口标题栏的关闭贴图（16×16 里字形只占中间 8×8，四周 25% 是留白） -->
      <img src="/assets/window_btn_c.png" alt="" draggable="false" @dragstart.prevent />
    </button>

    <button
      class="flower-slot__undo"
      type="button"
      aria-label="Undo last flower move"
      :disabled="!canUndo || flowerbedWon"
      @click="undoFlower"
    >
      <img src="/assets/btn_undo.png" alt="" draggable="false" @dragstart.prevent />
    </button>

    <div
      class="flower-tray"
      :class="{ 'is-empty': flowersLeft <= 0, 'is-locked': flowerbedWon }"
      @pointerdown="onDown"
    >
      <img
        class="flower-tray__icon"
        :src="FLOWER_SRC"
        alt="flower"
        draggable="false"
        @dragstart.prevent
      />
      <span class="flower-tray__count">{{ flowersLeft }}</span>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import {
  FLOWER_SRC,
  canUndo,
  cancelDrag,
  endFlowerEdit,
  flowerbedEditing,
  flowerbedWon,
  flowersLeft,
  startFlowerDrag,
  undoFlower,
} from './flowerbed.js'

// 三朵花相对格心的偏移（百分比），横竖间距大于花宽避免交叠，斜排按 45° 分解
const ORTHO_GAP = 34
const DIAG = 28 / Math.SQRT2
const CLEAR_PATTERNS = [
  [[-ORTHO_GAP, 0], [0, 0], [ORTHO_GAP, 0]],
  [[0, -ORTHO_GAP], [0, 0], [0, ORTHO_GAP]],
  [[-DIAG, -DIAG], [0, 0], [DIAG, DIAG]],
]

// 进入编辑模式显示图例，5s 后淡出；退出时立即收掉
const rulesVisible = ref(false)
let rulesTimer = 0
watch(
  flowerbedEditing,
  (on) => {
    clearTimeout(rulesTimer)
    if (!on) {
      rulesVisible.value = false
      return
    }
    rulesVisible.value = true
    rulesTimer = setTimeout(() => {
      rulesVisible.value = false
    }, 5000)
  },
  { immediate: true },
)

function onDown(e) {
  if (flowerbedWon.value || flowersLeft.value <= 0) return
  e.preventDefault()
  startFlowerDrag(e.clientX, e.clientY)
}

onBeforeUnmount(() => {
  clearTimeout(rulesTimer)
  cancelDrag()
})
</script>

<style scoped>
.flower-slot {
  position: absolute;
  bottom: var(--backyard-board-inset);
  right: calc(
    var(--backyard-board-inset) + var(--backyard-board-size) + var(--flower-tray-gap)
  );
  width: calc(var(--backyard-board-size) / var(--backyard-board-cols));
  display: flex;
  flex-direction: column;
  gap: var(--flower-tray-gap);
}

/* 图示竖列按棋盘高度三等分，贴在花槽左侧的空白区 */
.flower-rules {
  position: absolute;
  bottom: var(--backyard-board-inset);
  right: calc(
    var(--backyard-board-inset) + var(--backyard-board-size) +
      var(--flower-tray-gap) * 2 + var(--backyard-board-size) / var(--backyard-board-cols)
  );
  width: calc(var(--backyard-board-size) / var(--backyard-board-cols) * 1.7);
  height: var(--backyard-board-size);
  display: grid;
  grid-template-rows: repeat(3, 1fr);
  place-items: center;
  pointer-events: none;
}

.flower-rules__item {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  animation: rule-float-a 7s ease-in-out infinite;
}

.flower-rules__item:nth-child(2) {
  animation: rule-float-b 9s ease-in-out infinite;
}

.flower-rules__item:nth-child(3) {
  animation: rule-float-c 8s ease-in-out infinite;
}

@keyframes rule-float-a {
  0%, 100% { translate: 0 0; }
  25% { translate: 6px -5px; }
  50% { translate: -4px 6px; }
  75% { translate: 5px 3px; }
}

@keyframes rule-float-b {
  0%, 100% { translate: 0 0; }
  30% { translate: -6px 3px; }
  60% { translate: 4px 6px; }
  80% { translate: 6px -4px; }
}

@keyframes rule-float-c {
  0%, 100% { translate: 0 0; }
  20% { translate: 5px 6px; }
  45% { translate: -6px -3px; }
  70% { translate: 3px -6px; }
}

.flower-rules__flower {
  position: absolute;
  width: 34%;
  height: 34%;
  translate: -50% -50%;
  object-fit: contain;
  image-rendering: pixelated;
  filter: drop-shadow(0 0 3px rgba(255, 255, 255, 0.28));
}

.flower-rules-enter-active,
.flower-rules-leave-active {
  transition: opacity 0.6s ease;
}

.flower-rules-enter-from,
.flower-rules-leave-to {
  opacity: 0;
}

.flower-rules__cross {
  position: absolute;
  right: -4px;
  bottom: -6px;
  color: #e04a4a;
  font-family: var(--font-pixel);
  font-size: clamp(28px, 2.6vw, 38px);
  line-height: 1;
  text-shadow: 1px 1px 0 #000;
}

.flower-slot__exit,
.flower-slot__undo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 1;
  padding: 0;
  border: 0;
  background: none;
  box-shadow: inset 0 0 0 2px #fff;
  cursor: pointer;
}

.flower-slot__exit:disabled,
.flower-slot__undo:disabled {
  cursor: default;
  filter: brightness(0.45);
  opacity: 0.7;
}

.flower-slot__exit img,
.flower-slot__undo img {
  width: 76%;
  height: 76%;
  object-fit: contain;
  image-rendering: pixelated;
}

.flower-tray {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  box-sizing: border-box;
  box-shadow: inset 0 0 0 2px #fff;
  cursor: move;
  touch-action: none;
}

.flower-tray.is-empty,
.flower-tray.is-locked {
  box-shadow: inset 0 0 0 2px rgb(255 255 255 / 0.35);
  cursor: default;
}

.flower-tray__icon {
  position: absolute;
  inset: 12%;
  width: 76%;
  height: 76%;
  image-rendering: pixelated;
}

.flower-tray.is-empty .flower-tray__icon,
.flower-tray.is-locked .flower-tray__icon {
  opacity: 0.35;
}

.flower-tray__count {
  position: absolute;
  right: -2px;
  bottom: -2px;
  padding: 0 3px;
  background: #000;
  color: #fff;
  font-family: var(--font-pixel);
  font-size: clamp(14px, 1.2vw, 20px);
  line-height: 1.2;
}

.flower-tray.is-empty .flower-tray__count,
.flower-tray.is-locked .flower-tray__count {
  color: rgb(255 255 255 / 0.35);
}
</style>
