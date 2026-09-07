// 对话流台词本：所有「有序对话框串」集中在此管理（类比 RPG 台词文件）。
// 新增一串对话 = 在这里加一个 const，再在触发处调 dlg.start('你的key') 即可，无需改组件/引擎。
//
// 流定义形状：
//   start / 任意步 key: {
//     type:    'dialog' | 'option'         // 对话步 / 选项步
//     content: string                       // dialog 步的文案（支持 <br> / <a>，组件内 v-html）
//     options: [{ label, value }]          // option 步的选项列表
//     next:    字符串(线性跳下一步)
//            | { value: 步key } (选项分支映射)
//            | null (结束，流自关)
//   }
// 约定：每串流必须有 'start' 步作为入口。

// 告示牌：Morse code 彩蛋，YES/NO 分支
export const noticeSignFlow = {
  start: {
    type: 'dialog',
    content: 'Merely a notice sign.<br>There are some Morse codes written on it.<br>Read it?',
    next: 'choice',
  },
  choice: {
    type: 'option',
    options: [
      { label: 'YES', value: 'yes' },
      { label: 'NO', value: 'no' },
    ],
    next: { yes: 'yes', no: 'no' },
  },
  yes: {
    type: 'dialog',
    content: "Well, it reads:<br>.. .-. . .-. . .-.. -.-- / .- / -. --- - .. -.-. . / ... .. --. -. .<br>(I'm merely a notice sign.)",
    next: null,
  },
  no: {
    type: 'dialog',
    content: 'You decided not to read it. The sign remains a mystery.',
    next: null,
  },
}

// 掉落警告：窗口被拖出视口时弹，仅一步
export const droppedFlow = {
  start: {
    type: 'dialog',
    content: 'HEY YOU DROPPED ME OUT!??!!!!!',
    next: null,
  },
}

// 手电筒：仅当 torch 图标未被拉伸变形时点击才触发（彩蛋）。
// 选 YES 会点亮手电筒（副作用由 HomeView 监听本流的 'yes' 步执行）；选 NO 直接结束。
export const torchFoundFlow = {
  start: {
    type: 'dialog',
    content: 'You found a <span style="color:#00ffff">torch</span>.',
    next: 'choice',
  },
  choice: {
    type: 'option',
    content: 'Use it?',
    options: [
      { label: 'YES', value: 'yes' },
      { label: 'NO', value: 'no' },
    ],
    next: { yes: 'yes', no: null },
  },
  yes: {
    type: 'dialog',
    content: 'You lit the <span style="color:#00ffff">torch</span>.',
    next: null,
  },
}

export const tallchFoundFlow = {
  start: {
    type: 'dialog',
    content: 'You found a <span style="color:#00ffff">tallch</span>.',
    next: 'choice',
  },
  choice: {
    type: 'option',
    content: 'Use it?',
    options: [
      { label: 'YES', value: 'yes' },
      { label: 'NO', value: 'no' },
    ],
    next: { yes: 'yes', no: null },
  },
  yes: {
    type: 'dialog',
    content: 'You lit the <span style="color:#00ffff">tallch</span>.',
    next: null,
  },
}

export const benchFoundFlow = {
  start: {
    type: 'dialog',
    content: 'You found a <span style="color:#00ffff">bench</span>.',
    next: null,
  },
}

// 熄灭：点「I'M DONE WITH IT」后弹，播完 torch 图标开始左移离场。
// 名词按当时点亮的是 torch 还是 tallch 走不同流（与 Found 系列一一对应）。
const torchDoneFlow = {
  start: {
    type: 'dialog',
    content:
      'You shouted to the <span style="color:#00ffff">torch</span> that you are done with it.<br>' +
      'The <span style="color:#00ffff">torch</span> looks very sad.',
    next: null,
  },
}

const tallchDoneFlow = {
  start: {
    type: 'dialog',
    content:
      'You shouted to the <span style="color:#00ffff">tallch</span> that you are done with it.<br>' +
      'The <span style="color:#00ffff">tallch</span> looks very sad.',
    next: null,
  },
}

// 注册表：触发处用 key 引用（start('noticeSign') / start('dropped')）
export const dialogFlows = {
  noticeSign: noticeSignFlow,
  dropped: droppedFlow,
  torchFound: torchFoundFlow,
  tallchFound: tallchFoundFlow,
  benchFound: benchFoundFlow,
  torchDone: torchDoneFlow,
  tallchDone: tallchDoneFlow,
}

export default dialogFlows
