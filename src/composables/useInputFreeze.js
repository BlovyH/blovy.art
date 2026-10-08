import { onBeforeUnmount, ref } from 'vue'

/**
 * 冻结输入框：期间键盘输入不响应、光标不可见，除此之外不带任何提示或视觉变化。
 * 配 :readonly="frozen" 使用（readonly 不响应输入但仍可聚焦，且不像 disabled 会改外观）。
 * 光标靠使用处把 caret-color 设成 transparent 去掉。
 */
export function useInputFreeze() {
  const frozen = ref(false)
  let timer = null

  function freeze(ms) {
    clearTimeout(timer)
    frozen.value = true
    if (ms != null) timer = setTimeout(release, ms)
  }

  function release() {
    clearTimeout(timer)
    frozen.value = false
  }

  onBeforeUnmount(release)

  return { frozen, freeze, release }
}
