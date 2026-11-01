<template>
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
import { onBeforeUnmount } from 'vue'
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

function onDown(e) {
  if (flowerbedWon.value || flowersLeft.value <= 0) return
  e.preventDefault()
  startFlowerDrag(e.clientX, e.clientY)
}

onBeforeUnmount(cancelDrag)
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
