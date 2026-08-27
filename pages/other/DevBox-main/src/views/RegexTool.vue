<template>
  <div class="max-w-4xl mx-auto">
    <h2 class="text-2xl font-bold mb-4">正则表达式测试工具</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      <div>
        <label class="block mb-1 font-medium">正则表达式</label>
        <input v-model="regStr" class="w-full p-3 font-mono rounded bg-white dark:bg-darkCard border dark:border-slate-600" placeholder="\\d+">
      </div>
      <div>
        <label class="block mb-1 font-medium">匹配标志</label>
        <div class="flex gap-4">
          <label><input v-model="flagG" type="checkbox"> g 全局</label>
          <label><input v-model="flagI" type="checkbox"> i 忽略大小写</label>
        </div>
      </div>
    </div>
    <div>
      <label class="block mb-1 font-medium">测试文本</label>
      <textarea v-model="testText" @input="runTest" class="w-full h-32 p-3 font-mono rounded bg-white dark:bg-darkCard border dark:border-slate-600"></textarea>
    </div>
    <div class="mt-4">
      <h3 class="font-bold">匹配结果</h3>
      <div v-if="errMsg" class="text-red-500">{{ errMsg }}</div>
      <div v-else-if="result.length === 0" class="text-gray-400">无匹配内容</div>
      <div v-else class="mt-2 space-y-1">
        <div v-for="(item, idx) in result" :key="idx" class="p-2 bg-gray-100 dark:bg-darkCard rounded">{{ idx+1 }}. {{ item }}</div>
      </div>
    </div>
    <HistoryList key="regex" @fill="regStr = $event;runTest()" />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { testRegex } from '@/utils/regex'
import HistoryList from '@/components/HistoryList.vue'
import { useHistoryStore } from '@/stores/history'

const $history = useHistoryStore()
const regStr = ref('')
const testText = ref('')
const flagG = ref(true)
const flagI = ref(false)
const result = ref([])
const errMsg = ref('')

watch([regStr, testText, flagG, flagI], runTest)

function runTest() {
  errMsg.value = ''
  result.value = []
  if (!regStr.value || !testText.value) return
  let flag = ''
  if (flagG.value) flag += 'g'
  if (flagI.value) flag += 'i'
  const res = testRegex(testText.value, regStr.value, flag)
  if (!res.ok) {
    errMsg.value = res.msg
  } else {
    result.value = res.matches
    $history.addRecord('regex', regStr.value)
  }
}
</script>
