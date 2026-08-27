AllowRootDirInstall true
!include "LogicLib.nsh"

; 当路径发生变化时立即触发，同时修改 UI 显示
Function .onVerifyInstDir
  ; 检查路径是否已经以 WordSmith AI 结尾
  StrCpy $0 $INSTDIR "" -12
  ${If} $0 != "WordSmith AI"
    ; 强制在 UI 变量里加上子文件夹
    StrCpy $INSTDIR "$INSTDIR\WordSmith AI"
  ${EndIf}

  ; 验证路径长度
  StrLen $0 $INSTDIR
  ${If} $0 < 5
    Abort
  ${EndIf}
FunctionEnd

!macro customInstall
  ; 双重保险，确保安装前文件夹存在
  CreateDirectory $INSTDIR
  SetOutPath $INSTDIR
!macroend

!macro customUnInstall
  ; 卸载时安全删除 OCR 引擎目录（仅删除安装目录下的 ocr_engine 子目录）
  ${If} ${FileExists} "$INSTDIR\ocr_engine\*.*"
    RMDir /r "$INSTDIR\ocr_engine"
  ${EndIf}
  ; 清理可能残留的临时解压目录
  ${If} ${FileExists} "$INSTDIR\ocr_engine_temp\*.*"
    RMDir /r "$INSTDIR\ocr_engine_temp"
  ${EndIf}
!macroend
