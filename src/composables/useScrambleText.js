import { computed, onBeforeUnmount, ref, watch } from 'vue'

// 乱码字符按字宽分池，逐帧替换时行长不变，段落不会因换行点移动而抖
const NOISE_NARROW = '0123456789#%&@$*+=<>/\\|'
// HTML 文本里的乱码不能带标签或实体起始符
const NOISE_HTML_NARROW = '0123456789#%@$*+=/|'
const isWide = (ch) => ch.codePointAt(0) > 0xff
const HTML_UNSAFE = '<>&'

// 每帧换掉多少未落定位置的字符，越小越接近静态噪点
const NOISE_TURNOVER = 0.35

// 标出标签区间的字符，这些位置始终按原文输出
function lockTags(text) {
  const flags = new Uint8Array(text.length)
  let inside = false
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '<') inside = true
    flags[i] = inside ? 1 : 0
    if (text[i] === '>') inside = false
  }
  return flags
}

// 源文本变化时，把新文本从左到右逐字落定，其余位置持续跳乱码
export function useScrambleText(source, {
  durationMs = 520,
  tickMs = 32,
  turnover = NOISE_TURNOVER,
  html = false,
  trigger = null,
  enabled = () => true,
  keep = '',
} = {}) {
  const keepChars = new Set(keep)
  const displayText = ref(source.value)
  const isScrambling = ref(false)
  let timer = 0
  let startedAt = 0
  let target = ''
  let widePool = ''
  let narrowPool = ''
  let noise = ''
  let locked = null

  function stop() {
    clearTimeout(timer)
    timer = 0
  }

  function finish() {
    stop()
    displayText.value = target
    isScrambling.value = false
  }

  function frame() {
    const p = Math.min(1, (performance.now() - startedAt) / durationMs)
    const settled = Math.floor(target.length * p)
    let out = ''
    for (let i = 0; i < target.length; i += 1) {
      // 标签、keep 字符和已落定的位置按原文输出，标签不会被落定边界切成半截
      if (locked?.[i] || i < settled || target[i] === ' ' || keepChars.has(target[i])) {
        out += target[i]
        continue
      }
      // 未换掉的位置沿用上一帧字符，换掉的从同宽池里取
      const prev = noise[i]
      const pool = isWide(target[i]) ? widePool : narrowPool
      out += prev && Math.random() >= turnover
        ? prev
        : pool[(Math.random() * pool.length) | 0]
    }
    noise = out
    displayText.value = out
    if (p < 1) {
      timer = setTimeout(frame, tickMs)
      return
    }
    finish()
  }

  function run(next) {
    stop()
    target = next
    noise = ''
    if (!enabled() || !next) {
      displayText.value = next
      isScrambling.value = false
      return
    }
    const mixed = displayText.value + next
    const narrowChars = [...mixed].filter((ch) => !isWide(ch) && ch !== ' ' && !HTML_UNSAFE.includes(ch))
    // 宽字符乱码取自目标文案，切换后跟文案是同一套文字，也不引入字体子集里没有的字
    widePool = [...next].filter((ch) => isWide(ch) && ch.length === 1).join('') || (html ? NOISE_HTML_NARROW : NOISE_NARROW)
    narrowPool = (html ? NOISE_HTML_NARROW : NOISE_NARROW) + narrowChars.join('')
    // keep 的字符原样输出，也不能混进噪声池
    if (keepChars.size) {
      widePool = [...widePool].filter((ch) => !keepChars.has(ch)).join('')
      narrowPool = [...narrowPool].filter((ch) => !keepChars.has(ch)).join('')
    }
    locked = html ? lockTags(next) : null
    startedAt = performance.now()
    isScrambling.value = true
    frame()
  }

  // 传 trigger 时只有它变化才演出，源文本自身变化直接同步，避免每翻一句台词都乱码
  if (trigger) {
    const watched = computed(() => ({ text: source.value, tick: trigger.value }))
    watch(watched, (cur, prev) => {
      if (!prev || cur.tick === prev.tick || !enabled()) {
        stop()
        displayText.value = cur.text
        isScrambling.value = false
        return
      }
      run(cur.text)
    })
  } else {
    watch(source, run)
  }

  onBeforeUnmount(stop)
  return { displayText, isScrambling }
}
