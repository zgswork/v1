<template>
  <button
    @click="$theme.toggleDark()"
    class="p-2 rounded-lg bg-gray-200 dark:bg-darkCard"
  >
    {{ $theme.dark ? '☀️ 浅色' : '🌙 暗黑' }}
  </button>
</template>

<script setup>
import { useThemeStore } from '@/stores/theme'
const $theme = useThemeStore()
</script>
