import { ref } from 'vue'

const baseZ = 1000
const counter = ref(baseZ)

export function nextZ() {
  return ++counter.value
}
