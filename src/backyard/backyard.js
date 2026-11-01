// 后院空间
import { ref } from 'vue'
import { useDialogFlow } from '@/dialogs/useDialogFlow.js'
import { stopSnow } from '@/snowTrigger.js'
import { resetFlowerbed } from './flowerbed.js'

const dlg = useDialogFlow()

// 黑场每段时长
const FADE_MS = 600

// 空间状态存 localStorage
const SPACE_KEY = 'blovy.space'
const BACKYARD = 'backyard'

// 隐私模式 / 禁用存储时 localStorage 会抛 异常一律吞掉
function readSpace() {
  try {
    return localStorage.getItem(SPACE_KEY)
  } catch {
    return null
  }
}

function writeSpace(name) {
  try {
    if (name) localStorage.setItem(SPACE_KEY, name)
    else localStorage.removeItem(SPACE_KEY)
  } catch {
    /* 存不了就算了 */
  }
}

export const backyardEntered = ref(readSpace() === BACKYARD)
export const backyardFading = ref(false)

let restored = backyardEntered.value

export function consumeRestoreNotice() {
  const wasRestored = restored
  restored = false
  return wasRestored
}

const BACKYARD_FLOWS = new Set([
  'backyardBoard',
  'backyardReturn',
  'flowerbedDone',
  'flowerbedMax',
  'flowerbedAngel',
  'flowerbedCake',
])

let timers = []

export function clearBackyardTimers() {
  timers.forEach(clearTimeout)
  timers = []
}

export function enterBackyard() {
  clearBackyardTimers()
  writeSpace(BACKYARD)
  backyardFading.value = true
  timers.push(
    setTimeout(() => {
      backyardEntered.value = true
      dlg.reset()
      stopSnow()
      timers.push(
        setTimeout(() => {
          backyardFading.value = false
        }, FADE_MS)
      )
    }, FADE_MS)
  )
}

export function leaveBackyard() {
  clearBackyardTimers()
  writeSpace(null)
  resetFlowerbed()
  backyardFading.value = true
  timers.push(
    setTimeout(() => {
      backyardEntered.value = false
      if (BACKYARD_FLOWS.has(dlg.activeKey.value)) dlg.reset()
      timers.push(
        setTimeout(() => {
          backyardFading.value = false
        }, FADE_MS)
      )
    }, FADE_MS)
  )
}
