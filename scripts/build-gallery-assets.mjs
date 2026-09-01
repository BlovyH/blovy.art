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

  // 生成阶段前先读 content.json：拿 highResPrefix、旧哈希快照（判跳过用），并推导原图 R2 目录
  const content = fs.existsSync(CONTENT)
    ? JSON.parse(fs.readFileSync(CONTENT, 'utf8'))
    : (() => { throw new Error('找不到 public/data/content.json，无法运行构建') })()
  const HIGHRES_PREFIX = content.highResPrefix
  if (!HIGHRES_PREFIX) {
    throw new Error('content.json 缺少 highResPrefix（你的原图 R2 路径前缀），请配置后再运行')
  }
  const prevGalleryHashes = content._gallery || {}
  const prevOriginalsHashes = content._originals || {}
  const ORIGINALS_R2_DIR = HIGHRES_PREFIX.replace(/^https?:\/\/[^/]+/, '').replace(/^\/+/, '').replace(/\/+$/, '')
  const sharp = (await import('sharp')).default

  // 生成两档 WebP：原图未变且 webp 已在盘 → 跳过 sharp（继承上次 manifest 哈希，保留 webp 增量基线）；
  // 否则重新生成，并记录 ar（宽高比）用于前端 aspect-ratio 预留宽度、消除首屏 CLS
  const arMap = {}
  for (const { file: f, category } of files) {
    const name = path.basename(f, path.extname(f))
    const srcPath = path.join(ORIGINS, category, f)
    const smPath = path.join(DIST, 'thumbs', `${name}_sm.webp`)
    const mdPath = path.join(DIST, 'previews', `${name}_md.webp`)

    const originalsHash = hashBuf(fs.readFileSync(srcPath))
    const r2Key = `${BUCKET}/${ORIGINALS_R2_DIR}/${f}`
    const unchanged = originalsHash === prevOriginalsHashes[r2Key]
    const webpOnDisk = fs.existsSync(smPath) && fs.existsSync(mdPath)
    if (unchanged && webpOnDisk) {
      // 跳过生成：继承上次 manifest 哈希，避免下轮误判 webp 为「新增」重传
      const smPrev = prevGalleryHashes[`thumbs/${name}_sm`]
      const mdPrev = prevGalleryHashes[`previews/${name}_md`]
      if (smPrev) manifest[`thumbs/${name}_sm`] = smPrev
      if (mdPrev) manifest[`previews/${name}_md`] = mdPrev
      console.log(`  ↷ 跳过生成(原图未变且 webp 在盘): ${name}`)
      continue
    }

    const meta = await sharp(srcPath).metadata()
    const thumbW = Math.min(THUMB_W, meta.width || THUMB_W)
    const fullW = Math.min(FULL_W, meta.width || FULL_W)

    const thumbBuf = await sharp(srcPath).resize({ width: thumbW }).webp({ quality: 80 }).toBuffer()
    const fullBuf = await sharp(srcPath).resize({ width: fullW }).webp({ quality: 85 }).toBuffer()

    fs.mkdirSync(path.dirname(smPath), { recursive: true })
    fs.mkdirSync(path.dirname(mdPath), { recursive: true })
    fs.writeFileSync(smPath, thumbBuf)
    fs.writeFileSync(mdPath, fullBuf)

    manifest[`thumbs/${name}_sm`] = hashBuf(thumbBuf)
    manifest[`previews/${name}_md`] = hashBuf(fullBuf)
    arMap[name] = +(meta.width / meta.height).toFixed(4)
    console.log(`  ${name}: sm ${(thumbBuf.length / 1024).toFixed(1)}KB, md ${(fullBuf.length / 1024).toFixed(1)}KB`)
  }

  // 自动 upsert gallery 条目：
  //   - 已有同名（按 thumb/src 派生的图片名匹配）的条目：原样保留（含你手填的 title/desc 等字段），不动其位置
  //   - 新图：生成 { thumb/preview/highResSrc/... }，整批按文件名升序「头插」到数组最前（新图永远在最上）
  //   - 按图片名去重：重复运行 / 历史 bug 产生的副本在此清掉，并保留字段最完整的那一条
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
  const existing = [...byName.values()].map((x) => x.it)
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
      category,
      ar: arMap[name], // 新图生成时算的宽高比；前端用 aspect-ratio 预留宽度，消除首屏 CLS
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
  // 注：content.json 的写盘 + 上传移到 tryUpload 末尾（全部上传成功后才落盘，避免上传失败却留下「已上传」的错误哈希记录）

  await tryUpload(files, ORIGINALS_R2_DIR, prevGalleryHashes, prevOriginalsHashes, content)

  console.log(`\n完成，处理 ${files.length} 张图，新增 ${newEntries.length} 条 gallery 条目（头插到最前），旧条目已迁移到新路径格式。`)
  console.log(`已上传 R2：thumbs/ + previews/ 两档 WebP、原图(gallery/originals/)、content.json。`)
  console.log(`src=网格缩略图(thumbs/<name>_sm)，preview=详情中图(previews/<name>_md)，highResSrc=原图直链(highResPrefix+原文件名)。`)
}

async function tryUpload(galleryFiles, originalsR2Dir, prevGalleryHashes, prevOriginalsHashes, content) {
  const { execFileSync } = await import('node:child_process')
  // 调用 wrangler 的方式（Windows 兼容性）：
  //   - 直接用 execFileSync('npx.cmd'/'wrangler.cmd', {shell:false}) 会 spawnSync EINVAL（.cmd 非 PE 文件，须 cmd.exe 解释）；
  //   - 加 shell:true 走 cmd.exe /c 能避开 EINVAL，但 node 不会对参数数组里的 ( ) 等字符加引号，
  //     含括号/空格的文件名会被 cmd 当成语法而截断（如 photosynthesis(quick illust).png）。
  //   - 因此优先用 node 直接执行本地 wrangler 的 JS 入口（参数数组模式、不经过 shell，括号/空格安全，也无 EINVAL）；
  //     仅在本地没装 wrangler 时回退 npx（shell:true），回退路径用 q() 对特殊字符参数加双引号兜底。
  const resolveWrangler = () => {
    const pkg = path.join(root, 'node_modules', 'wrangler', 'package.json')
    if (fs.existsSync(pkg)) {
      try {
        const bin = JSON.parse(fs.readFileSync(pkg, 'utf8')).bin
        const rel = typeof bin === 'string' ? bin : bin.wrangler
        if (rel) {
          const jsEntry = path.join(root, 'node_modules', 'wrangler', rel)
          if (fs.existsSync(jsEntry)) return { exec: process.execPath, argsPrefix: [jsEntry], shell: false }
        }
      } catch {}
    }
    const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
    return { exec: npx, argsPrefix: ['wrangler'], shell: true }
  }
  const WR = resolveWrangler()
  const SHELL = WR.shell || false
  // 仅 npx(shell) 回退路径需要对含空格/括号/& 等字符的参数加双引号；数组模式(shell:false)下不加（加了反而错）
  const q = (s) => (SHELL && /[ ()&|<>^"%]/.test(s)) ? '"' + s + '"' : s
  // wrangler 可用性检查（未装/未登录则明确报错，不静默跳过）
  try {
    execFileSync(WR.exec, [...WR.argsPrefix, '--version'], { stdio: 'ignore', shell: SHELL })
  } catch {
    throw new Error('未检测到可用的 wrangler，无法上传 R2。请先 `npm i -D wrangler` 并 `wrangler login`（或设 CLOUDFLARE_API_TOKEN 环境变量）。')
  }
  // manifest 的 key 形如 thumbs/xxx_sm、previews/xxx_md，本地路径与 R2 key 同构
  // 单次上传失败自动重试，避免整轮崩；失败时打印 wrangler 真实 stderr + 退出码便于定位
  const wranglerPut = async (args, label, retries = 3) => {
    // 数组模式(shell:false)下 node 直接传参，括号/空格安全；npx(shell) 回退路径对含特殊字符的参数加引号
    const cmd = [...WR.argsPrefix, 'r2', 'object', 'put', '--remote', q(args[0]), '--file', q(args[1])]
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        execFileSync(WR.exec, cmd, { stdio: ['inherit', 'pipe', 'pipe'], shell: SHELL })
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

  // 增量上传：本地重算每个文件的哈希，和上次已上传的哈希比对。
  //   - 哈希一致 → 跳过（INSERT IGNORE：已存在就不传）
  //   - 哈希变了 → 重传（解决纯「存在性跳过」的坑：你改了图、key 却相同，纯存在性会留下旧图）
  // webp 的上次哈希在 content._gallery；原图的上次哈希在新增的 content._originals。
  const FORCE = process.env.FORCE_UPLOAD === '1'
  const plan = []
  for (const key of Object.keys(manifest)) {
    plan.push({
      r2Key: `${BUCKET}/gallery/${key}.webp`,
      localPath: path.join(DIST, `${key}.webp`),
      newHash: manifest[key],
      oldHash: prevGalleryHashes[key],
      label: key,
      kind: 'webp',
    })
  }
  for (const { file, category } of galleryFiles) {
    const srcPath = path.join(ORIGINS, category, file)
    const r2Key = `${BUCKET}/${originalsR2Dir}/${file}`
    plan.push({
      r2Key,
      localPath: srcPath,
      newHash: hashBuf(fs.readFileSync(srcPath)),
      oldHash: prevOriginalsHashes[r2Key],
      label: `originals/${file}`,
      kind: 'original',
    })
  }

  let uploaded = 0
  let skipped = 0
  for (const item of plan) {
    if (!FORCE && item.oldHash && item.oldHash === item.newHash) {
      console.log(`  ↷ 跳过(已存在且一致): ${item.label}`)
      skipped++
      continue
    }
    const tag = FORCE ? ' [强制]' : item.oldHash ? ' [变更]' : ' [新增]'
    console.log(`  ↑ 上传${tag}: ${item.label}`)
    await wranglerPut([item.r2Key, item.localPath], item.label)
    // 记录本次实际已上传的哈希并立即落盘（崩溃安全）：
    // 即便后续某个文件上传失败，已传成功的也不会在下轮被重复上传，
    // 增量基线可逐步建立，避免「整轮失败 → _originals 永为空 → 原图永远全量重传」。
    // webp 的 _gallery 由 main 在调用前已赋值（=本次重算的 manifest），这里只需累积原图哈希。
    if (item.kind === 'original') {
      ;(content._originals ||= {})[item.r2Key] = item.newHash
    }
    fs.writeFileSync(CONTENT, JSON.stringify(content, null, 2))
    uploaded++
  }

  // 全部 item 处理完（已逐个落盘本地），把最新 content.json 同步到 R2（幂等，失败不影响本地增量基线）
  await wranglerPut([`${BUCKET}/config/content.json`, CONTENT], 'content.json')

  console.log(`\n  增量上传完成：新传 ${uploaded} 个，跳过 ${skipped} 个(已存在且一致)${FORCE ? ' [FORCE_UPLOAD=1]' : ''}`)
}

main().catch((e) => {
  console.error(`\n❌ 脚本执行失败：${e.message}`)
  process.exit(1)
})
