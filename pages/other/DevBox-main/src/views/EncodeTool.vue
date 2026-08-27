<template>
  <div class="max-w-4xl mx-auto">
    <h2 class="text-2xl font-bold mb-4">编码 / 解码 / 哈希加密</h2>
    <div class="flex gap-2 mb-4 flex-wrap">
      <button @click="urlEncode" class="px-3 py-2 bg-primary text-white rounded">URL编码</button>
      <button @click="urlDecode" class="px-3 py-2 bg-primary text-white rounded">URL解码</button>
      <button @click="calcMd5" class="px-3 py-2 bg-slate-600 text-white rounded">MD5</button>
      <button @click="calcSha256" class="px-3 py-2 bg-slate-600 text-white rounded">SHA256</button>
      <button @click="clearAll" class="px-3 py-2 bg-red-500 text-white rounded">清空</button>
      <CopyBtn :text="output" />
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label class="block mb-1 font-medium">输入文本</label>
        <textarea
          v-model="input"
          class="w-full h-32 p-3 font-mono rounded bg-white dark:bg-darkCard border dark:border-slate-600"
        ></textarea>
      </div>
      <div>
        <label class="block mb-1 font-medium">输出结果</label>
        <pre class="p-3 min-h-32 bg-gray-50 dark:bg-slate-800 rounded font-mono whitespace-pre-wrap">{{ output }}</pre>
      </div>
    </div>

    <div v-if="errMsg" class="text-red-500 mt-2">{{ errMsg }}</div>
    <HistoryList key="encode" @fill="input = $event" />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { urlEncode, urlDecode, md5, sha256 } from '@/utils/encode'
import CopyBtn from '@/components/CopyBtn.vue'
import HistoryList from '@/components/HistoryList.vue'
import { useHistoryStore } from '@/stores/history'

const $history = useHistoryStore()
const input = ref('')
const output = ref('')
const errMsg = ref('')

watch(input, () => errMsg.value = '')

const saveHistory = () => input.value && $history.addRecord('encode', input.value)

const urlEncode = () => {
  output.value = urlEncode(input.value)
  saveHistory()
}
const urlDecode = () => {
  try {
    output.value = urlDecode(input.value)
    saveHistory()
  } catch (e) {
    errMsg.value = '解码失败，非法字符'
  }
}
const calcMd5 = () => {
  output.value = md5(input.value)
  saveHistory()
}
const calcSha256 = () => {
  output.value = sha256(input.value)
  saveHistory()
}

const clearAll = () => {
  input.value = ''
  output.value = ''
  errMsg.value = ''
}
</script>
