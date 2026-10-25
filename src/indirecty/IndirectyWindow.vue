<template>
  <!-- IndirectY 10000 -->
  <PixelWindow
    ref="iyWinRef"
    class="indirecty-window rainbow-palette"
    :class="{
      'is-locked': dialLocked,
      'is-flying': dialFlying || iconFlying,
      'is-gone': dialGone,
      'is-recalling': dialRecalling,
      'is-shown': dialShown,
      'is-edge': winEdgeHover,
      'is-spinning': winSpinning,
      'is-back': winBack,
      'is-frozen': frozen,
      'is-hit': hitOn,
      'is-settling': settling,
    }"
    :style="anchorStyle"
    width="30%"
    :disabled-controls="{ minimize: true, maximize: true }"
    :no-drag="(dialLocked && !dialGone) || (iconLocked && !iconGone) || winLocked || frozen"
    @close="closeIndirectyWindow"
    @pointerdown="onWinPointerDown"
    @pointermove="onWinPointerMove"
    @pointerup="onWinPointerUp"
    @pointercancel="onWinPointerUp"
    @pointerleave="onWinPointerLeave"
  >
    <template #title>
      IndirectY
      <input
        v-if="countEditing"
        ref="countInput"
        :value="countDraft"
        class="iy-count-input"
        type="text"
        inputmode="numeric"
        :style="{ width: 'calc(' + Math.max(countDraft.length, 1) + 'ch + 12px)' }"
        @mousedown="onCountMouseDown"
        @click="onCountClick"
        @input="onCountInput"
        @keydown.enter.prevent="commitCount"
        @keydown.esc.prevent="cancelCount"
        @blur="commitCount"
      />
      <span
        v-else
        class="iy-count"
        @mousedown="onCountMouseDown"
        @click="onCountClick"
      >{{ dialCount }}</span>
    </template>
    <template #icon>
      <span
        ref="iconEl"
        class="indirecty-icon"
        :class="{
          'is-draggable': iconDraggable,
          'is-dragging': iconDragging,
          'is-docked': iconDocked,
          'is-locked': iconLocked,
          'is-flying': iconFlying,
          'is-gone': iconGone,
        }"
        :style="{
          '--iy-icon-x': iconOffset.x + 'px',
          '--iy-icon-y': iconOffset.y + 'px',
          '--iy-icon-dock-scale': ICON_DOCK_SCALE,
        }"
        aria-hidden="true"
        @mousedown="onIconMouseDown"
        @pointerdown="onIconPointerDown"
        @pointermove="onIconSpinMove"
        @pointerup="onIconSpinUp"
        @pointercancel="onIconSpinUp"
      />
      <DialogBubble
        v-if="bubble"
        :text="bubble"
        :side="bubbleSide"
        :below="bubbleBelow"
        :leaving="bubbleLeaving"
      />
    </template>
    <div
      ref="dialEl"
      class="indirecty-dial"
      :class="{ 'is-returning': dialReturning }"
      :style="{ '--iy-return-ms': DIAL_RETURN_MS + 'ms' }"
      @pointerdown="onDialDown"
      @pointermove="onDialMove"
      @pointerup="onDialUp"
      @pointercancel="onDialUp"
    />
    <CallbackButton
      ref="callbackEl"
      v-if="callbackVisible"
      :leaving="callbackLeaving"
      @hit="onCallbackHit"
      @dismissed="onCallbackDismissed"
      @gone="onCallbackGone"
    />
<!--        <p class="indirecty-debug">-->
<!--          {{ Math.round(dialSpeedShown) }} px/s · {{ dialFramesPerSec.toFixed(1) }} f/s-->
<!--        </p>-->
  </PixelWindow>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref, computed, watch, nextTick } from 'vue'
import PixelWindow from '@/components/PixelWindow.vue'
import CallbackButton from './CallbackButton.vue'
import DialogBubble from '@/components/DialogBubble.vue'
import { createSpinControl } from '@/spinControl.js'
import { useDialogFlow } from '@/dialogs/useDialogFlow.js'

const emit = defineEmits(['close'])
const dlg = useDialogFlow()

const props = defineProps({
  anchor: { type: Object, default: null },
  frozen: { type: Boolean, default: false },
  settling: { type: Boolean, default: false },
  bubble: { type: String, default: '' },
  bubbleSide: { type: String, default: 'left' },
  bubbleBelow: { type: Boolean, default: false },
  bubbleLeaving: { type: Boolean, default: false },
})

// 锚点走 CSS 变量而不是内联 top / left：内联那条会被 PixelWindow 自己的定位样式合并掉
const anchorStyle = computed(() =>
  props.anchor
    ? { '--iy-anchor-left': props.anchor.left, '--iy-anchor-top': props.anchor.top }
    : null,
)

/* IndirectY 拨盘：拖动逐帧转，净转过的帧数直接进标题数字（左减右加）。
   帧数在 CSS 里还有一份（background-size 与逐帧位移），换图要一起改 */
const DIAL_SHEET = '/assets/signal_receiver-Sheet.png'
const DIAL_FRAMES = 9
const DIAL_START = 10000
const COUNT_MAX_DIGITS = 5 // 不包括负号
const ICON_DOCK_SCALE = 4 // 32px × 4 = 128px，正好是源图 16px 的 8 倍（整数倍才不糊）
const ICON_DRAG_THRESHOLD = 3 // 超过这么多 px 才算在拖，免得单击也被当成拖动
const ICON_FRAMES = 8 // sheet 横排帧数，CSS 的 mask-size 里还有一份
const ICON_IDLE_FPS = 8 // 空转速度：取它原本 CSS 动画的节奏（8 帧 / 1000ms）
new Image().src = DIAL_SHEET


const dialEl = ref(null)
const iconEl = ref(null)
const iconOffset = ref({ x: 0, y: 0 })
const iconDragging = ref(false)
const iconDocked = ref(false)
const iconDraggable = computed(() => callbackCleared.value && !iconDocked.value)
const dialCount = ref(DIAL_START)
const {
  locked: dialLocked,
  flying: dialFlying,
  gone: dialGone,
  speedShown: dialSpeedShown,
  down: onDialDown,
  move: onDialMove,
  up: onDialUp,
  reset: resetDialSpin,
  setTotal: setDialTotal,
  dispose: disposeDialSpin,
} = createSpinControl({
  frames: DIAL_FRAMES,
  el: dialEl,
  varName: '--iy-frame',
  onFrame: (_frame, total) => {
    dialCount.value = DIAL_START + total
  },
})

// 问号
const {
  locked: iconLocked,
  flying: iconFlying,
  gone: iconGone,
  down: onIconSpinDown,
  move: onIconSpinMove,
  up: onIconSpinUp,
  start: startIconSpin,
  reset: resetIconSpin,
  dispose: disposeIconSpin,
} = createSpinControl({
  frames: ICON_FRAMES,
  idleFps: ICON_IDLE_FPS,
  el: iconEl,
  varName: '--iy-icon-frame',
  enabled: () => iconDocked.value,
})

/* 窗口转盘 梅开三度 实现类似 callback 按钮 */
const WIN_EDGE_PX = 8 // 边线识别宽度
const WIN_DEG_PER_FRAME = 15 // 一格转多少度
const WIN_SETTLE_DELAY_MS = 64 // 多久没转算停下，可以惯性
const WIN_SETTLE_MS = 260 // 惯性时长

const iyWinRef = ref(null)
// PixelWindow 把根元素 expose 出来了（expose 里的 ref 是解包的，拿到的是元素本身）
const iyWinEl = computed(() => iyWinRef.value?.windowRef ?? null)
const winEdgeHover = ref(false)
const winSpinning = ref(false)
const winBack = ref(false)

function writeWinTurn(deg) {
  winShownDeg = deg
  iyWinEl.value?.style.setProperty('--iy-win-turn', deg + 'deg')
  const norm = ((deg % 360) + 360) % 360
  winBack.value = norm > 90 && norm < 270
}

const {
  locked: winLocked,
  gone: winGone,
  down: onWinSpinDown,
  move: onWinSpinMove,
  up: onWinSpinUp,
  reset: resetWinSpin,
  dispose: disposeWinSpin,
} = createSpinControl({
  // 只用来取模，窗口不用跳帧，给 1 就不会有帧序
  frames: 1,
  el: iyWinEl,
  varName: '--iy-win-frame',
  // 变量会继承：写 --fly-y 的话，里面的锅和问号会有速度叠加
  flyVar: '--iy-win-fly-y',
  onFrame: (_frame, total) => {
    writeWinTurn((total - winTurnBase) * WIN_DEG_PER_FRAME)
    if (total === winLastTotal) return
    if (winLastTotal !== null) winSpinDir = Math.sign(total - winLastTotal) || winSpinDir
    winLastTotal = total
    armWinSettle()
  },
})

let winTurnBase = 0
let winShownDeg = 0
let winLastTotal = null
let winSpinDir = 1
let winSettleTimer = 0
let winSettleRaf = 0

function armWinSettle() {
  clearTimeout(winSettleTimer)
  winSettleTimer = setTimeout(settleWinTurn, WIN_SETTLE_DELAY_MS)
}

function settleWinTurn() {
  winSettleTimer = 0
  if (winSpinning.value || winLocked.value || winLastTotal === null) return
  const from = winShownDeg
  const to = (winSpinDir < 0 ? Math.floor(from / 360) : Math.ceil(from / 360)) * 360
  const delta = to - from
  if (Math.abs(delta) < 1) return
  const t0 = performance.now()
  cancelAnimationFrame(winSettleRaf)
  const step = (now) => {
    const p = Math.min(1, (now - t0) / WIN_SETTLE_MS)
    writeWinTurn(from + delta * (1 - (1 - p) ** 3))
    if (p < 1) {
      winSettleRaf = requestAnimationFrame(step)
      return
    }
    winSettleRaf = 0
    winTurnBase = winLastTotal - to / WIN_DEG_PER_FRAME
  }
  winSettleRaf = requestAnimationFrame(step)
}

function cancelWinSettle() {
  clearTimeout(winSettleTimer)
  winSettleTimer = 0
  cancelAnimationFrame(winSettleRaf)
  winSettleRaf = 0
  if (winLastTotal !== null) winTurnBase = winLastTotal - winShownDeg / WIN_DEG_PER_FRAME
}

function resetWindowSpin() {
  winLastTotal = null
  winTurnBase = 0
  resetWinSpin()
  writeWinTurn(0)
  winSpinDir = 1
  cancelWinSettle()
}

function winEdgeHit(e) {
  const el = iyWinEl.value
  if (!el) return false
  const r = el.getBoundingClientRect()
  const x = e.clientX - r.left
  return x <= WIN_EDGE_PX || x >= r.width - WIN_EDGE_PX
}

function onWinPointerDown(e) {
  if (e.button !== 0 || !winEdgeHit(e)) return
  // 标题栏交互优先于边线识别
  if (e.target.closest?.('.pixel-titlebar')) return
  cancelWinSettle()
  winSpinning.value = true
  onWinSpinDown(e)
}

function onWinPointerMove(e) {
  winEdgeHover.value = winEdgeHit(e)
  onWinSpinMove(e)
}

function onWinPointerUp() {
  winSpinning.value = false
  onWinSpinUp()
  armWinSettle()
}

function onWinPointerLeave() {
  winEdgeHover.value = false
}

// iy 飞出去了就销毁
watch(winGone, (v) => {
  if (v) closeIndirectyWindow()
})

// debug 帧率用
// const dialFramesPerSec = computed(() => dialSpeedShown.value / SPIN_PX_PER_FRAME)

// 问号从窗口被创建的那一刻就在自己转（锅只在被拖时才转，等 pointerdown 就够）。
// rAF 在 Vue 更新完 DOM 之后才跑，所以这里虽然早于渲染、拿到的是下一帧才存在的元素也没关系
onMounted(() => {
  startIconSpin()
})

function resetState() {
  stopRecall()
  clearTimeout(returnTimer)
  clearTimeout(fadeTimer)
  resetDialSpin()
  resetIconSpin()
  resetWindowSpin()
  winSpinning.value = false
  iconOffset.value = { x: 0, y: 0 }
  iconDocked.value = false
  callbackHidden.value = false
  callbackLeaving.value = false
  callbackCleared.value = false
  dialShown.value = false
  dialRecalling.value = false
  dialReturning.value = false
  startIconSpin()
}

const countEditing = ref(false)
const countDraft = ref('')
const countInput = ref(null)
const COUNT_DRAG_SLOP = 5
let countDownAt = null

function beginEditCount() {
  if (props.frozen) return
  countDraft.value = String(dialCount.value)
  countEditing.value = true
  // 元素下一帧才存在，focus 得等它挂上
  nextTick(() => {
    const el = countInput.value
    if (!el) return
    el.focus()
    const end = el.value.length
    el.setSelectionRange(end, end)
  })
}

/* 加文本框不影响拖拽标题栏不然体验不是很好，加个判定 */
function onCountMouseDown(e) {
  countDownAt = { x: e.clientX, y: e.clientY }
  e.preventDefault()
}
function onCountClick(e) {
  const from = countDownAt
  countDownAt = null
  if (from && Math.hypot(e.clientX - from.x, e.clientY - from.y) > COUNT_DRAG_SLOP) return
  if (!countEditing.value) {
    beginEditCount()
    return
  }
  const el = countInput.value
  if (!el) return
  el.focus()
  const end = el.value.length
  el.setSelectionRange(end, end)
}

/* 最多五位数字，不包括开头允许的- */
function onCountInput(e) {
  const el = e.target
  const raw = el.value
  const signed = raw.replace(/[^\d-]/g, '').replace(/(?!^)-/g, '')
  const neg = signed.startsWith('-')
  const digits = (neg ? signed.slice(1) : signed).slice(0, COUNT_MAX_DIGITS)
  const cleaned = (neg ? '-' : '') + digits
  countDraft.value = cleaned
  if (cleaned === raw) return
  const pos = el.selectionStart ?? raw.length
  const back = Math.max(0, pos - (raw.length - cleaned.length))
  el.value = cleaned
  el.setSelectionRange(back, back)
}

function cancelCount() {
  countEditing.value = false
}

function commitCount() {
  if (!countEditing.value) return
  countEditing.value = false
  const n = Number.parseInt(countDraft.value.trim(), 10)
  if (!Number.isFinite(n)) return
  setDialTotal(n - DIAL_START)
}

function closeIndirectyWindow() {
  resetState()
  emit('close')
}

function focusWindow() {
  iyWinRef.value?.bringToFront()
}

const HIT_FLASH_MS = 160
let hitTimer = 0
function flashHit() {
  clearTimeout(hitTimer)
  hitOn.value = false
  requestAnimationFrame(() => {
    hitOn.value = true
    hitTimer = setTimeout(() => (hitOn.value = false), HIT_FLASH_MS)
  })
}

defineExpose({ rootEl: iyWinEl, resetState, resetWindowSpin, focusWindow, flashHit })

onBeforeUnmount(() => {
  disposeDialSpin()
  disposeIconSpin()
  disposeWinSpin()
  clearTimeout(winSettleTimer)
  clearTimeout(hitTimer)
  cancelAnimationFrame(winSettleRaf)
  stopRecall()
  clearTimeout(returnTimer)
  clearTimeout(fadeTimer)
})

// 标题栏的 mousedown 会启动拖窗，图标可拖期间要把它拦在自己这层
function onIconMouseDown(e) {
  if (iconDraggable.value || iconDocked.value) e.stopPropagation()
}

// 拖动照抄 UpdateNotice 那一套：位移写 translate，松手去掉 is-dragging 让过渡把元素送回去
let iconStart = null
let iconMoved = false

function onIconDown(e) {
  if (e.button !== 0 || !iconDraggable.value) return
  iconStart = { x: e.clientX, y: e.clientY, ox: iconOffset.value.x, oy: iconOffset.value.y }
  iconMoved = false
  window.addEventListener('pointermove', onIconMove)
  window.addEventListener('pointerup', onIconUp)
}

// 落位前是「拖去停靠」、落位后是「拖着转」，两条路互斥，合成一个入口给模板
function onIconPointerDown(e) {
  onIconDown(e)
  onIconSpinDown(e)
}

function onIconMove(e) {
  const dx = e.clientX - iconStart.x
  const dy = e.clientY - iconStart.y
  if (!iconMoved && Math.hypot(dx, dy) > ICON_DRAG_THRESHOLD) {
    iconMoved = true
    iconDragging.value = true
  }
  if (!iconMoved) return
  iconOffset.value = { x: iconStart.ox + dx, y: iconStart.oy + dy }
}

function onIconUp() {
  window.removeEventListener('pointermove', onIconMove)
  window.removeEventListener('pointerup', onIconUp)
  if (!iconMoved) return
  iconDragging.value = false
  if (overDockSpot()) dockIcon()
  else iconOffset.value = { x: 0, y: 0 }
}

// 落点是「内容区」而不是信号锅本身：锅被 translate 抬出视口了，它的矩形早就在屏幕外，
// 拿它判落点必然永远不中。父级（.pixel-window__content）没被位移过，就是那块空出来的地方
function dockSpotRect() {
  return dialEl.value?.parentElement?.getBoundingClientRect() ?? null
}

// 判定看图标自己的中心而不是指针：被拖着走的是图标，看它落哪儿才符合手感
function overDockSpot() {
  const el = iconEl.value
  const b = dockSpotRect()
  if (!el || !b) return false
  const a = el.getBoundingClientRect()
  const cx = a.left + a.width / 2
  const cy = a.top + a.height / 2
  return cx >= b.left && cx <= b.right && cy >= b.top && cy <= b.bottom
}

function dockIcon() {
  const el = iconEl.value
  const b = dockSpotRect()
  if (!el || !b) return
  const a = el.getBoundingClientRect()
  iconOffset.value = {
    x: iconOffset.value.x + (b.left + b.width / 2) - (a.left + a.width / 2),
    y: iconOffset.value.y + (b.top + b.height / 2) - (a.top + a.height / 2),
  }
  iconDocked.value = true
}

/* callback 阶段 */
const DIAL_RETURN_MS = 1200 // 归位动画时长，CSS 的 --iy-return-ms 用的是同一个值
const CALLBACK_FADE_MS = 460 // 按钮渐隐，跟组件里 --cb-swallow-ms 对齐
const QTE_HOLD_MS = 220 // 一击能拽多久，不续上下一击，锅立刻又开始往上跑
// 连点的速度门槛
const QTE_GAP_MS = 200 // ≈ 每秒 5 下
const DIAL_ESCAPE_SPEED = 110
const DIAL_PULL_SPEED = 170 // 拽回来的速度 px/s
// 出视口之后再退多少就停住
const DIAL_ESCAPE_EXTRA = 200

const callbackEl = ref(null)
const hitOn = ref(false)
const callbackHidden = ref(false)
const callbackLeaving = ref(false)
const callbackCleared = ref(false)
const dialRecalling = ref(false)
// 在视口里就必须看得见（不管有没有在拽）；出视口之后只在正被拽的那一段显形
const dialShown = ref(false)
const dialReturning = ref(false)
const callbackVisible = computed(() => dialGone.value && !callbackHidden.value)

let recallRaf = 0
let recallLast = 0
let recallY = 0
// 锅从等待位到内容区这段路有多长：按钮的放大比例按它折算，否则「近了多少」没有参照
let qteSpan = 0
let pullUntil = 0
// 上一击的时刻：判定「连没连上」用的就是它
let lastHitAt = 0
// 没人拽的时候锅该待的屏幕 bottom（视口坐标）：窗口再怎么拖它都留在这个高度上
let anchorBottom = null
let returnTimer = 0
let fadeTimer = 0

// 锅一出视口就瞬移到视口外 DIAL_ESCAPE_EXTRA 停住等，否则立即点击 callback 会闪现（因为还没真正移出去）
watch(dialGone, (v) => {
  if (!v) return
  pullUntil = 0
  anchorBottom = null
  const el = dialEl.value
  if (!el) return
  const y = parseFloat(el.style.getPropertyValue('--fly-y')) || 0
  recallY = y - (el.getBoundingClientRect().bottom + DIAL_ESCAPE_EXTRA)
  el.style.setProperty('--fly-y', recallY + 'px')
  // 先落位再量：等待位到内容区的距离就是这一段 QTE 的全长
  qteSpan = Math.max(dialGap() ?? 0, 1)
  startRecall()
})

function startRecall() {
  const el = dialEl.value
  if (!el || recallRaf) return
  recallY = parseFloat(el.style.getPropertyValue('--fly-y')) || 0
  recallLast = performance.now()
  dialRecalling.value = true
  recallRaf = requestAnimationFrame(stepRecall)
}

function stepRecall(now) {
  const dt = Math.min((now - recallLast) / 1000, 0.1)
  recallLast = now
  const pulling = performance.now() < pullUntil
  const el = dialEl.value
  const rect = el?.getBoundingClientRect()
  if (pulling) {
    // 被拽着走的时候锅是相对窗口运动的，之前那个锚点作废
    anchorBottom = null
    recallY = Math.min(recallY + DIAL_PULL_SPEED * dt, 0)
  } else if (rect) {
    if (anchorBottom === null) anchorBottom = rect.bottom
    // 抵消窗口拖动是瞬时、不限速的（它只是把锅放回锚点）—— 限速的 90px/s 跟不上手拖窗口的速度，
    // 锅会被一路带进视口。锚点只升不降：窗口往上抬时让锅跟着，否则一抬窗口等于把锅接回来了
    anchorBottom = Math.min(anchorBottom, rect.bottom)
    recallY += anchorBottom - rect.bottom
    // 没人拽就继续往上退，退到视口外 DIAL_ESCAPE_EXTRA 停住
    if (anchorBottom > -DIAL_ESCAPE_EXTRA) {
      const step = Math.min(DIAL_ESCAPE_SPEED * dt, anchorBottom + DIAL_ESCAPE_EXTRA)
      anchorBottom -= step
      recallY -= step
    }
  }
  el?.style.setProperty('--fly-y', recallY + 'px')
  const gap = dialGap()
  if (gap !== null) {
    callbackEl.value?.setCharge(1 - Math.min(Math.max(gap, 0) / qteSpan, 1))
  }
  if (pulling) dialShown.value = true
  else if (!dialInViewport()) dialShown.value = false
  if (dialInContent()) {
    finishRecall()
    return
  }
  // 退到位之后位置不动了，但循环不能停：显形以后要一直盯着它有没有又出视口，
  // 而拖窗口也会改变这个判定
  recallRaf = requestAnimationFrame(stepRecall)
}

// 判断锅有没有进到视口里：进视口就必须显形，没进就必须透明
function dialInViewport() {
  const a = dialEl.value?.getBoundingClientRect()
  if (!a) return false
  return a.bottom > 0 && a.top < window.innerHeight
}

// 锅底到内容区上沿还差多少
function dialGap() {
  const el = dialEl.value
  const b = dockSpotRect()
  if (!el || !b) return null
  return b.top - el.getBoundingClientRect().bottom
}

// 成功判据是锅的任意一部分进了内容区
function dialInContent() {
  const el = dialEl.value
  const b = dockSpotRect()
  if (!el || !b) return false
  const a = el.getBoundingClientRect()
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}

function stopRecall() {
  cancelAnimationFrame(recallRaf)
  recallRaf = 0
  anchorBottom = null
  dialShown.value = false
}

function onCallbackHit() {
  const now = performance.now()
  if (now - lastHitAt <= QTE_GAP_MS) pullUntil = now + QTE_HOLD_MS
  else {
    // 没连上，这一击不生效，并弹一下作为提示
    pullUntil = 0
    callbackEl.value?.nudge()
  }
  lastHitAt = now
  startRecall()
}

function finishRecall() {
  stopRecall()
  // 归位那一段要看得见（is-gone 把它压成透明了）
  dialShown.value = true
  callbackLeaving.value = true
  fadeTimer = setTimeout(() => {
    callbackHidden.value = true
  }, CALLBACK_FADE_MS)
  dialLocked.value = false
  dialReturning.value = true
  requestAnimationFrame(() => {
    dialEl.value?.style.setProperty('--fly-y', '0px')
  })
  returnTimer = setTimeout(endReturn, DIAL_RETURN_MS)
}

function endReturn() {
  dialReturning.value = false
  dialRecalling.value = false
  dialShown.value = false
  resetDialSpin()
  callbackLeaving.value = false
  // 锅复原了，下一轮它再飞走时按钮要能再出来
  callbackHidden.value = false
}

function onCallbackDismissed() {
  stopRecall()
  callbackHidden.value = true
  dlg.start('callbackDismissed')
  // 开启问号拖拽
  const stop = watch(dlg.visible, (v) => {
    if (v) return
    stop()
    callbackCleared.value = true
  })
}

function onCallbackGone() {
  stopRecall()
  callbackHidden.value = true
  callbackCleared.value = true
}
</script>

<style scoped>
.indirecty-window {
  position: absolute;
  top: var(--iy-anchor-top, 23%);
  left: var(--iy-anchor-left, 25%);
  /* 贴图单帧 16×16，图标位取整数倍才不糊 */
  --icon-size: 32px;
  translate: var(--iy-duel-x, 0px) calc(var(--iy-win-fly-y, 0px) + var(--iy-duel-y, 0px));
  rotate: y var(--iy-win-turn, 0deg);
  animation: indirecty-in 320ms cubic-bezier(0.34, 1.56, 0.64, 1);
  width: var(--iy-lift-w, 30%) !important;
}

.indirecty-window.is-frozen {
  z-index: var(--z-duel) !important;
  pointer-events: none;
  overflow: visible;
  transition: rotate 300ms ease-out;
}

.indirecty-window.is-settling {
  transition:
    translate 460ms cubic-bezier(0.33, 0, 0.2, 1),
    rotate 300ms ease-out;
}

.indirecty-window.is-back :deep(.pixel-titlebar),
.indirecty-window.is-back :deep(.pixel-window__content) {
  visibility: hidden;
}

.indirecty-window.is-hit::after {
  content: '';
  position: absolute;
  inset: -6px;
  z-index: 30;
  background: #ffffff;
  pointer-events: none;
  animation: indirecty-hit-flash 160ms steps(4, end) both;
}

@keyframes indirecty-hit-flash {
  0%,
  60% {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

.indirecty-window.is-edge,
.indirecty-window.is-spinning {
  cursor: ew-resize;
}

@keyframes indirecty-in {
  from {
    opacity: 0;
    scale: 0.9;
  }
}

/* 形状来自 sheet（当蒙版逐帧跳），颜色来自 shared.css 的 .rainbow-palette。
   ⚠️ 蒙版只留形状、不留明暗，贴图那层 3D 光影会被压成平色 —— 要保留立体感得改成叠加混合。
   sheet 是 8 帧横排，整条按 --icon-size 的整数倍渲（非整数倍会把像素插值糊掉），改帧数要同步改下面两处 */
.indirecty-icon {
  --iy-sheet: url('/assets/iy_icon-Sheet.png');
  display: block;
  width: 100%;
  height: 100%;
  -webkit-mask-image: var(--iy-sheet);
  mask-image: var(--iy-sheet);
  -webkit-mask-size: calc(var(--icon-size) * 8) var(--icon-size);
  mask-size: calc(var(--icon-size) * 8) var(--icon-size);
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  /* 首尾同色，横向平铺才能无缝流动 */
  background-image: linear-gradient(
    90deg,
    var(--rainbow-a),
    var(--rainbow-b),
    var(--rainbow-c),
    var(--rainbow-d),
    var(--rainbow-e),
    var(--rainbow-f),
    var(--rainbow-g),
    var(--rainbow-a)
  );
  background-size: calc(var(--icon-size) * 2) 100%;
  background-repeat: repeat-x;
  image-rendering: pixelated;
  /* 帧位置由 JS 逐帧写（拖转与空转共用这个变量），CSS 这边只剩彩虹流动 */
  -webkit-mask-position: calc(var(--icon-size) * var(--iy-icon-frame, 0) * -1) 0;
  mask-position: calc(var(--icon-size) * var(--iy-icon-frame, 0) * -1) 0;
  animation: iy-rainbow 2400ms linear infinite;
  /* 位移同 UpdateNotice：写进 CSS 变量，去掉 is-dragging 就有过渡把元素送回去。
     用 scale / translate 属性而不是 transform，是为了不跟上面那条 animation 抢一个属性。
     --fly-y 由起飞的 rAF 逐帧写，跟落位偏移叠加 */
  translate: var(--iy-icon-x, 0px) calc(var(--iy-icon-y, 0px) + var(--fly-y, 0px));
  transition:
    translate 220ms ease-out,
    scale 220ms ease-out;
}

/* 图标要被拖出标题栏、最后停在内容区，标题栏那层 overflow 会把移出去的部分裁掉 */
.indirecty-window :deep(.pixel-titlebar__left) {
  overflow: visible;
}

/* 可拖与拖拽中同一个关键字。预览侧同一批类名登记在 pointer 组，改这里要一起改 */
.indirecty-icon.is-draggable,
.indirecty-icon.is-dragging {
  cursor: pointer;
}

.indirecty-icon.is-dragging {
  transition: none;
}

.indirecty-icon.is-docked {
  /* 落位后它就是转盘了，光标跟信号锅同款；预览侧同一批类名登记在 ew-resize 组。
     别选中文字、别让浏览器把手势当成滚动 —— 这两条信号锅也有 */
  cursor: ew-resize;
  user-select: none;
  touch-action: none;
  scale: var(--iy-icon-dock-scale);
  /* 它在 DOM 里排在内容区前面，不抬一层会被内容盖住 */
  position: relative;
  z-index: 1;
  /* 回弹：末值大于 1 的贝塞尔会先冲过头再落回来 */
  transition:
    translate 320ms cubic-bezier(0.34, 1.56, 0.64, 1),
    scale 320ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* 起飞：锁死期间不再接受拖动，且得关掉过渡 —— 不然回弹那条会拖着上升走 */
.indirecty-icon.is-locked {
  pointer-events: none;
}

.indirecty-icon.is-flying {
  transition: none;
}

.indirecty-icon.is-gone {
  opacity: 0;
}

/* 位移只能用 px：background-position / mask-position 的百分比都是相对「容器宽 − 图宽」的差值，不是图宽 */
@keyframes iy-rainbow {
  to {
    background-position: calc(var(--icon-size) * -2) 0;
  }
}

/* 彩蛋：锁死期间不再接受拖动，指针也不该再提示可交互 */
.indirecty-window.is-locked .indirecty-dial {
  pointer-events: none;
}

/* 起飞的是**图**不是窗口：所以窗口自己和内容区都要放开裁剪，否则图只是贴着窗口上沿消失 */
.indirecty-window.is-flying,
.indirecty-window.is-flying :deep(.pixel-window__content) {
  overflow: visible;
}

.indirecty-window.is-gone .indirecty-dial {
  opacity: 0;
  transition: opacity 140ms ease;
}

/* 出视口之后一律透明 */
.indirecty-window.is-shown .indirecty-dial {
  opacity: 1;
}

/* 按钮要落在内容区正中，内容区得先成为定位父级 */
.indirecty-window :deep(.pixel-window__content) {
  position: relative;
}

/* 拽回来 / 归位那一段：它是从内容区上方外面进来的，内容区不能裁；这段时间内也不接受交互 */
.indirecty-window.is-recalling .indirecty-dial {
  pointer-events: none;
}

.indirecty-window.is-recalling :deep(.pixel-window__content) {
  overflow: visible;
}

/* 归位：JS 把 --fly-y 归零，过渡负责缓慢移动回原本位置。
   选择器要带上 .is-gone，归位期间窗口还是 gone，而 .is-gone 那条也在改 transition，
   特异性比单类名高，会把这里的 translate 整条替掉（表现为瞬移） */
.indirecty-window.is-gone .indirecty-dial.is-returning {
  transition:
    translate var(--iy-return-ms) cubic-bezier(0.33, 0, 0.2, 1),
    opacity 140ms ease;
}

/* 位移走 translate 属性而不是 transform —— PixelWindow 的 transform 是内联样式（拖窗用的），
   写在样式表里的 transform 会被它顶掉；translate 是独立属性，两者叠加生效 */

/* 调试读数，定完手感删掉（连同模板里那个 <p> 与 dialSpeedShown / dialFramesPerSec） */
.indirecty-debug {
  position: absolute;
  top: 2px;
  right: 6px;
  font-size: 10px;
  color: #808080;
  pointer-events: none;
}

/* 标题按原名大小写显示，不吃 PixelWindow 那条 uppercase；
   数字位数会变（10000 → 9999），等宽才不会让标题左右抖 */
.indirecty-window :deep(.pixel-titlebar__title) {
  text-transform: none;
  font-variant-numeric: tabular-nums;
}

.iy-count {
  cursor: text;
  /* 点它是「进来编辑」，不是选文字 */
  user-select: none;
  -webkit-user-select: none;
}

.iy-count-input {
  box-sizing: border-box;
  font: inherit;
  font-variant-numeric: tabular-nums;
  color: inherit;
  letter-spacing: inherit;
  background: rgb(255 255 255 / 6%);
  box-shadow: inset 0 0 0 2px rgb(255 255 255 / 34%);
  border: none;
  border-radius: 3px;
  padding: 0 5px;
  caret-color: #ffffff;
  cursor: text;
}

.iy-count-input:focus {
  outline: none;
}

/* 内容：9 帧横排 sheet，单帧 66×66，按整数倍渲（非整数倍会把像素插值糊掉） */
.indirecty-dial {
  --iy-dial: 198px;
  width: var(--iy-dial);
  height: var(--iy-dial);
  margin: 0 auto;
  background-image: url('/assets/signal_receiver-Sheet.png');
  background-size: calc(var(--iy-dial) * 9) var(--iy-dial);
  background-repeat: no-repeat;
  /* 只按整帧跳：半帧在像素图上是错位，不是中间态 */
  background-position: calc(var(--iy-dial) * var(--iy-frame, 0) * -1) 0;
  image-rendering: pixelated;
  /* 只能左右拖，光标照这个语义给（.resize-ew 同款）；预览侧要同步登记进 ew-resize 组 */
  cursor: ew-resize;
  /* 拖动别选中文字、别让浏览器把手势当成滚动 */
  user-select: none;
  touch-action: none;
  /* 彩蛋起飞时由 rAF 逐帧写入（见 stepFlyUp） */
  translate: 0 var(--fly-y, 0px);
}
</style>
