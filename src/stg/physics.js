// 弹幕物理常量：步进（组件）与反推初速（patterns）共用同一份，别在两边各写一遍
export const BULLET_DRAG = 0.9975 // 每 ms 保留的速度比例（指数衰减）：爆炸的"变慢"靠它
export const GRAVITY = 0.0012 // px/ms² 下落加速度
// 纯阻力下能跑到的极限位移 = v0 / DRAG_RATE，而重力还会往回拽，实际最高点只有它的一半多点。
// GRAVITY_SHARE 是凭观感定的系数，改 BULLET_DRAG / GRAVITY 之后要一起重调。
export const DRAG_RATE = -Math.log(BULLET_DRAG)
export const GRAVITY_SHARE = 0.56

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}
