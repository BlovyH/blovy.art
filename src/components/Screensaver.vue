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
      <!-- 单向的：CSS 里拿不到 JS 的常量，所以 JS 的值只能从内联样式往下塞。
           反过来 JS 读 CSS 是可以的（getComputedStyle），但要元素已挂载、拿回来还是带单位的字符串，
           而这两个值在气泡出现之前就要用（预载贴图 / 翻面计时），那时压根没元素可读。
           只在 CSS 里用到的（带宽 / 切法 / 口子宽）就写在下面 style 块里 -->
      <div
        v-if="bubbleText"
        ref="bubbleEl"
        class="screensaver__bubble"
        :class="{ 'is-below': bubbleBelow, 'is-fading': bubbleFading }"
        :style="{
          '--deghost-frame': `url(${BUBBLE_FRAME})`,
          '--deghost-flip-ms': `${DEGHOST_FLIP_MS}ms`,
        }"
        :key="bubbleText"
      >
        {{ bubbleText }}
        <img
          class="screensaver__bubble-tail"
          :src="BUBBLE_TAIL"
          alt=""
          draggable="false"
          @dragstart.prevent
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

const LOGO = '/assets/screensaver.png'
// 气泡和尖嘴分开两张贴图，因为 deghost 会动，为了保证尖嘴能始终指向他，所以我打算把对话框本体和尖嘴分开渲染
const BUBBLE_FRAME = '/assets/dialog_deghost.png'
const BUBBLE_TAIL = '/assets/dialog_deghost_arrow.png'
// 尖嘴可见部分的宽度
const TAIL_W = 14

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

// deghost 的台词
const DEGHOST_LINES = [
  "I've heard that Nothing obtains a part-time job called Wiki.",
  'But what is a Wiki?',
  "I wish I could ask him, but I'm merely a ghost that wanders and mumbles when shadow descends.",
]
// 每次触发屏保有概率在随机时间后触发
const DEGHOST_MIN_MS = import.meta.env.DEV ? 0 : 60_000
const DEGHOST_MAX_MS = import.meta.env.DEV ? 0 : 240_000
const DEGHOST_CHANCE = import.meta.env.DEV ? 1 : 0.35
// 每句停留多久按字数算
const DEGHOST_LINE_BASE_MS = 900
const DEGHOST_MS_PER_CHAR = 55
const DEGHOST_LINE_MIN_MS = 2600
const DEGHOST_LINE_MAX_MS = 9000

// 轮播间隔和次数
const DEGHOST_GAP_MS = 6000
const DEGHOST_PASSES = 3

// 下次触发屏保（没刷新）让 deghost 再说一句"..."，只出现这一次
const DEGHOST_EPILOGUE = '...'
const DEGHOST_EPILOGUE_DELAY_MS = 2000
const DEGHOST_EPILOGUE_MS = 3000
const DEGHOST_BUBBLE_PAD = 12 // 气泡离视口左右边的最小间距

const DEGHOST_BUBBLE_OFFSET_X = -88 // 往左偏一点
const DEGHOST_SAFE_TOP = 150 // deghost 离顶边近到这个距离，气泡就移到下面
const DEGHOST_FLIP_HYSTERESIS = 70 // 防抖
const DEGHOST_FLIP_MS = 160 // 换边前先把气泡收掉，收完再在另一边冒出来

const active = ref(false)
const level = ref(1)
const leveledUp = ref(false)
const logoEl = ref(null)
const imgEl = ref(null)
const bubbleEl = ref(null)
const bubbleText = ref('')
const bubbleBelow = ref(false)
const bubbleFading = ref(false) // 换边途中：先把气泡收掉，收完才真正换边

let deghostWillSpeak = null
let deghostPassesDone = 0
let epilogueShown = false

let idleTimer = 0
let cornerTimer = 0
let spawnTimer = 0
let levelUpTimer = 0
let deghostTimer = 0
let lineTimer = 0
let flipTimer = 0
let flipping = false
let bubbleW = 0
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

function updateBubble() {
  const el = bubbleEl.value
  if (!el || !bubbleW) return
  if (!flipping) {
    const wantBelow = bubbleBelow.value ? y <= DEGHOST_SAFE_TOP + DEGHOST_FLIP_HYSTERESIS : y < DEGHOST_SAFE_TOP
    if (wantBelow !== bubbleBelow.value) flipBubble(wantBelow)
  }
  // natural 是元素的静止位，dx 是偏移值
  const natural = x + w / 2 - bubbleW / 2
  const min = DEGHOST_BUBBLE_PAD
  const max = Math.max(min, window.innerWidth - bubbleW - DEGHOST_BUBBLE_PAD)
  const left = Math.min(Math.max(natural + DEGHOST_BUBBLE_OFFSET_X, min), max)
  el.style.setProperty('--deghost-bubble-dx', `${left - natural}px`)
  // 绝对定位子元素的 containing block 是 padding box，所以本体左边界要先让掉一圈九宫格带宽；
  // 带宽只从元素上量，不另存一份常量（clientLeft 就是左边框宽度）
  const band = el.clientLeft
  // 偏移取整：贴图是 1:1 渲染的，落在半像素上会被重采样（150% 缩放的屏上尤其明显）
  const aim = x + w / 2 - (left + band) - TAIL_W / 2
  const tailMax = Math.max(0, bubbleW - band * 2 - TAIL_W)
  el.style.setProperty('--deghost-tail-dx', `${Math.round(Math.min(Math.max(aim, 0), tailMax))}px`)
}

function flipBubble(next) {
  flipping = true
  bubbleFading.value = true
  clearTimeout(flipTimer)
  flipTimer = setTimeout(() => {
    bubbleBelow.value = next
    bubbleFading.value = false
    flipping = false
    nextTick(updateBubble)
  }, DEGHOST_FLIP_MS)
}

function armDeghost() {
  clearTimeout(deghostTimer)
  if (deghostPassesDone >= DEGHOST_PASSES) {
    if (!epilogueShown) {
      deghostTimer = setTimeout(() => {
        epilogueShown = true
        say(DEGHOST_EPILOGUE, DEGHOST_EPILOGUE_MS)
      }, DEGHOST_EPILOGUE_DELAY_MS)
    }
    return
  }
  if (deghostWillSpeak === null) deghostWillSpeak = Math.random() < DEGHOST_CHANCE
  if (!deghostWillSpeak) return
  // 命中即请求预载气泡和尖嘴贴图
  for (const src of [BUBBLE_FRAME, BUBBLE_TAIL]) new Image().src = src
  const at = DEGHOST_MIN_MS + Math.random() * (DEGHOST_MAX_MS - DEGHOST_MIN_MS)
  deghostTimer = setTimeout(speak, at)
}

function say(text, ms) {
  bubbleText.value = text
  nextTick(() => {
    bubbleW = bubbleEl.value?.offsetWidth || 0
    updateBubble()
  })
  lineTimer = setTimeout(() => {
    bubbleText.value = ''
  }, ms)
}

function lineDuration(text) {
  const ms = DEGHOST_LINE_BASE_MS + text.length * DEGHOST_MS_PER_CHAR
  return Math.min(Math.max(ms, DEGHOST_LINE_MIN_MS), DEGHOST_LINE_MAX_MS)
}

function speak() {
  let i = 0
  const step = () => {
    if (i >= DEGHOST_LINES.length) {
      // 只有整轮念完才计数：中途被 dismiss 打断的这轮不算，下次触发从头补
      deghostPassesDone += 1
      i = 0
      bubbleText.value = ''
      if (deghostPassesDone < DEGHOST_PASSES) lineTimer = setTimeout(step, DEGHOST_GAP_MS)
      return
    }
    const text = DEGHOST_LINES[i]
    bubbleText.value = text
    nextTick(() => {
      bubbleW = bubbleEl.value?.offsetWidth || 0
      updateBubble()
    })
    i += 1
    lineTimer = setTimeout(step, lineDuration(text))
  }
  step()
}

function stopDeghost() {
  clearTimeout(deghostTimer)
  clearTimeout(lineTimer)
  clearTimeout(flipTimer)
  flipping = false
  bubbleFading.value = false
  bubbleText.value = ''
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
  if (bubbleText.value) updateBubble()
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
  armDeghost()
}

function dismiss() {
  active.value = false
  leveledUp.value = false
  stopDeghost()
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
  clearTimeout(flipTimer)
  stopDeghost()
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

/* deghost 的台词气泡，挂在它身上，撞角会一起消失 */
.screensaver__bubble {
  position: absolute;
  bottom: 100%;
  left: 50%;
  width: max-content;
  max-width: min(340px, 80vw);
  box-sizing: border-box;
  /* 边框只用来占位（撑出盒宽、给正文留内缩），框本身画在 ::before 上，因为尖嘴要用到 mask */
  border: var(--deghost-band) solid transparent;
  padding: 2px 6px;
  background: none;
  color: #ffffff;
  font-family: var(--font-pixel);
  font-size: 15px;
  line-height: 1.5;

  --deghost-band: 18px;
  --deghost-slice: 6;
  /* 边框那条线的粗细：贴图里线是 1 格粗，按 slice 折算到带宽上就是 带宽 / slice。
     尖嘴要顶到线的上沿，两边的壁才和线头齐平 */
  --deghost-line: calc(var(--deghost-band) / var(--deghost-slice));
  /* 尖嘴在框上顶开的那个口：窄于两壁外沿、宽于两壁之间的空档，
     口子的两条边才都藏在尖嘴自己的贴图底下 */
  --deghost-mouth: 12px;
  --deghost-notch-x: calc(var(--deghost-band) + var(--deghost-tail-dx));
  --deghost-bubble-dy: -10px; /* 翻到下面时取正，见 .is-below */
  --deghost-tail-dx: 0px;
  translate: calc(-50% + var(--deghost-bubble-dx, 0px)) var(--deghost-bubble-dy);
  animation: screensaver-bubble-in 260ms ease-out both;
}

/* 框：九宫格边框单独画在这层，好让 mask 只裁它、不碰尖嘴 */
.screensaver__bubble::before {
  content: '';
  position: absolute;
  inset: calc(-1 * var(--deghost-band));
  border: var(--deghost-band) solid transparent;
  border-image-source: var(--deghost-frame);
  border-image-slice: var(--deghost-slice);
  border-image-repeat: stretch;
  image-rendering: pixelated;
  /* 整块 XOR 掉尖嘴那一小块 = 边框上开个口，尖嘴的壁才接得上；
     mask 的层从上往下给，exclude 作用在这层与它下面各层合成出的结果上 */
  mask-image: linear-gradient(#fff 0 0), linear-gradient(#fff 0 0);
  mask-size: 100% 100%, var(--deghost-mouth) var(--deghost-band);
  mask-position: 0 0, var(--deghost-notch-x) 100%;
  mask-repeat: no-repeat;
  mask-composite: exclude;
}

.screensaver__bubble-tail {
  position: absolute;
  left: 0;
  /* 顶到边框那条线的上沿：壁正好跨过线宽，接挖空 */
  top: calc(100% + var(--deghost-band) - var(--deghost-line));
  width: 16px;
  height: 16px;
  translate: var(--deghost-tail-dx) 0;
  image-rendering: pixelated;
}

/* 下面比上面留得多 */
.screensaver__bubble.is-below {
  bottom: auto;
  top: 100%;
  --deghost-bubble-dy: 26px;
}

.screensaver__bubble.is-below .screensaver__bubble-tail {
  top: auto;
  bottom: calc(100% + var(--deghost-band) - var(--deghost-line));
  rotate: 180deg;
  scale: -1 1;
}

.screensaver__bubble.is-below::before {
  mask-position: 0 0, var(--deghost-notch-x) 0;
}

.screensaver__bubble.is-fading {
  animation: screensaver-bubble-out var(--deghost-flip-ms) ease-in both;
}

@keyframes screensaver-bubble-out {
  to {
    opacity: 0;
  }
}

@keyframes screensaver-bubble-in {
  from {
    opacity: 0;
    scale: 0.9;
  }
  to {
    opacity: 1;
    scale: 1;
  }
}

</style>
