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

// 注册表：触发处用 key 引用（start('noticeSign') / start('dropped')）
export const dialogFlows = {
  noticeSign: noticeSignFlow,
  dropped: droppedFlow,
}

export default dialogFlows
