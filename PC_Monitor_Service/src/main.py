import sys
import os
import subprocess
import time
import win32serviceutil
import win32service
import win32event
import servicemanager

# 项目根目录（用于设置工作目录和查找虚拟环境）
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(base_dir)

from src.config import HOST, PORT, API_TOKEN

class MonitorService(win32serviceutil.ServiceFramework):
    _svc_name_ = "GhostLagMonitor"
    _svc_display_name_ = "Ghost Lag Monitor Service"
    _svc_description_ = "开机自启，提供网页监控和系统操作（SYSTEM权限）"
    _svc_start_ = win32service.SERVICE_AUTO_START   # 自动启动

    def __init__(self, args):
        win32serviceutil.ServiceFramework.__init__(self, args)
        self.hWaitStop = win32event.CreateEvent(None, 0, 0, None)
        self.process = None

    def SvcStop(self):
        self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
        win32event.SetEvent(self.hWaitStop)
        if self.process and self.process.poll() is None:
            self.process.terminate()
            time.sleep(1)
            if self.process.poll() is None:
                self.process.kill()

    def SvcDoRun(self):
        servicemanager.LogMsg(servicemanager.EVENTLOG_INFORMATION_TYPE,
                              servicemanager.PYS_SERVICE_STARTED,
                              (self._svc_name_, 'Starting...'))

        # ========== 关键修复：使用虚拟环境中的 python.exe ==========
        # 在 Windows 服务中，sys.executable 可能指向 pythonservice.exe，
        # 而不是真正的 python 解释器，因此我们显式指定虚拟环境中的 python.exe。
        python_exe = os.path.join(base_dir, 'venv', 'Scripts', 'python.exe')
        if not os.path.exists(python_exe):
            # 如果虚拟环境不存在，尝试回退到系统 Python（但通常不会发生）
            servicemanager.LogMsg(servicemanager.EVENTLOG_WARNING_TYPE,
                                  servicemanager.PYS_SERVICE_STARTED,
                                  (self._svc_name_, f'警告：未找到 {python_exe}，回退到 sys.executable'))
            python_exe = sys.executable

        cmd = [
            python_exe, "-m", "uvicorn",
            "src.api:app",
            "--host", HOST,
            "--port", str(PORT),
            "--workers", "1"
        ]

        # 将子进程的输出重定向到日志文件（便于调试）
        log_file_path = os.path.join(base_dir, "service_error.log")
        log_file = open(log_file_path, "a", encoding="utf-8")
        log_file.write(f"=== Started at {time.strftime('%Y-%m-%d %H:%M:%S')} ===\n")
        log_file.flush()

        try:
            self.process = subprocess.Popen(
                cmd,
                cwd=base_dir,
                stdout=log_file,
                stderr=log_file,
                creationflags=subprocess.CREATE_NO_WINDOW
            )
        except Exception as e:
            log_file.write(f"启动子进程失败: {e}\n")
            log_file.flush()
            # 若启动失败，则记录并退出服务
            servicemanager.LogMsg(servicemanager.EVENTLOG_ERROR_TYPE,
                                  servicemanager.PYS_SERVICE_STARTED,
                                  (self._svc_name_, f'启动子进程异常: {e}'))
            self.SvcStop()
            return

        # 等待服务停止信号
        win32event.WaitForSingleObject(self.hWaitStop, win32event.INFINITE)

        # 服务停止时，终止子进程
        if self.process and self.process.poll() is None:
            self.process.terminate()
            self.process.wait()

        log_file.close()


if __name__ == '__main__':
    if len(sys.argv) == 1:
        # 调试模式：直接运行 uvicorn（不安装为服务）
        import uvicorn
        print(f"调试模式启动，访问 http://{os.getenv('COMPUTERNAME')}:{PORT}/?token={API_TOKEN}")
        uvicorn.run("src.api:app", host=HOST, port=PORT)
    else:
        # 服务安装/卸载/启动/停止等命令
        win32serviceutil.HandleCommandLine(MonitorService)