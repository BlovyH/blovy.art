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
        v-for="b in DEBUG_HITBOX ? bullets : []"
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

      <!-- 符卡名：本条目的演出文案，全程挂在左上角 -->
      <div class="stg-card">{{ CARD_NAME }}</div>

      <div
        class="stg-flash"
        :class="{ 'is-white': flash === 'white', 'is-black': flash === 'black' }"
        :style="{ transitionDuration: `${flashMs}ms` }"
      ></div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { stickerStgRun } from '../dpActions.js'

const props = defineProps({
  item: {
    type: Object,
    required: true,
  },
})

const BULLET_TOTAL = 60 // 弹幕总量：格子不够就从已有的里复制补足
const BULLET_DRAG = 0.9975 // 每 ms 保留的速度比例（指数衰减）：爆炸的"变慢"靠它
const GRAVITY = 0.0012 // px/ms² 下落加速度
// 纯阻力下能跑到的极限位移 = v0 / DRAG_RATE，而重力还会往回拽，实际最高点只有它的一半多点。
// GRAVITY_SHARE 是凭观感定的系数，改 BULLET_DRAG / GRAVITY 之后要一起重调。
const DRAG_RATE = -Math.log(BULLET_DRAG)
const GRAVITY_SHARE = 0.56
const ASCENT = 0.12 // 「刚够冲过屏幕顶部」所需的上升高度里，顶部以上的余量（视口高度比例）
// 实际最高点 = 刚够过顶的高度 × 这个倍数。飞得越高回来越晚，整片因此错开时间落下 ——
// 全队同一个高度就是"一堵墙砸下来"，没有缝可钻。
const APEX_SCALE = { min: 1, max: 1.7 }
const UP_SPEED = { min: 1.2, max: 6 } // px/ms 向上初速的反推结果夹在这里
const SPREAD_X = 0.7 // 横向落点在各自槽位内的抖动幅度（占一个槽位宽度的比例）
const GRACE = 600 // ms 起爆后这段时间内不判定，给反应时间
const PLAYER_SPEED = 0.5 // px/ms
const SLOW_FACTOR = 0.45 // 按住 Shift 时的移速倍率：低速移动，用来钻缝
const PLAYER_SIZE = 22 // px 自机直径，也参与判定
const HIT_SCALE = 0.4 // 子弹判定圆直径相对贴图边长：比图片小一圈
// px 自机擦弹外框直径。显示与判定共用这一个常量，别再拆出第二个系数
const GRAZE_RING = 50
const GRAZE_LINGER = 300 // ms 擦弹提示的滞留时间，不然一闪就过去了
const BONUS_HOLD = 2222 // BONUS 停留时长 ms
const FLASH_HIT = 2200 // ms 中弹的白场，进出各一次
const FLASH_END = 500 // ms 结束的黑场，比白场短
// debug：把每发的判定区域画出来（红圈）。判定的实际情况是"玩家中心进圈即死"，所以圈比贴图自身的
// 判定圆大一个玩家尺寸 —— 要看贴图自己的判定圆就把后面的 PLAYER_SIZE 去掉。上线前记得改回 false。
const DEBUG_HITBOX = true
// 符卡名：全程显示在左上角。只属于本条目，所以留在视图里，不进 JSON
const CARD_NAME = '喵符「CAT-ASTROPHE」'

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

const gridRef = ref(null)
const phase = ref('idle') // idle | playing | bonus | clear（clear = 元素已收起，只剩色场在退）
const flash = ref('') // '' | 'white' | 'black'
const flashMs = ref(0) // 本次色场的时长，进和出用同一个
const grazing = ref(false) // 点亮后按 GRAZE_LINGER 滞留
const slow = ref(false)
const bullets = ref([])
const player = ref({ x: 0, y: 0 })

let raf = 0
let lastFrame = 0
let elapsed = 0 // 本局已进行的时间，用来算起爆后的无敌时间
let grazeTimer = 0 // 滞留计时，续期用；不放 timers[]（每帧一个会堆爆）
const timers = []
const keys = new Set()

// PREVIEW 每点一次 +1：watch 到就重开一局，所以游戏中再点也是重开
watch(stickerStgRun, () => {
  start()
})

function start() {
  stop()

  const cells = gridRef.value?.querySelectorAll('.sticker-cell')
  if (!cells?.length) return

  // 每格从自己所在的位置起爆
  const spawns = []
  for (const cell of cells) {
    const r = cell.getBoundingClientRect()
    spawns.push({
      src: cell.currentSrc || cell.src,
      x: r.left + r.width / 2,
      y: r.top + r.height / 2,
      size: Math.min(r.width, r.height),
    })
  }
  while (spawns.length < BULLET_TOTAL) {
    spawns.push({ ...spawns[Math.floor(Math.random() * spawns.length)] })
  }

  const slot = window.innerWidth / BULLET_TOTAL

  const list = []
  for (let i = 0; i < BULLET_TOTAL; i++) {
    const s = spawns[i]

    // 纵向：整片先冲过屏幕顶部。网格在窗口里的位置会随拖拽变，所以按各自起点反推所需初速，
    // 而不是给固定值 —— 否则窗口一低就冲不上去，又变成在中途四散。
    const bare = s.y + window.innerHeight * ASCENT // 刚够越过头顶的上升高度
    const rise = bare * (APEX_SCALE.min + Math.random() * (APEX_SCALE.max - APEX_SCALE.min))
    const vUp = clamp((rise * DRAG_RATE) / GRAVITY_SHARE, UP_SPEED.min, UP_SPEED.max)

    // 横向：按序号把落点均分到整屏宽度（各带一点抖动）。极限位移 = vx / DRAG_RATE，反着用
    // 就是"让我落到第 i 号槽位" —— 只有铺满整屏又带缝，才有钻的余地。
    const targetX = (i + 0.5) * slot + (Math.random() - 0.5) * slot * SPREAD_X
    const vx = (targetX - s.x) * DRAG_RATE

    list.push({
      id: i,
      src: s.src,
      size: s.size,
      x: s.x - s.size / 2,
      y: s.y - s.size / 2,
      vx,
      vy: -vUp,
    })
  }

  bullets.value = list
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

function tick(now) {
  const dt = Math.min(now - lastFrame, 32)
  lastFrame = now
  elapsed += dt

  movePlayer(dt)

  const px = player.value.x + PLAYER_SIZE / 2
  const py = player.value.y + PLAYER_SIZE / 2
  const drag = Math.pow(BULLET_DRAG, dt)
  const alive = []

  for (const b of bullets.value) {
    // 起爆瞬间很快，随后被阻力指数拖慢，同时一直受重力 —— 冲上去再落下来
    const vx = b.vx * drag
    const vy = b.vy * drag + GRAVITY * dt
    const nx = b.x + vx * dt
    const ny = b.y + vy * dt

    // 只等它落出屏幕下沿才丢掉：飞到屏幕上方时仍在列表里，之后会被重力拽回来
    if (ny > window.innerHeight) continue

    if (elapsed > GRACE) {
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

  if (!alive.length) {
    finish('bonus')
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

// debug：判定区域 = 以子弹中心为准、直径 size*HIT_SCALE + PLAYER_SIZE 的圆
// （玩家中心进这个圆就判定撞到，所以比贴图自己的判定圆大一个玩家尺寸）
function hitboxStyle(b) {
  const side = b.size * HIT_SCALE + PLAYER_SIZE
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
    phase.value = 'bonus'
    timers.push(setTimeout(() => runFlash('black', FLASH_END), BONUS_HOLD))
    return
  }
  runFlash('black', FLASH_END)
}

// 色场：涨满（ms）→ 收起元素 → 退掉（ms）。进出用同一条 transition，所以元素要常驻，不能 v-if
function runFlash(color, ms) {
  flashMs.value = ms
  flash.value = color
  timers.push(
    setTimeout(() => {
      bullets.value = []
      phase.value = 'clear'
      flash.value = ''
      timers.push(setTimeout(() => {
        phase.value = 'idle'
      }, ms))
    }, ms),
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

// 暗幕期间屏蔽底下的一切鼠标操作。
// 关键点：详情窗的 click-outside-to-close 是注册在 **document 捕获阶段** 的（PixelWindow.vue），
// 在它之前掐断只能靠 window —— 捕获顺序是 window → document → ... → target，
// 晚于 document 的任何监听（包括在遮罩自身上 stopPropagation）都来不及。
const SWALLOWED = ['mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu']
function swallowMouse(e) {
  if (phase.value === 'idle') return
  e.stopPropagation()
  e.preventDefault?.()
}
for (const type of SWALLOWED) {
  window.addEventListener(type, swallowMouse, true)
}

function onKeyDown(e) {
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

/* 尺寸由 playerStyle 从 PLAYER_SIZE 给出，CSS 里不写第二遍 */
.stg-player {
  position: absolute;
  top: 0;
  left: 0;
  background: #ffffff;
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
