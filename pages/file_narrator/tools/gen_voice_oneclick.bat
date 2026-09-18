@echo off
rem ============================================================
rem  pdf_narrator 解说语音一键生成 —— 兜底入口（双击运行）
rem  作用：等同于双击 gen_voice_oneclick.pyw。
rem  什么时候需要用这个：机器上 .pyw 没有关联到 Python，
rem  双击 gen_voice_oneclick.pyw 没有任何反应时。
rem  本文件不改任何数据，只是把 gen_voice_oneclick.pyw 用
rem  无控制台的方式启动起来。
rem ============================================================
setlocal
cd /d "%~dp0"

where pythonw >nul 2>nul
if %errorlevel%==0 (
    start "" pythonw "%~dp0gen_voice_oneclick.pyw"
    exit /b 0
)

where pyw >nul 2>nul
if %errorlevel%==0 (
    start "" pyw "%~dp0gen_voice_oneclick.pyw"
    exit /b 0
)

echo [提示] 没找到 pythonw / pyw，无法自动启动。
echo        请任选一种方式：
echo        1) 直接双击同目录的 gen_voice_oneclick.pyw（若已关联 Python）；
echo        2) 命令行执行：python gen_voice_oneclick.pyw --auto
pause
exit /b 1
