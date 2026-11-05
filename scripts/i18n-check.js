// 构建时校验 i18n 覆盖表，空词条和拼错的 key 都让构建失败
// 空语言表视为该语言未启用，跳过
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

export async function i18nCheck(root) {
  const [{ LOCALES, SHARED }, { dialogFlows }] = await Promise.all([
    import(pathToFileURL(`${root}/src/i18n.js`)),
    import(pathToFileURL(`${root}/src/dialogs/flows.js`)),
  ])

  // 默认值按基准文本命中，收集真实出现过的基准文本
  const baseTexts = new Set()
  const home = fs.readFileSync(path.join(root, 'src/views/HomeView.vue'), 'utf8')
  const welcome = home.match(/WELCOME_EN\s*=\s*`([^`]+)`/)?.[1]
  if (welcome) baseTexts.add(welcome)
  for (const flow of Object.values(dialogFlows)) {
    for (const step of Object.values(flow)) {
      if (!step || typeof step !== 'object') continue
      if (typeof step.content === 'string') baseTexts.add(step.content)
      for (const o of step.options ?? []) baseTexts.add(o.label)
    }
  }

  const errors = []
  for (const [langName, table] of Object.entries(LOCALES)) {
    const entries = Object.entries(table ?? {})
    if (entries.length === 0) continue
    for (const [key, value] of entries) {
      if (typeof value !== 'string' || value.trim() === '') {
        errors.push(`${langName} "${key}" - 值必须是非空字符串`)
        continue
      }
      // flow 词条形如 flow.step.content 或 flow.step.options.value.label，
      // 其余（UI 文案）只查非空
      const [flowKey, stepKey, field, optValue] = key.split('.')
      if (field !== 'content' && field !== 'options') continue
      const flow = dialogFlows[flowKey]
      if (!flow) {
        errors.push(`${langName} "${key}" - 流 ${flowKey} 不存在`)
        continue
      }
      const step = flow[stepKey]
      if (!step || typeof step !== 'object') {
        errors.push(`${langName} "${key}" - 步 ${flowKey}.${stepKey} 不存在`)
        continue
      }
      if (field === 'content') {
        if (step.content == null) errors.push(`${langName} "${key}" - 该步没有 content`)
      } else if (!step.options?.some((o) => o.value === optValue)) {
        errors.push(`${langName} "${key}" - 选项 ${optValue} 不存在`)
      }
    }
  }
  for (const [langName, table] of Object.entries(SHARED ?? {})) {
    for (const [base, value] of Object.entries(table ?? {})) {
      if (typeof value !== 'string' || value.trim() === '') {
        errors.push(`${langName} 默认值 "${base}" - 值必须是非空字符串`)
      } else if (!baseTexts.has(base)) {
        errors.push(`${langName} 默认值 "${base}" - 找不到这个基准文本`)
      }
    }
  }
  if (errors.length) throw new Error(`i18n 词条检查未通过\n${errors.join('\n')}`)
}
