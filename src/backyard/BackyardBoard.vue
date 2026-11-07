<template>
  <div class="backyard-board" @click="onClick">
    <div
      v-for="(cell, i) in backyardBoardCells"
      :key="i"
      class="backyard-board__cell"
      :data-index="i"
      :class="{
        'is-light': cell.light,
        'has-top': cell.hasTop,
        'has-right': cell.hasRight,
        'has-bottom': cell.hasBottom,
        'has-left': cell.hasLeft,
      }"
    >
      <img
        v-if="flowers.includes(i)"
        class="backyard-board__flower"
        :class="{ 'is-dark': cell.light, 'is-swallowed': swallowing }"
        :style="swallowStyle(i)"
        :src="FLOWER_SRC"
        alt=""
        draggable="false"
        @pointerdown="onFlowerDown(i, $event)"
      />
    </div>
    <span
      v-for="dot in backyardBoardDots"
      :key="`dot-${dot.key}`"
      class="backyard-board__dot"
      :style="{ left: dot.x, top: dot.y }"
    />

    <div
      v-for="layer in cakeLayers"
      :key="layer.key"
      class="backyard-cake-spin"
      :class="{ 'is-trail': layer.trail > 0, 'is-inner': layer.ring === 0 }"
      :style="cakeCenterStyle(layer.trail)"
      aria-hidden="true"
    >
      <img
        v-for="f in layer.items"
        :key="f.cell"
        class="backyard-cake-spin__flower"
        :class="{ 'is-dark': backyardBoardCells[f.cell].light }"
        :src="FLOWER_SRC"
        :style="cakeFlowerStyle(f)"
        alt=""
        draggable="false"
      />
    </div>

    <img
      v-if="cakePhase === 'cake' && !cakeTaken"
      class="backyard-cake"
      :style="cakeCenterStyle()"
      :src="CAKE_SRC"
      alt=""
      draggable="false"
      @click.stop="takeCake"
    >

    <div
      v-for="group in merging"
      :key="group.id"
      class="backyard-merge"
      :style="mergeStyle(group)"
      aria-hidden="true"
    >
      <img
        v-for="cellIndex in group.cells"
        :key="cellIndex"
        class="backyard-merge__flower"
        :class="{ 'is-dark': backyardBoardCells[cellIndex].light }"
        :style="mergeFlowerStyle(cellIndex)"
        :src="FLOWER_SRC"
        alt=""
        draggable="false"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { BACKYARD_BOARD_SIZE, backyardBoardCells, backyardBoardDots } from './boardGrid.js'
import {
  CAKE_SRC,
  FLOWER_SRC,
  cakeAt,
  cakeBloom,
  cakePhase,
  cakeTaken,
  flowers,
  flowerbedEditing,
  merging,
  startFlowerDrag,
  swallowing,
  takeCake,
} from './flowerbed.js'

const emit = defineEmits(['click'])

function onClick() {
  if (!flowerbedEditing.value) emit('click')
}

function onFlowerDown(index, e) {
  if (!flowerbedEditing.value) return
  e.preventDefault()
  startFlowerDrag(e.clientX, e.clientY, index)
}

// 残影层数
const CAKE_TRAILS = 2

const cakeLayers = computed(() => {
  if (!cakeBloom.value.length) return []
  const out = []
  for (const ring of [0, 1]) {
    const items = cakeBloom.value.filter((f) => f.ring === ring)
    if (!items.length) continue
    for (let k = 0; k <= CAKE_TRAILS; k++) out.push({ key: `${ring}-${k}`, ring, trail: k, items })
  }
  return out
})

function mergeStyle(group) {
  const cells = group.cells.map((i) => ({
    c: i % BACKYARD_BOARD_SIZE,
    r: Math.floor(i / BACKYARD_BOARD_SIZE),
  }))
  const ac = cells.reduce((s, v) => s + v.c, 0) / cells.length
  const ar = cells.reduce((s, v) => s + v.r, 0) / cells.length
  return {
    '--ac': ac,
    '--ar': ar,
    left: `${((ac + 0.5) * 100) / BACKYARD_BOARD_SIZE}%`,
    top: `${((ar + 0.5) * 100) / BACKYARD_BOARD_SIZE}%`,
  }
}

function mergeFlowerStyle(i) {
  return {
    '--c': i % BACKYARD_BOARD_SIZE,
    '--r': Math.floor(i / BACKYARD_BOARD_SIZE),
  }
}

function cakeCenterStyle(lag = 0) {
  const at = cakeAt.value
  if (!at) return null
  return {
    '--ac': at.ac,
    '--ar': at.ar,
    '--lag': lag,
    left: `${((at.ac + 0.5) * 100) / BACKYARD_BOARD_SIZE}%`,
    top: `${((at.ar + 0.5) * 100) / BACKYARD_BOARD_SIZE}%`,
  }
}

function swallowStyle(i) {
  if (!swallowing.value) return null
  return {
    '--swallow-step': (i % BACKYARD_BOARD_SIZE) + Math.floor(i / BACKYARD_BOARD_SIZE),
  }
}

function cakeFlowerStyle(f) {
  return {
    '--c': f.cell % BACKYARD_BOARD_SIZE,
    '--r': Math.floor(f.cell / BACKYARD_BOARD_SIZE),
    '--fx': f.fx,
    '--fy': f.fy,
    '--frot': `${f.rot}deg`,
    '--fscale': f.scale,
  }
}
</script>

<style scoped>
.backyard-board {
  position: absolute;
  right: var(--backyard-board-inset);
  bottom: var(--backyard-board-inset);
  outline: var(--backyard-board-border) solid var(--backyard-board-line);
  height: var(--backyard-board-size);
  height: round(down, var(--backyard-board-size), calc(1px * var(--backyard-board-cols)));
  aspect-ratio: 1;
  display: grid;
  grid-template-columns: repeat(var(--backyard-board-cols), 1fr);
  grid-template-rows: repeat(var(--backyard-board-cols), 1fr);
  cursor: pointer;
}

.backyard-board__cell {
  box-sizing: border-box;
  background: var(--backyard-board-dark);
  border: 0 solid var(--backyard-board-line);
}

.backyard-board__cell.is-light {
  background: var(--backyard-board-light);
  border-color: var(--backyard-board-line-alt);
}

.backyard-board__cell.has-top {
  border-top-width: var(--backyard-board-half-line);
}

.backyard-board__cell.has-right {
  border-right-width: var(--backyard-board-half-line);
}

.backyard-board__cell.has-bottom {
  border-bottom-width: var(--backyard-board-half-line);
}

.backyard-board__cell.has-left {
  border-left-width: var(--backyard-board-half-line);
}

.backyard-board {
  --cell: calc(var(--backyard-board-size) / var(--backyard-board-cols));
}

.backyard-board__flower {
  display: block;
  box-sizing: border-box; /* 不加的话 padding 会把盒子撑出一格，顶开格线 */
  width: 100%;
  height: 100%;
  padding: var(--flower-pad, 1px);
  object-fit: contain;
  image-rendering: pixelated;
}

.backyard-board__flower.is-dark {
  filter: invert(1);
}

.backyard-stage.is-editing .backyard-board__flower {
  cursor: move;
}

/* 被花圃吞掉，逐格错开下沉缩小 */
.backyard-board__flower.is-swallowed {
  animation: flower-swallowed var(--swallow-ms, 520ms) ease-in both;
  animation-delay: calc(var(--swallow-step, 0) * var(--swallow-stagger, 45ms));
}

@keyframes flower-swallowed {
  from {
    scale: 1;
    translate: 0 0;
    opacity: 1;
  }
  to {
    scale: 0;
    translate: 0 45%;
    opacity: 0;
  }
}

/* 演出容器 */
.backyard-merge {
  --merge-rise: calc(
    var(--backyard-top) + var(--backyard-h) -
      (var(--backyard-board-cols) - 0.5 - var(--ar)) * var(--backyard-board-size) /
      var(--backyard-board-cols) + var(--merge-exit-margin)
  );
  position: absolute;
  width: 0;
  height: 0;
  animation:
    merge-spin var(--merge-ms) linear both,
    merge-lift var(--merge-ms) cubic-bezier(0.55, 0.085, 0.68, 0.53) both;
}

/* 旋转轴垂直于屏幕 */
@keyframes merge-spin {
  to {
    rotate: 720deg;
  }
}

@keyframes merge-lift {
  0%,
  35% {
    translate: 0 0;
  }
  to {
    translate: 0 calc(var(--merge-rise) * -1);
  }
}

.backyard-merge__flower {
  --dx: calc((var(--c) - var(--ac)) * var(--cell));
  --dy: calc((var(--r) - var(--ar)) * var(--cell));
  position: absolute;
  box-sizing: border-box;
  width: var(--cell);
  height: var(--cell);
  padding: var(--flower-pad, 1px);
  left: calc(var(--cell) * -0.5);
  top: calc(var(--cell) * -0.5);
  scale: var(--merge-scale, 1);
  object-fit: contain;
  image-rendering: pixelated;
  animation: merge-gather var(--merge-ms) cubic-bezier(0.34, 1.3, 0.64, 1) both;
}

.backyard-merge__flower.is-dark {
  filter: invert(1);
}

/* 三朵在团里固定相隔 120°，所以三角函数直接写死，不用 sin()/cos() */
.backyard-merge__flower:nth-child(1) {
  --fx: 0;
  --fy: -1;
}

.backyard-merge__flower:nth-child(2) {
  --fx: 0.866;
  --fy: 0.5;
}

.backyard-merge__flower:nth-child(3) {
  --fx: -0.866;
  --fy: 0.5;
}

@keyframes merge-gather {
  0% {
    translate: var(--dx) var(--dy);
  }
  35%,
  to {
    translate: calc(var(--fx) * var(--merge-r)) calc(var(--fy) * var(--merge-r));
  }
}

.backyard-cake-spin {
  --turns: var(--cake-turns, 3); /* 外圈 */
  position: absolute;
  width: 0;
  height: 0;
  animation: cake-spin
    calc(var(--cake-ms) * (1 + var(--lag, 0) * var(--cake-trail-lag, 0.15)))
    var(--cake-ease, cubic-bezier(0.6, 0, 0.86, 0.16)) both;
}

.backyard-cake-spin.is-inner {
  --turns: var(--cake-turns-inner, 2);
}

@keyframes cake-spin {
  to {
    rotate: calc(var(--turns) * 360deg);
  }
}

.backyard-cake-spin.is-trail {
  animation-name: cake-spin, cake-trail;
  animation-timing-function: var(--cake-ease, cubic-bezier(0.6, 0, 0.86, 0.16)), linear;
}

@keyframes cake-trail {
  0%,
  40% {
    opacity: 0;
  }
  70%,
  to {
    opacity: var(--cake-trail-op, 0.45);
  }
}

.backyard-cake-spin__flower {
  --dx: calc((var(--c) - var(--ac)) * var(--cell));
  --dy: calc((var(--r) - var(--ar)) * var(--cell));
  position: absolute;
  box-sizing: border-box;
  width: var(--cell);
  height: var(--cell);
  padding: var(--flower-pad, 1px);
  left: calc(var(--cell) * -0.5);
  top: calc(var(--cell) * -0.5);
  scale: calc(var(--cake-scale, 0.8) * var(--fscale, 1));
  rotate: var(--frot, 0deg);
  object-fit: contain;
  image-rendering: pixelated;
  animation: cake-gather var(--cake-ms) cubic-bezier(0.34, 1.3, 0.64, 1) both;
}

.backyard-cake-spin__flower.is-dark {
  filter: invert(1);
}

@keyframes cake-gather {
  0% {
    translate: var(--dx) var(--dy);
    animation-timing-function: cubic-bezier(0.34, 1.3, 0.64, 1);
  }
  30%,
  65% {
    translate: calc(var(--fx) * var(--cell)) calc(var(--fy) * var(--cell));
    animation-timing-function: cubic-bezier(0.5, 0, 0.86, 0.3);
  }
  to {
    translate: calc(var(--fx) * var(--cell) * var(--cake-collapse, 0.18))
      calc(var(--fy) * var(--cell) * var(--cake-collapse, 0.18));
  }
}

.backyard-cake-spin:not(.is-trail) .backyard-cake-spin__flower {
  animation-name: cake-gather, cake-white-lit;
  animation-duration: var(--cake-ms), var(--cake-flash-ms);
  animation-delay: 0s, calc(var(--cake-ms) - var(--cake-flash-ms));
  animation-timing-function: cubic-bezier(0.34, 1.3, 0.64, 1), steps(2, end);
}

.backyard-cake-spin:not(.is-trail) .backyard-cake-spin__flower.is-dark {
  animation-name: cake-gather, cake-white-dark;
}

@keyframes cake-white-lit {
  0% {
    filter: brightness(1) invert(0);
  }
  to {
    filter: brightness(0) invert(1);
  }
}

@keyframes cake-white-dark {
  0% {
    filter: brightness(1) invert(1);
  }
  to {
    filter: brightness(0) invert(1);
  }
}

.backyard-cake {
  position: absolute;
  width: calc(var(--cell) * var(--cake-w));
  height: calc(var(--cell) * var(--cake-h));
  object-fit: contain;
  image-rendering: pixelated;
  filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.4)) drop-shadow(0 0 10px rgba(255, 255, 255, 0.22));
  translate: -50% -50%;
  animation: cake-pop var(--cake-pop-ms, 420ms) both;
  cursor: pointer;
}

@keyframes cake-pop {
  0% {
    scale: 0.25;
    animation-timing-function: cubic-bezier(0.2, 0.9, 0.3, 1);
  }
  45% {
    scale: 1.18;
    animation-timing-function: ease-in-out;
  }
  70% {
    scale: 0.88;
    animation-timing-function: ease-in-out;
  }
  88% {
    scale: 1.06;
    animation-timing-function: ease-in-out;
  }
  to {
    scale: 1;
  }
}

.backyard-board__dot {
  position: absolute;
  width: var(--backyard-board-border);
  height: var(--backyard-board-border);
  transform: translate(-50%, -50%);
  background: #000;
}
</style>
