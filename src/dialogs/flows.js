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

const sunglassesNightChoice = {
  type: 'option',
  options: [
    { label: 'OK fine', value: 'ok' },
    {
      label: "Shouldn't it be something like an eye protection mode that only turns up at night",
      value: 'moonglasses',
    },
  ],
  aside: { image: '/assets/eye-protection.png' },
  next: { ok: null, moonglasses: 'moonglasses_1' },
}

// 选了「护眼模式」之后那段，两串共用（步按流查，所以 spread 进各自的流）
const sunglassesNightTail = {
  moonglasses_1: {
    type: 'dialog',
    content: "Eye protection mode?<br>Hmm... I have a little sister Moonglasses.",
    next: 'moonglasses_2',
  },
  moonglasses_2: {
    type: 'dialog',
    content:
      "She ran away from home, and only turns up when she's out of money.<br>" +
      'If you ever meet her, you can ask her \'bout the eye protection mode.',
    next: null,
  },
}

// 晚上禁止戴太阳镜
const sunglassesNightFlow = {
  start: {
    type: 'dialog',
    content: "It's night now hon.<br>There's no sun to block, hahaha...",
    next: 'choice',
  },
  choice: sunglassesNightChoice,
  ...sunglassesNightTail,
}

// 如果戴着跨越了节点，自动摘下
const sunglassesNightOffFlow = {
  start: {
    type: 'dialog',
    content: "It's night now hon, so I took the sunglasses off for you.<br>Pretty thoughtful of me, huh?",
    next: 'choice',
  },
  choice: sunglassesNightChoice,
  ...sunglassesNightTail,
}

// 事不过三
const tilted3TimesFlow = {
  start: {
    type: 'dialog',
    content: 'Three times is enough.<br>The frame keeps sliding back. You leave it that way.',
    next: null,
  },
}

// 把新版本提示喂给 mesbin
const updateDismissedFlow = {
  start: {
    type: 'dialog',
    content: 'You refuse to choose.<br>Ms. Mesbin thanks you for the feeding.',
    next: null,
  },
}

// 把 callback 按钮喂给 mesbin
const callbackDismissedFlow = {
  start: {
    type: 'dialog',
    content: 'You set the receiver free.<br>Ms. Mesbin thanks you for the feeding.',
    next: null,
  },
}

// 把 emotion 的水滴喂给 mesbin，被拒收
const emotionDropRefusedFlow = {
  start: {
    type: 'dialog',
    content: 'Don\'t serve me filthy bodily fluids like that...',
    next: null,
  },
}

// 冒牌 SKI MODE
export const skiImpostorFlow = {
  start: {
    type: 'dialog',
    content: "GOT FOOLED AH?？<br>THE REAL ONE'S BEEN KIDNAPPED!！!!!！!AHAHAHAHAHAHA！!!！！！",
    next: 'taunt',
  },
  taunt: {
    type: 'dialog',
    content: 'UNLESS YOU FIND <span style="color:#00ffff">WIKI</span> AND GO JUDGE ME！!！<br>GO KILL ME！!!！!<br>AHAHAHAHAHAHAHAAHAHA！!!!!!！!!!!!！',
    next: null,
  },
}

export const backyardDoorFlow = {
  start: {
    type: 'dialog',
    content: "It's a door in a CAD floor plan style.<br>It leads to the Backyard. Enter it?",
    next: 'choice',
  },
  choice: {
    type: 'option',
    options: [
      { label: 'YES', value: 'yes' },
      { label: 'NO', value: 'no' },
    ],
    next: { yes: 'yes', no: null },
  },
  yes: {
    type: 'dialog',
    content: 'You open the door.',
    next: null,
  },
}

// 后院 棋盘花圃
export const backyardBoardFlow = {
  start: {
    type: 'dialog',
    content: 'What is it?',
    next: 'choice',
  },
  choice: {
    type: 'option',
    options: [
      { label: 'Flowerbed', value: 'flowerbed' },
      { label: 'Plants vs. ■■', value: 'pvx' },
      { label: "International \"Flower\" Chess", value: 'chess' },
    ],
    next: { flowerbed: 'flowerbed', pvx: 'pvx', chess: 'chess' },
  },
  flowerbed: {
    type: 'dialog',
    content: 'Yeah I know it.',
    next: null,
  },
  pvx: {
    type: 'dialog',
    content: 'I want to play too!',
    next: null,
  },
  chess: {
    type: 'dialog',
    content: "Sorry! I'm black-and-white colorblind,<br>so I can't tell the squares apart.",
    next: null,
  },
}

// 刷新后提示一下以免被误以为这就是桌面页...
export const backyardReturnFlow = {
  start: {
    type: 'dialog',
    content:
      "Welcome back! We've teleported you here because it's where you stayed last time.<br>" +
      'You can go back by the CAD floor plan style door at the top.',
    // 外飘箭头的目标填的是 DOM 上的 data-pointer 值，跟 aside 一样是纯数据
    point: 'backyard-exit-door',
    next: null,
  },
}

// 花圃的花全放完了
export const flowerbedDoneFlow = {
  start: {
    type: 'dialog',
    content: 'OMEDETOU!! Now every last flower has been wasted.',
    next: null,
  },
}

// 通关 摆到最大放置
export const flowerbedMaxFlow = {
  start: {
    type: 'dialog',
    content:
      'Congrats! You\'ve found a maximum placement!<br> The flowerbed seems very happy and makes a flower cake.',
    next: null,
  },
}

// 获得蛋糕
export const flowerbedCakeFlow = {
  start: {
    type: 'dialog',
    content: 'You got <span style="color: #00ffff">FLOWER CAKE</span>.',
    next: null,
  },
}

// 收下蛋糕后再点棋盘
export const flowerbedEmptyFlow = {
  start: {
    type: 'dialog',
    content: 'Any more flowers?',
    next: null,
  },
}

// 点地下室入口
export const basementLockedFlow = {
  start: {
    type: 'dialog',
    content: 'The basement is locked.',
    next: null,
  },
}

// 19
export const flowerbedPuddingFlow = {
  start: {
    type: 'dialog',
    content: 'Brilliant! Confirmed with this answer?',
    next: 'choice',
  },
  choice: {
    type: 'option',
    options: [
      { label: 'YES', value: 'yes' },
      { label: 'NO', value: 'no' },
    ],
    next: { yes: 'pudding', no: null },
  },
  pudding: {
    type: 'dialog',
    content: 'You got <span style="color: #00ffff">FLOWER PUDDING</span>.',
    next: null,
  },
}

// 剩下的花被花圃吞掉
export const flowerbedSwallowedFlow = {
  start: {
    type: 'dialog',
    content: 'The rest were swallowed.',
    next: null,
  },
}

// 花全浪费完之后再次点击
export const flowerbedAngelFlow = {
  start: {
    type: 'dialog',
    content: 'Angel... ANGEL!! I think I was FEELING angels flying up in front of me...!',
    next: 'panic',
  },
  panic: {
    type: 'dialog',
    content:
      '<span class="censor-word">S<span class="censor-stars">**</span>t</span> I haven\'t got my wishes prepared!!',
    next: null,
  },
}

// 点了 panic 句里星号后的抗议台词
export const flowerbedCensorFlow = {
  start: {
    type: 'dialog',
    content: "Ahhh don't change my lines!!!! Fxxk!",
    next: null,
    typewriter: {
      typeMs: 20,
      holdMs: 320,
      restore: 'flowerbedAngel',
      restoreStep: 'panic',
      restoreMs: 140,
    },
  },
}

// kajiu 招牌
export const kajiuFlow = {
  start: {
    type: 'option',
    options: [
      { label: 'Surprised Sub*ay and K*C didn\'t grab this place first', value: 'ask' },
    ],
    next: null,
  },
}

// 点了 kajiu 台词里星号后的抢占对话
export const kajiuNoEggFlow = {
  start: {
    type: 'dialog',
    content: 'Surprised? No surprise here!',
    next: null,
    typewriter: { typeMs: 20, holdMs: 320, restore: 'kajiu', restoreMs: 140 },
  },
}

// 注册表：触发处用 key 引用（start('noticeSign') / start('dropped')）
export const dialogFlows = {
  kajiu: kajiuFlow,
  kajiuNoEgg: kajiuNoEggFlow,
  noticeSign: noticeSignFlow,
  dropped: droppedFlow,
  torchFound: torchFoundFlow,
  tallchFound: tallchFoundFlow,
  benchFound: benchFoundFlow,
  torchDone: torchDoneFlow,
  tallchDone: tallchDoneFlow,
  tilted3Times: tilted3TimesFlow,
  sunglassesNight: sunglassesNightFlow,
  sunglassesNightOff: sunglassesNightOffFlow,
  updateDismissed: updateDismissedFlow,
  callbackDismissed: callbackDismissedFlow,
  emotionDropRefused: emotionDropRefusedFlow,
  basementLocked: basementLockedFlow,
  skiImpostor: skiImpostorFlow,
  backyardDoor: backyardDoorFlow,
  backyardBoard: backyardBoardFlow,
  backyardReturn: backyardReturnFlow,
  flowerbedDone: flowerbedDoneFlow,
  flowerbedMax: flowerbedMaxFlow,
  flowerbedAngel: flowerbedAngelFlow,
  flowerbedCake: flowerbedCakeFlow,
  flowerbedEmpty: flowerbedEmptyFlow,
  flowerbedPudding: flowerbedPuddingFlow,
  flowerbedSwallowed: flowerbedSwallowedFlow,
  flowerbedCensor: flowerbedCensorFlow,
}

export default dialogFlows
