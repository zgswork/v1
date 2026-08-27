@echo off
setlocal enabledelayedexpansion
for /f "tokens=2 delims==" %%i in ('wmic os get LocalDateTime /value') do set "dt=%%i"
set "current_date=%dt:~0,8%"
set output_file=文件夹列表_%current_date%.txt
set "current_dir=%cd%"
set "script_name=%~nx0"
> "%output_file%" (
    for /r %%f in (*) do (
        if not "%%~nxf"=="%script_name%" (
            if not "%%~nxf"=="%output_file%" (
                set "file_path=%%f"
                set "relative_path=!file_path:%current_dir%=!"
                if "!relative_path:~0,1!"=="\" set "relative_path=!relative_path:~1!"
                set "relative_path=!relative_path:\=/!"
                echo !relative_path!
            )
        )
    )
)
rem 或者cmd中本文件夹地址下输入：tree /f > mulu.txt