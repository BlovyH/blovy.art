const REPO_URL = 'https://github.com/BlovyH/blovy.art'

const FONTS = [
  {
    name: 'Fusion Pixel 12px',
    note: 'UI',
    url: 'https://github.com/TakWolf/fusion-pixel-font',
  },
  {
    name: 'Zhuque Fangsong',
    note: 'sticky key',
    url: 'https://github.com/TrionesType/zhuque',
  },
]

const S_TITLE = 'background:#00ffff;color:#000;font-size:20px;font-weight:bold;line-height:2;padding:4px 10px'
const S_BOLD = 'font-weight:bold;font-size:16px;line-height:1.9'
const LABEL_WIDTH = 6

function label(text) {
  return text.padEnd(LABEL_WIDTH)
}

// 旧仓库 getter 的简化版
function defineCommand(name, handler) {
  Object.defineProperty(window, name, {
    get: () => handler(),
    set: () => {}, // 防覆盖：赋值静默忽略，命令不会被随手改掉
    configurable: true,
  })
}

function printMenu() {
  // 所有 %c 必须写进第一个参数（格式串）——只有它会被解析
  // 写在后面的字符串参数里不保证被当成样式，样式串可能直接当文本打出来
  console.log('%c blovy.art %c >> Please type:', S_TITLE, S_BOLD)
  console.log(`  %c${label('fonts')}%c for typefaces`, S_BOLD, '')
  console.log(`  %c${label('repo')}%c for source code`, S_BOLD, '')
}

export function installConsoleMenu() {
  defineCommand('blovy', () => FONTS.map(font => `${font.name} — ${font.note}`).concat(REPO_URL))
  defineCommand('help', () => ['fonts — typefaces', `repo — ${REPO_URL}`])
  // 换行只能靠 console.log 打出来：回显值是一行预览，字符串里的 \n 会被转义显示。
  defineCommand('fonts', () => {
    for (const font of FONTS) {
      console.log(`%c${font.name}%c — ${font.note}  ${font.url}`, S_BOLD, '')
    }
    return null
  })
  defineCommand('repo', () => REPO_URL)

  printMenu()
}
