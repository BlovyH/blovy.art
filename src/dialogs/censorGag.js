// S**t 星号点击彩蛋
import { ref, watch } from 'vue'
import { useDialogFlow } from './useDialogFlow.js'
import { registerRestoreGuard } from './cinematicGuards.js'
import { BURST_MS, makeImpactParticles } from '@/fx/impactFx.js'
import { backyardEntered } from '@/backyard/backyard.js'

const FLOW_KEY = 'flowerbedAngel'
const PANIC_STEP = 'panic'
const CENSOR_FLOW = 'flowerbedCensor'
const ELEGANT_WORD = 'Sugar'
// 换词加粒子亮起来的时间，到点立刻抢占
const SWAP_MS = 200
// 粒子从词的中心点向外扩散
const BURST_GAP = 6
const BURST_BAND = 130

// 抢占框出现瞬间整屏抖两个回合
export const censorShaking = ref(false)

watch(censorShaking, (on) => {
  document.documentElement.classList.toggle('is-quake', on)
})

const dlg = useDialogFlow()

// 离开后院就别把原句弹回来
registerRestoreGuard(CENSOR_FLOW, () => backyardEntered.value)

// 抢占框被收掉时结束抖动
watch(() => dlg.activeKey.value, (key) => {
  if (key !== CENSOR_FLOW) censorShaking.value = false
})

// 换词到抢占之间挡住重复点击
let swapping = false

const kebab = (k) => (k.startsWith('--') ? k : k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()))

// 粒子容器直接挂 body，复用 shared.css 的 .fx-burst，自带回收计时
function spawnBurst(rect) {
  const origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  const wrap = document.createElement('div')
  wrap.className = 'fx-burst'
  wrap.style.left = `${origin.x}px`
  wrap.style.top = `${origin.y}px`
  wrap.style.fontFamily = 'var(--font-pixel)'
  const core = { left: origin.x, top: origin.y, width: 0, height: 0 }
  for (const p of makeImpactParticles(core, origin, { gap: BURST_GAP, band: BURST_BAND })) {
    const s = document.createElement('span')
    s.className = 'fx-particle'
    s.textContent = '+'
    for (const [k, v] of Object.entries(p.style)) s.style.setProperty(kebab(k), v)
    wrap.appendChild(s)
  }
  document.body.appendChild(wrap)
  setTimeout(() => wrap.remove(), BURST_MS)
}

// 入口 stars 是被点的星号 span，整词取它外层的 .censor-word
export function triggerCensorGag(stars) {
  if (swapping) return
  if (dlg.activeKey.value !== FLOW_KEY || dlg.currentStep.value !== PANIC_STEP) return
  const word = stars.closest('.censor-word')
  if (!word) return
  swapping = true

  spawnBurst(word.getBoundingClientRect())
  word.textContent = ELEGANT_WORD

  // 换词一结束立即抢占，之后由演出组件接手打字与收场
  setTimeout(() => {
    dlg.start(CENSOR_FLOW, { preempt: true })
    censorShaking.value = true
    swapping = false
  }, SWAP_MS)
}
