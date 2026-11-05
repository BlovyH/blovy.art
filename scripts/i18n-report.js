// 列出各语言相对对话流的翻译覆盖情况，node scripts/i18n-report.js 直接跑
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const [{ LOCALES, SHARED }, { dialogFlows }, { default: fs }] = await Promise.all([
  import(pathToFileURL(`${root}/src/i18n.js`)),
  import(pathToFileURL(`${root}/src/dialogs/flows.js`)),
  import('node:fs'),
])
// EN 基准文本，供搜索时对照台词
const EN_TEXT = {
  'home.welcome': fs.readFileSync(`${root}src/views/HomeView.vue`, 'utf8').match(/WELCOME_EN\s*=\s*`([^`]+)`/)?.[1] ?? '',
}

// 不在 flows 里的 UI 词条在这里登记
const UI_KEYS = ['home.welcome']

const allKeys = [...UI_KEYS]
for (const [flowKey, flow] of Object.entries(dialogFlows)) {
  for (const [stepKey, step] of Object.entries(flow)) {
    if (!step || typeof step !== 'object') continue
    if (step.content != null) {
      allKeys.push(`${flowKey}.${stepKey}.content`)
      EN_TEXT[`${flowKey}.${stepKey}.content`] = step.content
    }
    for (const o of step.options ?? []) {
      allKeys.push(`${flowKey}.${stepKey}.options.${o.value}.label`)
      EN_TEXT[`${flowKey}.${stepKey}.options.${o.value}.label`] = o.label
    }
  }
}

// node scripts/i18n-report.js [关键词]
// 不带关键词 - 覆盖报告；带关键词 - 按基准文本或 key 片段反查 key
const query = process.argv[2]
if (query) {
  const q = query.toLowerCase()
  const hits = allKeys.filter((k) => k.toLowerCase().includes(q) || EN_TEXT[k]?.toLowerCase().includes(q))
  if (!hits.length) {
    console.log(`no match: ${query}`)
  } else {
    for (const k of hits) console.log(`${k}  -  ${EN_TEXT[k].replace(/\s+/g, ' ')}`)
  }
  process.exit(0)
}

console.log('用法 - node scripts/i18n-report.js [关键词]   反查示例 - node scripts/i18n-report.js wish')
for (const [name, table] of Object.entries(LOCALES)) {
  const shared = SHARED[name] ?? {}
  const has = (v) => typeof v === 'string' && v.trim() !== ''
  const isExact = (k) => has(table?.[k])
  const sharedOf = (k) => (has(shared[EN_TEXT[k]]) ? shared[EN_TEXT[k]] : null)
  const exact = allKeys.filter(isExact)
  const viaShared = allKeys.filter((k) => !isExact(k) && sharedOf(k))
  const dead = Object.keys(table ?? {}).filter((k) => !allKeys.includes(k))
  const deadShared = Object.keys(shared).filter((b) => !Object.values(EN_TEXT).includes(b))
  const missing = allKeys.filter((k) => !isExact(k) && !sharedOf(k))
  console.log(`${name}  ${exact.length + viaShared.length}/${allKeys.length}  -  单独 ${exact.length}，默认 ${viaShared.length}，缺 ${missing.length}`)
  if (viaShared.length) {
    console.log('  走默认值 - 检查是否该特化')
    for (const k of viaShared) console.log(`    ${k}  -  ${EN_TEXT[k].replace(/\s+/g, ' ')} -> ${sharedOf(k)}`)
  }
  for (const k of missing) console.log(`  缺 ${k}`)
  for (const k of dead) console.log(`  死词条 ${k}`)
  for (const b of deadShared) console.log(`  死默认值 ${b}`)
}
