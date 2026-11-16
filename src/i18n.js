// i18n 覆盖表 EN 是基准，查不到回退 EN。
// 语言选择在主页左上角下拉
import { ref } from 'vue'

export const lang = ref('EN')

// 生产对访客放开的语言，翻译到位后手动加进来
export const ENABLED_LANGS = ['EN']

// 非对话 UI 文案的基准文本，按 key 登记
export const UI_TEXT = {
  'home.welcome': `Hello there, welcome to my workspace! I'm a Chinese illustrator and back-end developer shachiku. It might look a bit new here and it's still under construction, but you can have a look around!`,
  // 手电筒元素压住的目标片段，译文里要保留为 home.welcome 的子串
  'home.welcome.torch': 'my workspace',
  'torch.mark.adwebture': 'the ADWEBTURE',
  'torch.done.label': "I'M DONE WITH IT",
  'ui.mobile.title': 'Mobile Device Detected',
  'ui.mobile.message': "I noticed you're on a phone. I might add support someday, but it's recommended you check it out on a computer for now.",
  'ui.mobile.confirm': 'Got it',
  'lang.wip': '制作中',
}

// 高亮文本请在 highlights.js 注册
export const LOCALES = {
  ZH: {
    'home.welcome': '你好，这里是我的线上工作室，欢迎你来看看！我画插画，同时也是个后端开发社畜。这里可能很多地方还在完善，但总之可以先随便瞄两眼？',
    'home.welcome.torch': '线上工作室',
    'torch.mark.adwebture': '神秘交互空间',
    'ui.mobile.title': 'Mobile Device Detected',
    'ui.mobile.message': "I noticed you're on a phone. I might add support someday, but it's recommended you check it out on a computer for now.",
    'ui.mobile.confirm': '知了',
    'lang.wip': '制作中',

    'noticeSign.start.content': '只是个告示牌。<br>上面写着一堆摩斯代码。<br>要瞅一眼吗？',
    'noticeSign.choice.options.yes.label': '看',
    'noticeSign.choice.options.no.label': '不看',
    'noticeSign.yes.content': '上面写的是：<br>.-- --- / --.. .... .. / ... .... .. / --. . / --. .- --- / ... .... .. / .--. .- ..<br>(wo zhi shi ge gao shi pai)',
    'noticeSign.no.content': '你寻思还是不看了。上面到底写的啥将成为你心中永远的疑问。',

    'torch.done.label': '受够了',
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

    'flowerbedEmpty.start.content': '花儿们在花圃内安详地睡着。',
    'flowerbedMore.start.content': '还有花朵吗？',

    'kajiu.start.options.ask.label': '你这个铺位，选址的时候正*鸡排和蜜*冰城没有和你竞争吗？',
    'kajiuNoEgg.start.content': '别点了这个没有彩蛋',
  },
  JP: {
    'home.welcome': 'あぁ、ようこそ！ここが自分のオンライン作業台です。中国人で、イラストを描きつつ、バックエンド開発もしてるしゃちくです。まだまだ更新中ですが、まあ、気軽に見ていってください。',
    'home.welcome.torch': '自分のオンライン作業台',
    'torch.mark.adwebture': 'ザ・アドウェブチャー',
    'ui.mobile.title': 'Mobile Device Detected',
    'ui.mobile.message': "I noticed you're on a phone. I might add support someday, but it's recommended you check it out on a computer for now.",
    'ui.mobile.confirm': 'わかった',
    'lang.wip': '制作中',

    'noticeSign.start.content': 'ただのかんばんだ。<br>モールス信号が書かれている。<br>読んでみる？',
    'noticeSign.yes.content': '書かれているのは：<br>- .- -.. .- / -. --- / -.- .- -. -... .- -. / -.-- .-<br>(Tada no kanban ya)',
    'noticeSign.no.content': '読まないことにした。かんばんの内容は謎のままだ。',

    'torch.done.label': 'もういい加減にしろ',
    'torchFound.start.content': 'トーチ が見つかった。',
    'torchFound.choice.content': 'つける？',
    'torchFound.yes.content': 'トーチ をつけた。',
    'torchDone.start.content': 'トーチ に「もういい加減にしろ」としゃべった。とても悲しそうに見える…',
    'tallchFound.start.content': 'トおおおおおチ が見つかった。',
    'tallchFound.choice.content': '要开吗？',
    'tallchFound.yes.content': 'トおおおおおチ をつけた。',
    'tallchDone.start.content': 'トおおおおおチ に「もういい加減にしろ」としゃべった。とても悲しそうに見える…',
    'benchFound.start.content': 'ベンチ が見つかった。',

    'flowerbedEmpty.start.content': '花たちは花壇のナカに静かに眠っている。',
    'flowerbedMore.start.content': 'ハナ、まだある？',

    'kajiu.start.options.ask.label': 'この区画さ、決めるときす*家とドン*とぶつからなかったんだ？',
    'kajiuNoEgg.start.content': 'ここには何も隠してないよ',
  },
}

// 按基准文本共用的默认译法，具体词条优先
// 例 - YES 写一次，所有没单独配的 YES 选项都用它
export const SHARED = {
  ZH: {
    YES: '是',
    NO: '否',
  },
  JP: {
    YES: 'はい',
    NO: 'いいえ',
  },
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
