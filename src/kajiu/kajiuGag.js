// 点 kajiu 台词里的星号时抢占一句演出对话
import { useDialogFlow } from '@/dialogs/useDialogFlow.js'

const dlg = useDialogFlow()

export function triggerKajiuGag() {
  if (dlg.activeKey.value !== 'kajiu') return
  dlg.start('kajiuNoEgg', { preempt: true })
}
