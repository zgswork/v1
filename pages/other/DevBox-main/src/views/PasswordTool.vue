<template>
  <div class="max-w-4xl mx-auto">
    <h2 class="text-2xl font-bold mb-4">高强度密码生成器</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      <div>
        <label class="block mb-1">密码长度</label>
        <input v-model.number="length" type="number" min="4" max="64" class="w-full p-2 rounded border dark:bg-darkCard">
      </div>
      <div class="space-y-2">
        <label><input v-model="opts.lower" type="checkbox"> 小写字母 a-z</label>
        <label class="ml-4"><input v-model="opts.upper" type="checkbox"> 大写字母 A-Z</label>
        <br>
        <label><input v-model="opts.num" type="checkbox"> 数字 0-9</label>
        <label class="ml-4"><input v-model="opts.symbol" type="checkbox"> 特殊符号 !@#$</label>
      </div>
    </div>
    <button @click="createPwd" class="px-4 py-2 bg-primary text-white rounded mb-4">生成密码</button>
    <div class="p-3 bg-gray-100 dark:bg-darkCard rounded flex justify-between items-center">
      <span class="font-mono text-lg">{{ pwd }}</span>
      <CopyBtn :text="pwd" />
    </div>
    <HistoryList key="pwd" @fill="pwd = $event" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { generatePwd } from '@/utils/password'
import CopyBtn from '@/components/CopyBtn.vue'
import HistoryList from '@/components/HistoryList.vue'
import { useHistoryStore } from '@/stores/history'

const $history = useHistoryStore()
const length = ref(16)
const opts = ref({
  lower: true,
  upper: true,
  num: true,
  symbol: true
})
const pwd = ref('')

const createPwd = () => {
  const newPwd = generatePwd(length.value, opts.value)
  pwd.value = newPwd
  $history.addRecord('pwd', newPwd)
}
</script>
