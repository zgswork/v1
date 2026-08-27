<template>
  <div class="min-h-screen bg-gray-100 dark:bg-darkBg text-gray-800 dark:text-gray-100 flex">
    <!-- 侧边栏 -->
    <aside class="w-64 bg-white dark:bg-darkCard p-4 shrink-0">
      <h1 class="text-xl font-bold mb-6">DevBox 工具箱</h1>
      <DarkToggle class="mb-6" />
      <nav class="space-y-2">
        <router-link
          v-for="route in $router.getRoutes().filter(r=>r.meta.title)"
          :key="route.path"
          :to="route.path"
          class="block p-2 rounded hover:bg-gray-200 dark:hover:bg-slate-700"
          active-class="bg-primary text-white"
        >
          {{ route.meta.title }}
        </router-link>
      </nav>
    </aside>
    <!-- 主内容 -->
    <main class="flex-1 p-6 overflow-auto">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import DarkToggle from './DarkToggle.vue'
import { useRouter } from 'vue-router'
const $router = useRouter()
</script>
