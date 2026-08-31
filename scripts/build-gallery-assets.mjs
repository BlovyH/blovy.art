// Gallery 图片资源构建脚本（构建期自动化，替代手动缩略图）
//
// Workflow：
//   1. 原图丢进 assets/gallery-originals/（支持 png/jpg/jpeg/webp/avif/gif）
//   2. 运行 npm run assets:build
//      - 用 sharp 为每张图生成两档 WebP（文件名拼后缀，不再一个图一个文件夹）：
//          * sm 宽480  → assets/gallery-dist/thumbs/<name>_sm.webp   （网格缩略图）
//          * md 宽1600 → assets/gallery-dist/previews/<name>_md.webp （详情中图，压缩版，非原图）
//      - 计算内容哈希写入 public/data/content.json 的 _gallery 字段（缓存破穿 ?v=）
//      - 自动用 wrangler 上传到 R2：thumbs/ + previews/ 两档 WebP、原图(gallery/originals/)、content.json（需先 wrangler login 或设 CLOUDFLARE_API_TOKEN）
//   3. content.json 的 gallery 条目头插：{ "thumb":"thumbs/<name>_sm", "preview":"previews/<name>_md", "highResSrc":"<原图直链>", ... }
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const ORIGINS = path.join(root, 'assets', 'gallery-originals')
const DIST = path.join(root, 'assets', 'gallery-dist')
const CONTENT = path.join(root, 'public', 'data', 'content.json')

// bucket 名从 wrangler.toml 读取（构建/部署配置，非网站数据层），缺失即报错
const BUCKET = (() => {
  const toml = path.join(root, 'wrangler.toml')
  if (!fs.existsSync(toml)) throw new Error('找不到 wrangler.toml，无法获取 R2 bucket 名')
  const m = fs.readFileSync(toml, 'utf8').match(/bucket_name\s*=\s*"([^"]+)"/)
  if (!m) throw new Error('wrangler.toml 未配置 bucket_name')
  return m[1]
})()
// 生成尺寸：图片参数，非数据层，写死常量（改尺寸直接改这里）
const THUMB_W = 480   // sm 档：网格缩略图
const FULL_W = 1600  // md 档：详情中图（压缩版，不是原图；原图走 highResSrc）
const EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif'])

let manifest = {}

function hashBuf(buf) {
  let h = 0x811c9dc5
  for (let i = 0; i < buf.length; i++) {
    h ^= buf[i]
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

async function main() {
  if (!fs.existsSync(ORIGINS)) {
    fs.mkdirSync(ORIGINS, { recursive: true })
    console.warn(`已创建原图文件夹 ${ORIGINS}，把图片放进去后再运行。`)
    return
  }
  fs.mkdirSync(DIST, { recursive: true })

  // 本地按子文件夹分类：gallery-originals/original/ → category:"original"，fandom/ → "fandom"
  // 仅用于写 JSON 的 category 字段；远端 R2 按档位分 thumbs/ 与 previews/ 两个目录
  const CATEGORIES = ['original', 'fandom']
  let files = []
  for (const cat of CATEGORIES) {
    const dir = path.join(ORIGINS, cat)
    if (!fs.existsSync(dir)) {
      console.warn(`[跳过] 未找到 gallery-originals/${cat}/ 子文件夹`)
      continue
    }
    files = files.concat(
      fs.readdirSync(dir)
        .filter((f) => EXT.has(path.extname(f).toLowerCase()))
        .map((f) => ({ file: f, category: cat })),
    )
  }
  if (files.length === 0) {
    console.warn('gallery-originals/ 下 original/ 与 fandom/ 子文件夹里都没有图片，跳过。')
    return
  }
  // 同名跨分类冲突检测：R2 key 以纯文件名为准，会互相覆盖
  const _seen = new Map()
  for (const { file, category } of files) {
    const n = path.basename(file, path.extname(file))
    if (_seen.has(n) && _seen.get(n) !== category) {
      throw new Error(`图片名冲突：「${n}」同时出现在 ${_seen.get(n)}/ 与 ${category}/，R2 key 会互相覆盖，请改名`)
    }
    _seen.set(n, category)
  }

  const sharp = (await import('sharp')).default
  const arByName = {}
  for (const { file: f, category } of files) {
    const name = path.basename(f, path.extname(f))
    const srcPath = path.join(ORIGINS, category, f)

    const meta = await sharp(srcPath).metadata()
    const thumbW = Math.min(THUMB_W, meta.width || THUMB_W)
    const fullW = Math.min(FULL_W, meta.width || FULL_W)
    // 记录真实宽高比，写进 content.json，供前端在图未加载时预留宽度（消除首屏布局抖动）
    const ar = meta.width && meta.height ? +(meta.width / meta.height).toFixed(4) : null
    if (ar) arByName[name] = ar

    const thumbBuf = await sharp(srcPath).resize({ width: thumbW }).webp({ quality: 80 }).toBuffer()
    const fullBuf = await sharp(srcPath).resize({ width: fullW }).webp({ quality: 85 }).toBuffer()

    const smPath = path.join(DIST, 'thumbs', `${name}_sm.webp`)
    const mdPath = path.join(DIST, 'previews', `${name}_md.webp`)
    fs.mkdirSync(path.dirname(smPath), { recursive: true })
    fs.mkdirSync(path.dirname(mdPath), { recursive: true })
    fs.writeFileSync(smPath, thumbBuf)
    fs.writeFileSync(mdPath, fullBuf)

    manifest[`thumbs/${name}_sm`] = hashBuf(thumbBuf)
    manifest[`previews/${name}_md`] = hashBuf(fullBuf)
    console.log(`  ${name}: sm ${(thumbBuf.length / 1024).toFixed(1)}KB, md ${(fullBuf.length / 1024).toFixed(1)}KB`)
  }

  // 自动 upsert gallery 条目：
  //   - 已有同名（按 thumb/src 派生的图片名匹配）的条目：原样保留（含你手填的 title/desc 等字段），不动其位置
  //   - 新图：生成 { thumb/preview/highResSrc/... }，整批按文件名升序「头插」到数组最前（新图永远在最上）
  //   - 按图片名去重：重复运行 / 历史 bug 产生的副本在此清掉，并保留字段最完整的那一条
  let content = {}
  if (fs.existsSync(CONTENT)) {
    content = JSON.parse(fs.readFileSync(CONTENT, 'utf8'))
  } else {
    throw new Error('找不到 public/data/content.json，无法运行构建')
  }
  // 原图前缀从 content.json 读取，缺失即报错（不回退默认值）
  const HIGHRES_PREFIX = content.highResPrefix
  if (!HIGHRES_PREFIX) {
    throw new Error('content.json 缺少 highResPrefix（你的原图 R2 路径前缀），请配置后再运行')
  }
  // 按图片名去重并保留字段最完整的条目（重复运行 / 历史 bug 产生的副本在此清掉）
  const existingRaw = Array.isArray(content.gallery) ? content.gallery : []
  const byName = new Map()
  for (const it of existingRaw) {
    const t = (it && (it.thumb || it.src)) || ''
    const n = path.basename(t).replace(/_(sm|md)$/, '')
    if (!n) continue
    let score = 0
    if (it.title && it.title !== n) score++
    if (it.detail) score++
    if (it.date) score++
    if (it.desc) score++
    if (it.tags && it.tags.length) score++
    const prev = byName.get(n)
    if (!prev || score > prev.score) byName.set(n, { it, score })
  }
  const existing = [...byName.entries()].map(([n, x]) => ({ ...x.it, ar: arByName[n] ?? x.it.ar }))
  const existingNames = new Set(byName.keys())
  const newFiles = files
    .filter(({ file: f }) => !existingNames.has(path.basename(f, path.extname(f))))
    .sort((a, b) => a.file.localeCompare(b.file))
  const newEntries = newFiles.map(({ file: f, category }) => {
    const name = path.basename(f, path.extname(f))
    const highResSrc = `${HIGHRES_PREFIX.replace(/\/$/, '')}/${f}`
    return {
      thumb: `thumbs/${name}_sm`,
      preview: `previews/${name}_md`,
      highResSrc,
      ar: arByName[name] ?? null,
      category,
      tags: [],
      alt: name,
      title: name,
      date: '',
      detail: '',
    }
  })
  // 旧条目格式迁移：src 纯名（旧格式）→ thumbs/<name>_sm，并补 preview 字段；手填 title/desc/tags 保留
  const migrateItem = (it) => {
    if (it && typeof it.src === 'string' && !it.src.includes('/') && !it.preview) {
      const n = it.src
      const next = { ...it, thumb: `thumbs/${n}_sm`, preview: `previews/${n}_md` }
      delete next.src
      return next
    }
    return it
  }
  content.gallery = [...newEntries, ...existing.map(migrateItem)]
  content._gallery = manifest
  fs.writeFileSync(CONTENT, JSON.stringify(content, null, 2))

  // 从 highResPrefix（如 https://cdn.blovy.art/gallery/originals）推导原图在 R2 的目录：gallery/originals
  const ORIGINALS_R2_DIR = HIGHRES_PREFIX.replace(/^https?:\/\/[^/]+/, '').replace(/^\/+/, '').replace(/\/+$/, '')
  await tryUpload(files, ORIGINALS_R2_DIR)

  console.log(`\n完成，处理 ${files.length} 张图，新增 ${newEntries.length} 条 gallery 条目（头插到最前），旧条目已迁移到新路径格式。`)
  console.log(`已上传 R2：thumbs/ + previews/ 两档 WebP、原图(gallery/originals/)、content.json。`)
  console.log(`src=网格缩略图(thumbs/<name>_sm)，preview=详情中图(previews/<name>_md)，highResSrc=原图直链(highResPrefix+原文件名)。`)
}

async function tryUpload(galleryFiles, originalsR2Dir) {
  const { execFileSync } = await import('node:child_process')
  // Windows 下 execFileSync 无 shell 时找不到 npx（实为 npx.cmd），用 .cmd 直调可正确解析参数数组（含空格/括号路径）
  const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx'
  // wrangler 可用性检查（未装/未登录则明确报错，不静默跳过）
  try {
    execFileSync(NPX, ['wrangler', '--version'], { stdio: 'ignore' })
  } catch {
    throw new Error('未检测到可用的 wrangler，无法上传 R2。请先 `npm i -D wrangler` 并 `wrangler login`（或设 CLOUDFLARE_API_TOKEN 环境变量）。')
  }
  // manifest 的 key 形如 thumbs/xxx_sm、previews/xxx_md，本地路径与 R2 key 同构
  // 单次上传失败自动重试，避免整轮崩；失败时打印 wrangler 真实 stderr + 退出码便于定位
  const wranglerPut = async (args, label, retries = 3) => {
    const cmd = ['wrangler', 'r2', 'object', 'put', '--remote', args[0], '--file', args[1]]
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // 无 shell：参数数组直接传给 npx.cmd，空格/括号路径由 node 正确转义，无嵌套引号冲突
        // stdout 继承终端（保留 wrangler 正常进度），stderr 捕获用于错误诊断
        execFileSync(NPX, cmd, { stdio: ['inherit', 'pipe', 'pipe'] })
        return
      } catch (e) {
        const errText = (e.stderr || Buffer.from('')).toString().trim() || e.message || ''
        const code = e.status ?? '未知'
        const lastLine = errText.split('\n').filter(Boolean).pop() || e.message || '未知错误'
        if (attempt === retries) {
          console.error(`\n  ❌ 上传最终失败（已重试 ${retries} 次）：${label}`)
          console.error(`  wrangler 退出码: ${code}`)
          if (errText) console.error(`  wrangler 输出:\n${errText}`)
          throw e
        }
        console.warn(`  ⚠️ 第 ${attempt}/${retries} 次失败：${label}（退出码 ${code}）`)
        console.warn(`  └─ ${lastLine.slice(0, 300)}`)
        await new Promise((r) => setTimeout(r, 1500))
      }
    }
  }
  for (const key of Object.keys(manifest)) {
    await wranglerPut([`${BUCKET}/gallery/${key}.webp`, path.join(DIST, `${key}.webp`)], key)
  }
  // 上传原图：本地源在 gallery-originals/<category>/<file>，R2 key 为 <originalsR2Dir>/<file>
  // 与 highResSrc 指向的 URL 对齐（highResPrefix 去掉协议+域名即 R2 目录），含空格/括号由 q() 引号保护
  for (const { file, category } of galleryFiles) {
    const srcPath = path.join(ORIGINS, category, file)
    await wranglerPut([`${BUCKET}/${originalsR2Dir}/${file}`, srcPath], `originals/${file}`)
  }
  await wranglerPut([`${BUCKET}/config/content.json`, CONTENT], 'content.json')
}

main().catch((e) => {
  console.error(`\n❌ 脚本执行失败：${e.message}`)
  process.exit(1)
})
