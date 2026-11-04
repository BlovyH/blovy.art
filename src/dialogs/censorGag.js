// S**t 星号点击彩蛋
import { nextTick, ref, watch } from 'vue'
import { useDialogFlow } from './useDialogFlow.js'
import { BURST_MS, makeImpactParticles } from '@/fx/impactFx.js'
import { backyardEntered } from '@/backyard/backyard.js'

const FLOW_KEY = 'flowerbedAngel'
const PANIC_STEP = 'panic'
const CENSOR_FLOW = 'flowerbedCensor'
const ELEGANT_WORD = 'Sugar'
// 换词加粒子亮起来的时间，到点立刻抢占
const SWAP_MS = 200
// 打字机每字时长
const TYPE_MS = 20
// 打完字抗议停留多久
const HOLD_MS = 320
// 抗议框消失后多久原句回来
const RESTORE_MS = 140
// 粒子从词的中心点向外扩散
const BURST_GAP = 6
const BURST_BAND = 130

// 抢占框出现瞬间整屏抖两个回合
export const censorShaking = ref(false)

watch(censorShaking, (on) => {
  document.documentElement.classList.toggle('is-quake', on)
})

const dlg = useDialogFlow()

let running = false
let timers = []

function clearTimers() {
  timers.forEach(clearTimeout)
  timers = []
}

const kebab = (k) => (k.startsWith('--') ? k : k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()))

// 粒子容器直接挂 body，复用 shared.css 的 .fx-burst
// 自带回收计时、不进 timers，重触发时不会把还在飞的粒子提前清场
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

// 打字机 逐字写回文本
function typeOut(textEl, onDone) {
  const full = textEl.textContent
  textEl.textContent = ''
  let i = 0
  const step = () => {
    i += 1
    textEl.textContent = full.slice(0, i)
    if (i < full.length) {
      timers.push(setTimeout(step, TYPE_MS))
      return
    }
    onDone()
  }
  step()
}

// 入口 stars 是被点的星号 span，整词取它外层的 .censor-word
export function triggerCensorGag(stars) {
  if (running) return
  if (dlg.activeKey.value !== FLOW_KEY || dlg.currentStep.value !== PANIC_STEP) return
  const word = stars.closest('.censor-word')
  if (!word) return
  running = true
  clearTimers()

  spawnBurst(word.getBoundingClientRect())
  word.textContent = ELEGANT_WORD

  // 换词一结束立即抢占
  timers.push(
    setTimeout(() => {
      dlg.start(CENSOR_FLOW, { preempt: true })
      censorShaking.value = true
      nextTick(() => {
        const textEl = document.querySelector('.dialog-box__text')
        if (!textEl) {
          censorShaking.value = false
          running = false
          return
        }
        typeOut(textEl, () => {
          timers.push(
            setTimeout(() => {
              censorShaking.value = false
              dlg.reset()
              timers.push(
                setTimeout(() => {
                  // 已经离开后院就别把台词弹回来了
                  if (backyardEntered.value) {
                    dlg.start(FLOW_KEY, { preempt: true, step: PANIC_STEP })
                  }
                  running = false
                }, RESTORE_MS),
              )
            }, HOLD_MS),
          )
        })
      })
    }, SWAP_MS),
  )
}
