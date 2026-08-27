<template>
  <div class="max-w-4xl mx-auto">
    <h2 class="text-2xl font-bold mb-4">二维码生成器</h2>
    <div class="flex flex-col md:flex-row gap-6">
      <div class="flex-1 space-y-4">
        <div>
          <label class="block mb-1 font-medium">文本/链接</label>
          <textarea
            v-model="content"
            @input="renderQr"
            class="w-full h-32 p-3 rounded bg-white dark:bg-darkCard border dark:border-slate-600"
            placeholder="输入网址、文字生成二维码"
          ></textarea>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block mb-1">尺寸</label>
            <input v-model.number="size" type="number" min="100" max="600" class="w-full p-2 rounded border dark:bg-darkCard">
          </div>
          <div>
            <label class="block mb-1">前景色</label>
            <input v-model="darkColor" type="color" class="w-full h-10 rounded">
          </div>
        </div>
        <button @click="downloadImg" class="px-4 py-2 bg-primary text-white rounded">下载二维码图片</button>
        <HistoryList key="qrcode" @fill="content = $event;$nextTick(renderQr)" />
      </div>
      <div class="shrink-0">
        <canvas ref="qrCanvas" class="bg-white rounded"></canvas>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, watch } from 'vue'
import { generateQrCanvas } from '@/utils/qrcode'
import HistoryList from '@/components/HistoryList.vue'
import { useHistoryStore } from '@/stores/history'

const $history = useHistoryStore()
const qrCanvas = ref(null)
const content = ref('https://github.com')
const size = ref(240)
const darkColor = ref('#000000')

const renderQr = async () => {
  if (!qrCanvas.value || !content.value) return
  await generateQrCanvas(content.value, qrCanvas.value, {
    width: size.value,
    color: { dark: darkColor.value, light: '#ffffff' }
  })
  $history.addRecord('qrcode', content.value)
}

watch([size, darkColor], () => renderQr())

const downloadImg = () => {
  const link = document.createElement('a')
  link.download = 'qrcode.png'
  link.href = qrCanvas.value.toDataURL('image/png')
  link.click()
}
nextTick(renderQr)
</script>
