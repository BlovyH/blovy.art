// NOTHING 搜索框的彩蛋分支。
// 命中条件：输入内容精确等于 keyword（忽略大小写与首尾空格）。
// 命中后走一段「本来没找到、突然改口」的演出，而不是直接返回 nothing。
//
// 「触发一个事件」= 跑分支自己的那段演出（目前就是窗口内部的文字变化），
// 全部发生在 NothingWindow 内部，不往外抛。加分支只需要在下面加一条。
export const NOTHING_BRANCHES = [
  {
    keyword: 'gallery',
    found: 'Here! We do have a GALLERY window.',
    // 说出结论时要把自己挪开的那个窗口（选择器）。它在视口哪半边，NOTHING 就往反方向滑。
    target: '.gallery-window',
  },
]

// 演出里那句没打完的话：卡在 noth 后面，接三个点
export const PARTIAL_TEXT = 'Sorry, we found noth'
