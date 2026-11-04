// i18n 覆盖表 EN 是基准，查不到回退 EN。
// 语言选择在主页左上角下拉
import { ref } from 'vue'

export const lang = ref('EN')

// 生产对访客放开的语言，翻译到位后手动加进来
export const ENABLED_LANGS = ['EN']

export const LOCALES = {
  ZH: {
    // 'home.welcome': '欢迎语翻译',
    // 'flowerbedAngel.panic.content': '台词翻译',
    // options 项的 key 走 value（'xxFlow.choice.options.yes.label'）
  },
  JP: {},
}

// 兜底
export function t(key, fallback) {
  const v = LOCALES[lang.value]?.[key]
  return v != null && v.trim() !== '' ? v : fallback
}
