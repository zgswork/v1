/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * The built directory structure
     *
     * ```tree
     * ├─┬─┬ dist
     * │ │ └── index.html
     * │ │
     * │ ├─┬ dist-electron
     * │ │ ├── main.js
     * │ │ └── preload.js
     * │
     * ```
     */
    APP_ROOT: string
    /** /dist/ or /public/ */
    VITE_PUBLIC: string
  }
}

// Used in Renderer process, expose in `preload.ts`

interface OcrEngineStatus {
  installed: boolean
  enginePath: string | null
  missingModels: string[]
}

interface AcceleratorStatus {
  acceleratorInstalled: boolean
  patchLoaded: boolean
  dx12Supported: boolean
  adapterName: string | null
  activeProvider: 'DML' | 'CPU'
  acceleratorPath: string | null
  error: string | null
}

interface OnnxModelStatus {
  installed: boolean
  modelPath: string | null
  missingFiles: string[]
}

interface GpuPackStatus {
  acceleratorInstalled: boolean
  onnxModelInstalled: boolean
  ready: boolean
  adapterName: string | null
  activeProvider: 'DML' | 'CPU'
  missingDlls: string[]
  missingOnnxFiles: string[]
  error: string | null
}

interface Window {
  wordsmith?: {
    clipboard: {
      write: (payload: { html: string; text: string }) => Promise<void>
      writeImage: (dataUrl: string) => Promise<void>
      captureArea: (rect: { x: number; y: number; width: number; height: number }, transparent?: boolean) => Promise<boolean>
      captureAreaAsDataUrl: (rect: { x: number; y: number; width: number; height: number }) => Promise<string>
      renderKatexOffscreen: (params: { katexHtml: string; katexCss: string; fontSize: number; padding: number }) => Promise<string>
    }
    models: {
      fetch: (url: string, apiKey: string) => Promise<{
        ok: boolean
        status?: number
        body?: string
        error?: string
      }>
    }
    ocr: {
      recognize: (imagePath: string, vlmConfig?: {
        baseUrl: string
        apiKey: string
        model: string
        systemPrompt: string
      } | null) => Promise<{
        success: boolean
        markdown: string
        error?: string
      }>
      setEnginePath: (enginePath: string | null) => Promise<void>
      getEngineStatus: () => Promise<OcrEngineStatus>
      selectZipFile: () => Promise<string | null>
      importEngineZip: (zipFilePath: string) => Promise<{
        success: boolean
        enginePath?: string
        error?: string
      }>
    }
    pdf: {
      toImages: (pdfPath: string) => Promise<{
        success: boolean
        pages?: string[]
        pageCount?: number
        error?: string
      }>
      cleanup: () => Promise<void>
    }
    accel: {
      getStatus: () => Promise<AcceleratorStatus>
      checkDx12: () => Promise<{
        supported: boolean
        adapter: string | null
        error: string | null
      }>
      selectZipFile: () => Promise<string | null>
      importPatchZip: (zipFilePath: string) => Promise<{
        success: boolean
        acceleratorPath?: string
        error?: string
      }>
      setPath: (enginePath: string | null) => Promise<void>
      getOnnxModelStatus: () => Promise<OnnxModelStatus>
      selectOnnxZipFile: () => Promise<string | null>
      importOnnxModelZip: (zipFilePath: string) => Promise<{
        success: boolean
        modelPath?: string
        error?: string
      }>
      getGpuStatus: () => Promise<GpuPackStatus>
      selectGpuZipFile: () => Promise<string | null>
      importGpuPack: (zipFilePath: string) => Promise<{
        success: boolean
        error?: string
      }>
    }
    window: {
      minimize: () => void
      maximize: () => void
      close: () => void
      isMaximized: () => Promise<boolean>
      onMaximizedChange: (callback: (isMaximized: boolean) => void) => () => void
      openExternal: (url: string) => Promise<void>
    }
  }
}
