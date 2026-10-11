<template>
  <router-view />
  <UpdateNotice v-if="updateAvailable" @later="dismissUpdate" />
</template>

<script setup>
import UpdateNotice from './components/UpdateNotice.vue'
import { useUpdateCheck } from './composables/useUpdateCheck.js'

const { available: updateAvailable, dismiss: dismissUpdate } = useUpdateCheck()
</script>
