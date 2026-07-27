@echo off
setlocal enabledelayedexpansion

set PUSH=1
set MSG=

:parse
if "%1"=="" goto endparse
if "%1"=="-np" (
    set PUSH=0
    shift
    goto parse
)
if "%1"=="--no-push" (
    set PUSH=0
    shift
    goto parse
)
if "%1"=="-h" goto help
if "%1"=="--help" goto help
if defined MSG (
    set MSG=!MSG! %1
) else (
    set MSG=%1
)
shift
goto parse
:endparse

if not defined MSG (
    set /p MSG="请输入提交信息: "
)

echo 正在添加所有更改...
git add .
if errorlevel 1 (
    echo [错误] git add 失败，请检查是否在 Git 仓库中。
    exit /b 1
)

echo 正在提交...
git commit -m "%MSG%"
if errorlevel 1 (
    echo [错误] git commit 失败。
    exit /b 1
)

if %PUSH%==1 (
    echo 正在推送到远程仓库...
    git push
    if errorlevel 1 (
        echo [错误] git push 失败。
        exit /b 1
    )
) else (
    echo [跳过] 未推送（使用了 -np 选项）。
)

echo 操作成功完成！
goto :eof

:help
echo 用法: %~nx0 [选项] [提交信息]
echo.
echo 选项:
echo   -np, --no-push    只提交，不推送（默认会推送）
echo   -h, --help        显示此帮助信息
echo.
echo 如果未提供提交信息，脚本会交互式提示输入。
echo 示例:
echo   %~nx0 "修复登录bug"          # 提交并推送
echo   %~nx0 -np "更新文档"         # 只提交不推送
echo   %~nx0                        # 交互式输入信息并推送
exit /b 0