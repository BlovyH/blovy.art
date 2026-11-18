// kajiu 营业时段与 KAJIU 窗口开关
import { computed, ref, watch } from 'vue'

// 营业 8:00 - 次日 00:30；咖啡 8:00-18:00，18:00-18:30 换场，酒吧 18:30-00:30
const COFFEE_START = 8 * 60
const BREAK_START = 18 * 60
const BAR_START = 18 * 60 + 30
const BAR_END = 30

function nowMinutes() {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

export function periodAt(minutes) {
  if (minutes >= COFFEE_START && minutes < BREAK_START) return 'coffee'
  if (minutes >= BREAK_START && minutes < BAR_START) return 'break'
  if (minutes >= BAR_START || minutes < BAR_END) return 'bar'
  return 'closed'
}

export const kajiuPeriod = ref(periodAt(nowMinutes()))
export const isKajiuBreak = computed(() => kajiuPeriod.value === 'break')
export const isKajiuOpen = computed(() => kajiuPeriod.value === 'coffee' || kajiuPeriod.value === 'bar')
export const isKajiuBar = computed(() => kajiuPeriod.value === 'bar')

export const kajiuWindowOpen = ref(false)
// 信号波连接比窗口减一层
export const kajiuFocusTick = ref(0)

// 每次时段变化时，切换badge顺便检测是否有开着的窗口，不要轮询
watch(kajiuPeriod, () => {
  if (!isKajiuOpen.value) kajiuWindowOpen.value = false
})

let timer = 0
let scheduledAt = 0
let watchers = 0

// 下一个时段边界距现在还有多少毫秒
function msToNextBoundary() {
  const minutes = nowMinutes()
  const boundaries = [COFFEE_START, BREAK_START, BAR_START, BAR_END]
  let best = Infinity
  for (const b of boundaries) {
    let delta = (b - minutes + 1440) % 1440
    if (delta === 0) delta = 1440
    if (delta < best) best = delta
  }
  return best * 60000 - (Date.now() % 60000)
}

function schedule() {
  clearTimeout(timer)
  const wait = Math.max(msToNextBoundary(), 1000)
  scheduledAt = Date.now() + wait
  timer = window.setTimeout(() => {
    kajiuPeriod.value = periodAt(nowMinutes())
    schedule()
  }, wait)
}

// 组件挂载时开始计时，标签页回到前台时补一次漏掉的时间
function onVisibility() {
  if (document.hidden) return
  kajiuPeriod.value = periodAt(nowMinutes())
  if (Math.abs(Date.now() - scheduledAt) > 1000) schedule()
}

export function watchKajiuHours() {
  watchers += 1
  if (watchers > 1) return
  kajiuPeriod.value = periodAt(nowMinutes())
  schedule()
  document.addEventListener('visibilitychange', onVisibility)
}

export function unwatchKajiuHours() {
  watchers -= 1
  if (watchers > 0) return
  clearTimeout(timer)
  timer = 0
  watchers = 0
  document.removeEventListener('visibilitychange', onVisibility)
}
