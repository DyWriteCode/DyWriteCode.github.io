@echo off
echo 正在安装幽灵卡顿监控服务（开机自启）...
cd /d "%~dp0"
if not exist venv\Scripts\python.exe (
    echo 错误: 请先运行 python -m venv venv 创建虚拟环境
    pause
    exit /b
)
echo 停止并卸载旧服务...
"%cd%\venv\Scripts\python.exe" src/main.py stop >nul 2>&1
"%cd%\venv\Scripts\python.exe" src/main.py remove >nul 2>&1
echo 安装新服务...
"%cd%\venv\Scripts\python.exe" src/main.py install
echo 启动服务...
"%cd%\venv\Scripts\python.exe" src/main.py start
echo 检查服务状态...
sc query GhostLagMonitor | find "RUNNING" >nul
if %errorlevel%==0 (
    echo 服务已成功运行！
) else (
    echo 服务未能启动，请查看事件日志或手动启动。
)
echo 访问地址: http://本机IP:8000/?token=Dy20090918
pause