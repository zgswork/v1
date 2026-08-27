# 五线谱工作室 (staff-studio)

交互式五线谱训练工具:单个自包含的 `staff-studio.html`,零依赖、零构建、可离线 `file://` 直接打开。

> 已归档。

## 用法

浏览器打开 `staff-studio.html` 即可。支持高音/低音谱号、音符录入(鼠标 / 键盘)、Web Audio 播放、深色模式、中英文切换,状态保存于 localStorage。

## 技术要点

纯手绘 SVG 谱号 / 音符(不用音乐字体或 Unicode 音乐符号,避免 Windows 下显示为豆腐块);响应式多行排版(窄屏自动换行而非横向滚动)。实现细节见 [`CLAUDE.md`](./CLAUDE.md)。
