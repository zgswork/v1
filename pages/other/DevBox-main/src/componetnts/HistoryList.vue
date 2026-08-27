<template>
  <div v-if="list.length" class="mt-4">
    <div class="flex justify-between items-center mb-2">
      <h3 class="font-bold">历史记录</h3>
      <button @click="$history.clearRecord(key)" class="text-red-400">清空</button>
    </div>
    <div class="space-y-1 max-h-48 overflow-y-auto">
      <div
        v-for="(item, idx) in list"
        :key="idx"
        @click="$emit('fill', item)"
        class="p-2 bg-gray-100 dark:bg-darkCard rounded cursor-pointer text-sm truncate"
      >
        {{ item }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { useHistoryStore } from '@/stores/history'
const $history = useHistoryStore()
const props = defineProps(['key'])
const emit = defineEmits(['fill'])
const list = $history.records[props.key] || []
</script>
