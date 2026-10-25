import { ref, watch } from 'vue'

// 溜冰场模式的开关：桌面那个 SKI MODE 图标翻它，窗口 / 图标 / power-btn 的拖动都看它。
// 存 localStorage 是为了刷新之后还是开着 —— 它是个「模式」，不是一次性彩蛋。
const KEY = 'blovy.ski-mode'

// 开关的两张贴图：路径只留这一处（模板换图与预载都用它）
export const SKI_MODE_ICON = ['/assets/ski.png', '/assets/ski_on.png']

export const skiMode = ref(localStorage.getItem(KEY) === '1')

// 「绑架」彩蛋：桌面那个 SKI MODE 有 chance 是个冒牌货 —— 它不开溜冰场，只把正牌关掉再嘲笑你。
// 掷一次定生死（模块级只算一遍），刷新才重掷；所以它是个偶发事件，不是一个开关。
export const SKI_IMPOSTOR_CHANCE = 0.11
export const skiImpostor = Math.random() < SKI_IMPOSTOR_CHANCE

watch(skiMode, (on) => {
  localStorage.setItem(KEY, on ? '1' : '0')
})

export function toggleSkiMode() {
  skiMode.value = !skiMode.value
}
