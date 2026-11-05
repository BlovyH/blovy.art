// 把 12x12 像素图补成独立字体，并注册 @font-face
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import opentype from 'opentype.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const GRID = 12
const ALPHA_MIN = 128
const FAMILY = 'Fusion Pixel Glyphs'
const DIR = path.join(root, 'public/assets/fonts')
const SOURCE = path.join(root, 'src/assets/fonts/fusion-pixel-12px-monospaced-zh_hans.ttf')
const OUT = path.join(DIR, 'glyph-patch.ttf')
const CSS = path.join(root, 'src/assets/styles/global.css')

const parseFont = (buf) => opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))

// 补丁字形跟主字体共用一套度量
const source = parseFont(fs.readFileSync(SOURCE))
const m = {
  unitsPerEm: source.unitsPerEm,
  ascender: source.ascender,
  descender: source.descender,
  advance: source.tables.hhea.advanceWidthMax,
}
const cw = m.advance / GRID
const ch = (m.ascender - m.descender) / GRID

async function readInk(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  if (info.width !== GRID || info.height !== GRID) {
    throw new Error(`${path.basename(file)} 必须是 ${GRID}x${GRID}，当前 ${info.width}x${info.height}`)
  }
  const stride = info.channels
  const ink = new Uint8Array(GRID * GRID)
  for (let i = 0; i < ink.length; i++) ink[i] = data[i * stride + stride - 1] >= ALPHA_MIN ? 1 : 0
  if (!ink.includes(1)) throw new Error(`${path.basename(file)} 里没有不透明的笔画，确认背景是透明的`)
  return ink
}

// 每个墨点一个矩形轮廓，sfnt 各表交给字体引擎生成
function glyphPath(ink) {
  const p = new opentype.Path()
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      if (!ink[row * GRID + col]) continue
      const x0 = Math.round(col * cw)
      const x1 = Math.round((col + 1) * cw)
      const y0 = Math.round(m.ascender - (row + 1) * ch)
      const y1 = Math.round(m.ascender - row * ch)
      p.moveTo(x0, y0)
      p.lineTo(x0, y1)
      p.lineTo(x1, y1)
      p.lineTo(x1, y0)
      p.close()
    }
  }
  return p
}

// 读回产物，按轮廓起点还原成网格，跟输入图逐格比对
function inkFromGlyph(glyph) {
  const ink = new Uint8Array(GRID * GRID)
  let start = null
  for (const cmd of glyph.path.commands) {
    if (cmd.type === 'M') start = [cmd.x, cmd.y]
    else if (cmd.type === 'Z' && start) {
      const col = Math.round(start[0] / cw)
      const row = Math.round((m.ascender - start[1]) / ch) - 1
      if (row >= 0 && row < GRID && col >= 0 && col < GRID) ink[row * GRID + col] = 1
      start = null
    }
  }
  return ink
}

// 只替换标记之间的那一段，重复运行不会累加
function injectCss(cps) {
  const ranges = cps.map(cp => `U+${cp.toString(16).toUpperCase()}`).join(', ')
  const start = '/* glyph-font:start */'
  const end = '/* glyph-font:end */'
  const block = [
    start,
    '@font-face {',
    `  font-family: '${FAMILY}';`,
    "  src: url('/assets/fonts/glyph-patch.ttf');",
    '  font-weight: normal;',
    '  font-style: normal;',
    '  font-display: block;',
    `  unicode-range: ${ranges};`,
    '}',
    end,
    '',
  ].join('\n')
  let css = fs.readFileSync(CSS, 'utf8')
  const a = css.indexOf(start)
  if (a >= 0) {
    const b = css.indexOf(end, a)
    if (b < 0) throw new Error('global.css 里的补丁字体标记不完整')
    css = css.slice(0, a) + block + css.slice(b + end.length).replace(/^\r?\n/, '')
  } else {
    css = block + css
  }
  fs.writeFileSync(CSS, css)
}

const files = fs.readdirSync(DIR)
  .map(name => /^glyph-([0-9a-fA-F]{4,6})\.png$/.exec(name))
  .filter(Boolean)
  .sort((a, b) => parseInt(a[1], 16) - parseInt(b[1], 16))
if (!files.length) throw new Error(`没有找到 glyph-<码位>.png，放在 ${path.relative(root, DIR)}`)

const entries = []
for (const hit of files) {
  entries.push({ cp: parseInt(hit[1], 16), ink: await readInk(path.join(DIR, hit[0])) })
}

const glyphs = [new opentype.Glyph({
  name: '.notdef', unicode: 0, advanceWidth: m.advance, path: new opentype.Path(),
})]
for (const { cp, ink } of entries) {
  glyphs.push(new opentype.Glyph({
    name: `uni${cp.toString(16).toUpperCase().padStart(4, '0')}`,
    unicode: cp,
    advanceWidth: m.advance,
    path: glyphPath(ink),
  }))
}
const font = new opentype.Font({
  familyName: FAMILY,
  styleName: 'Regular',
  unitsPerEm: m.unitsPerEm,
  ascender: m.ascender,
  descender: m.descender,
  glyphs,
})
const out = font.toArrayBuffer()
fs.writeFileSync(OUT, Buffer.from(out))

const check = parseFont(Buffer.from(out))
for (const { cp, ink } of entries) {
  const got = inkFromGlyph(check.charToGlyph(String.fromCodePoint(cp)))
  const bad = ink.reduce((n, v, i) => n + (v !== got[i] ? 1 : 0), 0)
  if (bad) throw new Error(`U+${cp.toString(16).toUpperCase()} 读回后有 ${bad} 格与像素图不一致`)
}
if (!process.argv.includes('--no-css')) injectCss(entries.map(e => e.cp))
const list = entries.map(e => `U+${e.cp.toString(16).toUpperCase()}`).join(', ')
console.log(`已生成 ${path.relative(root, OUT)}  ${list}  ${entries.length} 个字形  ${fs.statSync(OUT).size} 字节，逐格校验通过`)
