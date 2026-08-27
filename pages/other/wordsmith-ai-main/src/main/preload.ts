import { ipcRenderer, contextBridge } from 'electron'

contextBridge.exposeInMainWorld('wordsmith', {
  clipboard: {
    write(payload: { html: string; text: string }) {
      return ipcRenderer.invoke('clipboard:write', payload)
    },
    writeImage(dataUrl: string) {
      return ipcRenderer.invoke('clipboard:writeImage', dataUrl)
    },
    captureArea(rect: { x: number; y: number; width: number; height: number }, transparent?: boolean) {
      return ipcRenderer.invoke('clipboard:captureArea', rect, transparent)
    },
    captureAreaAsDataUrl(rect: { x: number; y: number; width: number; height: number }) {
      return ipcRenderer.invoke('clipboard:captureAreaAsDataUrl', rect) as Promise<string>
    },
    renderKatexOffscreen(params: { katexHtml: string; katexCss: string; fontSize: number; padding: number }) {
      return ipcRenderer.invoke('clipboard:renderKatexOffscreen', params) as Promise<string>
    },
  },
  models: {
    fetch(url: string, apiKey: string) {
      return ipcRenderer.invoke('models:fetch', url, apiKey) as Promise<{
        ok: boolean; status?: number; body?: string; error?: string
      }>
    },
  },
  ocr: {
    recognize(imagePath: string, vlmConfig?: { baseUrl: string; apiKey: string; model: string; systemPrompt: string } | null) {
      return ipcRenderer.invoke('ocr:recognize', imagePath, vlmConfig)
    },
    setEnginePath(enginePath: string | null) {
      return ipcRenderer.invoke('ocr:setEnginePath', enginePath)
    },
    getEngineStatus() {
      return ipcRenderer.invoke('ocr:getEngineStatus')
    },
    selectZipFile() {
      return ipcRenderer.invoke('ocr:selectZipFile')
    },
    importEngineZip(zipFilePath: string) {
      return ipcRenderer.invoke('ocr:importEngineZip', zipFilePath)
    },
  },
  pdf: {
    toImages(pdfPath: string) {
      return ipcRenderer.invoke('pdf:toImages', pdfPath)
    },
    cleanup() {
      return ipcRenderer.invoke('pdf:cleanup')
    },
  },
  accel: {
    getStatus() {
      return ipcRenderer.invoke('accel:getStatus')
    },
    checkDx12() {
      return ipcRenderer.invoke('accel:checkDx12')
    },
    selectZipFile() {
      return ipcRenderer.invoke('accel:selectZipFile')
    },
    importPatchZip(zipFilePath: string) {
      return ipcRenderer.invoke('accel:importPatchZip', zipFilePath)
    },
    setPath(enginePath: string | null) {
      return ipcRenderer.invoke('accel:setPath', enginePath)
    },
    getOnnxModelStatus() {
      return ipcRenderer.invoke('onnx:getModelStatus')
    },
    selectOnnxZipFile() {
      return ipcRenderer.invoke('onnx:selectZipFile')
    },
    importOnnxModelZip(zipFilePath: string) {
      return ipcRenderer.invoke('onnx:importModelZip', zipFilePath)
    },
    // GPU 加速包一键导入（合并 DLL + ONNX 模型）
    getGpuStatus() {
      return ipcRenderer.invoke('gpu:getStatus')
    },
    selectGpuZipFile() {
      return ipcRenderer.invoke('gpu:selectZipFile')
    },
    importGpuPack(zipFilePath: string) {
      return ipcRenderer.invoke('gpu:importPack', zipFilePath)
    },
  },
  window: {
    minimize() {
      ipcRenderer.send('window:minimize')
    },
    maximize() {
      ipcRenderer.send('window:maximize')
    },
    close() {
      ipcRenderer.send('window:close')
    },
    isMaximized() {
      return ipcRenderer.invoke('window:isMaximized')
    },
    onMaximizedChange(callback: (isMaximized: boolean) => void) {
      const handler = (_event: Electron.IpcRendererEvent, isMaximized: boolean) => callback(isMaximized)
      ipcRenderer.on('window:maximized', handler)
      return () => ipcRenderer.removeListener('window:maximized', handler)
    },
    openExternal(url: string) {
      return ipcRenderer.invoke('window:openExternal', url)
    },
  },
})
