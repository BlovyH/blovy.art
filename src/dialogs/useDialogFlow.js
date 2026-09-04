// 对话流引擎（通用状态机）。
// 设计为「模块级单例」：所有调用方（HomeView 的触发器 + DialogFlowRunner 渲染器）
// 共享同一份 state，从而实现「全局单串、非抢占、无队列」。
//
// 用法：
//   const dlg = useDialogFlow()
//   dlg.start('noticeSign')          // 任意触发器调用
//   dlg.isDialog / dlg.isOption      // Runner 渲染器读取当前步类型
//   dlg.advance()                    // 对话步点击/回车推进（Runner 在 DialogBox @click 上绑）
//   dlg.select(value)                // 选项步选择（Runner 在 OptionBox @select 上绑）
import { ref, computed } from 'vue'
import { dialogFlows } from './flows.js'

// ── 模块级单例 state（关键：全局只有一份）──
const activeKey = ref(null)        // 当前在跑的流 key（null = 空闲）
const currentStep = ref(null)      // 当前步 key（'start' 起）

const flow = computed(() =>
  activeKey.value ? dialogFlows[activeKey.value] : null
)
const step = computed(() =>
  flow.value && currentStep.value ? flow.value[currentStep.value] : null
)

const visible = computed(() => !!step.value)
const isDialog = computed(() => step.value?.type === 'dialog')
const isOption = computed(() => step.value?.type === 'option')
const content = computed(() => step.value?.content ?? '')
const options = computed(() => step.value?.options ?? [])

// 启动一串对话。非抢占：已有流在跑则直接忽略（不排队、不抢占）。
function start(key) {
  if (activeKey.value) return
  if (!dialogFlows[key]) return
  activeKey.value = key
  currentStep.value = 'start'
}

// 对话步推进：有 next 就跳，next 为 null 则结束（自关）
function advance() {
  const s = step.value
  if (!s) return
  if (s.next == null) {
    reset()
    return
  }
  currentStep.value = s.next
}

// 选项步选择：按 value 跳到对应后续步；映射缺省/为 null 则结束
function select(value) {
  const s = step.value
  if (!s || s.type !== 'option') return
  const nxt = s.next ? s.next[value] : null
  if (nxt == null) {
    reset()
    return
  }
  currentStep.value = nxt
}

function reset() {
  activeKey.value = null
  currentStep.value = null
}

// 所有调用方拿到的都是同一份模块级 state 的引用
export function useDialogFlow() {
  return {
    activeKey,
    step,
    visible,
    isDialog,
    isOption,
    content,
    options,
    start,
    advance,
    select,
    reset,
  }
}
