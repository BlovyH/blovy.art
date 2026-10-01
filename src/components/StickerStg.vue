<template>
  <!-- 贴纸条目：静态网格（idle）。张数与顺序全在 JSON 的 stickerSeries 里，这里只按数组渲染 -->
  <div ref="gridRef" class="sticker-grid">
    <img
      v-for="(src, idx) in item.stickers || []"
      :key="src"
      class="sticker-cell"
      :src="src"
      :alt="`sticker ${idx + 1}`"
    />
  </div>

  <!-- 弹幕游戏层：整局都挂在 body 上，坐标用视口坐标，暗幕盖住整屏 -->
  <Teleport to="body">
    <div v-if="phase !== 'idle'" class="stg-layer">
      <!-- 游戏本体 -->
      <div v-if="phase !== 'clear'" class="stg-stage">
        <div class="stg-veil"></div>

        <img
          v-for="b in bullets"
          :key="b.id"
          class="stg-bullet"
          :src="b.src"
          :style="{ width: `${b.size}px`, transform: `translate3d(${b.x}px, ${b.y}px, 0)` }"
          alt=""
        />

        <!-- debug：子弹判定区域 -->
        <div
          v-for="b in showHitbox ? bullets : []"
          :key="`hit-${b.id}`"
          class="stg-hitbox"
          :style="hitboxStyle(b)"
        ></div>

        <div v-if="phase === 'playing'" class="stg-player" :style="playerStyle"></div>

        <div
          v-if="phase === 'playing' && grazing"
          class="stg-graze"
          :style="grazeStyle"
        ></div>

        <div v-if="phase === 'bonus'" class="stg-bonus">Sticker Card Bonus!!</div>

        <!-- 符卡名：本条目的演出文案，全程挂在左上角（只属于本条目，所以留在视图里，不进 JSON） -->
        <div class="stg-card">{{ CARD_NAME }}</div>
      </div>

      <div
        class="stg-flash"
        :class="{ 'is-white': flash === 'white', 'is-black': flash === 'black' }"
        :style="{ transitionDuration: `${flashMs}ms` }"
      ></div>
    </div>
  </Teleport>

  <!-- 调参面板：只在 dev 下按需加载（文件本身不进仓库，见 .gitignore），加载不到就没有这块 -->
  <Teleport to="body">
    <div v-if="showTuner" ref="tunerRef">
      <component
        :is="tunerComp"
        :script="scriptRef"
        :ctx="ctxRef"
        :hitbox="showHitbox"
        @apply="applyScript"
        @hitbox="setHitbox"
        @close="showTuner = false"
      />
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { stickerStgCleared, stickerStgRun } from '../dpActions.js'
import * as patterns from '../stg/patterns.js'
import { SCRIPT } from '../stg/script.js'
import { BULLET_DRAG, GRAVITY } from '../stg/physics.js'

const props = defineProps({
  item: {
    type: Object,
    required: true,
  },
})

const GRACE = 600 // ms 起爆后这段时间内不判定，给反应时间
const PLAYER_SPEED = 0.6 // px/ms
const SLOW_FACTOR = 0.48 // 按住 Shift 时的移速倍率：低速移动，用来钻缝
const PLAYER_SIZE = 16 // px 自机直径，也参与判定
const HIT_SCALE = 0.42 // 子弹判定圆直径相对贴图边长：比图片小一圈
const GRAZE_RING = 50 // 擦弹范围
const GRAZE_LINGER = 300 // 擦弹圈滞留时间 ms
const SWAY_FREQ = (Math.PI * 2) / 2000 // 摆动周期 2000ms，换算成每 ms 的弧度
const BONUS_HOLD = 2222 // BONUS 停留时长 ms
const FLASH_HIT = 2200 // ms 中弹的白场涨满时长
const FLASH_END = 500 // ms 结束的黑场涨满时长，比白场短
const FLASH_FALL = 500
const DEBUG_HITBOX = true // 碰撞箱总开关：false 时面板上那个开关怎么拨都不显示
// 面板开关上次的选择存这里 —— 保存会触发重载，不记下来每保存一次就掉回上面的初值
const HITBOX_KEY = 'stg.hitbox'
// 符卡名：全程显示在左上角。只属于本条目，所以留在视图里，不进 JSON
const CARD_NAME = '喵符「CAT-ASTROPHE」'

const gridRef = ref(null)
const phase = ref('idle') // idle | playing | bonus | clear（clear = 元素已收起，只剩色场在退）
const flash = ref('') // '' | 'white' | 'black'
const flashMs = ref(0) // 本次色场的时长，进和出用同一个
const grazing = ref(false) // 点亮后按 GRAZE_LINGER 滞留
const slow = ref(false)
const bullets = ref([])
const player = ref({ x: 0, y: 0 })
// 是否画判定圈：总开关 && 面板开关（后者上次的选择从 localStorage 读回）
function readHitboxFlag() {
  try {
    const v = localStorage.getItem(HITBOX_KEY)
    return v === null ? true : v === '1'
  } catch {
    return true
  }
}

const showHitbox = ref(DEBUG_HITBOX && readHitboxFlag())

function setHitbox(on) {
  try {
    localStorage.setItem(HITBOX_KEY, on ? '1' : '0')
  } catch {
    // 存不下就算了，这次会话内照常生效
  }
  showHitbox.value = DEBUG_HITBOX && on
}

let raf = 0
let lastFrame = 0
let elapsed = 0 // 本局已进行的时间，用来算起爆后的无敌时间
let grazeTimer = 0 // 滞留计时，续期用；不放 timers[]（每帧一个会堆爆）
const timers = []
const keys = new Set()

// 波次调度：scriptRef 是当前跑的那份（调参面板可以整份换掉），pending 是还没到点的波次
const scriptRef = ref(SCRIPT)
// 本局采到的弹源，调参面板拿它按真实 pattern 算预览，所以是 ref 不是局部变量
const ctxRef = ref(null)
let pending = []
let delayed = []
let nextId = 0

// 调参面板：dev 下才动态加载，路径写成变量是为了让打包器别去解析它（文件不在仓库里）
const showTuner = ref(false)
const tunerComp = shallowRef(null)
const tunerRef = ref(null)

// 面板按变量路径动态加载，不在模块图里，HMR 推不到它 —— 改完面板文件只能靠刷新页面才生效。
// 所以每次打开都换一个时间戳重取一份：同一个 URL 第二次 import 会直接吃浏览器缓存。
async function loadTuner() {
  try {
    return (await import(/* @vite-ignore */ `../stg/StgTuner.vue?t=${Date.now()}`)).default
  } catch {
    return (await import(/* @vite-ignore */ '../stg/StgTuner.vue')).default
  }
}

async function toggleTuner() {
  if (!import.meta.env.DEV) return
  if (showTuner.value) {
    showTuner.value = false
    return
  }
  try {
    tunerComp.value = await loadTuner()
  } catch {
    return
  }
  showTuner.value = true
}

function applyScript(list, opts = {}) {
  scriptRef.value = list
  start(opts)
}

// 面板里的键盘与鼠标要能正常工作：否则输入被游戏的方向键吃掉、点击被吞鼠标的那段掐断
function fromTuner(target) {
  return !!(tunerRef.value && target instanceof Node && tunerRef.value.contains(target))
}

// PREVIEW 每点一次 +1：watch 到就重开一局，所以游戏中再点也是重开
watch(stickerStgRun, () => {
  start()
})

// 弹源：贴纸格子现在的屏幕位置与贴图。一局取一次（网格是静止的）
function collectCells() {
  const nodes = gridRef.value?.querySelectorAll('.sticker-cell')
  if (!nodes?.length) return []
  const list = []
  for (const cell of nodes) {
    const r = cell.getBoundingClientRect()
    list.push({
      src: cell.currentSrc || cell.src,
      x: r.left + r.width / 2,
      y: r.top + r.height / 2,
      size: Math.min(r.width, r.height),
    })
  }
  return list
}

const noHit = ref(false)

function start(opts) {
  noHit.value = !!(opts && opts.noHit)
  stop()

  const cells = collectCells()
  if (!cells.length) return

  ctxRef.value = {
    cells,
    vw: window.innerWidth,
    vh: window.innerHeight,
    playerSize: PLAYER_SIZE,
  }
  pending = scriptRef.value.slice().sort((a, b) => a.at - b.at)
  bullets.value = []
  delayed = []
  nextId = 0
  player.value = {
    x: (window.innerWidth - PLAYER_SIZE) / 2,
    y: window.innerHeight * 0.75,
  }
  flash.value = ''
  grazing.value = false
  phase.value = 'playing'
  elapsed = 0
  lastFrame = performance.now()
  raf = requestAnimationFrame(tick)
}

// 到点的波次就发射：按 at 顺序取，pattern 查不到就跳过（跟 dpActions 一样静默）
function spawnDue() {
  const ctx = ctxRef.value
  if (!ctx) return
  ctx.player = {
    x: player.value.x + PLAYER_SIZE / 2,
    y: player.value.y + PLAYER_SIZE / 2,
  }
  while (pending.length && elapsed >= pending[0].at) {
    const wave = pending.shift()
    const make = patterns[wave.pattern]
    if (typeof make !== 'function') continue
    for (const s of make(ctx, wave)) {
      const b = { id: nextId++, ...s }
      if (b.delay > 0) {
        b.due = elapsed + b.delay
        delayed.push(b)
      } else {
        bullets.value.push(b)
      }
    }
  }
}

// 到点的延迟弹幕入场
function flushDelayed() {
  if (!delayed.length) return
  const keep = []
  for (const b of delayed) {
    if (elapsed >= b.due) bullets.value.push(b)
    else keep.push(b)
  }
  delayed = keep
}

function tick(now) {
  const dt = Math.min(now - lastFrame, 32)
  lastFrame = now
  elapsed += dt

  spawnDue()
  flushDelayed()
  movePlayer(dt)

  const px = player.value.x + PLAYER_SIZE / 2
  const py = player.value.y + PLAYER_SIZE / 2
  const drag = Math.pow(BULLET_DRAG, dt)
  const vw = window.innerWidth
  const vh = window.innerHeight
  const alive = []

  for (const b of bullets.value) {
    let vx = b.vx
    let vy = b.vy
    let nx
    let ny

    // 摆动：横向速度按正弦来回，幅度就是 sway，落速不受影响
    if (b.sway) {
      b.age = (b.age || 0) + dt
      vx = Math.cos(b.age * SWAY_FREQ) * b.sway
    }

    if (b.move === 'linear') {
      // 匀速直飞：不吃阻力也不吃重力，四边出界就丢
      nx = b.x + vx * dt
      ny = b.y + vy * dt
      if (ny > vh || ny + b.size < 0 || nx + b.size < 0 || nx > vw) continue
    } else {
      // 起爆瞬间很快，随后被阻力指数拖慢，同时一直受重力 —— 冲上去再落下来
      vx = b.vx * drag
      vy = b.vy * drag + GRAVITY * dt
      nx = b.x + vx * dt
      ny = b.y + vy * dt
      // 只等它落出屏幕下沿才丢掉：飞到屏幕上方时仍在列表里，之后会被重力拽回来
      if (ny > vh) continue
    }

    // 不判定的一局：中弹与擦弹都不算，跑完整段就结束
    if (elapsed > GRACE && !noHit.value) {
      // 圆对圆：子弹判定圆半径 + 玩家半径。逐轴比较是方形判定，会在贴图的四个角多判一块
      const reach = (b.size * HIT_SCALE + PLAYER_SIZE) / 2
      const dx = nx + b.size / 2 - px
      const dy = ny + b.size / 2 - py
      const d2 = dx * dx + dy * dy
      if (d2 < reach * reach) {
        // 撞到：全部元素瞬间消失，直接回到静态网格
        die()
        return
      }
      // 擦弹：贴纸碰到外框就算
      const graze = GRAZE_RING / 2 + b.size / 2
      if (d2 < graze * graze) markGraze()
    }

    alive.push({ ...b, x: nx, y: ny, vx, vy })
  }

  bullets.value = alive

  // 清屏判定：场上没弹、波次发完、延迟入场的也全进来了才算过 —— 还有波次没到点时不能提前给 BONUS
  if (!alive.length && !pending.length && !delayed.length) {
    // 不判定的一局跑完不算过关：否则单波预览也会往 localStorage 写通关、按钮提前变 REVIEW
    finish(noHit.value ? 'clear' : 'bonus')
    return
  }

  raf = requestAnimationFrame(tick)
}

const playerStyle = computed(() => ({
  width: `${PLAYER_SIZE}px`,
  height: `${PLAYER_SIZE}px`,
  transform: `translate3d(${player.value.x}px, ${player.value.y}px, 0)`,
}))

// 擦弹外框：以自机中心为圆心的一圈细边
const grazeStyle = computed(() => ({
  width: `${GRAZE_RING}px`,
  height: `${GRAZE_RING}px`,
  transform: `translate3d(${player.value.x + PLAYER_SIZE / 2 - GRAZE_RING / 2}px, ${
    player.value.y + PLAYER_SIZE / 2 - GRAZE_RING / 2
  }px, 0)`,
}))

function markGraze() {
  grazing.value = true
  if (grazeTimer) clearTimeout(grazeTimer)
  grazeTimer = setTimeout(() => {
    grazing.value = false
    grazeTimer = 0
  }, GRAZE_LINGER)
}

function movePlayer(dt) {
  let dx = 0
  let dy = 0
  if (keys.has('left')) dx -= 1
  if (keys.has('right')) dx += 1
  if (keys.has('up')) dy -= 1
  if (keys.has('down')) dy += 1
  if (!dx && !dy) return

  const len = Math.hypot(dx, dy)
  const step = PLAYER_SPEED * (slow.value ? SLOW_FACTOR : 1) * dt
  const x = player.value.x + (dx / len) * step
  const y = player.value.y + (dy / len) * step
  player.value = {
    x: Math.min(Math.max(x, 0), window.innerWidth - PLAYER_SIZE),
    y: Math.min(Math.max(y, 0), window.innerHeight - PLAYER_SIZE),
  }
}

// debug：子弹自己的判定圆，跟贴图同一个缩比，所以永远比贴图小一圈。
// 判定还叠加了玩家半径（玩家中心进圈即死），那部分不画 —— 加上去小弹幕的圈会反过来比贴图大。
function hitboxStyle(b) {
  const side = b.size * HIT_SCALE
  const offset = b.size / 2 - side / 2
  return {
    width: `${side}px`,
    height: `${side}px`,
    transform: `translate3d(${b.x + offset}px, ${b.y + offset}px, 0)`,
  }
}

// 中弹：白场涨满 → 在其遮挡下收干净 → 白场退掉
function die() {
  stop()
  runFlash('white', FLASH_HIT)
}

// bomb（X 键）：清屏，直接走淡出
function bomb() {
  bullets.value = []
  finish('clear')
}

function finish(mode) {
  stop()
  if (mode === 'bonus') {
    // 只有打完才算过关：按 B 清屏走的是下面那条，不通知外面
    stickerStgCleared.value++
    phase.value = 'bonus'
    timers.push(setTimeout(() => runFlash('black', FLASH_END), BONUS_HOLD))
    return
  }
  runFlash('black', FLASH_END)
}

// 色场：涨满（rise）→ 收起游戏 → 退掉（FLASH_FALL）。进出用同一条 transition，
// 所以元素要常驻，不能 v-if；两段时长不同，退场前把 transitionDuration 换成退场那份
function runFlash(color, rise) {
  flashMs.value = rise
  flash.value = color
  timers.push(
    setTimeout(() => {
      bullets.value = []
      phase.value = 'clear'
      flashMs.value = FLASH_FALL
      flash.value = ''
      timers.push(setTimeout(() => {
        phase.value = 'idle'
      }, FLASH_FALL))
    }, rise),
  )
}

function stop() {
  if (raf) cancelAnimationFrame(raf)
  raf = 0
  if (grazeTimer) clearTimeout(grazeTimer)
  grazeTimer = 0
  grazing.value = false
  slow.value = false
  flash.value = ''
  while (timers.length) clearTimeout(timers.pop())
  keys.clear()
}

const DIRECTION_KEYS = {
  arrowleft: 'left',
  arrowright: 'right',
  arrowup: 'up',
  arrowdown: 'down',
  a: 'left',
  d: 'right',
  w: 'up',
  s: 'down',
}

// 游戏存在期间屏蔽底下的一切鼠标操作
const SWALLOWED = ['mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu']
function swallowMouse(e) {
  // 面板内的 mousedown 要掐断：详情窗是点外面就关，面板 teleport 到 body 后算"外面"。
  // 只掐这一种 —— click 得放行，否则面板自己的按钮点不动。
  if (fromTuner(e.target)) {
    if (e.type === 'mousedown') e.stopPropagation()
    return
  }
  if (phase.value === 'idle') return
  e.stopPropagation()
  e.preventDefault?.()
}
for (const type of SWALLOWED) {
  window.addEventListener(type, swallowMouse, true)
}

function onKeyDown(e) {
  // 隐藏组合键：不容易误触，也不占用方向键那几个游戏按键
  if (e.ctrlKey && e.altKey && e.shiftKey && e.key.toLowerCase() === 's') {
    e.preventDefault()
    toggleTuner()
    return
  }
  if (fromTuner(e.target)) return
  if (phase.value !== 'playing') return
  if (e.key === 'Shift') {
    slow.value = true
    return
  }
  const key = e.key.toLowerCase()
  if (key === 'x') {
    bomb()
    return
  }
  const dir = DIRECTION_KEYS[key]
  if (!dir) return
  e.preventDefault()
  keys.add(dir)
}

function onKeyUp(e) {
  if (e.key === 'Shift') {
    slow.value = false
    return
  }
  const dir = DIRECTION_KEYS[e.key.toLowerCase()]
  if (dir) keys.delete(dir)
}

window.addEventListener('keydown', onKeyDown)
window.addEventListener('keyup', onKeyUp)

onBeforeUnmount(() => {
  stop()
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  for (const type of SWALLOWED) {
    window.removeEventListener(type, swallowMouse, true)
  }
})
</script>

<style scoped>
.sticker-grid {
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  align-content: start;
  gap: 4px;
  padding: 4px;
  overflow-y: auto;
}

.sticker-cell {
  width: 100%;
  height: auto;
  /* 防加载未完成闪烁 */
  aspect-ratio: 1;
  image-rendering: pixelated;
}

/* 全屏游戏层：暗幕与弹幕都在里面，层级由 windowZ.js 的 Z.STG 统一给出 */
.stg-layer {
  position: fixed;
  inset: 0;
  z-index: var(--z-stg);
  /* 暗幕要挡住底下的交互，所以这里不能设 pointer-events: none —— 元素自身的点击/悬停由本层接住，
     挂在 document 上的全局监听（详情窗的 click-outside-to-close）由下面的 window 捕获阶段掐断。 */
}

/* 游戏本体：与层同区域同坐标系，里面元素的视口坐标照旧，它只是给"整块卸载"划一条边 */
.stg-stage {
  position: absolute;
  inset: 0;
}

.stg-veil {
  position: absolute;
  inset: 0;
  background: #000000;
  opacity: 0.85;
}

.stg-bullet {
  position: absolute;
  top: 0;
  left: 0;
  height: auto;
  image-rendering: pixelated;
  will-change: transform;
}

/* debug 用：子弹判定区域（配合 DEBUG_HITBOX）。与判定公式一致，是个圆不是方框 */
.stg-hitbox {
  position: absolute;
  top: 0;
  left: 0;
  box-sizing: border-box;
  border: 1px solid #ff2b2b;
  background: rgb(255 43 43 / 12%);
  border-radius: 50%;
  will-change: transform;
}

/* 尺寸由 playerStyle 从 PLAYER_SIZE 给出，CSS 里不写第二遍。
   描边走 border-box 画在框内，所以加粗描边不会把自机的视觉直径撑大 */
.stg-player {
  position: absolute;
  top: 0;
  left: 0;
  box-sizing: border-box;
  background: #ffffff;
  border: 3px solid #ff2b2b;
  border-radius: 50%;
  will-change: transform;
}

.stg-graze {
  position: absolute;
  top: 0;
  left: 0;
  box-sizing: border-box;
  border: 3px solid #ffffff;
  border-radius: 50%;
  will-change: transform;
}

/* 色场：铺满整屏，靠 opacity 进出。常驻不 v-if，否则退场那一下没有过渡 */
.stg-flash {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition-property: opacity;
  transition-timing-function: ease;
}

.stg-flash.is-white {
  background: #ffffff;
  opacity: 1;
}

.stg-flash.is-black {
  background: #000000;
  opacity: 1;
}

.stg-bonus {
  position: absolute;
  left: 50%;
  top: 12%;
  color: #ffffff;
  font-family: var(--font-pixel);
  font-size: clamp(28px, 5vw, 64px);
  letter-spacing: 2px;
  white-space: nowrap;
  text-shadow: 0 4px 0 #000000;
  /* 常态 = 动画末帧，fill-mode 失效时也不会闪 */
  opacity: 1;
  transform: translate(-50%, 0);
  animation: stg-bonus-in 460ms cubic-bezier(0.2, 0.9, 0.25, 1) both;
}

/* 符卡名：全屏左上角常驻 */
.stg-card {
  position: absolute;
  top: 24px;
  left: 24px;
  color: #ffffff;
  font-family: var(--font-pixel);
  font-size: clamp(18px, 2.4vw, 34px);
  letter-spacing: 1px;
  white-space: nowrap;
  text-shadow: 0 3px 0 #000000;
  /* 常态 = 动画末帧，fill-mode 失效时也不会闪 */
  opacity: 1;
  transform: translateY(0);
  animation: stg-card-in 380ms cubic-bezier(0.2, 0.9, 0.25, 1) both;
}

/* 左上角字牌的出现：从上方落一小段 + 淡入 */
@keyframes stg-card-in {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 小小的浮现：从下方一点点浮上来 + 淡入 */
@keyframes stg-bonus-in {
  from {
    opacity: 0;
    transform: translate(-50%, 14px);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}
</style>
