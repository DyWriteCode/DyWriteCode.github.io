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
set /p MSG="[notice]Please enter the commit message: "
)

echo Adding all changes...
git add .
if errorlevel 1 (
echo [Error] git add failed, please check if you are in a Git repository.
exit /b 1
)

echo Committing...
git commit -m "%MSG%"
if errorlevel 1 (
echo [Error] git commit failed.
exit /b 1
)

if %PUSH%==1 (
    echo [notice]Pushing to the remote repository...
    git push
    if errorlevel 1 (
        echo [Error] git push failed.
        exit /b 1
    )
) else (
    echo [Skipped] Not pushed (used -np option).
)

echo [notice]Operation completed successfully!
goto :eof

:help
echo Usage: %~nx0 [options] [commit message]
echo.
echo Options:
echo -np, --no-push Only commit, do not push (default is to push)
echo -h, --help Show this help message
echo.
echo If no commit message is provided, the script will prompt you interactively.
echo Example:
echo %~nx0 "Fix login bug" # Commit and push
echo %~nx0 -np "Update docs" # Only commit, do not push
echo %~nx0 # Interactively enter message and pushexit /b 0