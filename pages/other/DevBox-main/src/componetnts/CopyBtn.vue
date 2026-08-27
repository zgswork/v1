<template>
  <button
    @click="handleCopy"
    class="px-3 py-1 bg-primary text-white rounded"
  >
    复制
  </button>
</template>

<script setup>
import { ref } from 'vue'
const props = defineProps(['text'])
const toast = ref('')
const handleCopy = async () => {
  await navigator.clipboard.writeText(props.text)
  alert('复制成功')
}
</script>
