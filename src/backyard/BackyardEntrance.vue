<template>
  <BackyardDoor @click="onDoorClick" />
</template>

<script setup>
import { watch } from 'vue'
import { useDialogFlow } from '@/dialogs/useDialogFlow.js'
import BackyardDoor from './BackyardDoor.vue'
import { enterBackyard } from './backyard.js'

const dlg = useDialogFlow()

function onDoorClick() {
  dlg.start('backyardDoor')
}

watch(
  () => [dlg.activeKey.value, dlg.currentStep.value],
  ([key, step]) => {
    if (step === 'yes' && key === 'backyardDoor') enterBackyard()
  }
)
</script>
