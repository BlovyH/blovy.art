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
      let draggingAdded = false

      function onMove(ev) {
        const dx = b.x + (ev.clientX - startX)
        const dy = b.y + (ev.clientY - startY)
        // Only flag "dragging" once the move actually passes the threshold.
        // Adding it on mousedown would clash with consumers' `:active:not(.is-dragging)`
        // press effect (e.g. power-btn sunken border) and break the click feel.
        const dist = Math.hypot(ev.clientX - startX, ev.clientY - startY)
        if (dist > THRESHOLD && !draggingAdded) {
          draggingAdded = true
          el.classList.add('is-dragging')
        }
        el.style.setProperty('--ddx', dx + 'px')
        el.style.setProperty('--ddy', dy + 'px')
        samplerOf(el).sample(dx, dy)
      }

      function onUp(ev) {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        el.classList.remove('is-dragging')
        const moved =
          Math.abs(ev.clientX - startX) > THRESHOLD ||
          Math.abs(ev.clientY - startY) > THRESHOLD
        if (moved) {
          const next = { x: b.x + (ev.clientX - startX), y: b.y + (ev.clientY - startY) }
          // 先把松手时的真实位置写上，再量rect
          el.style.setProperty('--ddx', next.x + 'px')
          el.style.setProperty('--ddy', next.y + 'px')
          const { dx, dy } = keepInView(el.getBoundingClientRect())
          base.set(el, { x: next.x + dx, y: next.y + dy })
          if (dx || dy) {
            el.style.setProperty('--ddx', next.x + dx + 'px')
            el.style.setProperty('--ddy', next.y + dy + 'px')
          }
          // 溜冰场模式：松手后接着滑，位置一样写回 base + CSS vars
          if (skiMode.value) {
            const { vx, vy } = samplerOf(el).take()
            if (Math.hypot(vx, vy) >= SKI_MIN_SPEED) {
              const shift = (sx, sy) => {
                const cur = base.get(el) || { x: 0, y: 0 }
                const nx = cur.x + sx
                const ny = cur.y + sy
                base.set(el, { x: nx, y: ny })
                el.style.setProperty('--ddx', nx + 'px')
                el.style.setProperty('--ddy', ny + 'px')
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
