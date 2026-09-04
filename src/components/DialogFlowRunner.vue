<script setup>
// 对话流渲染器：全局在 HomeView 挂一次即可。
// 根据引擎当前步 type 自动显示 DialogBox（对话）或 OptionBox（选项），
// 复用现有展示组件，自身不含任何编排逻辑。
import DialogBox from './DialogBox.vue'
import OptionBox from './OptionBox.vue'
import { useDialogFlow } from '@/dialogs/useDialogFlow.js'

const { isDialog, isOption, content, options, visible, advance, select } = useDialogFlow()
</script>

<template>
  <!-- 两个组件常驻挂载，靠 :visible 切换显隐（与原 HomeView 行为一致） -->
  <DialogBox
    :visible="isDialog"
    :content="content"
    @click="advance"
  />
  <OptionBox
    :visible="isOption"
    :options="options"
    @select="select"
  />
</template>
