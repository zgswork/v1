[简体中文](CHANGELOG.md) | [English](CHANGELOG.en-US.md)
# Changelog

> **Version Numbering**: Release versions use `vX.Y.Z`, beta branches use `vX.Y.Z-<feature>.N` to distinguish feature lines. Merged to main as the next release version.

## v1.2.1
### Fixed
- Fixed UI freeze during long AI streaming sessions that previously required restarting the app. In burst-rate + multi-round scenarios, main-thread occupancy dropped from 47.8% to 35.2%, cumulative blocking time reduced by 59% (21s → 8.6s)
  - ChatPanel: stream loop now uses `requestAnimationFrame` to throttle `setWorkspaceMessages`, lowering trigger frequency from "per token" to frame rate (≤60Hz)
  - useAppStore: wrapped `localStorage` with a 100ms throttled storage, capping `setItem` at 10Hz; `beforeunload` / `pagehide` / `visibilitychange` force-flush as fallback
  - partialize: skips `workspace.messages` during streaming and persists `streaming=false`, also fixes a latent bug where a crash mid-stream would leave the app stuck in "streaming" state on restart
- Added `scripts/bench-stream-perf.mjs`: reproducible offline benchmark covering 4 scenarios (normal / burst / multi-round / extreme)

## v1.2.0
### Added
- Added LaTeX formula editor page (sidebar Σ entry) with real-time KaTeX preview and 8 example formulas
- Added LaTeX → UnicodeMath converter covering: fractions, superscripts/subscripts, Greek letters, roots, matrices, piecewise functions, modifiers, math fonts, large operator protection
- Added high-DPI image export: 4x super-sampling + white-to-transparent conversion + smart crop + PNG pHYs DPI metadata injection (~524 DPI, matching Word 11pt font size)
- Added AI Formula Assistant: collapsible left panel with streaming chat to generate LaTeX, one-click insert, hover highlight, auto-insert toggle
- Added staircase dual-panel layout: AI assistant and history can open simultaneously
- Added context round slider (0=unlimited, max 20 rounds) to control historical conversation rounds sent to AI, reducing token consumption
- Added per-round checkbox: manually include/exclude specific conversation rounds, overriding default window rules
- Added pinned history rounds: select conversation rounds from history as cross-session context snapshots
- Added regenerate / continue generation buttons
- Added context filter engine `context-filter.ts` with 14 unit tests
- Added version update detection: automatically checks for new versions on startup, supports "Go to Download", "Remind Me Later", and "Skip This Version"
- Added OCR architecture change warning, sidebar red dot indicator, and "About & Updates" card in Settings
- Added `window:openExternal` IPC channel to open download links in system default browser
- Injected `__APP_VERSION__` via Vite `define` for runtime version comparison
- Added 25 UnicodeMath conversion unit tests
### Changed
- Zero-flash image export: offscreen BrowserWindow replaces visible DOM capturePage
- Moved history panel from right to left side, panel buttons unified on left column header
- Improved formula extraction: multi-line environments split by `\\` (≤10 lines split, >10 lines kept as whole block)
### Fixed
- Fixed chat panel input box being clipped at window bottom
- Fixed left sidebar new sections crowding custom instruction and reference document space
- User data and OCR engine are automatically preserved during overlay installation

## v1.1.3
### Added
- Added table structure enhancement: integrated RT-DETR-L wired/wireless table cell detection models (`table_wired_det.onnx` + `table_wireless_det.onnx`), 3-level fallback chain (model detection → morphological grid → coordinate clustering), significantly improved complex table reconstruction
- Added OCR post-processing enhancements: math symbol regex corrector (`sn→sin`, `coS→cos`, `tg→tan`, etc.), formula region 2D spatial reconstruction (block merging + OpenCV visual fraction bar detection + `\frac` output), OpenCV morphological table grid extraction
- Added multi-page PDF support: renders PDF pages to PNG via PyMuPDF and OCR-processes them, with merged results added to reference files (max 50 pages)
- Added table detection model conversion script `scripts/convert_table_det.py` (supports PIR format)
### Changed
- Removed deprecated `FormulaRecognizer` class (~130 lines) and cleaned up related references (all formula recognition models use autoregressive architecture, incompatible with DirectML)
- Accelerated zip extraction: prioritizes native Windows `tar.exe` over pure JS `extract-zip`, several times faster
- Updated OCR technical documentation with comprehensive formula recognition model research conclusions

## v1.1.2
### Added
- Added OCR support for GPU inference acceleration using ```DirectML```, with universal compatibility for the Windows platform.
### Changed
- Adjusted OCR functionality, removed the PaddleOCR-VL from previous versions, and adopted a pipeline OCR mode (using ```layout_det.onnx, text_det.onnx, text_rec.onnx``` supplemented with the ```ppocr_keys_v1.txt``` dictionary)

## v1.1.1
### Added
- Added online OCR inference function. Users can manually select a specified service provider and vision model for OCR recognition in "Settings - Advanced - OCR Image Recognition", and the recognition results support manual modification.
### Changed
- Adjusted the model selection function: changed from manual input to obtaining a model list, supporting searching by model name and recently used model names.

## v1.1.0
### Added
- Added OCR functionality with the integration of PaddleOCR, allowing users to select or drag-and-drop images for recognition.
- The OCR feature is optional and requires manual selection and import of the zip package in "Settings > Advanced > OCR Image Recognition Engine".

## v1.0.18
### Fixed
- Fixed the issue of UI overlay and misalignment in the title bar.

## Pre-1.0.17 (Legacy Versions)
### Added
- Added the attachment document upload feature (supports conversion to markdown/txt for upload).
- Added the user-defined prompt feature, enabling prompts to be fixed and sent by default in each conversation.
- Added the history record interface to support viewing detailed debugging information of conversations.
- Added the independent zoom-in function for the rendering window.
- Initial construction of UI styles and core functions.