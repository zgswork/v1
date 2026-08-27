<template>
  <div class="max-w-4xl mx-auto">
    <h2 class="text-2xl font-bold mb-4">Base64 文本转换</h2>
    <div class="flex gap-2 mb-4 flex-wrap">
      <button @click="toBase64" class="px-4 py-2 bg-primary text-white rounded">文本转Base64</button>
      <button @click="fromBase64" class="px-4 py-2 bg-green-500 text-white rounded">Base64转文本</button>
      <button @click="clearAll" class="px-4 py-2 bg-red-500 text-white rounded">清空</button>
      <CopyBtn :text="output" />
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label class="block mb-1 font-medium">输入内容</label>
        <textarea
          v-model="input"
          class="w-full h-32 p-3 font-mono rounded bg-white dark:bg-darkCard border dark:border-slate-600"
        ></textarea>
      </div>
      <div>
        <label class="block mb-1 font-medium">结果</label>
        <pre class="p-3 min-h-32 bg-gray-50 dark:bg-slate-800 rounded font-mono whitespace-pre-wrap">{{ output }}</pre>
      </div>
    </div>

    <div v-if="errMsg" class="text-red-500 mt-2">{{ errMsg }}</div>
    <HistoryList key="base64" @fill="input = $event" />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { textToBase64, base64ToText } from '@/utils/base64'
import CopyBtn from '@/components/CopyBtn.vue'
import HistoryList from '@/components/HistoryList.vue'
import { useHistoryStore } from '@/stores/history'

const $history = useHistoryStore()
const input = ref('')
const output = ref('')
const errMsg = ref('')

watch(input, () => errMsg.value = '')

const saveHis = () => input.value && $history.addRecord('base64', input.value)

const toBase64 = () => {
  output.value = textToBase64(input.value)
  saveHis()
}
const fromBase64 = () => {
  try {
    output.value = base64ToText(input.value)
    saveHis()
  } catch (e) {
    errMsg.value = '非法Base64字符串'
  }
}

const clearAll = () => {
  input.value = ''
  output.value = ''
  errMsg.value = ''
}
</script>
