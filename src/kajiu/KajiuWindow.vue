<template>
  <!-- 信号波 Teleport 到 body，窗口是 overflow:hidden 的 -->
  <Teleport to="body">
    <div ref="linkEl" class="kajiu-link" :style="waveStyle" aria-hidden="true">
      <span v-for="n in MAX_BANDS" :key="n" class="kajiu-link__band">(</span>
    </div>
  </Teleport>

  <PixelWindow
    ref="winRef"
    class="kajiu-window"
    topMost
    centered
    width="min(820px, 88vw)"
    height="300px"
    :style="{ '--kajiu-frame': palette.frame, '--kajiu-title': palette.title }"
    :disabled-controls="{ minimize: true, maximize: true }"
    @close="kajiuWindowOpen = false"
  >
    <template #title>
      KAJiU<span class="kajiu-window__sub">~
        <em>{{ isKajiuBar ? 'bar' : 'cafe' }}</em>
      </span>
    </template>
    <div class="kajiu-body">
      <svg class="kajiu-room" viewBox="0 0 1000 300" preserveAspectRatio="none" aria-hidden="true">
        <g fill="none" stroke="currentColor" stroke-width="1" shape-rendering="crispEdges">
          <rect x="140" y="60" width="720" height="180" stroke-width="2" />
        </g>
        <g class="kajiu-room__pixels" shape-rendering="crispEdges">
          <rect v-for="(b, i) in stairBlocks" :key="i" :x="b.x" :y="b.y" :width="STAIR_PIXEL" :height="STAIR_PIXEL" />
        </g>
        <g fill="none" stroke="currentColor" stroke-width="1" shape-rendering="crispEdges">
          <path class="kajiu-room__frame" d="M0 0H1000M0 300H1000M0 0V300M1000 0V300" />
        </g>
      </svg>
    </div>
  </PixelWindow>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import PixelWindow from '@/components/PixelWindow.vue'
import { Z } from '@/stores/windowZ.js'
import { isKajiuBar, kajiuFocusTick, kajiuWindowOpen } from './kajiuHours.js'

// 咖啡时间：金黄边框 / 棕黄标题；酒吧时间：青绿边框 / 蓝色标题
const palette = computed(() =>
  isKajiuBar.value
    ? { frame: '#2fe6c8', title: '#4d8dff' }
    : { frame: '#ffd447', title: '#b7791f' },
)

const winRef = ref(null)
const linkEl = ref(null)
// 层级要在 rAF 里读窗口的 z-index 再写，computed 只给个初值
const waveStyle = ref({ color: palette.value.frame, zIndex: Z.WINDOW_BASE - 1 })
watch(palette, (p) => {
  waveStyle.value.color = p.frame
})
const focusTick = kajiuFocusTick

const STAIR_PIXEL = 4
function blockLine(gx1, gy1, gx2, gy2) {
  const out = []
  const sx = gx2 > gx1 ? 1 : -1
  const total = Math.abs(gx2 - gx1)
  for (let i = 0; i <= total; i += 1) {
    const t = total ? i / total : 0
    const gx = gx1 + sx * i
    const gy = Math.round(gy1 + (gy2 - gy1) * t)
    out.push({ x: gx * STAIR_PIXEL - STAIR_PIXEL / 2, y: gy * STAIR_PIXEL - STAIR_PIXEL / 2 })
  }
  return out
}
// 内框四角落在格 (35,15)-(215,60)，四角连外框四角
const stairBlocks = [
  ...blockLine(0, 0, 35, 15),
  ...blockLine(250, 0, 215, 15),
  ...blockLine(0, 75, 35, 60),
  ...blockLine(250, 75, 215, 60),
]

// 括号池固定：份数够覆盖任何屏幕的连线即可，Vue 永不增删节点
const MAX_BANDS = 200
const WAVE_STEP = 26
const WAVE_SIZE_NEAR = 64
const WAVE_SIZE_FAR = 10
const WAVE_SPEED = 64
const WAVE_FADE = 60

let raf = 0
let lastSeg = ''
let layerDirty = true
let geom = null

function winEl() {
  return document.querySelector('.kajiu-window')
}

// 窗口自己的 z-index 可能是数字也可能是 auto
function windowZ(el) {
  if (!el) return 0
  const v = getComputedStyle(el).zIndex
  return v === 'auto' ? 0 : Number(v)
}

function boxLink(b, w) {
  const bcx = b.left + b.width / 2
  const bcy = b.top + b.height / 2
  const wcx = w.left + w.width / 2
  const wcy = w.top + w.height / 2
  let dx = bcx - wcx
  let dy = bcy - wcy
  const d = Math.hypot(dx, dy)
  if (d < 1) return null
  dx /= d
  dy /= d
  const hit = (r, cx, cy, sign) => {
    const tx = dx ? r.width / 2 / Math.abs(dx) : Infinity
    const ty = dy ? r.height / 2 / Math.abs(dy) : Infinity
    const t = Math.min(tx, ty)
    return { x: cx + sign * dx * t, y: cy + sign * dy * t }
  }
  const from = hit(w, wcx, wcy, 1)
  const to = hit(b, bcx, bcy, -1)
  return { x1: from.x, y1: from.y, x2: to.x, y2: to.y }
}

// 每帧量 badge 与窗口，端点取整后再判断变化
// 这个遇到的问题和雪花飘飘歌词波浪动是类似的
function measure() {
  const badgeEl = document.querySelector('.kajiu-badge')
  const windowEl = document.querySelector('.kajiu-window')
  if (!badgeEl || !windowEl) return
  const seg = boxLink(badgeEl.getBoundingClientRect(), windowEl.getBoundingClientRect())
  if (!seg) {
    lastSeg = ''
    geom = null
    return
  }
  const x1 = Math.round(seg.x1)
  const y1 = Math.round(seg.y1)
  const x2 = Math.round(seg.x2)
  const y2 = Math.round(seg.y2)
  const key = `${x1},${y1},${x2},${y2}`
  if (key === lastSeg) return
  lastSeg = key
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy)
  if (len < 1) {
    geom = null
    return
  }
  geom = {
    x1,
    y1,
    ux: dx / len,
    uy: dy / len,
    len,
    // 角度取整：窗口静止时旋转恒定，字符不会因 0.1 度的角度变化反复栅格化
    angle: Math.round((Math.atan2(dy, dx) * 180) / Math.PI),
  }
}

// 绝对时间算位移，不累加帧间隔（rAF 间隔本身在抖）
// 字号取偶数：括号方框宽高都是整数，-50% 居中偏移才落在整像素，文字不抖
function paintWaves(ts) {
  if (!geom || !linkEl.value) return
  const { x1, y1, ux, uy, len, angle } = geom
  const offset = ((ts / 1000) * WAVE_SPEED) % WAVE_STEP
  const kids = linkEl.value.children
  for (let i = 0; i < kids.length; i += 1) {
    const pos = i * WAVE_STEP - offset
    const el = kids[i]
    if (pos < -WAVE_STEP || pos > len + WAVE_STEP) {
      el.style.opacity = '0'
      continue
    }
    const t = Math.min(Math.max(pos / len, 0), 1)
    const raw = WAVE_SIZE_NEAR + (WAVE_SIZE_FAR - WAVE_SIZE_NEAR) * t
    const size = 2 * Math.round(raw / 2)
    const d = pos - size / 2
    const edge = Math.min(Math.max(pos / WAVE_FADE, 0), Math.max((len - pos) / WAVE_FADE, 0), 1)
    el.style.left = `${Math.round(x1 + ux * d)}px`
    el.style.top = `${Math.round(y1 + uy * d)}px`
    el.style.width = `${size}px`
    el.style.height = `${size}px`
    el.style.fontSize = `${size}px`
    el.style.opacity = (0.7 * edge).toFixed(3)
    el.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`
  }
}

function track(ts) {
  measure()
  paintWaves(ts)
  if (layerDirty) {
    layerDirty = false
    waveStyle.value.zIndex = (windowZ(winEl()) || Z.WINDOW_BASE) - 1
  }
  raf = requestAnimationFrame(track)
}

onMounted(() => {
  raf = requestAnimationFrame(track)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
})

// 窗口刚打开时补一次层级重算
watch(kajiuWindowOpen, (open) => {
  if (!open) return
  requestAnimationFrame(() => { layerDirty = true })
})

watch(focusTick, () => {
  layerDirty = true
})

watch(isKajiuBar, () => {
  layerDirty = true
})

defineExpose({
  focus: () => {
    // topMost 窗口恒在图标之上，不需要置顶；只重算连线层级
    layerDirty = true
  },
})
</script>

<style scoped>
/* 沿用窗口贴图边框的形状，用同色 mask 上色，类似 wiki 的做法 */
.kajiu-window {
  border-image-source: none;
  border-color: transparent;
  /* 染色层要盖到 border 区 */
  overflow: visible;
}

.kajiu-window::before {
  content: '';
  position: absolute;
  inset: -6px;
  border-radius: 8px;
  background: var(--kajiu-frame);
  -webkit-mask-box-image: url('/assets/window_frame.png') 6 round;
  -webkit-mask-box-image-width: 6px;
  mask-border: url('/assets/window_frame.png') 6 round;
  mask-border-width: 6px;
  pointer-events: none;
}

.kajiu-window :deep(.pixel-titlebar__title) {
  color: var(--kajiu-title);
  /* 特判去掉全局标题的强制大写 */
  text-transform: none;
}

/* 斜体小标题，斜杠分隔符保持正体 */
.kajiu-window__sub {
  margin-left: 6px;
  font-size: 0.62em;
  letter-spacing: 0;
}

.kajiu-window__sub em {
  font-style: italic;
  text-transform: none;
}

/* 收紧内容区内边距 */
.kajiu-window :deep(.pixel-window__content) {
  padding: 2px 4px 4px;
}

.kajiu-body {
  position: relative;
  /* 父级 .pixel-window__content 不是 flex，flex:1 无效；明确撑满才有高度给绝对定位的 SVG */
  height: 100%;
}

.kajiu-room {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  color: #808080;
}

.kajiu-room * {
  vector-effect: non-scaling-stroke;
}

/* 房间外框比内部透视线粗，拉开主次 */
.kajiu-room__frame {
  stroke: #ffffff;
  stroke-width: 4;
}

.kajiu-room__pixels rect {
  fill: currentColor;
  stroke: none;
}

.kajiu-link {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
  mix-blend-mode:hard-light;
}

/* 括号方框宽高由脚本设为偶数整数，flex 居中字符，-50% 偏移才落在整像素 */
.kajiu-link__band {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-pixel);
  line-height: 1;
  color: currentColor;
  text-shadow: 0 0 4px currentColor, 0 0 10px currentColor, 0 0 20px color-mix(in srgb, currentColor 55%, transparent);
  white-space: pre;
  opacity: 0;
}
</style>
