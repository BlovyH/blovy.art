import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import subsetFont from 'subset-font'
import { loadEnv } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

const fontConfigs = [
  {
    name: 'Fusion Pixel 12px',
    input: path.join(rootDir, 'src/assets/fonts/fusion-pixel-12px-monospaced-zh_hans.ttf'),
    output: path.join(rootDir, 'src/assets/fonts/generated/fusion-pixel-subset.woff2'),
  },
  {
    name: 'Zhuque Fangsong',
    input: path.join(rootDir, 'src/assets/fonts/ZhuqueFangsong-Regular.ttf'),
    output: path.join(rootDir, 'src/assets/fonts/generated/zhuque-fangsong-subset.woff2'),
  },
]

const scanDirs = [
  path.join(rootDir, 'src'),
  path.join(rootDir, 'public'),
]

const includeExtensions = new Set([
  '.vue',
  '.js',
  '.ts',
  '.json',
  '.css',
  '.html',
])

const baseChars = new Set(
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 '
)

function collectText(filePath, content) {
  const text = content.toString('utf-8')
  for (const char of text) {
    // Keep printable characters, CJK, symbols, etc.
    // Skip control characters and some whitespace we don't need in the font.
    if (char === '\0') continue
    baseChars.add(char)
  }
}

async function scanDirectory(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      // Skip dependency / generated directories
      if (entry.name === 'node_modules' || entry.name === 'dist') continue
      await scanDirectory(fullPath)
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase()
      if (!includeExtensions.has(ext)) continue
      try {
        const content = await fs.readFile(fullPath)
        collectText(fullPath, content)
      } catch (err) {
        console.warn(`Failed to read ${fullPath}:`, err.message)
      }
    }
  }
}

async function ensureDir(filePath) {
  const dir = path.dirname(filePath)
  await fs.mkdir(dir, { recursive: true })
}

async function collectFromContentSource() {
  // 运行时的内容源（生产 = R2 远端 content.json）。构建时子集必须覆盖这些字符，
  const local = path.join(rootDir, 'public/data/content.json')
  const readLocal = async () => {
    try {
      const buf = await fs.readFile(local)
      for (const char of buf.toString('utf-8')) {
        if (char === '\0') continue
        baseChars.add(char)
      }
      console.log('[subset] 已用本地 public/data/content.json 纳入子集。')
    } catch {
      console.warn('[subset] 本地 content.json 不可用，子集可能缺动态文案字符。')
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    // dev / 本地直跑：本地有 content.json，直接扫，不联网
    await readLocal()
    return
  }

  // 生产构建：运行时内容在 R2 远端，CI 干净 checkout 无本地文件，必须拉远端
  let url
  try {
    const env = loadEnv('production', rootDir, ['VITE_'])
    url = env.VITE_CONTENT_DATA_URL
  } catch {
    url = undefined
  }
  url = url || 'https://cdn.blovy.art/config/content.json'

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    for (const char of text) {
      if (char === '\0') continue
      baseChars.add(char)
    }
    console.log(`[subset] 已扫描远端 content.json（${text.length} 字符）纳入子集。`)
  } catch (err) {
    console.warn(`[subset] 拉取远端 content.json 失败 (${url}): ${err.message}，改用本地兜底。`)
    await readLocal()
  } finally {
    clearTimeout(timer)
  }
}

export async function subsetFonts() {
  console.log('Scanning project text for font subsetting...')
  for (const scanDir of scanDirs) {
    await scanDirectory(scanDir)
  }

  // 补充运行时内容源（R2 content.json）的字符，CI 干净 checkout 下本地没有该文件
  await collectFromContentSource()

  const text = Array.from(baseChars).sort().join('')
  console.log(`Collected ${text.length} unique characters for subsetting.`)

  for (const config of fontConfigs) {
    const inputBuffer = await fs.readFile(config.input)
    console.log(`Subsetting ${config.name}...`)
    const subsetBuffer = await subsetFont(inputBuffer, text, {
      targetFormat: 'woff2',
    })
    await ensureDir(config.output)
    await fs.writeFile(config.output, Buffer.from(subsetBuffer))
    const outputSize = (subsetBuffer.byteLength / 1024).toFixed(1)
    const inputSize = (inputBuffer.length / 1024).toFixed(1)
    console.log(
      `  ${config.name}: ${inputSize} KB → ${outputSize} KB written to ${path.relative(rootDir, config.output)}`
    )
  }

  console.log('Font subsetting complete.')
}

// Run directly when executed as a script
if (import.meta.url === `file://${process.argv[1]}`) {
  subsetFonts().catch((err) => {
    console.error('Font subsetting failed:', err)
    process.exit(1)
  })
}
