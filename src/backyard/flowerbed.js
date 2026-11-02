// 花圃编辑模式 状态放模块单例，花槽、棋盘、舞台三处都要用
import { computed, ref } from 'vue'
import { useDialogFlow } from '@/dialogs/useDialogFlow.js'
import { BACKYARD_BOARD_SIZE, BACKYARD_MAX_FLOWERS, findFlowerMatch } from './boardGrid.js'

const dlg = useDialogFlow()

export const FLOWER_SRC = '/assets/flower_piece.png'
new Image().src = FLOWER_SRC

// 一局给几朵花
const FLOWER_START = 24
// 三消演出的时长
export const MERGE_MS = 2600

export const flowerbedEditing = ref(false)
export const flowersLeft = ref(FLOWER_START)
export const flowers = ref([])
// 正在演出的三消，可以有好几组同时在飞（演出期间照样能放花）
// 每组 { id, cells: [下标 x3] }；id 用来让撤回只掐自己那一步产生的那组
export const merging = ref([])
// 拖着的那朵花（屏幕坐标），null = 没在拖
export const draggingFlower = ref(null)
// 撤回栈：每格是改动前的一份快照 { flowers, left }
const undoStack = ref([])
export const canUndo = computed(() => undoStack.value.length > 0)

function pushUndo(lifted = null) {
  const before = [...flowers.value]
  if (lifted !== null && !before.includes(lifted)) before.push(lifted)
  undoStack.value = [
    ...undoStack.value,
    { flowers: before, left: flowersLeft.value, mergeId: null },
  ]
}

function tagLastUndo(mergeId) {
  const stack = undoStack.value
  if (!stack.length) return
  const last = stack.at(-1)
  undoStack.value = [...stack.slice(0, -1), { ...last, mergeId }]
}

export function undoFlower() {
  if (flowerbedWon.value) return // 通关之后棋盘冻结，撤回也跟着锁
  const snap = undoStack.value.at(-1)
  if (!snap) return
  undoStack.value = undoStack.value.slice(0, -1)
  if (snap.mergeId != null) endMerge(snap.mergeId)
  flowers.value = [...snap.flowers]
  flowersLeft.value = snap.left
}

// 每组演出一个自己的定时器
let mergeSeq = 0
const mergeTimers = new Map()

function spawnMerge(cells) {
  const id = ++mergeSeq
  merging.value = [...merging.value, { id, cells }]
  mergeTimers.set(
    id,
    setTimeout(() => endMerge(id), MERGE_MS),
  )
  return id
}

function endMerge(id) {
  const timer = mergeTimers.get(id)
  if (timer === undefined) return
  clearTimeout(timer)
  mergeTimers.delete(id)
  merging.value = merging.value.filter((g) => g.id !== id)
}

function outOfFlowers() {
  return flowersLeft.value <= 0 && flowers.value.length === 0
}

export const flowerbedSpent = ref(false)

export const flowerbedWon = ref(false)

function announceMax() {
  if (flowerbedWon.value || flowers.value.length < BACKYARD_MAX_FLOWERS) return
  flowerbedWon.value = true
  dlg.start('flowerbedMax', { preempt: true })
}

export const cakePhase = ref('idle') // 'idle' | 'spin' | 'cake'
export const cakeBloom = ref([])
export const cakeAt = ref(null)

export const cakeTaken = ref(false)

export const CAKE_SPIN_MS = 1800
// 演出半径范围
export const BLOOM_INNER = 0.5
export const BLOOM_OUTER = 2.0
// 任意两朵之间至少隔这么远
const BLOOM_MIN_GAP = 0.42

let cakeTimer = 0

// 在环带里挑一个落点，尽量离已经摆好的那些远一点
// 试满次数还挑不到就退而求其次用试过的里面最空的
function pickBloomSeat(seats) {
  const r2Min = BLOOM_INNER * BLOOM_INNER
  const r2Max = BLOOM_OUTER * BLOOM_OUTER
  let fallback = { x: 0, y: 0 }
  let bestGap = -1
  for (let k = 0; k < 40; k++) {
    const a = Math.random() * Math.PI * 2
    // sqrt 取半径 = 按面积均匀；直接 random 会全挤在内圈
    const rad = Math.sqrt(r2Min + Math.random() * (r2Max - r2Min))
    const x = Math.cos(a) * rad
    const y = Math.sin(a) * rad
    let gap = Infinity
    for (const s of seats) gap = Math.min(gap, Math.hypot(x - s.x, y - s.y))
    if (gap >= BLOOM_MIN_GAP) return { x, y }
    if (gap > bestGap) {
      bestGap = gap
      fallback = { x, y }
    }
  }
  return fallback
}

export function startCakeSequence() {
  // 只有通关那一局能开场，而且一局只开一次
  if (!flowerbedWon.value || cakePhase.value !== 'idle') return
  const cells = [...flowers.value]
  if (cells.length < BACKYARD_MAX_FLOWERS) return

  const n = cells.length
  const ac = cells.reduce((s, i) => s + (i % BACKYARD_BOARD_SIZE), 0) / n
  const ar = cells.reduce((s, i) => s + Math.floor(i / BACKYARD_BOARD_SIZE), 0) / n
  cakeAt.value = { ac, ar }
  const seats = []
  cakeBloom.value = cells.map((cell) => {
    const seat = pickBloomSeat(seats)
    seats.push(seat)
    return {
      cell,
      ring: Math.random() < 0.5 ? 0 : 1,
      fx: Math.round(seat.x * 100) / 100,
      fy: Math.round(seat.y * 100) / 100,
      // 每朵自己的朝向 / 大小也抖动
      rot: Math.round((Math.random() - 0.5) * 90),
      scale: Math.round((0.82 + Math.random() * 0.36) * 100) / 100,
    }
  })
  // 花交给演出层，格子当场清空，类似三消
  flowers.value = []
  cakePhase.value = 'spin'
  cakeTimer = setTimeout(() => {
    cakeBloom.value = []
    cakePhase.value = 'cake'
  }, CAKE_SPIN_MS)
}

// 必须要抢占可能的 welcome back
function announceDone() {
  if (!outOfFlowers() || flowerbedSpent.value) return
  flowerbedSpent.value = true
  dlg.start('flowerbedDone', { preempt: true })
  undoStack.value = []
  endFlowerEdit()
}

// 点蛋糕收下，同时退出编辑模式
export function takeCake() {
  if (cakePhase.value !== 'cake' || cakeTaken.value) return
  cakeTaken.value = true
  endFlowerEdit()
  dlg.start('flowerbedCake', { preempt: true })
}

const BOARD_FLOW_KEY = 'blovy.backyardBoardFlow'

function readBoardFlowSeen() {
  try {
    return sessionStorage.getItem(BOARD_FLOW_KEY) === '1'
  } catch {
    return false // 隐私模式下读不到就当没看过，只是会再问一遍
  }
}

export const boardFlowSeen = ref(readBoardFlowSeen())

export function beginFlowerEdit() {
  flowerbedEditing.value = true
  if (boardFlowSeen.value) return
  boardFlowSeen.value = true
  try {
    sessionStorage.setItem(BOARD_FLOW_KEY, '1')
  } catch {
    // 存不下就只是这次会话里每次进后院都要再看一遍对话
  }
}

// 退出编辑模式
export function endFlowerEdit() {
  flowerbedEditing.value = false
}

// 离开后院时重置这一局
export function resetFlowerbed() {
  for (const timer of mergeTimers.values()) clearTimeout(timer)
  mergeTimers.clear()
  clearTimeout(cakeTimer)
  cakeTimer = 0
  cakePhase.value = 'idle'
  cakeBloom.value = []
  cakeAt.value = null
  flowerbedSpent.value = false
  flowerbedWon.value = false
  cakeTaken.value = false
  undoStack.value = []
  flowerbedEditing.value = false
  flowersLeft.value = FLOWER_START
  flowers.value = []
  merging.value = []
  draggingFlower.value = null
}

// 落一朵花到 index 并查三连
// from = 这朵是从哪拿的（null = 花槽，下标 = 从棋盘上搬起来的）
// 搬起来的不消耗库存；返回 true 表示凑成了三连。
function settle(index, from) {
  pushUndo(from)
  flowers.value = [...flowers.value, index]
  if (from === null) flowersLeft.value -= 1

  const trio = findFlowerMatch(new Set(flowers.value), index)
  if (!trio) {
    announceMax()
    return false
  }

  // 三格当场清空
  flowers.value = flowers.value.filter((i) => !trio.includes(i))
  tagLastUndo(spawnMerge(trio))
  announceDone()
  return true
}

// 拖拽放置
export function startFlowerDrag(x, y, from = null) {
  // 演出期间不锁放置
  if (!flowerbedEditing.value) return
  if (flowerbedWon.value) return
  if (from === null) {
    if (flowersLeft.value <= 0) return
  } else {
    flowers.value = flowers.value.filter((i) => i !== from)
  }
  draggingFlower.value = { x, y, from }
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', onDragUp)
  window.addEventListener('pointercancel', onDragCancel)
}

function onDragMove(e) {
  if (!draggingFlower.value) return
  draggingFlower.value = { ...draggingFlower.value, x: e.clientX, y: e.clientY }
}

function stopDragListening() {
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragUp)
  window.removeEventListener('pointercancel', onDragCancel)
}

function onDragUp(e) {
  stopDragListening()
  dropFlower(e.clientX, e.clientY)
}

// 拖拽被打断（切走标签页之类）不按落点算，原样放回去
function onDragCancel() {
  stopDragListening()
  cancelDrag()
}

// 中断拖拽 把拿起来的那朵放回原位（从花槽拿的就当没拿过）
export function cancelDrag() {
  const from = draggingFlower.value?.from ?? null
  draggingFlower.value = null
  if (from !== null && !flowers.value.includes(from)) {
    flowers.value = [...flowers.value, from]
  }
}

function dropFlower(x, y) {
  const from = draggingFlower.value?.from ?? null
  draggingFlower.value = null

  const under = document.elementFromPoint(x, y)
  if (under?.closest?.('.flower-tray')) {
    if (from !== null) {
      pushUndo(from)
      flowersLeft.value += 1
    }
    return false
  }

  const cell = under?.closest?.('.backyard-board__cell')
  const to = cell ? Number(cell.dataset.index) : null
  if (to === null || flowers.value.includes(to)) {
    if (from !== null) flowers.value = [...flowers.value, from]
    return false
  }
  return settle(to, from)
}
