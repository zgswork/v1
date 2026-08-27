<template>
  <div class="max-w-4xl mx-auto">
    <h2 class="text-2xl font-bold mb-4">颜色转换工具</h2>
    <div class="flex gap-4 items-center mb-4">
      <input v-model="hex" type="color" class="w-20 h-20 rounded cursor-pointer" @input="convertColor">
      <div class="flex-1">
        <label class="block mb-1">HEX</label>
        <input v-model="hex" @input="convertColor" class="w-full p-2 rounded border dark:bg-darkCard">
      </div>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
      <div class="p-3 bg-gray-100 dark:bg-darkCard rounded">
        <div class="flex justify-between items-center">
          <span>RGB</span>
          <CopyBtn :text="color.rgb" />
        </div>
        <p class="font-mono mt-1">{{ color.rgb }}</p>
      </div>
      <div class="p-3 bg-gray-100 dark:bg-darkCard rounded">
        <div class="flex justify-between items-center">
          <span>HSL</span>
          <CopyBtn :text="color.hsl" />
        </div>
        <p class="font-mono mt-1">{{ color.hsl }}</p>
      </div>
    </div>
    <HistoryList key="color" @fill="hex = $event;convertColor()" />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { hexToAll } from '@/utils/color'
import CopyBtn from '@/components/CopyBtn.vue'
import HistoryList from '@/components/HistoryList.vue'
import { useHistoryStore } from '@/stores/history'

const $history = useHistoryStore()
const hex = ref('#3b82f6')
const color = ref({ hex: '', rgb: '', hsl: '' })

const convertColor = () => {
  color.value = hexToAll(hex.value)
  $history.addRecord('color', hex.value)
}
watch(hex, convertColor)
convertColor()
</script>
