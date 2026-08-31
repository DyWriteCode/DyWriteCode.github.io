@echo off
echo 正在停止并卸载服务...
cd /d "%~dp0"
"%cd%\venv\Scripts\python.exe" src/main.py stop
"%cd%\venv\Scripts\python.exe" src/main.py remove
pause