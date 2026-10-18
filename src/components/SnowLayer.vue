<template>
  <div
    class="snow-layer"
    :class="{ 'is-leaving': leaving, 'is-seeding': seeding }"
    aria-hidden="true"
  >
    <!-- 提示符落点雪花 -->
    <span
      v-if="seed && seeding"
      class="snow-seed"
      :style="seedStyle"
      >*</span
    >
    <!-- 神秘柔光，在雪花的下面 -->
    <div class="snow-bloom">
      <div class="snow-bloom__glow" />
      <div class="snow-bloom__haze" />
      <span
        v-for="spot in bokeh"
        :key="spot.id"
        class="snow-bokeh"
        :style="spot.style"
      />
      <span
        v-for="spot in motes"
        :key="spot.id"
        class="snow-bokeh"
        :style="spot.style"
      />
    </div>
    <span
      v-for="flake in flakes"
      :key="flake.id"
      class="snow-flake"
      :style="flake.style"
      >*</span
    >
    <svg
      class="snow-defs"
      aria-hidden="true"
    >
      <defs>
        <!-- 逐字画的最外层白色描边/px，必须是像素格的整数倍（1 格 = 字号 / 12）：
             轮廓是整格一级的台阶，非整格偏移会把一级台阶切成半格观感比较毛糙 -->
        <filter
          id="snow-dilate-1"
          x="-25%"
          y="-25%"
          width="150%"
          height="150%"
          primitiveUnits="userSpaceOnUse"
          color-interpolation-filters="sRGB"
        >
          <feMorphology
            operator="dilate"
            radius="4"
          />
        </filter>
        <filter
          id="snow-dilate-2"
          x="-25%"
          y="-25%"
          width="150%"
          height="150%"
          primitiveUnits="userSpaceOnUse"
          color-interpolation-filters="sRGB"
        >
          <feMorphology
            operator="dilate"
            radius="8"
          />
        </filter>
        <!-- 拼音字号比正文小一格，描边为黑边 1 格、白圈 2 格 -->
        <filter
          id="snow-dilate-py-1"
          x="-40%"
          y="-40%"
          width="180%"
          height="180%"
          primitiveUnits="userSpaceOnUse"
          color-interpolation-filters="sRGB"
        >
          <feMorphology
            operator="dilate"
            radius="2"
          />
        </filter>
        <filter
          id="snow-dilate-py-2"
          x="-40%"
          y="-40%"
          width="180%"
          height="180%"
          primitiveUnits="userSpaceOnUse"
          color-interpolation-filters="sRGB"
        >
          <feMorphology
            operator="dilate"
            radius="4"
          />
        </filter>
      </defs>
    </svg>
    <p class="snow-lyric">
      <span class="snow-lyric__line">
        <span class="snow-lyric__text snow-lyric__text--halo">
          <span
            v-for="(ch, i) in chars"
            :key="i"
            class="snow-lyric__col"
            :style="colStyle(i)"
          >
            <span class="snow-lyric__py">{{ PINYIN[i] }}</span>
            <span class="snow-lyric__ch">{{ ch }}</span>
          </span>
        </span>
        <span class="snow-lyric__text snow-lyric__text--outline">
          <span
            v-for="(ch, i) in chars"
            :key="i"
            class="snow-lyric__col"
            :style="colStyle(i)"
          >
            <span class="snow-lyric__py">{{ PINYIN[i] }}</span>
            <span class="snow-lyric__ch">{{ ch }}</span>
          </span>
        </span>
        <span class="snow-lyric__text snow-lyric__text--fill">
          <span
            v-for="(ch, i) in chars"
            :key="i"
            class="snow-lyric__col"
            :style="colStyle(i)"
          >
            <span
              class="snow-lyric__py"
              :style="sungStyle(i)"
              >{{ PINYIN[i] }}</span
            >
            <span
              class="snow-lyric__ch"
              :style="sungStyle(i)"
              >{{ ch }}</span
            >
          </span>
        </span>
      </span>
    </p>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { snowSeed } from '@/snowTrigger.js'

const LYRIC = '雪花飘飘~北风萧萧~'
const PINYIN = ['xuě', 'huā', 'piāo', 'piāo', '', 'běi', 'fēng', 'xiāo', 'xiāo', '']
const FLAKE_COUNT = 60
// 字号只取 12 的整数倍；像素字体在非整数倍下会被插值糊掉
const FLAKE_SIZES = [24, 36, 48, 60, 72]

// 每个字的吟唱时间
const CHAR_MS = [1100, 540, 800, 440, 500, 300, 500, 1000, 800, 1000]
const HOLD_MS = 1200

const chars = [...LYRIC]
const starts = []
let acc = 0
chars.forEach((_, i) => {
  starts.push(acc)
  acc += CHAR_MS[i] ?? 300
})
const CYCLE_MS = acc + HOLD_MS

const FADE_OUT_MS = 800
const SEED_MS = 1500 // 提示符旋转移动变成雪花的动画时间
const emit = defineEmits(['end'])
const leaving = ref(false)

const seed = snowSeed.value
const seeding = ref(Boolean(seed))
let endTimer = 0
let seedTimer = 0

function beginCycle() {
  endTimer = setTimeout(() => {
    leaving.value = true
    endTimer = setTimeout(() => emit('end'), FADE_OUT_MS)
  }, CYCLE_MS)
}

onMounted(() => {
  // 计时从飘雪开始，提示符进场只是前摇
  if (seeding.value) {
    seedTimer = setTimeout(() => {
      seeding.value = false
      beginCycle()
    }, SEED_MS)
    return
  }
  beginCycle()
})

onBeforeUnmount(() => {
  clearTimeout(endTimer)
  clearTimeout(seedTimer)
})

// 每个字一条 keyframes：在整轮时间轴上，自己那段把双色渐变的边界从右推到左（露出蓝色），
// 其余时间停在两端。百分比只能写死成数字，所以这一段用 JS 拼出来注入，
// 而不是把唱/停比例写死在 CSS 里
// 波浪幅度取整格（1 格 = 字号 / 12）：描边层每帧都要按当前位置重新栅格化，
// 小数位移会让它每帧落在半格上，膨胀出来的外轮廓跟着来回抖 1px
const WAVE_AMP = 8

const keyframes = `
@keyframes snow-wave {
  from { translate: 0 ${WAVE_AMP}px; }
  to { translate: 0 -${WAVE_AMP}px; }
}
${chars
  .map((_, i) => {
    const from = ((starts[i] / CYCLE_MS) * 100).toFixed(3)
    const to = (((starts[i] + (CHAR_MS[i] ?? 300)) / CYCLE_MS) * 100).toFixed(3)
    return `@keyframes snow-sung-${i} {
  0%, ${from}% { background-position: 100% 0; }
  ${to}%, 100% { background-position: 0 0; }
}`
  })
  .join('\n')}`

if (typeof document !== 'undefined' && !document.getElementById('snow-keyframes')) {
  const el = document.createElement('style')
  el.id = 'snow-keyframes'
  el.textContent = keyframes
  document.head.appendChild(el)
}

// 波浪：每字一条，相位错开一点连起来就是起伏。写在内联样式里是因为填色层要把它和
// 渐变推进拼进同一个 animation 简写，而 scoped CSS 里的 keyframes 会被改名、内联引用不到
// steps() 会让位移落在整像素上；用平滑的（ease-in-out、WAVE_AMP = 5）就会有微小的抖动
// （描边层带 filter，所以它每一帧都要按字当前的位置重新栅格化一次。连续插值（ease-in-out 从 5px 到 -5px），绝大多数帧的位移都是小数（比如 3.47px）。整层落在半格上 → 栅格化出来的边缘 alpha 每帧都不一样 → 膨胀（取邻域最大值）出来的外轮廓就跟着来回挪大约 1 个设备像素。）
// 二选一，你要不要吧.jpg
const wave = (i) =>
  `snow-wave 1.2s steps(${WAVE_AMP * 2}, end) ${(i * -0.1).toFixed(2)}s infinite alternate`
/* 波浪挂在整列（拼音 + 字）上：分开挂的话两行会各自起伏，运动不统一 */
const colStyle = (i) => ({ animation: wave(i) })
/* 拼音和字共用同一条 snow-sung-i、同一个 CYCLE_MS：起止时刻完全一致; 不循环 */
const sungStyle = (i) => ({
  animation: `snow-sung-${i} ${CYCLE_MS}ms linear forwards`,
})

const pick = (list) => list[Math.floor(Math.random() * list.length)]
const rand = (min, max) => min + Math.random() * (max - min)

// 大小光斑，尺寸、浓度、位置、漂移量随机（随机范围和生成数见下面的变量）
const makeSpots = (count, cfg) =>
  Array.from({ length: count }, (_, id) => ({
    id,
    style: {
      left: rand(-15, 95).toFixed(1) + '%',
      top: rand(-15, 95).toFixed(1) + '%',
      '--bk-size': Math.round(rand(...cfg.size)) + cfg.unit,
      '--bk-alpha': rand(...cfg.alpha).toFixed(3),
      /* 四个中途停靠点，各自随机 → 连起来是一条闭合折线，没有规律地往四周游走 */
      ...Object.fromEntries(
        [1, 2, 3, 4].flatMap((n) => [
          [`--bk-x${n}`, Math.round(rand(-cfg.dx, cfg.dx)) + 'vw'],
          [`--bk-y${n}`, Math.round(rand(-cfg.dy, cfg.dy)) + 'vh'],
        ]),
      ),
      '--bk-scale': rand(1.05, 1.25).toFixed(2),
      '--bk-dur': rand(...cfg.dur).toFixed(1) + 's',
      /* 负延迟，让它们一显示就在行程中途动着的状态 */
      '--bk-delay': rand(-cfg.dur[1], 0).toFixed(1) + 's',
    },
  }))

// 大光斑
const bokeh = makeSpots(6, {
  size: [30, 44],
  unit: 'vw',
  alpha: [0.05, 0.1],
  dx: 14,
  dy: 10,
  dur: [28, 55],
})

// 小光斑
const motes = makeSpots(8, {
  size: [120, 220],
  unit: 'px',
  alpha: [0.05, 0.08],
  dx: 20,
  dy: 15,
  dur: [12, 26],
})

const flakes = Array.from({ length: FLAKE_COUNT }, (_, id) => {
  const dur = rand(6, 14)
  // 起点只由一个随机数决定：斜着飘时「出生点 x」和「已走过的进度」不是两个独立的量
  // 屏幕上一朵雪的位置是 x + y 恒等于出生点，所以出生点必须在 0 ~ (视口宽 + 视口高) 上均匀取，
  // 密度才铺满整屏；拆成两个随机数相加会变成梯形分布，两个角（左上、右下）明显偏稀
  const birth = rand(0, 1)
  const progress = rand(0, 1)
  const percent = (birth * 100).toFixed(2)
  return {
    id,
    birth,
    progress,
    size: pick(FLAKE_SIZES),
    style: {
      left: `calc(${percent}% + ${percent}vh)`,
      opacity: rand(0.45, 1).toFixed(2),
      '--fall-dur': dur.toFixed(2) + 's',
      '--fall-delay': (-progress * dur).toFixed(2) + 's',
    },
  }
})
flakes.forEach((f) => {
  f.style.fontSize = f.size + 'px'
})

const vw = window.innerWidth
const vh = window.innerHeight

// 取一片雪花在整屏切进来那一刻的位置作为提示符目的点
// 起点和进度都是已知的，不用等渲染
function flakePosAtBurst(f) {
  const travel = vh + 2 * f.size
  return {
    x: f.birth * (vw + vh) - f.progress * travel,
    y: -2 * f.size + f.progress * travel,
    size: f.size,
  }
}

// 提示符落点取整屏切进来时正好在屏幕内、个头最大的一片
// 为了视觉优化，只在左半屏里挑点，下限是提示符自己的横坐标，上界取提示符自己的纵坐标 + 一点偏移值（至少出对话框吧）
const GAP_ABOVE = 50
const seedX = seed ? seed.x : 0
const seedY = seed ? seed.y : vh * 0.7
const target =
  flakes
    .map(flakePosAtBurst)
    .filter(
      (p) =>
        p.x > seedX &&
        p.x < vw * 0.5 &&
        p.y > vh * 0.1 &&
        p.y + p.size * 0.5 < Math.min(vh * 0.7, seedY - GAP_ABOVE),
    )
    .sort((a, b) => b.size - a.size)[0] ?? {
  x: Math.min(seedX + vw * 0.15, vw * 0.45),
  y: Math.min(vh * 0.3, seedY - GAP_ABOVE - 24),
  size: 48,
}

// 雪花盒子的中心：ASCII 是半角，一个 * 的盒子是 0.5em 宽、1em 高（line-height 写死 1），
// 所以半宽 = 0.25em、半高 = 0.5em
const seedStyle =
  seed &&
  {
    left: seed.x + 'px',
    top: seed.y + 'px',
    fontSize: seed.size,
    '--seed-dx': target.x + target.size * 0.25 - seed.x + 'px',
    '--seed-dy': target.y + target.size * 0.5 - seed.y + 'px',
    '--seed-scale': (target.size / parseFloat(seed.size)).toFixed(3),
    '--seed-dur': SEED_MS + 'ms',
  }
</script>

<style scoped>
.snow-layer {
  position: fixed;
  inset: 0;
  z-index: var(--z-snow);
  pointer-events: none;
  overflow: hidden;
}

.snow-layer.is-seeding .snow-bloom,
.snow-layer.is-seeding .snow-flake,
.snow-layer.is-seeding .snow-lyric {
  display: none;
}

.snow-layer.is-leaving {
  opacity: 0;
  transition: opacity 800ms linear;
}

/* 提示符移动到目标点后消失，播放动画，没必要给提示符本身也加飘雪动画 */
.snow-seed {
  position: absolute;
  z-index: 2;
  color: #ffffff;
  font-weight: bold;
  line-height: 1;
  /* 动画未生效的那一帧的兜底（动画期间由 keyframes 覆盖） */
  translate: -50% -50%;
  animation: snow-seed var(--seed-dur) cubic-bezier(0.45, 0, 0.55, 1) forwards;
}

@keyframes snow-seed {
  from {
    /* 两端都写成 -50% + Npx 的形状：只有同为 calc 才保证插值顺利。
       -50% 是把盒子中心摆到 left/top 上，起点和终点都对中心，字形才对得上 */
    translate: calc(-50% + 0px) calc(-50% + 0px);
    rotate: 0deg;
    scale: 1;
  }
  to {
    translate: calc(-50% + var(--seed-dx)) calc(-50% + var(--seed-dy));
    /* 转3圈，不然有时候感觉没看清像平移，不太明显 */
    rotate: 1080deg;
    scale: var(--seed-scale);
  }
}

.snow-flake {
  position: absolute;
  top: -2em;
  color: #ffffff;
  /* 起飞那颗 * 要落到某片雪花上，两边 boxsizing 必须相似（都是 0.5em × 1em），
     中心对上字形才对得上。靠继承的话行高不确定，终点算不准 */
  line-height: 1;
  /* 用 translate, 不和大量用着的 transform 产生冲突 */
  animation: snow-fall var(--fall-dur) linear var(--fall-delay) infinite;
}

/* 柔光 */
.snow-bloom {
  position: absolute;
  inset: 0;
  pointer-events: none;
  --bloom-blur: 12px; /* 光散开的半径 */
  --bloom-gain: 1.7; /* 泛光提亮多少，越大越像过曝 */
  --bloom-mix: 0.4; /* 泛光叠回原画面的比例：0 = 没泛光，1 = 整屏只剩模糊那一版 */
  --bloom-haze: 0.1; /* 白雾浓度，少女漫那种整体泛白的底子 */
}

/* 泛光（bloom），把整屏模糊 + 提亮之后，半透明叠回原画面 */
.snow-bloom__glow {
  position: absolute;
  inset: 0;
  /* 查了一下，Safari 到 18 才认无前缀的 backdrop-filter，老 WebKit 只认 -webkit- 那条
     两条都写，认识的用、不认识的丢，都不认识的话我也没招了，那就只剩雪花了 */
  -webkit-backdrop-filter: blur(var(--bloom-blur)) brightness(var(--bloom-gain))
    saturate(0.8);
  backdrop-filter: blur(var(--bloom-blur)) brightness(var(--bloom-gain)) saturate(0.8);
  opacity: var(--bloom-mix);
}

/* 白雾，在泛光之上再压一次对比、提一点亮，然后罩一层白，不压对比会变脏 */
.snow-bloom__haze {
  position: absolute;
  inset: 0;
  -webkit-backdrop-filter: blur(1px) brightness(1.08) contrast(0.88);
  backdrop-filter: blur(1px) brightness(1.08) contrast(0.88);
  background: rgba(255, 255, 255, var(--bloom-haze));
}

.snow-bokeh {
  position: absolute;
  width: var(--bk-size);
  height: var(--bk-size);
  background: radial-gradient(
    circle,
    rgba(255, 255, 255, var(--bk-alpha)) 0 38%,
    rgba(255, 255, 255, 0) 72%
  );
  /* 不要 alternate：折线已经闭合连续了，alternate 会原路倒着走一遍 */
  animation: snow-bokeh var(--bk-dur) ease-in-out var(--bk-delay) infinite;
}

@keyframes snow-bokeh {
  0% {
    translate: 0 0;
    scale: 1;
  }
  20% {
    translate: var(--bk-x1) var(--bk-y1);
  }
  40% {
    translate: var(--bk-x2) var(--bk-y2);
  }
  60% {
    translate: var(--bk-x3) var(--bk-y3);
    scale: var(--bk-scale);
  }
  80% {
    translate: var(--bk-x4) var(--bk-y4);
  }
  100% {
    /* 必须回到起点：末点停在哪，下一轮的 0% 就在哪，避免跳变 */
    translate: 0 0;
    scale: 1;
  }
}

/* 只放 filter 定义不占位 */
.snow-defs {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
}

@keyframes snow-fall {
  from {
    translate: 0 0;
  }
  to {
    /* 左斜 45°：两个方向的位移量相等。纵向要越过视口底边，否则最后一段会停在屏幕上 */
    translate: calc(-100vh - 2em) calc(100vh + 2em);
  }
}

.snow-lyric {
  position: absolute;
  bottom: 8vh;
  left: 0;
  right: 0;
  text-align: center;
  /* 1 格 = 字号 / 12，下面所有偏移量（描边半径、波浪幅度、行距）都按它取值 */
  font-size: 48px;
  font-weight: bold;
}

.snow-lyric__line {
  position: relative;
  /* 宽度由在流内的填色层决定，描边那两层绝对定位铺满它 */
  display: inline-flex;
  align-items: flex-end;
  /* 投影挂在整行上，取的是三层合成后的剪影（含白圈）。挂在某一层上会跟别的层错位 */
  filter: drop-shadow(8px 8px 4px rgba(0, 0, 0, 0.55));
}

/* 字间距必须挂在列所在的这一层上，放在 .snow-lyric__line 上是无效的，那层的三个子元素是
   描边 / 填色那三层，其中两层绝对定位、不算 flex item，只剩一个 in-flow 项，gap 无从生效。
   三层都得是同一个 flex 容器、同一个 gap，描边才跟填色逐字对齐。
   用 column-gap 而不是 letter-spacing：后者对原子内联盒（每列本身是 flex 容器）行为不一致 */
.snow-lyric__text {
  display: flex;
  /* 汉字间距。拼音是绝对定位、不占列宽，所以这个值只落在汉字上 ——
     想拉开音节之间的距离得改拼音自身，改这里会连汉字一起拉宽 */
  column-gap: 12px;
}

/* 描边靠 feMorphology 膨胀整层 alpha（见模板里那两个 filter），不是逐字的 text-shadow：
   逐字画阴影时，字与字的间隙只有 1 格，两边的阴影一叠就把中间填死，看着像每个字各自描了一圈、
   又互相压住。作用在整层上才是整段文字一个轮廓，字间的空隙由整体剪影决定 */
.snow-lyric__text--halo,
.snow-lyric__text--outline {
  position: absolute;
  inset: 0;
}

.snow-lyric__text--halo {
  z-index: 1;
  color: #ffffff;
}

.snow-lyric__text--outline {
  z-index: 2;
  color: #000000;
}

/* 膨胀 = mdb 里面的“选择境界的描绘” 拼音和汉字两行字号不同没法设同样的数字
   所以考虑分别描一遍然后结果区域取并集合成一个整体 */
.snow-lyric__text--halo .snow-lyric__ch {
  filter: url(#snow-dilate-2);
}

.snow-lyric__text--halo .snow-lyric__py {
  filter: url(#snow-dilate-py-2);
}

.snow-lyric__text--outline .snow-lyric__ch {
  filter: url(#snow-dilate-1);
}

.snow-lyric__text--outline .snow-lyric__py {
  filter: url(#snow-dilate-py-1);
}

/* 填色层
   字本身就是 mask（background-clip: text）不存在对不齐的问题 */
.snow-lyric__text--fill {
  position: relative;
  z-index: 3;
}

/* 一列 = 一个字的拼音 + 字本身，波浪挂在列上 */
.snow-lyric__col {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  row-gap: 0;
}

.snow-lyric__py {
  /* 脱离流、绝对挂在字头顶上：留在流里的话列宽 = max(拼音宽, 字宽)，而音节长短不一
     （三个字母 / 四个字母不一样宽），列宽就会忽宽忽窄，汉字间距跟着变得不均匀
     脱流之后列宽恒等于字宽，间距只由 column-gap 决定 */
  position: absolute;
  bottom: calc(100% + 4px);
  left: 50%;
  translate: -50% 0;
  white-space: nowrap;
  /* 盒子撑到整列宽，两行同步 */
  width: 100%;
  text-align: center;
  /* 字号上限由列宽卡死：这个字体的 ASCII 是半角（0.5em），字号 F 下一个四字母音节 = 2F px，
     必须小于 字宽 + column-gap，否则相邻音节会粘在一起 */
  font-size: 24px;
  line-height: 1;
}

.snow-lyric__ch {
  display: inline-block;
  /* 必须写死 1，默认行高（normal ≈ 1.2）会在字上面留出一截行距 */
  line-height: 1;
}

.snow-lyric__text--fill .snow-lyric__ch,
.snow-lyric__text--fill .snow-lyric__py {
  color: transparent;
  -webkit-text-fill-color: transparent;
  background-image: linear-gradient(90deg, #0000ff 0 50%, #ffffff 50% 100%);
  background-size: 200% 100%;
  background-repeat: no-repeat;
  background-position: 100% 0;
  -webkit-background-clip: text;
  background-clip: text;
}
</style>
