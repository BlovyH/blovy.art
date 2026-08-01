import { createI18n } from 'vue-i18n'
import { messages } from './messages'

const saved = localStorage.getItem('locale')
const browserLang = navigator.language.slice(0, 2)
const locale = saved || (['zh', 'en', 'ja'].includes(browserLang) ? browserLang : 'zh')

export const i18n = createI18n({
  legacy: false,
  locale,
  fallbackLocale: 'zh',
  messages,
  globalInjection: true,
})

export function setLocale(lang) {
  i18n.global.locale.value = lang
  localStorage.setItem('locale', lang)
}
