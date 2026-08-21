import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import subsetFont from 'subset-font'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

const fontConfigs = [
  {
    name: 'Fusion Pixel 12px',
    input: path.join(rootDir, 'src/assets/fonts/fusion-pixel-12px-monospaced-zh_hans.ttf'),
    output: path.join(rootDir, 'public/assets/fonts/fusion-pixel-subset.woff2'),
  },
  {
    name: 'Zhuque Fangsong',
    input: path.join(rootDir, 'src/assets/fonts/ZhuqueFangsong-Regular.ttf'),
    output: path.join(rootDir, 'public/assets/fonts/zhuque-fangsong-subset.woff2'),
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

export async function subsetFonts() {
  console.log('Scanning project text for font subsetting...')
  for (const scanDir of scanDirs) {
    await scanDirectory(scanDir)
  }

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
