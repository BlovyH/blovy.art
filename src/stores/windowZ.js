import { ref } from 'vue'

// 全站 z-index 的唯一来源。CSS 里改用 var(--z-xxx)，由 installZVariables() 注入 :root。
export const Z = {
  COMMAND: 1, // 左上角命令窗口
  COMMAND_FRONT: 2, // printf welcome 窗口，压在命令窗口上
  COMMENTS: 40,
  GALLERY: 50,
  DP: 100,

  WINDOW_BASE: 1000, // nextZ() 从这里开始递增
  ICON: 9998, // 桌面图标 .drag-top
  TOP_MOST: 9999, // 桌面图标创建的窗口
  MAXIMIZED: 10000, // 最大化窗口独占一层：高于图标和 top-most 窗，低于全屏效果层
  DETAIL: 10001, // 点开图/项目后的详情面板：必须从最大化出来的父窗口上面浮起来
  MESBIN: 10009, // 可丢弃目标的垃圾桶，高于后院全屏层，低于对话框，与 DUEL 同层但互斥出现
  DUEL: 10009, // iy 转转转动画期间强制置顶不然其他窗口点一下就遮住了，直到结束新窗口也会被遮住（新窗口额外加了手动置 focus 状态逻辑）
  OVERLAY: 10010, // 太阳镜滤镜 / DialogBox
  BANNER: 10011, // 切换横幅 / OptionBox
  MENU: 10013, // 跟随点击位置的小浮层菜单
  FLOWER_SPIT: 10016, // 后院吐出的花朵，压过后院舞台，低于拎起的水滴
  CALLBACK_ITEM: 10017, // iy 的 callback 按钮
  EMOTIONS_DROP: 10017, // 拎起来的水滴，压在 mesbin 上面
  TORCH: 10018, // 手电筒：压过所有页面内容，上面只留演出层和系统通知
  SNOW: 10019, // 飘雪层：全屏飘雪 + 底部字幕，满屏，无交互
  STG: 10020, // 贴纸弹幕游戏层：整屏暗幕 + 弹幕，压在所有窗口之上
  STG_TUNER: 10021, // 弹幕调参面板（仅 dev，见 .gitignore）：要浮在游戏层上面
  // ⚠️ 后院必须低于 OVERLAY / BANNER：后院里的棋盘要点开对话框，而 DialogBox / OptionBox
  // 是 Teleport 到 body 的，不受 .home.is-backyard 的隐藏规则管，只能靠层级压过后院舞台。
  BACKYARD: 10008, // 后院空间
  BACKYARD_FADE: 10031, // 进出后院的黑场过渡层：要连对话框一起盖住，所以远高于后院
  TOAST: 20000,
  SCREENSAVER: 30000, // 屏保：压过所有页面内容（含 toast），任何操作立刻退出所以不吃事件
  BLACKOUT: 40000, // 花朵溢出（演出层最高）
  UPDATE: 40001, // 右上角「有新版本」提示：系统通知，压过包括演出层在内的所有层
}

// 把层级表写成 :root 的 CSS 变量，让样式和 JS 用的是同一份数字
export function installZVariables() {
  const root = document.documentElement
  for (const [name, value] of Object.entries(Z)) {
    root.style.setProperty(`--z-${name.toLowerCase().replace(/_/g, '-')}`, String(value))
  }
}

const counter = ref(Z.WINDOW_BASE)

export function nextZ() {
  return ++counter.value
}

// 同一时刻只允许一个窗口最大化：新窗口进来时先把上一个还原回去
let maximizedRelease = null
export function claimMaximized(release) {
  if (maximizedRelease && maximizedRelease !== release) maximizedRelease()
  maximizedRelease = release
}
export function releaseMaximized(release) {
  if (maximizedRelease === release) maximizedRelease = null
}
