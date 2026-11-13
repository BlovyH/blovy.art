<script setup>
// 挂在演出对话上的打字机：逐字写完停留一段时间，然后交给上层收场
import { nextTick, onBeforeUnmount, onMounted } from 'vue'

const props = defineProps({
  typeMs: { type: Number, default: 20 },
  holdMs: { type: Number, default: 320 },
})

const emit = defineEmits(['done'])

let timers = []

function clearTimers() {
  timers.forEach(clearTimeout)
  timers = []
}

function typeOut(textEl) {
  const full = textEl.textContent
  textEl.textContent = ''
  let i = 0
  const step = () => {
    i += 1
    textEl.textContent = full.slice(0, i)
    if (i < full.length) {
      timers.push(setTimeout(step, props.typeMs))
      return
    }
    timers.push(setTimeout(() => emit('done'), props.holdMs))
  }
  step()
}

onMounted(async () => {
  await nextTick()
  const textEl = document.querySelector('.dialog-box__text')
  if (!textEl) {
    emit('done')
    return
  }
  typeOut(textEl)
})

onBeforeUnmount(clearTimers)
</script>

<template><!----></template>
