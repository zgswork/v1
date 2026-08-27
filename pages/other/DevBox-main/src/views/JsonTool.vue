<template>
  <div class="max-w-4xl mx-auto">
    <h2 class="text-2xl font-bold mb-4">JSON 格式化 / 压缩 / 校验</h2>

    <div class="flex gap-2 mb-4">
      <button @click="handleFormat" class="px-4 py-2 bg-primary text-white rounded">格式化</button>
      <button @click="handleCompress" class="px-4 py-2 bg-gray-500 text-white rounded">压缩</button>
      <button @click="handleClear" class="px-4 py-2 bg-red-500 text-white rounded">清空</button>
      <CopyBtn :text="output" />
    </div>

    <textarea
      v-model="input"
      class="w-full h-64 p-3 font-mono rounded bg-white dark:bg-darkCard border dark:border-slate-600"
      placeholder="粘贴JSON内容..."
    ></textarea>

    <div v-if="errMsg" class="text-red-500 my-2">{{ errMsg }}</div>

    <div class="mt-4">
      <h3 class="font-bold mb-2">输出结果</h3>
      <pre class="p-3 min-h-40 bg-gray-50 dark:bg-slate-800 rounded font-mono whitespace-pre-wrap">{{ output }}</pre>
    </div>

    <HistoryList key="json" @fill="input = $event" />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { formatJson, compressJson, validateJson } from '@/utils/json'
import CopyBtn from '@/components/CopyBtn.vue'
import HistoryList from '@/components/HistoryList.vue'
import { useHistoryStore } from '@/stores/history'

const $history = useHistoryStore()
const input = ref('')
const output = ref('')
const errMsg = ref('')

watch(input, () => {
  errMsg.value = ''
})

const handleFormat = () => {
  try {
    const res = formatJson(input.value)
    output.value = res
    $history.addRecord('json', input.value)
  } catch (e) {
    const check = validateJson(input.value)
    errMsg.value = check.msg
  }
}

const handleCompress = () => {
  try {
    const res = compressJson(input.value)
    output.value = res
    $history.addRecord('json', input.value)
  } catch (e) {
    const check = validateJson(input.value)
    errMsg.value = check.msg
  }
}

const handleClear = () => {
  input.value = ''
  output.value = ''
  errMsg.value = ''
}
</script>
