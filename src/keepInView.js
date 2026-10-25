/* 松手时把可拖拽区域完全离开了视口的东西拉回视口 */

// 推回后离视口边的距离
export const KEEP_MARGIN = 0

/**
 * @param {{left:number, top:number, right:number, bottom:number}} rect 抓取用的矩形（窗口传标题栏，其它传元素自身）
 * @returns {{dx:number, dy:number}} 还需要补的位移（视口像素）
 */
export function keepInView(rect) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  let dx = 0
  let dy = 0
  if (rect.top < KEEP_MARGIN) {
    dy = KEEP_MARGIN - rect.top
  } else if (rect.bottom > vh - KEEP_MARGIN) {
    dy = Math.max(vh - KEEP_MARGIN - rect.bottom, KEEP_MARGIN - rect.top)
  }
  if (rect.left < KEEP_MARGIN) {
    dx = KEEP_MARGIN - rect.left
  } else if (rect.right > vw - KEEP_MARGIN) {
    dx = Math.max(vw - KEEP_MARGIN - rect.right, KEEP_MARGIN - rect.left)
  }
  return { dx, dy }
}
