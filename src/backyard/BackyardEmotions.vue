<template>
  <DesktopIcon
    class="emotions-icon"
    initial-left="calc(var(--backyard-cx) + var(--backyard-w) / 2 - 100px)"
    initial-top="calc(var(--backyard-top) + 16px)"
    :always-top="false"
    @click="visible = true"
  >
    <template #icon>
      <span class="emotions-icon-stack" :class="{ 'is-sad': faceSad }">
        <img class="desktop-icon-img emotions-face" :src="FACE_SRC" alt="" draggable="false" @dragstart.prevent />
        <img class="desktop-icon-img emotions-face emotions-face--sad" :src="FACE_SAD_SRC" alt="" draggable="false" @dragstart.prevent />
        <img class="desktop-icon-img" :style="{ translate: iconDropTranslate }" :src="DROP_SRC" alt="" draggable="false" @dragstart.prevent />
      </span>
    </template>
  </DesktopIcon>

  <PixelWindow
    v-if="visible"
    class="emotions-window"
    title="EMOTIONS"
    :left="windowLeft"
    top="var(--backyard-top)"
    width="min(360px, 70vw)"
    :disabled-controls="{ minimize: true, maximize: true }"
    @close="visible = false"
    @dragmove="onEmotionsDragMove"
    @dragend="onEmotionsDragEnd"
  >
    <div class="emotions-body">
      <span class="emotions-label">{{ emotionLabel }}</span>
      <div ref="stackEl" class="emotions-stack" :class="{ 'is-sad': faceSad }">
        <img class="emotions-face" :src="FACE_SRC" alt="emotions" draggable="false" @dragstart.prevent />
        <img class="emotions-face emotions-face--sad" :src="FACE_SAD_SRC" alt="" draggable="false" @dragstart.prevent />
        <Teleport to="body" :disabled="!carried">
          <img
            ref="dropEl"
            class="emotions-drop"
            :class="{ 'is-carried': carried, 'is-dragging': dragging, 'is-hot': dropHot }"
            :style="dropStyle"
            :src="DROP_SRC"
            alt=""
            draggable="false"
            @dragstart.prevent
            @pointerdown="onDown"
            @pointermove="onDropHover"
            @pointerleave="dropHot = false"
          />
        </Teleport>
        <div v-if="showRegions" class="emotions-regions" aria-hidden="true">
          <div
            v-for="g in REGIONS"
            :key="g.id"
            class="emotions-region"
            :class="'emotions-region--' + g.id"
            :style="{ top: g.v[0] * 100 + '%', height: (g.v[1] - g.v[0]) * 100 + '%' }"
          >
            <span>{{ g.id }} {{ g.v[0] }} - {{ g.v[1] }}</span>
          </div>
        </div>
      </div>
    </div>
  </PixelWindow>

  <MesBin ref="bin" :visible="dragging" placement="top" />

  <FlowerSpit ref="spitRef" />
  <SorryBlackout v-if="blackout" />
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import DesktopIcon from '@/components/DesktopIcon.vue'
import MesBin from '@/components/MesBin.vue'
import PixelWindow from '@/components/PixelWindow.vue'
import { useDialogFlow } from '@/dialogs/useDialogFlow.js'
import { useShakeDetect } from '@/composables/useShakeDetect.js'
import FlowerSpit from './FlowerSpit.vue'
import SorryBlackout from './SorryBlackout.vue'

const FACE_SRC = '/assets/emotion_face.png'
const FACE_SAD_SRC = '/assets/emotion_face_sad.png'
const DROP_SRC = '/assets/emotion_drop.png'
const DRAG_THRESHOLD = 4
const CARRY_RELEASE_MS = 240
const FACE_RESTORE_MS = 3000
const EMOTIONS_SHAKE = {
  minPath: 130,
  minReversals: 1,
  minSwing: 28,
  maxNetRatio: 0.4,
  cooldownMs: 180,
}

new Image().src = FACE_SAD_SRC

const faceSad = ref(false)
const spitRef = ref(null)
const blackout = ref(false)
let faceTimer = 0

function scheduleFaceRestore() {
  clearTimeout(faceTimer)
  faceTimer = setTimeout(() => { faceSad.value = false }, FACE_RESTORE_MS)
}

function onEmotionsShake(dir) {
  if (faceSad.value && spitRef.value?.burst(dir)) {
    blackout.value = true
    return
  }
  faceSad.value = true
  emotion.value = 'default'
  scheduleFaceRestore()
}

const emotionsShake = useShakeDetect(onEmotionsShake, EMOTIONS_SHAKE)

function onEmotionsDragMove({ x, y }) {
  emotionsShake.push(x, y)
}

function onEmotionsDragEnd() {
  emotionsShake.reset()
}

// 判定区间，dev 下可按调试组合键查看可视化（见下）
const REGIONS = [
  { id: 'eyes', v: [0.16, 0.48] },
  { id: 'nose', v: [0.48, 0.60] },
  { id: 'mouth', v: [0.60, 1.0] },
]

// 将 drop 尖端作为要匹配的判定点
const DROP_HOT = { x: 0.838, y: 0.113 }

// 各挂载点相对默认位置的位移，px = 比例乘上 face 边长
const ANCHORS = {
  default: { x: 0, y: 0 },
  eyes: { x: 0.028, y: 0.432 },
  nose: { x: -0.303, y: 0.499 },
  mouth: { x: -0.142, y: 0.671 },
}

const LABELS = { default: '怒', eyes: '喜', nose: '哀', mouth: '饿' }

// 判定带只在 dev 下由快捷键切换，默认关
const DEBUG_REGIONS = import.meta.env.DEV
const showRegions = ref(false)

function onEmotionsKeydown(e) {
  if (e.ctrlKey && e.altKey && e.shiftKey && e.key.toLowerCase() === 's') {
    e.preventDefault()
    showRegions.value = !showRegions.value
  }
}

const dlg = useDialogFlow()
const visible = ref(false)
const viewportW = ref(window.innerWidth)
const onResize = () => { viewportW.value = window.innerWidth }
onMounted(() => {
  window.addEventListener('resize', onResize)
  if (DEBUG_REGIONS) window.addEventListener('keydown', onEmotionsKeydown)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  window.removeEventListener('keydown', onEmotionsKeydown)
  removeListeners()
  clearTimeout(carryTimer)
  clearTimeout(faceTimer)
  document.body.style.cursor = ''
})

// 窗口默认贴后院框右侧，右边放不下就挪到框左侧
const GAP = 20
const windowLeft = computed(() => {
  const vw = viewportW.value
  const frameW = Math.min(1000, vw * 0.88)
  const winW = Math.min(360, vw * 0.7)
  const rightEdge = vw * 0.4 + frameW / 2
  if (rightEdge + GAP + winW + GAP <= vw) return `${Math.round(rightEdge + GAP)}px`
  return `${Math.max(GAP, Math.round(vw * 0.4 - frameW / 2 - GAP - winW))}px`
})

const dropEl = ref(null)
const stackEl = ref(null)
const bin = ref(null)
const dragging = ref(false)
const carried = ref(false)
const EMOTION_KEY = 'emotions.state'
function readEmotion() {
  try {
    const v = localStorage.getItem(EMOTION_KEY)
    return v && Object.hasOwn(LABELS, v) ? v : 'default'
  } catch {
    return 'default'
  }
}
const emotion = ref(readEmotion())
watch(emotion, (v) => {
  try {
    localStorage.setItem(EMOTION_KEY, v)
  } catch {
    // 存不下就算了，这次会话内照常生效
  }
})
const emotionLabel = computed(() => LABELS[emotion.value])
// 窗口里的 drop 边长，用来把拖拽位移换算成图标自身的百分比
const DROP_DISPLAY_PX = 200
const iconDropTranslate = computed(() => {
  const a = ANCHORS[emotion.value]
  const dx = dragging.value ? offset.value.x / DROP_DISPLAY_PX : 0
  const dy = dragging.value ? offset.value.y / DROP_DISPLAY_PX : 0
  return `${(a.x + dx) * 100}% ${(a.y + dy) * 100}%`
})
const offset = ref({ x: 0, y: 0 })
const carryCenter = ref({ x: 0, y: 0 })
const dropStyle = computed(() => {
  const a = ANCHORS[emotion.value]
  return {
    '--ed-x': offset.value.x + 'px',
    '--ed-y': offset.value.y + 'px',
    '--ed-cx': carryCenter.value.x + 'px',
    '--ed-cy': carryCenter.value.y + 'px',
    '--ed-ax': a.x * 100 + '%',
    '--ed-ay': a.y * 100 + '%',
  }
})

// 因为我导出的 drop 贴图和 face 是一样大的，所以按贴图 alpha 过滤透明像素不参与 hover 指针和拖拽行为
let dropAlpha = null
const dropHot = ref(false)

function loadDropAlpha() {
  const img = new Image()
  img.onload = () => {
    const c = document.createElement('canvas')
    c.width = img.naturalWidth
    c.height = img.naturalHeight
    const ctx = c.getContext('2d')
    ctx.drawImage(img, 0, 0)
    const { data } = ctx.getImageData(0, 0, c.width, c.height)
    const a = new Uint8Array(c.width * c.height)
    for (let i = 0; i < a.length; i++) a[i] = data[i * 4 + 3] > 0 ? 1 : 0
    dropAlpha = { w: c.width, h: c.height, a }
  }
  img.src = DROP_SRC
}
loadDropAlpha()

function hitDropPixel(e) {
  const el = dropEl.value
  if (!dropAlpha || !el) return true
  const r = el.getBoundingClientRect()
  const u = (e.clientX - r.left) / r.width
  const v = (e.clientY - r.top) / r.height
  if (u < 0 || u >= 1 || v < 0 || v >= 1) return false
  return dropAlpha.a[Math.floor(v * dropAlpha.h) * dropAlpha.w + Math.floor(u * dropAlpha.w)] === 1
}

function onDropHover(e) {
  dropHot.value = hitDropPixel(e)
}

let start = null
let moved = false
let carryTimer = 0

function onDown(e) {
  if (e.button !== 0 || !hitDropPixel(e)) return
  start = { x: e.clientX, y: e.clientY }
  moved = false
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
}

function onMove(e) {
  if (!start) return
  const dx = e.clientX - start.x
  const dy = e.clientY - start.y
  if (!moved) {
    if (Math.hypot(dx, dy) <= DRAG_THRESHOLD) return
    const r = dropEl.value.getBoundingClientRect()
    carryCenter.value = { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    moved = true
    carried.value = true
    dragging.value = true
    document.body.style.cursor = 'move'
  }
  offset.value = { x: dx, y: dy }
}

function hitRegion(x, y) {
  const el = stackEl.value
  if (!el) return null
  const r = el.getBoundingClientRect()
  const u = (x - r.left) / r.width
  const v = (y - r.top) / r.height
  if (u < 0 || u > 1 || v < 0 || v > 1) return null
  return REGIONS.find((g) => v >= g.v[0] && v <= g.v[1])?.id ?? null
}

// mesbin 拒收
function onUp(e) {
  removeListeners()
  const fed = moved && (bin.value?.over(e.clientX, e.clientY) ?? false)
  const dr = dropEl.value?.getBoundingClientRect()
  const hot = dr
    ? { x: dr.left + dr.width * DROP_HOT.x, y: dr.top + dr.height * DROP_HOT.y }
    : { x: e.clientX, y: e.clientY }
  const hit = fed || !moved ? null : hitRegion(hot.x, hot.y)
  emotion.value = hit ?? 'default'
  dragging.value = false
  document.body.style.cursor = ''
  if (fed) dlg.start('emotionDropRefused')
  const r = stackEl.value?.getBoundingClientRect()
  const a = ANCHORS[emotion.value]
  offset.value = moved && r
    ? {
      x: r.left + r.width / 2 + r.width * a.x - carryCenter.value.x,
      y: r.top + r.height / 2 + r.height * a.y - carryCenter.value.y,
    }
    : { x: 0, y: 0 }
  clearTimeout(carryTimer)
  if (moved) {
    carryTimer = setTimeout(() => {
      carried.value = false
      offset.value = { x: 0, y: 0 }
    }, CARRY_RELEASE_MS)
  }
  moved = false
  start = null
}

function removeListeners() {
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
  window.removeEventListener('pointercancel', onUp)
}
</script>

<style scoped>
.emotions-window {
  min-width: min-content;
}

/* 抵掉 PixelWindow 默认的垂直居中位移，让窗口顶边落在框顶 */
.emotions-window:not(.is-manual) {
  translate: 0 50%;
}

.emotions-icon-stack {
  display: grid;
  width: 100%;
  height: 100%;
}

.desktop-icon-img {
  grid-area: 1 / 1;
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
}

.emotions-body {
  position: relative;
  display: flex;
  overflow: clip;
  overflow-clip-margin: 14px;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.emotions-label {
  position: absolute;
  top: -10px;
  left: 0;
  z-index: 1;
  color: #fff;
  font-size: 44px;
  line-height: 1;
  pointer-events: none;
}

.emotions-stack {
  display: grid;
  width: 200px;
  height: 200px;
}

.emotions-regions {
  grid-area: 1 / 1;
  position: relative;
  pointer-events: none;
}

.emotions-region {
  position: absolute;
  left: 0;
  right: 0;
  border-top: 1px solid;
  border-bottom: 1px solid;
}

.emotions-region--eyes {
  background: rgba(0, 170, 255, 0.16);
  border-color: rgba(0, 170, 255, 0.85);
}

.emotions-region--nose {
  background: rgba(255, 200, 0, 0.2);
  border-color: rgba(255, 200, 0, 0.9);
}

.emotions-region--mouth {
  background: rgba(255, 80, 80, 0.16);
  border-color: rgba(255, 80, 80, 0.85);
}

.emotions-region span {
  position: absolute;
  top: 1px;
  left: 2px;
  font-size: 9px;
  line-height: 1;
  color: #000;
  background: rgba(255, 255, 255, 0.8);
}

.emotions-face,
.emotions-drop {
  grid-area: 1 / 1;
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
}

/* 两张 face 同时挂载，切换时不用等图片下载 */
.emotions-face--sad {
  opacity: 0;
}

.is-sad .emotions-face:not(.emotions-face--sad) {
  opacity: 0;
}

.is-sad .emotions-face--sad {
  opacity: 1;
}

.emotions-drop {
  cursor: default;
  touch-action: none;
  user-select: none;
  translate: var(--ed-ax) var(--ed-ay);
}

.emotions-drop.is-hot {
  cursor: move;
}

/* 拎起来后 Teleport 到 body */
.emotions-drop.is-carried {
  position: fixed;
  left: var(--ed-cx);
  top: var(--ed-cy);
  width: 200px;
  height: 200px;
  translate: calc(-50% + var(--ed-x)) calc(-50% + var(--ed-y));
  z-index: var(--z-emotions-drop);
  pointer-events: none;
}

.emotions-drop.is-carried:not(.is-dragging) {
  transition: translate 220ms ease-out;
}
</style>
