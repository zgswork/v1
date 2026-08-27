import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, nativeImage, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { mkdir, rm, rename, readdir, copyFile, cp, access, constants as fsConst } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { tmpdir } from 'node:os'
import extract from 'extract-zip'
import { CpuOcrProvider, OnnxPipelineProvider, AccelerationManager, type OcrResult, type OcrEngineStatus, type OnnxModelStatus, type AcceleratorStatus, type GpuPackStatus } from './ocr-provider'
import { VlmProvider, type VlmOcrConfig } from './vlm-provider'

// ---------------------------------------------------------------------------
// 快速解压: 优先用 Windows 原生 tar.exe（C 二进制，比纯 JS yauzl 快数倍）
// ---------------------------------------------------------------------------
const SYSTEM_TAR = 'C:\\Windows\\System32\\tar.exe'

async function fastExtract(zipPath: string, destDir: string): Promise<void> {
  // 检测系统 tar.exe 是否存在
  try {
    await access(SYSTEM_TAR, fsConst.R_OK)
  } catch {
    // 无系统 tar，回退纯 JS 解压
    await extract(zipPath, { dir: destDir })
    return
  }

  // 用系统 tar.exe 解压（Windows 10 1803+ 自带，支持 zip 格式）
  return new Promise((resolve, reject) => {
    execFile(
      SYSTEM_TAR,
      ['-xf', zipPath, '-C', destDir],
      { timeout: 600000, maxBuffer: 10 * 1024 * 1024 },
      (error) => {
        if (error) {
          // tar 失败（极罕见），回退纯 JS
          console.warn('[fastExtract] tar.exe failed, falling back to extract-zip:', error.message)
          extract(zipPath, { dir: destDir }).then(resolve).catch(reject)
        } else {
          resolve()
        }
      },
    )
  })
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function normalizeDevServerUrl(url: string): string {
  try {
    const u = new URL(url)
    if (u.hostname === 'localhost') u.hostname = '127.0.0.1'
    return u.toString()
  } catch {
    return url
  }
}

async function loadUrlWithRetry(win: BrowserWindow, url: string, retries = 20, delay = 1000) {
  let attempt = 0
  while (attempt < retries) {
    try {
      const normalized = normalizeDevServerUrl(url)
      console.log(`[Main] Attempting to load URL: ${normalized} (Attempt ${attempt + 1}/${retries})`)
      await win.loadURL(normalized)
      console.log(`[Main] Successfully loaded URL: ${normalized}`)
      return
    } catch (error) {
      const err = error as Error
      console.error(`[Main] Failed to load URL: ${url}. Error: ${err.message}`)
      attempt++
      if (attempt < retries) {
        console.log(`[Main] Retrying in ${delay}ms...`)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }
  console.error(`[Main] Failed to load URL after ${retries} attempts.`)
  // Fallback to local file if remote load fails completely
  try {
    console.log('[Main] Falling back to local file...')
    await win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  } catch (e) {
    console.error('[Main] Failed to fallback to local file.', e)
  }
}

// Clipboard IPC
ipcMain.handle('clipboard:write', async (_event, payload: { html: string; text: string }) => {
  clipboard.write({
    html: payload.html,
    text: payload.text,
  })
})

ipcMain.handle('clipboard:writeImage', async (_event, dataUrl: string) => {
  const image = nativeImage.createFromDataURL(dataUrl)
  clipboard.writeImage(image)
})

ipcMain.handle('clipboard:captureArea', async (event, rect: { x: number; y: number; width: number; height: number }, transparent?: boolean) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) return false
  const image = await win.webContents.capturePage(rect)
  if (transparent) {
    // 白色/近白色像素设为透明（BGRA 格式）
    const size = image.getSize()
    const bitmap = image.toBitmap()
    for (let i = 0; i < bitmap.length; i += 4) {
      const b = bitmap[i], g = bitmap[i + 1], r = bitmap[i + 2]
      if (r > 240 && g > 240 && b > 240) {
        bitmap[i + 3] = 0
      }
    }
    const result = nativeImage.createFromBitmap(Buffer.from(bitmap), { width: size.width, height: size.height })
    clipboard.writeImage(result)
  } else {
    clipboard.writeImage(image)
  }
  return true
})

// 截取区域并返回 data URL（不写入剪贴板，用于渲染器侧后处理）
ipcMain.handle('clipboard:captureAreaAsDataUrl', async (event, rect: { x: number; y: number; width: number; height: number }) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) throw new Error('No window')
  const image = await win.webContents.capturePage(rect)
  return image.toDataURL()
})

// 离屏渲染 KaTeX 公式（零闪烁）— 在不可见窗口中渲染并截图
let _offscreenWin: BrowserWindow | null = null

ipcMain.handle('clipboard:renderKatexOffscreen', async (_event, params: {
  katexHtml: string
  katexCss: string
  fontSize: number
  padding: number
}) => {
  // 懒创建离屏窗口，复用以避免重复创建开销
  if (!_offscreenWin || _offscreenWin.isDestroyed()) {
    _offscreenWin = new BrowserWindow({
      show: false,
      width: 2000,
      height: 1000,
      webPreferences: { webSecurity: false },
    })
    await _offscreenWin.loadURL('about:blank')
  }

  const offWin = _offscreenWin

  // 注入 KaTeX CSS（含绝对字体 URL）+ 公式 HTML
  await offWin.webContents.insertCSS(params.katexCss)
  const rect: { x: number; y: number; width: number; height: number } = await offWin.webContents.executeJavaScript(`
    (() => {
      document.body.innerHTML = '';
      document.body.style.cssText = 'margin:0;padding:0;background:white;overflow:visible;';
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'padding:${params.padding}px;font-size:${params.fontSize}px;line-height:1.2;display:inline-block;background:white;';
      wrapper.innerHTML = ${JSON.stringify(params.katexHtml)};
      document.body.appendChild(wrapper);
      const el = wrapper.querySelector('.katex-display') || wrapper.querySelector('.katex') || wrapper;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
    })()
  `)

  // 等待字体加载 + 渲染完成
  await offWin.webContents.executeJavaScript('document.fonts.ready')
  await new Promise(r => setTimeout(r, 100))

  const pad = 8
  const captureRect = {
    x: Math.max(0, rect.x - pad),
    y: Math.max(0, rect.y - pad),
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  }
  const image = await offWin.webContents.capturePage(captureRect)
  return image.toDataURL()
})

// Models fetch IPC — 在主进程发起 HTTP 请求，绕过渲染进程 CORS 限制
ipcMain.handle('models:fetch', async (_event, url: string, apiKey: string): Promise<{ ok: boolean; status?: number; body?: string; error?: string }> => {
  try {
    const headers: Record<string, string> = {}
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`
    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(15000),
    })
    const body = await response.text()
    console.log(`[Models] GET ${url} → ${response.status} (${body.length} bytes)`)
    return { ok: response.ok, status: response.status, body }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[Models] GET ${url} FAILED: ${msg}`)
    return { ok: false, error: msg }
  }
})

// OCR IPC
const ocrProvider = new CpuOcrProvider()
const onnxPipelineProvider = new OnnxPipelineProvider()
const vlmProvider = new VlmProvider()
const accelManager = new AccelerationManager()

ipcMain.handle('ocr:recognize', async (_event, imagePath: string, vlmConfig?: VlmOcrConfig | null): Promise<OcrResult> => {
  try {
    if (!imagePath || typeof imagePath !== 'string') {
      return { success: false, markdown: '', error: 'Invalid image path.' }
    }
    // 1. VLM 云端优先：配置有效时使用 VLM API
    if (vlmConfig && vlmConfig.apiKey && vlmConfig.baseUrl && vlmConfig.model) {
      return await vlmProvider.recognize(imagePath, vlmConfig)
    }
    // 2. ONNX Pipeline + DirectML 加速：模型文件存在时使用模块化 ONNX 推理
    if (await onnxPipelineProvider.isAvailable()) {
      const result = await onnxPipelineProvider.recognize(imagePath)
      // ONNX Pipeline 失败时自动回退 CPU PPStructure
      if (!result.success) {
        console.warn(`[OCR] ONNX Pipeline 推理失败 (${result.error})，回退 CPU...`)
        return await ocrProvider.recognize(imagePath)
      }
      return result
    }
    // 3. CPU PPStructureV3 兜底
    return await ocrProvider.recognize(imagePath)
  } catch (err) {
    return { success: false, markdown: '', error: err instanceof Error ? err.message : 'Unknown error' }
  }
})

ipcMain.handle('ocr:setEnginePath', async (_event, enginePath: string | null): Promise<void> => {
  ocrProvider.setEnginePath(enginePath)
  onnxPipelineProvider.setEnginePath(enginePath)
  accelManager.setEnginePath(enginePath)
  // 自动部署 GPU 推理所需的 Python 脚本（兼容旧版 OCR 引擎 zip）
  if (enginePath) {
    ensureOcrScripts(enginePath).catch(() => {})
  }
})

ipcMain.handle('ocr:getEngineStatus', async (): Promise<OcrEngineStatus> => {
  return ocrProvider.getEngineStatus()
})

ipcMain.handle('ocr:selectZipFile', async (): Promise<string | null> => {
  const result = await dialog.showOpenDialog({
    title: '选择 OCR 引擎压缩包',
    filters: [{ name: 'ZIP 压缩包', extensions: ['zip'] }],
    properties: ['openFile'],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

ipcMain.handle('ocr:importEngineZip', async (_event, zipPath: string): Promise<{ success: boolean; enginePath?: string; error?: string }> => {
  // OCR 引擎存放在安装目录下，而不是 C 盘 AppData
  const appDir = VITE_DEV_SERVER_URL
    ? process.env.APP_ROOT               // 开发模式：项目根目录
    : path.dirname(app.getPath('exe'))    // 生产模式：exe 所在目录
  const tempDir = path.join(appDir, 'ocr_engine_temp')
  const finalDir = path.join(appDir, 'ocr_engine')

  try {
    // 1. Clean up any previous temp directory
    await rm(tempDir, { recursive: true, force: true })

    // 2. Create temp directory
    await mkdir(tempDir, { recursive: true })

    // 3. Extract zip to temp (优先用系统 tar.exe 加速)
    await fastExtract(zipPath, tempDir)

    // 4. Resolve the actual engine root (find python/ + paddlex_home/)
    const engineRoot = await resolveEngineRoot(tempDir)
    if (!engineRoot) {
      await rm(tempDir, { recursive: true, force: true })
      return { success: false, error: '压缩包结构不正确：未找到 OCR 引擎文件。请确认压缩包包含 python/、site-packages/ 和 paddlex_home/ 目录。' }
    }

    // 5. Validate models
    const missing = await CpuOcrProvider.validateEngineDir(engineRoot)
    if (missing.length > 0) {
      await rm(tempDir, { recursive: true, force: true })
      return { success: false, error: `模型文件不完整，缺少以下模型：${missing.join(', ')}` }
    }

    // 6. Remove old engine
    await rm(finalDir, { recursive: true, force: true })

    // 7. Move resolved engine root to final location
    await rename(engineRoot, finalDir)

    // 8. Ensure func_ret directory exists (paddlex needs it)
    await mkdir(path.join(finalDir, 'paddlex_home', 'func_ret'), { recursive: true })

    // 9. Clean up temp
    await rm(tempDir, { recursive: true, force: true })

    // 10. Update provider
    ocrProvider.setEnginePath(finalDir)
    onnxPipelineProvider.setEnginePath(finalDir)
    accelManager.setEnginePath(finalDir)

    // 11. 自动部署 GPU 推理脚本
    await ensureOcrScripts(finalDir)

    return { success: true, enginePath: finalDir }
  } catch (err) {
    // Clean up temp on any failure
    await rm(tempDir, { recursive: true, force: true }).catch(() => {})
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: `导入失败：${message}` }
  }
})

/**
 * 确保 OCR 引擎目录包含 GPU 推理所需的 Python 脚本。
 * 若脚本缺失（旧版 zip 未打包），从 app 资源中自动复制。
 * 生产模式: resources/ocr-scripts/
 * 开发模式: 项目根目录 ocr_engine/
 */
const OCR_SCRIPTS = ['onnx_engine.py', 'hw_accel.py', 'onnx_pipeline.py', 'pdf_converter.py']

async function ensureOcrScripts(enginePath: string): Promise<void> {
  const scriptsSource = VITE_DEV_SERVER_URL
    ? path.join(process.env.APP_ROOT!, 'ocr_engine')
    : path.join(process.resourcesPath, 'ocr-scripts')

  for (const script of OCR_SCRIPTS) {
    const dest = path.join(enginePath, script)
    try {
      await access(dest, fsConst.R_OK)
    } catch {
      // 目标文件缺失，从 app 资源复制
      const src = path.join(scriptsSource, script)
      try {
        await copyFile(src, dest)
        console.log(`[OCR] 已部署脚本: ${script}`)
      } catch {
        console.warn(`[OCR] 无法部署脚本 ${script}（源文件可能不存在）`)
      }
    }
  }
}

/**
 * Find the OCR engine root within the extracted temp dir.
 * The engine root is a directory containing python/, site-packages/, and paddlex_home/.
 * Tries:
 *   - temp/ directly (ocr_engine contents at top level)
 *   - temp/ocr_engine/
 *   - temp/<single-wrapper>/ (any single subdirectory)
 */
async function resolveEngineRoot(tempDir: string): Promise<string | null> {
  // Check if a directory is a valid engine root
  if (await CpuOcrProvider.hasRuntime(tempDir)) return tempDir

  // Try temp/ocr_engine/
  const ocrEngineSub = path.join(tempDir, 'ocr_engine')
  if (await CpuOcrProvider.hasRuntime(ocrEngineSub)) return ocrEngineSub

  // Try single-level wrapper
  try {
    const entries = await readdir(tempDir, { withFileTypes: true })
    const dirs = entries.filter(e => e.isDirectory())
    if (dirs.length === 1) {
      const wrapperDir = path.join(tempDir, dirs[0].name)
      if (await CpuOcrProvider.hasRuntime(wrapperDir)) return wrapperDir
    }
  } catch {
    // ignore readdir errors
  }

  return null
}

// PDF → 图片转换 IPC
let pdfTempDir: string | null = null

ipcMain.handle('pdf:toImages', async (_event, pdfPath: string): Promise<{
  success: boolean
  pages?: string[]
  pageCount?: number
  error?: string
}> => {
  // 查找 Python 和 pdf_converter.py
  const enginePath = onnxPipelineProvider.getEnginePath()
  if (!enginePath) {
    return { success: false, error: 'OCR 引擎未安装，无法转换 PDF。' }
  }

  const pythonExe = path.join(enginePath, 'python', 'python.exe')
  const scriptPath = path.join(enginePath, 'pdf_converter.py')

  try {
    await access(pythonExe, fsConst.R_OK)
  } catch {
    return { success: false, error: 'Python 运行时未找到。' }
  }
  try {
    await access(scriptPath, fsConst.R_OK)
  } catch {
    return { success: false, error: 'pdf_converter.py 脚本未找到。' }
  }

  // 创建临时目录
  const tempBase = path.join(tmpdir(), 'wordsmith-pdf')
  const outputDir = path.join(tempBase, `pdf_${Date.now()}`)
  await mkdir(outputDir, { recursive: true })
  pdfTempDir = outputDir

  const sitePackages = path.join(enginePath, 'site-packages')

  return new Promise((resolve) => {
    execFile(
      pythonExe,
      [scriptPath, pdfPath, '--output-dir', outputDir],
      {
        env: { ...process.env, PYTHONPATH: sitePackages },
        timeout: 300000, // 5 分钟
        maxBuffer: 10 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (stderr) {
          console.log(`[PDF] stderr: ${stderr}`)
        }
        if (error) {
          console.error(`[PDF] execFile error:`, error.message)
          resolve({ success: false, error: `PDF 转换失败: ${error.message}` })
          return
        }
        try {
          const result = JSON.parse(stdout.trim())
          resolve(result)
        } catch {
          resolve({ success: false, error: `PDF 输出解析失败: ${stdout.slice(0, 200)}` })
        }
      },
    )
  })
})

ipcMain.handle('pdf:cleanup', async (): Promise<void> => {
  if (pdfTempDir) {
    await rm(pdfTempDir, { recursive: true, force: true }).catch(() => {})
    pdfTempDir = null
  }
})

// Acceleration IPC
ipcMain.handle('accel:getStatus', async (): Promise<AcceleratorStatus> => {
  return accelManager.getStatus()
})

ipcMain.handle('accel:checkDx12', async () => {
  return accelManager.checkDx12()
})

ipcMain.handle('accel:selectZipFile', async (): Promise<string | null> => {
  const result = await dialog.showOpenDialog({
    title: '选择加速补丁压缩包',
    filters: [{ name: 'ZIP 压缩包', extensions: ['zip'] }],
    properties: ['openFile'],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

ipcMain.handle('accel:importPatchZip', async (_event, zipPath: string): Promise<{ success: boolean; acceleratorPath?: string; error?: string }> => {
  const appDir = VITE_DEV_SERVER_URL
    ? process.env.APP_ROOT
    : path.dirname(app.getPath('exe'))
  const tempDir = path.join(appDir, 'accelerator_temp')
  const finalDir = path.join(appDir, 'accelerator')

  try {
    // 1. 清理旧临时目录
    await rm(tempDir, { recursive: true, force: true })

    // 2. 创建临时目录
    await mkdir(tempDir, { recursive: true })

    // 3. 解压 zip
    await fastExtract(zipPath, tempDir)

    // 4. 查找含 DirectML.dll 的根目录
    const accelRoot = await resolveAcceleratorRoot(tempDir)
    if (!accelRoot) {
      await rm(tempDir, { recursive: true, force: true })
      return { success: false, error: '压缩包结构不正确：未找到 DirectML.dll。请确认压缩包包含加速补丁文件。' }
    }

    // 5. 校验必要 DLL
    const validation = await AccelerationManager.validateAcceleratorDir(accelRoot)
    if (!validation.valid) {
      await rm(tempDir, { recursive: true, force: true })
      return { success: false, error: `缺少必要文件：${validation.missingFiles.join(', ')}` }
    }

    // 6. 删除旧加速目录
    await rm(finalDir, { recursive: true, force: true })

    // 7. 移动到最终位置
    await rename(accelRoot, finalDir)

    // 8. 清理临时目录
    await rm(tempDir, { recursive: true, force: true })

    // 9. 更新内存状态（引擎路径不变，加速目录由 acceleratorPath getter 推导）
    // accelManager 的 enginePath 已经在 ocr:setEnginePath 或启动时设置过

    return { success: true, acceleratorPath: finalDir }
  } catch (err) {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {})
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: `导入失败：${message}` }
  }
})

ipcMain.handle('accel:setPath', async (_event, enginePath: string | null): Promise<void> => {
  accelManager.setEnginePath(enginePath)
})

// ONNX 模型管理 IPC
ipcMain.handle('onnx:getModelStatus', async (): Promise<OnnxModelStatus> => {
  return onnxPipelineProvider.getOnnxModelStatus()
})

ipcMain.handle('onnx:selectZipFile', async (): Promise<string | null> => {
  const result = await dialog.showOpenDialog({
    title: '选择 ONNX 模型压缩包',
    filters: [{ name: 'ZIP 压缩包', extensions: ['zip'] }],
    properties: ['openFile'],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

ipcMain.handle('onnx:importModelZip', async (_event, zipPath: string): Promise<{ success: boolean; modelPath?: string; error?: string }> => {
  const installDir = onnxPipelineProvider.onnxModelInstallDir
  if (!installDir) {
    return { success: false, error: '请先安装本地 OCR 引擎。' }
  }

  const appDir = VITE_DEV_SERVER_URL
    ? process.env.APP_ROOT
    : path.dirname(app.getPath('exe'))
  const tempDir = path.join(appDir, 'onnx_model_temp')

  try {
    // 1. 清理旧临时目录
    await rm(tempDir, { recursive: true, force: true })

    // 2. 创建临时目录
    await mkdir(tempDir, { recursive: true })

    // 3. 解压 zip
    await fastExtract(zipPath, tempDir)

    // 4. 查找含 layout_det.onnx（流水线哨兵）的根目录
    const modelRoot = await resolveOnnxModelRoot(tempDir)
    if (!modelRoot) {
      await rm(tempDir, { recursive: true, force: true })
      return { success: false, error: '压缩包结构不正确：未找到 ONNX 流水线模型文件。请确认压缩包包含 layout_det.onnx、text_det.onnx、text_rec.onnx 和 ppocr_keys_v1.txt。' }
    }

    // 5. 校验必要文件
    const missing = await OnnxPipelineProvider.validatePipelineModelDir(modelRoot)
    if (missing.length > 0) {
      await rm(tempDir, { recursive: true, force: true })
      return { success: false, error: `模型文件不完整，缺少：${missing.join(', ')}` }
    }

    // 6. 删除旧模型目录
    await rm(installDir, { recursive: true, force: true })

    // 7. 确保父目录存在
    await mkdir(path.dirname(installDir), { recursive: true })

    // 8. 移动到最终位置
    await rename(modelRoot, installDir)

    // 9. 清理临时目录
    await rm(tempDir, { recursive: true, force: true })

    return { success: true, modelPath: installDir }
  } catch (err) {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {})
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: `导入失败：${message}` }
  }
})

// ---------------------------------------------------------------------------
// GPU 加速包一键导入 IPC（合并 DLL + ONNX 模型为单个 zip）
// ---------------------------------------------------------------------------

ipcMain.handle('gpu:getStatus', async (): Promise<GpuPackStatus> => {
  // 聚合加速补丁状态和 ONNX 流水线模型状态
  const accelSt = await accelManager.getStatus()
  const onnxSt = await onnxPipelineProvider.getOnnxModelStatus()

  // 只有 DLL + 模型 + 真实 GPU + onnxruntime 全满足才算就绪
  const ready = accelSt.acceleratorInstalled
    && onnxSt.installed
    && accelSt.dx12Supported
    && accelSt.activeProvider === 'DML'

  return {
    acceleratorInstalled: accelSt.acceleratorInstalled,
    onnxModelInstalled: onnxSt.installed,
    ready,
    adapterName: accelSt.adapterName,
    activeProvider: accelSt.activeProvider,
    missingDlls: accelSt.acceleratorInstalled ? [] : ['DirectML.dll'],
    missingOnnxFiles: onnxSt.missingFiles,
    error: accelSt.error,
  }
})

ipcMain.handle('gpu:selectZipFile', async (): Promise<string | null> => {
  const result = await dialog.showOpenDialog({
    title: '选择 GPU 加速包压缩包',
    filters: [{ name: 'ZIP 压缩包', extensions: ['zip'] }],
    properties: ['openFile'],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

ipcMain.handle('gpu:importPack', async (_event, zipPath: string): Promise<{ success: boolean; error?: string }> => {
  const appDir = VITE_DEV_SERVER_URL
    ? process.env.APP_ROOT
    : path.dirname(app.getPath('exe'))
  const tempDir = path.join(appDir, 'gpu_pack_temp')
  const accelFinalDir = path.join(appDir, 'accelerator')
  const onnxModelInstallDir = onnxPipelineProvider.onnxModelInstallDir

  if (!onnxModelInstallDir) {
    return { success: false, error: '请先安装本地 OCR 引擎，再导入 GPU 加速包。' }
  }

  try {
    // 1. 清理旧临时目录
    await rm(tempDir, { recursive: true, force: true })
    await mkdir(tempDir, { recursive: true })

    // 2. 解压 zip
    await fastExtract(zipPath, tempDir)

    // 3. 在解压内容中搜索 DLL 目录（含 DirectML.dll）、模型目录（含 layout_det.onnx）和 site-packages 目录
    const dllRoot = await findFileRecursive(tempDir, 'DirectML.dll', 3)
    const modelRoot = await findFileRecursive(tempDir, 'layout_det.onnx', 4)
    // site-packages 目录识别：含 onnxruntime 子目录
    // findFileRecursive 返回的就是 site-packages/ 目录本身（包含 onnxruntime 的父目录）
    const sitePackagesRoot = await findFileRecursive(tempDir, 'onnxruntime', 3)

    if (!dllRoot && !modelRoot && !sitePackagesRoot) {
      await rm(tempDir, { recursive: true, force: true })
      return { success: false, error: '压缩包结构不正确：未找到 DirectML.dll、ONNX 流水线模型或 onnxruntime 运行时。请确认压缩包包含 GPU 加速包内容。' }
    }

    const results: string[] = []

    // 4. 安装 DLL
    if (dllRoot) {
      const validation = await AccelerationManager.validateAcceleratorDir(dllRoot)
      if (validation.valid) {
        await rm(accelFinalDir, { recursive: true, force: true })
        await mkdir(accelFinalDir, { recursive: true })
        // 复制 DLL 文件到目标
        const dllEntries = await readdir(dllRoot, { withFileTypes: true })
        for (const entry of dllEntries) {
          if (entry.isFile()) {
            const src = path.join(dllRoot, entry.name)
            const dest = path.join(accelFinalDir, entry.name)
            await copyFile(src, dest)
          }
        }
        results.push('加速补丁')
      } else {
        results.push(`加速补丁(缺少: ${validation.missingFiles.join(', ')})`)
      }
    }

    // 5. 安装 ONNX 流水线模型
    if (modelRoot) {
      const missing = await OnnxPipelineProvider.validatePipelineModelDir(modelRoot)
      if (missing.length === 0) {
        await rm(onnxModelInstallDir, { recursive: true, force: true })
        await mkdir(path.dirname(onnxModelInstallDir), { recursive: true })
        await rename(modelRoot, onnxModelInstallDir)
        results.push('OCR 流水线模型')
      } else {
        results.push(`OCR 流水线模型(缺少: ${missing.join(', ')})`)
      }
    }

    // 6. 合并 site-packages（onnxruntime-directml 运行时）
    const enginePath = onnxPipelineProvider.getEnginePath()
    if (sitePackagesRoot && enginePath) {
      const destSitePackages = path.join(enginePath, 'site-packages')
      await mkdir(destSitePackages, { recursive: true })
      const entries = await readdir(sitePackagesRoot, { withFileTypes: true })
      let pkgCount = 0
      for (const entry of entries) {
        const src = path.join(sitePackagesRoot, entry.name)
        const dest = path.join(destSitePackages, entry.name)
        await rm(dest, { recursive: true, force: true }).catch(() => {})
        await cp(src, dest, { recursive: true })
        pkgCount++
      }
      if (pkgCount > 0) results.push(`onnxruntime 运行时 (${pkgCount} 项)`)
    }

    // 7. 清理临时目录
    await rm(tempDir, { recursive: true, force: true })

    if (results.length === 0) {
      return { success: false, error: '未能成功安装任何组件。' }
    }

    // 7. 确保引擎目录有 GPU 推理所需的 Python 脚本
    if (onnxPipelineProvider.getEnginePath()) {
      await ensureOcrScripts(onnxPipelineProvider.getEnginePath()!).catch(() => {})
    }

    return { success: true }
  } catch (err) {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {})
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: `导入失败：${message}` }
  }
})

/**
 * 在目录树中递归搜索包含指定文件的目录。
 * 返回包含该文件的目录路径，或 null。
 * maxDepth 控制搜索深度。
 */
async function findFileRecursive(dir: string, fileName: string, maxDepth: number): Promise<string | null> {
  if (maxDepth < 0) return null

  try {
    await access(path.join(dir, fileName))
    return dir
  } catch {
    // 文件不在当前目录
  }

  try {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const result = await findFileRecursive(path.join(dir, entry.name), fileName, maxDepth - 1)
        if (result) return result
      }
    }
  } catch {
    // ignore readdir errors
  }

  return null
}

/**
 * 在解压后的临时目录中查找 ONNX 流水线模型根目录。
 * 查找包含 layout_det.onnx（哨兵文件）的层级。
 */
async function resolveOnnxModelRoot(tempDir: string): Promise<string | null> {
  if (await OnnxPipelineProvider.hasPipelineModel(tempDir)) return tempDir

  // 尝试 temp/pipeline/ 或 temp/onnx_models/pipeline/
  const knownSubs = [
    path.join(tempDir, 'pipeline'),
    path.join(tempDir, 'onnx_models', 'pipeline'),
    path.join(tempDir, 'onnx_models'),
  ]
  for (const sub of knownSubs) {
    if (await OnnxPipelineProvider.hasPipelineModel(sub)) return sub
  }

  // 尝试单层包装目录
  try {
    const entries = await readdir(tempDir, { withFileTypes: true })
    const dirs = entries.filter(e => e.isDirectory())
    if (dirs.length === 1) {
      const wrapperDir = path.join(tempDir, dirs[0].name)
      if (await OnnxPipelineProvider.hasPipelineModel(wrapperDir)) return wrapperDir
    }
  } catch {
    // ignore readdir errors
  }

  return null
}

/**
 * 在解压后的临时目录中查找加速补丁根目录。
 * 查找包含 DirectML.dll 的层级。
 */
async function resolveAcceleratorRoot(tempDir: string): Promise<string | null> {
  if (await AccelerationManager.hasAccelerator(tempDir)) return tempDir

  const accelSub = path.join(tempDir, 'accelerator')
  if (await AccelerationManager.hasAccelerator(accelSub)) return accelSub

  try {
    const entries = await readdir(tempDir, { withFileTypes: true })
    const dirs = entries.filter(e => e.isDirectory())
    if (dirs.length === 1) {
      const wrapperDir = path.join(tempDir, dirs[0].name)
      if (await AccelerationManager.hasAccelerator(wrapperDir)) return wrapperDir
    }
  } catch {
    // ignore readdir errors
  }

  return null
}

// Window control IPC handlers
ipcMain.on('window:minimize', () => {
  win?.minimize()
})

ipcMain.on('window:maximize', () => {
  if (win?.isMaximized()) {
    win.unmaximize()
  } else {
    win?.maximize()
  }
})

ipcMain.on('window:close', () => {
  win?.close()
})

ipcMain.handle('window:isMaximized', () => {
  return win?.isMaximized() ?? false
})

ipcMain.handle('window:openExternal', (_event, url: string) => {
  // 安全校验：只允许 https 链接
  if (typeof url === 'string' && url.startsWith('https://')) {
    return shell.openExternal(url)
  }
})

async function createWindow() {
  // Remove the application menu completely
  Menu.setApplicationMenu(null)

  // Platform-specific window configuration
  const isWindows = process.platform === 'win32'

  win = new BrowserWindow({
    icon: path.join(process.env.APP_ROOT, 'build', 'icon.ico'),
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hidden', // Hide title bar but keep window controls
    titleBarOverlay: isWindows ? {
      color: '#f4f4f5', // zinc-100
      symbolColor: '#71717a', // zinc-500
      height: 36,
    } : undefined,
    backgroundColor: '#fafafa', // zinc-50 to prevent white flash
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  // Send maximize state changes to renderer
  win.on('maximize', () => {
    win?.webContents.send('window:maximized', true)
  })

  win.on('unmaximize', () => {
    win?.webContents.send('window:maximized', false)
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    await loadUrlWithRetry(win, VITE_DEV_SERVER_URL)
  } else {
    await win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)

process.on('unhandledRejection', (err) => {
  // Avoid noisy crash in dev if dev server has not started yet
  console.error('[unhandledRejection]', err)
})
