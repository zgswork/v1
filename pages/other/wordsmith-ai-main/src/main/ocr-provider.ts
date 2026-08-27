import { execFile } from 'node:child_process'
import { accessSync, constants as fsConstants } from 'node:fs'
import { access, constants } from 'node:fs/promises'
import path from 'node:path'
import { app } from 'electron'

// ---------------------------------------------------------------------------
// AcceleratorStatus
// ---------------------------------------------------------------------------

export interface AcceleratorStatus {
  acceleratorInstalled: boolean
  patchLoaded: boolean
  dx12Supported: boolean
  adapterName: string | null
  activeProvider: 'DML' | 'CPU'
  acceleratorPath: string | null
  error: string | null
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OcrResult {
  success: boolean
  markdown: string
  error?: string
}

export interface OcrEngineStatus {
  installed: boolean
  enginePath: string | null
  missingModels: string[]
}

export interface OcrProvider {
  readonly name: string
  recognize(imagePath: string, signal?: AbortSignal): Promise<OcrResult>
  checkAvailability(): Promise<string | null>
}

// ---------------------------------------------------------------------------
// Required model directories
// ---------------------------------------------------------------------------

const REQUIRED_MODELS = [
  'PP-DocBlockLayout',
  'PP-DocLayout_plus-L',
  'PP-FormulaNet_plus-L',
  'PP-LCNet_x1_0_table_cls',
  'PP-OCRv5_server_det',
  'PP-OCRv5_server_rec',
  'RT-DETR-L_wired_table_cell_det',
  'RT-DETR-L_wireless_table_cell_det',
  'SLANet_plus',
  'SLANeXt_wired',
]

// ---------------------------------------------------------------------------
// CpuOcrProvider — PPStructure via embedded Python sidecar
// ---------------------------------------------------------------------------

export class CpuOcrProvider implements OcrProvider {
  readonly name = 'cpu-ppstructure'

  /** Root of the OCR engine (contains python/, site-packages/, paddlex_home/, ocr_cli.py) */
  private enginePath: string | null

  constructor() {
    // Dev mode: auto-detect local ocr_engine/
    const devEngine = path.join(app.getAppPath(), 'ocr_engine')
    try {
      accessSync(path.join(devEngine, 'python', 'python.exe'), fsConstants.R_OK)
      accessSync(path.join(devEngine, 'paddlex_home', 'official_models'), fsConstants.R_OK)
      this.enginePath = devEngine
    } catch {
      this.enginePath = null
    }
  }

  /**
   * Set the OCR engine root path. Called on app startup (from persisted settings)
   * and after user imports the engine zip.
   */
  setEnginePath(enginePath: string | null): void {
    this.enginePath = enginePath
  }

  private get pythonPath(): string {
    return path.join(this.enginePath!, 'python', 'python.exe')
  }

  private get scriptPath(): string {
    return path.join(this.enginePath!, 'ocr_cli.py')
  }

  private get sitePackagesPath(): string {
    return path.join(this.enginePath!, 'site-packages')
  }

  private get paddlexHome(): string {
    return path.join(this.enginePath!, 'paddlex_home')
  }

  /**
   * Validate that a directory is a valid OCR engine root.
   * Checks for python/python.exe, site-packages/, ocr_cli.py, and all required models.
   * Returns list of missing model names (empty = fully valid).
   */
  static async validateEngineDir(dir: string): Promise<string[]> {
    const officialModelsDir = path.join(dir, 'paddlex_home', 'official_models')

    const missing: string[] = []
    for (const model of REQUIRED_MODELS) {
      const paramsFile = path.join(officialModelsDir, model, 'inference.pdiparams')
      try {
        await access(paramsFile, constants.R_OK)
      } catch {
        missing.push(model)
      }
    }
    return missing
  }

  /**
   * Check if a directory has the basic OCR engine runtime files.
   */
  static async hasRuntime(dir: string): Promise<boolean> {
    try {
      await access(path.join(dir, 'python', 'python.exe'), constants.R_OK)
      await access(path.join(dir, 'site-packages'), constants.R_OK)
      await access(path.join(dir, 'ocr_cli.py'), constants.R_OK)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get current OCR engine installation status.
   */
  async getEngineStatus(): Promise<OcrEngineStatus> {
    if (!this.enginePath) {
      return { installed: false, enginePath: null, missingModels: REQUIRED_MODELS }
    }
    const missing = await CpuOcrProvider.validateEngineDir(this.enginePath)
    return {
      installed: missing.length === 0,
      enginePath: this.enginePath,
      missingModels: missing,
    }
  }

  recognize(imagePath: string, signal?: AbortSignal): Promise<OcrResult> {
    return new Promise((resolve) => {
      if (!this.enginePath) {
        resolve({ success: false, markdown: '', error: 'OCR_ENGINE_NOT_INSTALLED' })
        return
      }

      if (signal?.aborted) {
        resolve({ success: false, markdown: '', error: 'Cancelled.' })
        return
      }

      const env = {
        ...process.env,
        PYTHONPATH: this.sitePackagesPath,
        PADDLEX_HOME: this.paddlexHome,
        PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK: 'True',
      }

      const child = execFile(
        this.pythonPath,
        [this.scriptPath, imagePath],
        {
          timeout: 120_000,
          maxBuffer: 10 * 1024 * 1024,
          windowsHide: true,
          env,
        },
        (error, stdout) => {
          if (error) {
            if ((error as Error & { killed?: boolean }).killed) {
              const msg = error.message?.includes('TIMEOUT')
                ? 'OCR timed out (120s limit).'
                : 'OCR process was cancelled.'
              resolve({ success: false, markdown: '', error: msg })
              return
            }
            if (stdout) {
              try {
                const parsed = JSON.parse(stdout)
                resolve({
                  success: false,
                  markdown: '',
                  error: parsed.error || 'OCR process error.',
                })
                return
              } catch {
                // fall through
              }
            }
            resolve({
              success: false,
              markdown: '',
              error: `OCR process error: ${error.message}`,
            })
            return
          }

          try {
            const parsed = JSON.parse(stdout)
            resolve({
              success: !!parsed.success,
              markdown: parsed.markdown ?? '',
              error: parsed.error,
            })
          } catch {
            resolve({
              success: false,
              markdown: '',
              error: 'Failed to parse OCR output.',
            })
          }
        },
      )

      if (signal) {
        const onAbort = () => {
          child.kill()
        }
        signal.addEventListener('abort', onAbort, { once: true })
        child.on('exit', () => {
          signal.removeEventListener('abort', onAbort)
        })
      }
    })
  }

  async checkAvailability(): Promise<string | null> {
    if (!this.enginePath) {
      return 'OCR engine not installed.'
    }

    try {
      await access(this.pythonPath, constants.X_OK)
    } catch {
      return `Embedded Python not found at: ${this.pythonPath}`
    }

    try {
      await access(this.sitePackagesPath, constants.R_OK)
    } catch {
      return `Site-packages not found at: ${this.sitePackagesPath}`
    }

    return null
  }
}

// ---------------------------------------------------------------------------
// ONNX 模型状态
// ---------------------------------------------------------------------------

export interface OnnxModelStatus {
  installed: boolean
  modelPath: string | null
  missingFiles: string[]
}

// ---------------------------------------------------------------------------
// OnnxPipelineProvider — 模块化 ONNX OCR 流水线（DirectML 加速）
// ---------------------------------------------------------------------------

/** 流水线所需的模型文件（哨兵: layout_det.onnx）
/** 流水线必需文件（表格检测模型 table_wired_det/table_wireless_det 为可选增强，不列入） */
const PIPELINE_REQUIRED_FILES = [
  'layout_det.onnx',
  'text_det.onnx',
  'text_rec.onnx',
  'ppocr_keys_v1.txt',
]
const PIPELINE_SENTINEL = 'layout_det.onnx'

export class OnnxPipelineProvider implements OcrProvider {
  readonly name = 'onnx-pipeline'

  /** 与 CpuOcrProvider 共享的引擎路径 */
  private enginePath: string | null

  constructor() {
    const devEngine = path.join(app.getAppPath(), 'ocr_engine')
    try {
      accessSync(path.join(devEngine, 'python', 'python.exe'), fsConstants.R_OK)
      this.enginePath = devEngine
    } catch {
      this.enginePath = null
    }
  }

  setEnginePath(enginePath: string | null): void {
    this.enginePath = enginePath
  }

  getEnginePath(): string | null {
    return this.enginePath
  }

  private get pythonPath(): string {
    return path.join(this.enginePath!, 'python', 'python.exe')
  }

  private get scriptPath(): string {
    return path.join(this.enginePath!, 'onnx_pipeline.py')
  }

  private get sitePackagesPath(): string {
    return path.join(this.enginePath!, 'site-packages')
  }

  /** 流水线模型候选路径 */
  private get pipelineCandidates(): string[] {
    if (!this.enginePath) return []
    return [
      path.join(this.enginePath, 'onnx_models', 'pipeline'),
      path.join(this.enginePath, 'onnx_models'),
    ]
  }

  /**
   * 搜索流水线模型目录，返回找到的路径或 null。
   * 哨兵文件: layout_det.onnx
   */
  async findPipelineModelDir(): Promise<string | null> {
    for (const dir of this.pipelineCandidates) {
      try {
        await access(path.join(dir, PIPELINE_SENTINEL), constants.R_OK)
        return dir
      } catch {
        // 继续检查下一个候选
      }
    }
    return null
  }

  /**
   * 获取流水线模型安装状态。
   */
  async getOnnxModelStatus(): Promise<OnnxModelStatus> {
    if (!this.enginePath) {
      return { installed: false, modelPath: null, missingFiles: PIPELINE_REQUIRED_FILES }
    }
    const modelDir = await this.findPipelineModelDir()
    if (!modelDir) {
      return { installed: false, modelPath: null, missingFiles: PIPELINE_REQUIRED_FILES }
    }
    const missing = await OnnxPipelineProvider.validatePipelineModelDir(modelDir)
    return {
      installed: missing.length === 0,
      modelPath: modelDir,
      missingFiles: missing,
    }
  }

  /**
   * 校验流水线模型目录，返回缺失文件列表。
   */
  static async validatePipelineModelDir(dir: string): Promise<string[]> {
    const missing: string[] = []
    for (const file of PIPELINE_REQUIRED_FILES) {
      try {
        await access(path.join(dir, file), constants.R_OK)
      } catch {
        missing.push(file)
      }
    }
    return missing
  }

  /**
   * 快速判断目录下是否有 layout_det.onnx（哨兵文件）。
   */
  static async hasPipelineModel(dir: string): Promise<boolean> {
    try {
      await access(path.join(dir, PIPELINE_SENTINEL), constants.R_OK)
      return true
    } catch {
      return false
    }
  }

  /**
   * 流水线模型的默认安装路径。
   */
  get onnxModelInstallDir(): string | null {
    if (!this.enginePath) return null
    return path.join(this.enginePath, 'onnx_models', 'pipeline')
  }

  /**
   * 检查推理链路是否完整（脚本 + 模型 + onnxruntime 运行时）。
   */
  async isAvailable(): Promise<boolean> {
    if (!this.enginePath) return false

    try {
      await access(this.scriptPath, constants.R_OK)
    } catch {
      return false
    }

    try {
      await access(path.join(this.sitePackagesPath, 'onnxruntime'), constants.R_OK)
    } catch {
      return false
    }

    const modelDir = await this.findPipelineModelDir()
    return modelDir !== null
  }

  recognize(imagePath: string, signal?: AbortSignal): Promise<OcrResult> {
    return new Promise((resolve) => {
      if (!this.enginePath) {
        resolve({ success: false, markdown: '', error: 'OCR_ENGINE_NOT_INSTALLED' })
        return
      }

      if (signal?.aborted) {
        resolve({ success: false, markdown: '', error: 'Cancelled.' })
        return
      }

      const env = {
        ...process.env,
        PYTHONPATH: this.sitePackagesPath,
      }

      const child = execFile(
        this.pythonPath,
        [this.scriptPath, imagePath, '--engine-path', this.enginePath!],
        {
          timeout: 120_000,
          maxBuffer: 10 * 1024 * 1024,
          windowsHide: true,
          env,
        },
        (error, stdout) => {
          if (error) {
            if ((error as Error & { killed?: boolean }).killed) {
              const msg = error.message?.includes('TIMEOUT')
                ? 'ONNX Pipeline timed out (120s limit).'
                : 'ONNX Pipeline process was cancelled.'
              resolve({ success: false, markdown: '', error: msg })
              return
            }
            if (stdout) {
              try {
                const parsed = JSON.parse(stdout)
                resolve({
                  success: false,
                  markdown: '',
                  error: parsed.error || 'ONNX Pipeline process error.',
                })
                return
              } catch {
                // fall through
              }
            }
            resolve({
              success: false,
              markdown: '',
              error: `ONNX Pipeline process error: ${error.message}`,
            })
            return
          }

          try {
            const parsed = JSON.parse(stdout)
            resolve({
              success: !!parsed.success,
              markdown: parsed.markdown ?? '',
              error: parsed.error,
            })
          } catch {
            resolve({
              success: false,
              markdown: '',
              error: 'Failed to parse ONNX Pipeline output.',
            })
          }
        },
      )

      if (signal) {
        const onAbort = () => {
          child.kill()
        }
        signal.addEventListener('abort', onAbort, { once: true })
        child.on('exit', () => {
          signal.removeEventListener('abort', onAbort)
        })
      }
    })
  }

  async checkAvailability(): Promise<string | null> {
    if (!this.enginePath) {
      return 'OCR engine not installed.'
    }

    try {
      await access(this.pythonPath, constants.X_OK)
    } catch {
      return `Embedded Python not found at: ${this.pythonPath}`
    }

    const available = await this.isAvailable()
    if (!available) {
      return 'ONNX pipeline models not found.'
    }

    return null
  }
}

// ---------------------------------------------------------------------------
// AccelerationManager — ONNX Runtime + DirectML 加速管理
// ---------------------------------------------------------------------------

const REQUIRED_ACCEL_DLLS = ['DirectML.dll']

// ---------------------------------------------------------------------------
// GpuPackStatus — 聚合 GPU 加速包状态（DLL + ONNX 模型）
// ---------------------------------------------------------------------------

export interface GpuPackStatus {
  /** 加速补丁（DirectML DLL）是否已安装 */
  acceleratorInstalled: boolean
  /** ONNX 模型是否已安装 */
  onnxModelInstalled: boolean
  /** 两者都安装 = 完全就绪 */
  ready: boolean
  /** 显卡名称 */
  adapterName: string | null
  /** 当前推理后端 */
  activeProvider: 'DML' | 'CPU'
  /** 缺失的 DLL 文件 */
  missingDlls: string[]
  /** 缺失的 ONNX 模型文件 */
  missingOnnxFiles: string[]
  /** 错误信息 */
  error: string | null
}

export class AccelerationManager {
  /** 与 CpuOcrProvider 共享的引擎路径 */
  private enginePath: string | null

  constructor() {
    // Dev mode: 自动检测本地 ocr_engine/
    const devEngine = path.join(app.getAppPath(), 'ocr_engine')
    try {
      accessSync(path.join(devEngine, 'python', 'python.exe'), fsConstants.R_OK)
      this.enginePath = devEngine
    } catch {
      this.enginePath = null
    }
  }

  setEnginePath(enginePath: string | null): void {
    this.enginePath = enginePath
  }

  /** accelerator 目录: enginePath 同级的 accelerator/ */
  get acceleratorPath(): string | null {
    if (!this.enginePath) return null
    return path.join(this.enginePath, '..', 'accelerator')
  }

  /**
   * 通过 PowerShell 查询 Win32_VideoController 获取真实显卡信息，
   * 过滤虚拟显示适配器（远程桌面、GameViewer 等），
   * 纯 Node.js 实现，不依赖 hw_accel.py。
   */
  private queryGpu(): Promise<{ supported: boolean; adapter: string | null; error: string | null }> {
    return new Promise((resolve) => {
      // 查询所有显卡，返回 Name 数组
      const psCmd = 'Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name | ConvertTo-Json'
      execFile(
        'powershell.exe',
        ['-NoProfile', '-NoLogo', '-Command', psCmd],
        { timeout: 15_000, windowsHide: true },
        (error, stdout) => {
          if (error) {
            resolve({ supported: false, adapter: null, error: `查询显卡失败: ${error.message}` })
            return
          }
          try {
            const raw = JSON.parse(stdout.trim())
            // PowerShell 单项时返回字符串，多项时返回数组
            const names: string[] = Array.isArray(raw) ? raw : [raw]

            // 过滤虚拟/软件适配器
            const VIRTUAL_KEYWORDS = ['Virtual', 'Basic Render', 'Microsoft Basic', 'Remote', 'GameViewer']
            const realGpus = names.filter((n) =>
              typeof n === 'string' && !VIRTUAL_KEYWORDS.some((kw) => n.includes(kw))
            )

            if (realGpus.length > 0) {
              resolve({ supported: true, adapter: realGpus[0], error: null })
              return
            }
            // 没有真实显卡
            const allNames = names.filter(Boolean).join(', ')
            resolve({
              supported: false,
              adapter: allNames || null,
              error: allNames
                ? `仅检测到虚拟/软件适配器 (${allNames})，不支持 DirectML`
                : '未检测到显卡适配器',
            })
          } catch {
            resolve({ supported: false, adapter: null, error: '无法解析显卡信息' })
          }
        },
      )
    })
  }

  /**
   * 获取综合加速状态（纯 Node.js，不依赖 Python 脚本）。
   */
  async getStatus(): Promise<AcceleratorStatus> {
    if (!this.enginePath) {
      return {
        acceleratorInstalled: false,
        patchLoaded: false,
        dx12Supported: false,
        adapterName: null,
        activeProvider: 'CPU',
        acceleratorPath: null,
        error: null,
      }
    }

    // 检查加速补丁 DLL
    const accelDir = this.acceleratorPath!
    const validation = await AccelerationManager.validateAcceleratorDir(accelDir)
    const accelInstalled = validation.valid

    // 查询显卡
    const gpuInfo = await this.queryGpu()

    // 检查 onnxruntime 是否安装（DML 推理的必要条件）
    let onnxrtInstalled = false
    try {
      await access(path.join(this.enginePath, 'site-packages', 'onnxruntime'), constants.R_OK)
      onnxrtInstalled = true
    } catch {
      // onnxruntime 未安装
    }

    const canDml = accelInstalled && gpuInfo.supported && onnxrtInstalled

    return {
      acceleratorInstalled: accelInstalled,
      patchLoaded: accelInstalled,
      dx12Supported: gpuInfo.supported,
      adapterName: gpuInfo.adapter,
      activeProvider: canDml ? 'DML' : 'CPU',
      acceleratorPath: accelInstalled ? accelDir : null,
      error: gpuInfo.error,
    }
  }

  /**
   * 检测 DirectX 12 兼容性（纯 Node.js，不依赖 Python 脚本）。
   */
  async checkDx12(): Promise<{ supported: boolean; adapter: string | null; error: string | null }> {
    return this.queryGpu()
  }

  /**
   * 校验加速补丁目录是否包含必要的 DLL 文件。
   */
  static async validateAcceleratorDir(dir: string): Promise<{ valid: boolean; missingFiles: string[] }> {
    const missing: string[] = []
    for (const dll of REQUIRED_ACCEL_DLLS) {
      try {
        await access(path.join(dir, dll), constants.R_OK)
      } catch {
        missing.push(dll)
      }
    }
    return { valid: missing.length === 0, missingFiles: missing }
  }

  /**
   * 快速判断目录下是否存在 DirectML.dll。
   */
  static async hasAccelerator(dir: string): Promise<boolean> {
    try {
      await access(path.join(dir, 'DirectML.dll'), constants.R_OK)
      return true
    } catch {
      return false
    }
  }
}
