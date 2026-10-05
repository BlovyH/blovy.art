<template>
  <div v-if="active" class="screensaver" aria-hidden="true">
    <div v-if="leveledUp" class="screensaver__levelup">LEVEL UP!!!</div>
    <div ref="logoEl" class="screensaver__logo">
      <img
        ref="imgEl"
        class="screensaver__logo-img"
        :src="LOGO"
        alt=""
        draggable="false"
        @dragstart.prevent
      />
      <!-- 字也参与边界（碰撞等）计算，不会被甩到屏幕外 -->
      <svg class="screensaver__arc" viewBox="0 0 192 120" aria-hidden="true">
        <defs>
          <!-- 上弧顺时针过顶点、下弧逆时针过底点
               两条弧都是椭圆整体平移来的，考虑到文字读向，上行只需让开一条缝、下行要让开一个行高 -->
          <path id="screensaver-arc-top" d="M 0 58 A 96 40 0 0 1 192 58" />
          <path id="screensaver-arc-bottom" d="M 0 78 A 96 40 0 0 0 192 78" />
        </defs>
        <text class="screensaver__arc-text">
          <textPath href="#screensaver-arc-top" startOffset="50%">lorem ipsum</textPath>
        </text>
        <text class="screensaver__arc-text">
          <textPath href="#screensaver-arc-bottom" startOffset="50%">滚滚长江东逝水</textPath>
        </text>
      </svg>
      <span v-if="level > 1" class="screensaver__level">{{ level }}</span>
    </div>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

const LOGO = '/assets/screensaver.png'

const IDLE_MS = import.meta.env.DEV ? 30_000 : 66_000
const SPEED = 90
const MAX_STEP_MS = 32
const CORNER_TOLERANCE = 12 // px，撞角容错距离
const HIDDEN_MS = 1500
const SWALLOW_MS = 380
const LEVEL_UP_MS = 1400
const POP_MS = 320 // respawn
const POP_EASING = 'cubic-bezier(0.34, 1.56, 0.64, 1)'
const SPAWN_SCALE = 0.2

const active = ref(false)
const level = ref(1)
const leveledUp = ref(false)
const logoEl = ref(null)
const imgEl = ref(null)

let idleTimer = 0
let cornerTimer = 0
let spawnTimer = 0
let levelUpTimer = 0
let raf = 0
let last = 0
let x = 0
let y = 0
let vx = SPEED
let vy = SPEED
let w = 0
let h = 0

function place() {
  logoEl.value.style.transform = `translate3d(${x}px, ${y}px, 0)`
}

function clampToViewport() {
  const vw = window.innerWidth
  const vh = window.innerHeight
  if (x + w > vw) x = Math.max(0, vw - w)
  if (y + h > vh) y = Math.max(0, vh - h)
}

function tick(now) {
  const dt = Math.min(now - last, MAX_STEP_MS)
  last = now
  x += (vx * dt) / 1000
  y += (vy * dt) / 1000

  const vw = window.innerWidth
  const vh = window.innerHeight
  let hitX = false
  let hitY = false
  if (x <= 0) {
    x = 0
    vx = Math.abs(vx)
    hitX = true
  } else if (x + w >= vw) {
    x = Math.max(0, vw - w)
    vx = -Math.abs(vx)
    hitX = true
  }
  if (y <= 0) {
    y = 0
    vy = Math.abs(vy)
    hitY = true
  } else if (y + h >= vh) {
    y = Math.max(0, vh - h)
    vy = -Math.abs(vy)
    hitY = true
  }

  if (hitX || hitY) {
    // 沿墙方向还差多少到最近的角
    const gap = hitX && hitY ? 0 : hitX ? Math.min(y, vh - h - y) : Math.min(x, vw - w - x)
    if (gap <= CORNER_TOLERANCE) {
      hitCorner(x * 2 <= vw - w ? 0 : vw - w, y * 2 <= vh - h ? 0 : vh - h)
      return
    }
  }

  place()
  raf = requestAnimationFrame(tick)
}

function hitCorner(tx, ty) {
  cancelAnimationFrame(raf)
  raf = 0
  leveledUp.value = true
  clearTimeout(levelUpTimer)
  levelUpTimer = setTimeout(() => {
    leveledUp.value = false
  }, LEVEL_UP_MS)
  const el = logoEl.value
  el.style.transformOrigin = `${tx === 0 ? '0%' : '100%'} ${ty === 0 ? '0%' : '100%'}`
  el.style.transition = `transform ${SWALLOW_MS}ms cubic-bezier(0.5, 0, 0.75, 0.4), opacity ${SWALLOW_MS}ms ease-in`
  void el.offsetWidth
  el.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(0)`
  el.style.opacity = '0'
  cornerTimer = setTimeout(respawn, SWALLOW_MS + HIDDEN_MS)
}
// 生成位置避开撞角区域
function randomSpot() {
  const pad = CORNER_TOLERANCE
  x = pad + Math.random() * Math.max(0, window.innerWidth - w - pad * 2)
  y = pad + Math.random() * Math.max(0, window.innerHeight - h - pad * 2)
}

function respawn() {
  if (!active.value) return
  // 先 respawn 再 +1
  level.value++
  const el = logoEl.value
  randomSpot()
  el.style.transition = ''
  el.style.transformOrigin = '50% 50%'
  el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${SPAWN_SCALE})`
  el.style.opacity = '0'
  void el.offsetWidth
  el.style.transition = `transform ${POP_MS}ms ${POP_EASING}, opacity ${POP_MS}ms ease-out`
  el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(1)`
  el.style.opacity = '1'
  // 演出放完再开循环：tick 每帧都在写 transform，一起跑会把这段动画冲掉
  spawnTimer = setTimeout(() => {
    if (!active.value) return
    last = performance.now()
    raf = requestAnimationFrame(tick)
  }, POP_MS)
}

function waitForImage(el) {
  if (el.complete && el.naturalWidth) return Promise.resolve()
  return new Promise((resolve) => {
    el.addEventListener('load', resolve, { once: true })
    el.addEventListener('error', resolve, { once: true })
  })
}

async function start() {
  active.value = true
  await nextTick()
  await waitForImage(imgEl.value)
  if (!active.value) return
  w = logoEl.value.offsetWidth
  h = logoEl.value.offsetHeight
  randomSpot()
  place()
  last = performance.now()
  raf = requestAnimationFrame(tick)
}

function dismiss() {
  active.value = false
  leveledUp.value = false
  clearTimeout(cornerTimer)
  clearTimeout(spawnTimer)
  clearTimeout(levelUpTimer)
  cancelAnimationFrame(raf)
  raf = 0
  arm()
}

function arm() {
  clearTimeout(idleTimer)
  idleTimer = setTimeout(start, IDLE_MS)
}

function onActivity() {
  if (active.value) dismiss()
  else arm()
}

const EVENTS = ['mousemove', 'mousedown', 'wheel', 'keydown', 'touchstart']

onMounted(() => {
  // 图挂在 v-if 里，不预载的话它第一次出现才开始下载，量尺寸时还没高度
  new Image().src = LOGO
  for (const type of EVENTS) {
    window.addEventListener(type, onActivity, { passive: true })
  }
  window.addEventListener('resize', clampToViewport)
  arm()
})

onBeforeUnmount(() => {
  for (const type of EVENTS) {
    window.removeEventListener(type, onActivity, { passive: true })
  }
  window.removeEventListener('resize', clampToViewport)
  clearTimeout(idleTimer)
  clearTimeout(cornerTimer)
  clearTimeout(spawnTimer)
  clearTimeout(levelUpTimer)
  cancelAnimationFrame(raf)
})
</script>

<style scoped>
.screensaver {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  z-index: var(--z-screensaver);
  pointer-events: none;
}

/* 同 StickerStg .stg-bonus */
.screensaver__levelup {
  position: absolute;
  left: 50%;
  top: 12%;
  color: #ffffff;
  font-family: var(--font-pixel);
  font-size: clamp(28px, 5vw, 64px);
  letter-spacing: 2px;
  white-space: nowrap;
  text-shadow: 0 4px 0 #000000;
  opacity: 1;
  transform: translate(-50%, 0);
  animation: screensaver-levelup-in 460ms cubic-bezier(0.2, 0.9, 0.25, 1) both;
}

@keyframes screensaver-levelup-in {
  from {
    opacity: 0;
    transform: translate(-50%, 14px);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}

/* 改字号要跟着改这个缝隙 */
.screensaver__logo {
  position: absolute;
  top: 0;
  left: 0;
  width: 192px;
  height: 120px;
  will-change: transform;
}

.screensaver__logo-img {
  position: absolute;
  left: 0;
  top: 20px;
  display: block;
  width: 100%;
  height: 80px;
  image-rendering: pixelated;
}

/* 弧上的两行字：跟着图一起动、一起被吸进角里 */
.screensaver__arc {
  position: absolute;
  inset: 0;
}

.screensaver__arc-text {
  font-family: var(--font-pixel);
  font-size: 16px;
  letter-spacing: 1px;
  fill: #ff00ff;
  text-anchor: middle;
}

.screensaver__level {
  position: absolute;
  right: 24px;
  bottom: 40px;
  color: #ffffff;
  font-family: var(--font-pixel);
  font-size: 20px;
  line-height: 1;
  text-shadow: 0 3px 0 #000000;
}

</style>
