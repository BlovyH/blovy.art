<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { onTorchFrame } from './torchState.js'

const props = defineProps({
  // 吸附的元素，显现内容跟着它一起动
  anchor: { type: String, required: true },
  // 目标文本，有值时按这段文字的矩形定位
  text: { type: String, default: '' },
})

// NodeFilter.SHOW_TEXT，不依赖全局常量
const SHOW_TEXT_NODES = 4

const el = ref(null)
let unregister = null
let anchorEl = null
let anchorSelector = ''
let range = null
let rangeNode = null
let rangeSource = ''
let rangeText = ''
let lastLeft = ''
let lastTop = ''

function measure(target) {
  if (!props.text) return target.getBoundingClientRect()
  // 文本节点内容或目标片段变了才重建 Range，其余帧直接复用
  if (!range || rangeText !== props.text || !rangeNode?.isConnected || rangeNode.data !== rangeSource) {
    range = null
    const walker = document.createTreeWalker(target, SHOW_TEXT_NODES)
    let node
    while ((node = walker.nextNode())) {
      const at = node.data.indexOf(props.text)
      if (at < 0) continue
      range = document.createRange()
      range.setStart(node, at)
      range.setEnd(node, at + props.text.length)
      rangeNode = node
      rangeSource = node.data
      rangeText = props.text
      break
    }
  }
  if (!range) return null
  // 片段跨行时压在第一行的矩形上，不用两行的联合矩形
  return range.getClientRects()[0] ?? range.getBoundingClientRect()
}

function update() {
  const node = el.value
  if (!node) return
  if (anchorSelector !== props.anchor || !anchorEl?.isConnected) {
    anchorEl = document.querySelector(props.anchor)
    anchorSelector = props.anchor
  }
  if (!anchorEl) {
    if (node.style.visibility !== 'hidden') node.style.visibility = 'hidden'
    return
  }
  const r = measure(anchorEl)
  // 锚点被隐藏或目标文本不存在时量不到矩形，先收起自己避免跳到视口左上角
  if (!r || !(r.width || r.height)) {
    if (node.style.visibility !== 'hidden') node.style.visibility = 'hidden'
    return
  }
  if (node.style.visibility !== 'visible') node.style.visibility = 'visible'
  const left = r.left + r.width / 2 + 'px'
  const top = r.top + r.height / 2 + 'px'
  // 位置没变就不写样式，避免逐帧改动触发同步布局
  if (left !== lastLeft) {
    node.style.left = left
    lastLeft = left
  }
  if (top !== lastTop) {
    node.style.top = top
    lastTop = top
  }
}

onMounted(() => {
  update()
  unregister = onTorchFrame(update)
  window.addEventListener('resize', update)
})
onBeforeUnmount(() => {
  if (unregister) unregister()
  window.removeEventListener('resize', update)
})
</script>

<template>
  <div ref="el" class="torch-mark"><slot /></div>
</template>

<style scoped>
.torch-mark {
  position: absolute;
  translate: -50% -50%;
  white-space: nowrap;
  color: #00ffff;
  text-shadow: -1px 0 0 #000, 1px 0 0 #000, 0 -1px 0 #000, 0 1px 0 #000;
}
</style>
