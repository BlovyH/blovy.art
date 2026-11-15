// 对话文案里要高亮的片段，按文本登记；style 省略时用默认青色
export const HIGHLIGHTS = [
  { text: 'WIKI' },
  { text: 'torch' },
  { text: 'tallch' },
  { text: 'bench' },
  { text: '手㫣' },
  { text: '手电' },
  { text: '手凳' },
  { text: 'トーチ' },
  { text: 'トおおおおおチ' },
  { text: 'ベンチ' },
  { text: 'FLOWER PUDDING' },
  { text: 'FLOWER CAKE' },
]

// 样式名映射到 class，新增样式只需在这里加一行和一条 CSS
const STYLES = { cyan: 'dialog-hl--cyan' }

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const SOURCE = [...HIGHLIGHTS]
  .sort((a, b) => b.text.length - a.text.length)
  .map((h) => escapeRe(h.text))
  .join('|')
const classOf = new Map(
  HIGHLIGHTS.map((h) => [h.text, STYLES[h.style ?? 'cyan'] ?? STYLES.cyan]),
)

// 按标签切段，只在文本段里替换，保住 <br> / <a> 等原有 HTML
export function highlightText(text) {
  if (!text) return text
  const pattern = new RegExp(`(${SOURCE})`, 'g')
  return text
    .split(/(<[^>]*>)/g)
    .map((part) =>
      part.startsWith('<')
        ? part
        : part.replace(pattern, (m) => `<span class="dialog-hl ${classOf.get(m)}">${m}</span>`),
    )
    .join('')
}
