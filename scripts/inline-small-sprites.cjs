// 构建期把白名单里的 sprite 换成 base64 data URI。源码继续写 /assets/xxx.png，只有产物受影响。
const fs = require('node:fs')
const path = require('node:path')
const MagicString = require('magic-string')

const SOURCE_RE = /\.(vue|js|ts|jsx|tsx|css|scss)$/

module.exports = function inlineSmallSprites(opts = {}) {
  const root = opts.root || process.cwd()
  const prefix = opts.prefix || '/assets/'
  const assetsDir = path.resolve(root, opts.assetsDir || 'public/assets')

  const white = new Set(opts.sprites || [])
  const cache = new Map()
  function encode(name) {
    if (cache.has(name)) return cache.get(name)
    const buf = fs.readFileSync(path.join(assetsDir, name))
    const uri = `data:image/png;base64,${buf.toString('base64')}`
    cache.set(name, uri)
    return uri
  }

  return {
    name: 'inline-small-sprites',
    // 必须在 plugin-vue 编译之前做纯文本替换，否则模板 src 已经变成 import，换成 data URI 会被当模块解析
    enforce: 'pre',
    apply: 'build',
    buildStart() {
      // 白名单里写错的文件名要出声，不能直接跳过让人以为已经内联
      for (const name of [...white]) {
        if (!fs.existsSync(path.join(assetsDir, name))) {
          this.warn(`[inline-small-sprites] whitelisted sprite not found, keep path: ${name}`)
          white.delete(name)
        }
      }
    },
    transform(code, id) {
      if (!SOURCE_RE.test(id)) return null

      const s = new MagicString(code)
      let hit = false
      for (const name of white) {
        const needle = prefix + name
        let from = 0
        let idx
        let dataUri
        while ((idx = code.indexOf(needle, from)) !== -1) {
          if (dataUri === undefined) {
            try {
              dataUri = encode(name)
            } catch (e) {
              // 单个 sprite 编码失败就保留原路径，其余照常内联，构建不中断
              this.warn(`[inline-small-sprites] encode failed, keep path: ${name} (${e.message})`)
              dataUri = null
              break
            }
          }
          s.overwrite(idx, idx + needle.length, dataUri)
          hit = true
          from = idx + needle.length
        }
      }
      if (!hit) return null
      return { code: s.toString(), map: s.generateMap({ hires: true }) }
    },
  }
}
