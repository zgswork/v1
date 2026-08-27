<template>
  <div class="max-w-4xl mx-auto">
    <h2 class="text-2xl font-bold mb-4">时间戳转换工具</h2>
    <div class="flex gap-2 mb-4 flex-wrap">
      <button @click="getNow10" class="px-4 py-2 bg-primary text-white rounded">获取10位时间戳</button>
      <button @click="getNow13" class="px-4 py-2 bg-primary text-white rounded">获取13位时间戳</button>
      <button @click="convertTs" class="px-4 py-2 bg-green-500 text-white rounded">转换</button>
      <button @click="clearAll" class="px-4 py-2 bg-red-500 text-white rounded">清空</button>
      <CopyBtn :text="result" />
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label class="block mb-1 font-medium">输入时间戳/日期</label>
        <textarea
          v-model="inputVal"
          class="w-full h-32 p-3 font-mono rounded bg-white dark:bg-darkCard border dark:border-slate-600"
          placeholder="输入10位/13位时间戳，或日期 2026-07-11 12:00:00"
        ></textarea>
      </div>
      <div>
        <label class="block mb-1 font-medium">转换结果</label>
        <pre class="p-3 min-h-32 bg-gray-50 dark:bg-slate-800 rounded font-mono whitespace-pre-wrap">{{ result }}</pre>
      </div>
    </div>

    <div v-if="errMsg" class="text-red-500 mt-2">{{ errMsg }}</div>
    <HistoryList key="timestamp" @fill="inputVal = $event" />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { getNowTs10, getNowTs13, tsToDate } from '@/utils/time'
import CopyBtn from '@/components/CopyBtn.vue'
import HistoryList from '@/components/HistoryList.vue'
import { useHistoryStore } from '@/stores/history'
import dayjs from 'dayjs'

const $history = useHistoryStore()
const inputVal = ref('')
const result = ref('')
const errMsg = ref('')

watch(inputVal, () => errMsg.value = '')

const getNow10 = () => {
  inputVal.value = getNowTs10().toString()
  convertTs()
}
const getNow13 = () => {
  inputVal.value = getNowTs13().toString()
  convertTs()
}

const convertTs = () => {
  errMsg.value = ''
  const val = inputVal.value.trim()
  if (!val) return
  try {
    if (/^\d+$/.test(val)) {
      const dateStr = tsToDate(val)
      const ts10 = Math.floor(Number(val) / (val.length === 13 ? 1000 : 1))
      const ts13 = Number(val) * (val.length === 10 ? 1000 : 1)
      result.value = `日期：${dateStr}\n10位时间戳：${ts10}\n13位时间戳：${ts13}`
    } else {
      const time = dayjs(val)
      if (!time.isValid()) throw new Error('日期格式错误')
      const ts10 = Math.floor(time.valueOf() / 1000)
      const ts13 = time.valueOf()
      result.value = `日期：${time.format('YYYY-MM-DD HH:mm:ss')}\n10位时间戳：${ts10}\n13位时间戳：${ts13}`
    }
    $history.addRecord('timestamp', val)
  } catch (e) {
    errMsg.value = e.message
  }
}

const clearAll = () => {
  inputVal.value = ''
  result.value = ''
  errMsg.value = ''
}
</script>
