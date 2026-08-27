import { Route, Routes } from 'react-router-dom'
import { useAppStore } from './store/useAppStore'
import { useEffect } from 'react'
import NewPage from './pages/New'
import HistoryPage from './pages/History'
import SettingsPage from './pages/Settings'
import HelpPage from './pages/Help'
import LatexPage from './pages/Latex'
import { OnboardingModal } from './components/business/OnboardingModal'
import { Toaster } from './components/ui/Toaster'
import { GlobalSidebar } from './components/business/GlobalSidebar'
import { PageLayout } from './layouts/PageLayout'
import { UpdateModal } from './components/business/UpdateModal'
import { checkForUpdate } from './services/UpdateService'
import { useUpdateStore } from './store/useUpdateStore'

function App() {
  const eyeCareMode = useAppStore((s) => s.settings.eyeCareMode)
  const ocrEnginePath = useAppStore((s) => s.settings.ocrEnginePath)
  const updateInfo = useUpdateStore((s) => s.updateInfo)
  const showModal = useUpdateStore((s) => s.showModal)
  const setUpdateInfo = useUpdateStore((s) => s.setUpdateInfo)
  const dismissUpdate = useUpdateStore((s) => s.dismiss)

  // 启动时异步检测版本更新
  useEffect(() => {
    checkForUpdate().then((info) => {
      if (info) setUpdateInfo(info)
    })
  }, [setUpdateInfo])

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove('eye-care')
    if (eyeCareMode) {
      root.classList.add('eye-care')
    }
  }, [eyeCareMode])

  useEffect(() => {
    if (window.wordsmith?.ocr?.setEnginePath) {
      window.wordsmith.ocr.setEnginePath(ocrEnginePath)
    }
  }, [ocrEnginePath])

  useEffect(() => {
    // accel:setPath 设置 accelManager 的 enginePath（用于查找 accelerator/ 目录和运行 hw_accel.py）
    // 必须传 ocrEnginePath（OCR 引擎根路径），而非 acceleratorPath
    if (window.wordsmith?.accel?.setPath) {
      window.wordsmith.accel.setPath(ocrEnginePath)
    }
  }, [ocrEnginePath])

  return (
    <div className="flex h-full w-full bg-zinc-50">
      <OnboardingModal />
      <Toaster />
      {updateInfo && showModal && <UpdateModal info={updateInfo} onClose={dismissUpdate} />}

      {/* Global Navigation Sidebar - extends to top */}
      <GlobalSidebar />

      {/* Main Content Area */}
      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <Routes>
          <Route path="/" element={<NewPage />} />
          <Route path="/latex" element={<LatexPage />} />
          <Route path="/history" element={<PageLayout><HistoryPage /></PageLayout>} />
          <Route path="/settings" element={<PageLayout><SettingsPage /></PageLayout>} />
          <Route path="/help" element={<PageLayout><HelpPage /></PageLayout>} />
        </Routes>
      </div>
    </div>
  )
}

export default App
