// 列出各语言相对对话流的翻译覆盖情况，node scripts/i18n-report.js 直接跑
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const [{ LOCALES }, { dialogFlows }, { default: fs }] = await Promise.all([
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

// node scripts/i18n-report.js 关键词 - 按台词原文或 key 片段反查 key
const query = process.argv[2]
if (query) {
  const q = query.toLowerCase()
  const hits = allKeys.filter((k) => k.toLowerCase().includes(q) || EN_TEXT[k]?.toLowerCase().includes(q))
  if (!hits.length) {
    console.log(`no match: ${query}`)
  } else {
    for (const k of hits) console.log(`${k}  -  ${EN_TEXT[k].replace(/\s+/g, ' ').slice(0, 60)}`)
  }
  process.exit(0)
}

for (const [name, table] of Object.entries(LOCALES)) {
  const done = allKeys.filter((k) => typeof table?.[k] === 'string' && table[k].trim() !== '')
  const dead = Object.keys(table ?? {}).filter((k) => !allKeys.includes(k))
  const missing = allKeys.filter((k) => !done.includes(k))
  console.log(`${name}  ${done.length}/${allKeys.length}`)
  for (const k of missing) console.log(`  缺 ${k}`)
  for (const k of dead) console.log(`  死词条 ${k}`)
}
