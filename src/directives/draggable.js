// v-draggable — lego block: makes any element draggable, decoupled from its
// positioning/CSS. Compose it with a small top-layer class (e.g. `.drag-top`)
// for "drag + always-on-top" windows/icons.
//
// How it works:
//   - Movement is written to CSS vars `--ddx` / `--ddy` on the element. The
//     CONSUMER must include
//       transform: translate(var(--ddx, 0px), var(--ddy, 0px));
//     in its own CSS. This lets the element keep any positioning
//     (absolute / top / bottom / left ...) and even a `:active` press effect
//     via `:active:not(.is-dragging)` without the drag transform clobbering it.
//   - Adds `.is-dragging` while dragging (cursor/visual hook + global move
//     cursor). The class is removed on mouseup.
//   - If `binding.value` is a function, it is invoked on a press that did NOT
//     move past the 3px threshold — i.e. treat as a click. A real drag swallows
//     the native click so `@click` handlers don't fire after repositioning.
//   - 元素落在带 data-drag-bounds 的祖先里时，拖拽实时被该边界挡住；属性值是
//     边界元素的选择器，留空则用祖先本身。

import { keepInView } from '@/keepInView.js'
import { skiMode } from '@/skiMode.js'
import { SKI_MIN_SPEED, createVelSampler, startGlide } from '@/skiGlide.js'

const THRESHOLD = 3
const base = new WeakMap()
const vels = new WeakMap()
const glides = new WeakMap()

function samplerOf(el) {
  let s = vels.get(el)
  if (!s) {
    s = createVelSampler()
    vels.set(el, s)
  }
  return s
}

// 返回本次拖拽允许的累计位移范围，值相对拖拽起点的元素矩形
function dragLimits(el, startRect) {
  const root = el.closest('[data-drag-bounds]')
  if (!root) return null
  const box = root.dataset.dragBounds ? root.querySelector(root.dataset.dragBounds) : root
  if (!box) return null
  const b = box.getBoundingClientRect()
  return {
    minX: b.left - startRect.left,
    maxX: b.right - startRect.right,
    minY: b.top - startRect.top,
    maxY: b.bottom - startRect.bottom,
  }
}

const limit = (v, lo, hi) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)))

export default {
  mounted(el, binding) {
    el.style.touchAction = 'none'
    const onClick = typeof binding.value === 'function' ? binding.value : null

    function onDown(e) {
      if (e.button !== undefined && e.button !== 0) return
      const startX = e.clientX
      const startY = e.clientY
      const b = base.get(el) || { x: 0, y: 0 }
      // 还在滑就被抓住：先掐掉，否则两段一起推
      glides.get(el)?.()
      glides.delete(el)
      samplerOf(el).reset()
      const lim = dragLimits(el, el.getBoundingClientRect())
      const clampAt = (p) =>
        lim
          ? {
            x: limit(p.x, b.x + lim.minX, b.x + lim.maxX),
            y: limit(p.y, b.y + lim.minY, b.y + lim.maxY),
          }
          : p
      let draggingAdded = false

      function onMove(ev) {
        const p = clampAt({ x: b.x + (ev.clientX - startX), y: b.y + (ev.clientY - startY) })
        // Only flag "dragging" once the move actually passes the threshold.
        // Adding it on mousedown would clash with consumers' `:active:not(.is-dragging)`
        // press effect (e.g. power-btn sunken border) and break the click feel.
        const dist = Math.hypot(ev.clientX - startX, ev.clientY - startY)
        if (dist > THRESHOLD && !draggingAdded) {
          draggingAdded = true
          el.classList.add('is-dragging')
        }
        el.style.setProperty('--ddx', p.x + 'px')
        el.style.setProperty('--ddy', p.y + 'px')
        samplerOf(el).sample(p.x, p.y)
      }

      function onUp(ev) {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        el.classList.remove('is-dragging')
        const moved =
          Math.abs(ev.clientX - startX) > THRESHOLD ||
          Math.abs(ev.clientY - startY) > THRESHOLD
        if (moved) {
          const next = clampAt({ x: b.x + (ev.clientX - startX), y: b.y + (ev.clientY - startY) })
          // 先把松手时的真实位置写上，再量rect
          el.style.setProperty('--ddx', next.x + 'px')
          el.style.setProperty('--ddy', next.y + 'px')
          const { dx, dy } = keepInView(el.getBoundingClientRect())
          const settled = clampAt({ x: next.x + dx, y: next.y + dy })
          base.set(el, settled)
          if (settled.x !== next.x || settled.y !== next.y) {
            el.style.setProperty('--ddx', settled.x + 'px')
            el.style.setProperty('--ddy', settled.y + 'px')
          }
          // 溜冰场模式：松手后接着滑，位置一样写回 base + CSS vars
          if (skiMode.value) {
            const { vx, vy } = samplerOf(el).take()
            if (Math.hypot(vx, vy) >= SKI_MIN_SPEED) {
              const shift = (sx, sy) => {
                const cur = base.get(el) || { x: 0, y: 0 }
                const p = clampAt({ x: cur.x + sx, y: cur.y + sy })
                base.set(el, p)
                el.style.setProperty('--ddx', p.x + 'px')
                el.style.setProperty('--ddy', p.y + 'px')
              }
              glides.get(el)?.()
              glides.set(
                el,
                startGlide({
                  getRect: () => el.getBoundingClientRect(),
                  move: shift,
                  vx,
                  vy,
                })
              )
            }
          }
          // Swallow the native click that follows a real drag so @click
          // handlers don't fire after repositioning.
          el.addEventListener(
            'click',
            (c) => {
              c.stopPropagation()
              c.preventDefault()
            },
            { capture: true, once: true }
          )
        } else {
          if (onClick) onClick(ev)
          // discard any sub-threshold jitter so the element stays put
          el.style.setProperty('--ddx', b.x + 'px')
          el.style.setProperty('--ddy', b.y + 'px')
        }
      }

      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    }

    el.addEventListener('mousedown', onDown)
    el.__vDraggableDown = onDown
  },

  unmounted(el) {
    if (el.__vDraggableDown) {
      el.removeEventListener('mousedown', el.__vDraggableDown)
    }
  },
}
