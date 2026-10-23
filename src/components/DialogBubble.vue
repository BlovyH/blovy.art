<template>
  <div class="dialog-bubble" :class="[`is-${side}`, { 'is-below': below, 'is-leaving': leaving }]">
    <span class="dialog-bubble__text">{{ text }}</span>
    <img
      class="dialog-bubble__tail"
      :src="BUBBLE_TAIL"
      alt=""
      draggable="false"
      @dragstart.prevent
    />
  </div>
</template>

<script setup>
const BUBBLE_TAIL = '/assets/dialog_common_arrow.png'

defineProps({
  text: { type: String, default: '' },
  side: { type: String, default: 'left' },
  below: { type: Boolean, default: false },
  leaving: { type: Boolean, default: false },
})
</script>

<style scoped>
.dialog-bubble {
  position: absolute;
  z-index: 2;
  box-sizing: border-box;
  /* 固定正方形 */
  width: var(--db-box);
  height: var(--db-box);
  display: grid;
  place-items: center;
  border: var(--db-band) solid transparent;
  padding: 2px 6px;
  color: #ffffff;
  font-family: var(--font-pixel);
  font-size: 36px;
  font-weight: bold;
  line-height: 1;
  text-align: center;
  white-space: nowrap;
  background: #000000;
  border-radius: calc(2 * var(--db-corner));

  --db-band: 18px;
  --db-box: 84px;
  --db-gap-above: 46px;
  --db-gap-below: 62px;
  --db-slice: 6;
  --db-line: calc(var(--db-band) / var(--db-slice));
  --db-mouth: 12px;
  --db-corner: calc(4 * var(--db-band) / var(--db-slice));
  translate: 0 var(--db-dy, 0px);
  animation: dialog-bubble-in 260ms ease-out both;
}

.dialog-bubble.is-left {
  left: -10px;
}

.dialog-bubble.is-right {
  right: -10px;
}

.dialog-bubble:not(.is-below) {
  bottom: 100%;
  --db-dy: calc(-1 * var(--db-gap-above));
}

.dialog-bubble.is-below {
  top: 100%;
  --db-dy: var(--db-gap-below);
}

.dialog-bubble::before {
  content: '';
  position: absolute;
  inset: calc(-1 * var(--db-band));
  border: var(--db-band) solid transparent;
  border-image-source: url('/assets/dialog_common.png');
  border-image-slice: var(--db-slice);
  border-image-repeat: stretch;
  image-rendering: pixelated;
  mask-image: linear-gradient(#fff 0 0), linear-gradient(#fff 0 0);
  mask-size: 100% 100%, var(--db-mouth) var(--db-band);
  mask-position: 0 0, 50% 100%;
  mask-repeat: no-repeat;
  mask-composite: exclude;
}

.dialog-bubble.is-below::before {
  mask-position: 0 0, 50% 0;
}

.dialog-bubble__tail {
  position: absolute;
  left: 50%;
  width: 16px;
  height: 16px;
  translate: -50% 0;
  image-rendering: pixelated;
}

.dialog-bubble:not(.is-below) .dialog-bubble__tail {
  top: calc(100% + var(--db-band) - var(--db-line));
}

.dialog-bubble.is-below .dialog-bubble__tail {
  bottom: calc(100% + var(--db-band) - var(--db-line));
}

/* 收掉只能换一条 animation：入场那条带 both，结束后仍占着 opacity / scale，
   在它上面写普通声明不会生效（animation 在级联里最高） */
.dialog-bubble.is-leaving {
  animation: dialog-bubble-out 220ms ease-in both;
}

@keyframes dialog-bubble-in {
  from {
    opacity: 0;
    scale: 0.6;
  }
}

@keyframes dialog-bubble-out {
  to {
    opacity: 0;
    scale: 0.7;
  }
}
</style>
