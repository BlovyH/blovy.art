// i18n 覆盖表 EN 是基准，查不到回退 EN。
// 语言选择在主页左上角下拉
import { ref } from 'vue'

export const lang = ref('EN')

// 生产对访客放开的语言，翻译到位后手动加进来
export const ENABLED_LANGS = ['EN']

// 非对话 UI 文案的基准文本，按 key 登记
export const UI_TEXT = {
  'home.welcome': `Hello there, welcome to my workspace! I'm a Chinese illustrator and back-end developer shachiku. It might look a bit new here and it's still under construction, but you can have a look around!`,
  'ui.mobile.title': 'Mobile Device Detected',
  'ui.mobile.message': "I noticed you're on a phone. I might add support someday, but it's recommended you check it out on a computer for now.",
  'ui.mobile.confirm': 'Got it',
}

export const LOCALES = {
  ZH: {
    // 'home.welcome': '欢迎语翻译',
    // 'flowerbedAngel.panic.content': '台词翻译',
    // options 项的 key 走 value（'xxFlow.choice.options.yes.label'）
    'torchFound.start.content': '你找到了手电。',
    'torchFound.choice.content': '要开吗？',
    'torchFound.choice.options.yes.label': '开',
    'torchFound.choice.options.no.label': '不开',
    'torchFound.yes.content': '你打开了手电。',
    'torchDone.start.content': '你冲着手电嚷嚷“我真是受够你了”。它看起来很伤心。',
    'tallchFound.start.content': '你找到了手㫣。',
    'tallchFound.choice.content': '要开吗？',
    'tallchFound.choice.options.yes.label': '开',
    'tallchFound.choice.options.no.label': '不开',
    'tallchFound.yes.content': '你打开了手㫣。',
    'tallchDone.start.content': '你冲着手㫣嚷嚷“我真是受够你了”。它看起来很伤心。',
    'benchFound.start.content': '你找到了手凳。',

    'flowerbedEmpty.start.content': '还有花朵吗？',
  },
  JP: {
    'flowerbedEmpty.start.content': 'ハナ、まだある？'
  },
}

// 按基准文本共用的默认译法，具体词条优先
// 例 - YES 写一次，所有没单独配的 YES 选项都用它
export const SHARED = {
  ZH: {
    // YES: '是',
  },
  JP: {},
}

// 具体词条优先，其次按基准文本查默认值，都没有就用基准文本
export function t(key, fallback) {
  const exact = LOCALES[lang.value]?.[key]
  if (typeof exact === 'string' && exact.trim() !== '') return exact
  const shared = SHARED[lang.value]?.[fallback]
  if (typeof shared === 'string' && shared.trim() !== '') return shared
  return fallback
}

// 按 key 查 UI 文案，查不到时退回 key 本身
export function tUi(key) {
  return t(key, UI_TEXT[key] ?? key)
}
