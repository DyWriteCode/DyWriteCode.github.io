import psutil
import wmi
import subprocess
import time
import os
import win32evtlog
import win32evtlogutil
import win32con
import win32api
from datetime import datetime
from typing import List, Dict, Any   # 增加 Any
import winreg

c = wmi.WMI()
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ================= 1. 系统基础指标（含上下文切换/中断） =================
def get_system_metrics() -> Dict[str, Any]:
    cpu_percent = psutil.cpu_percent(interval=0.1)
    mem = psutil.virtual_memory()
    disk_usage = psutil.disk_usage('C:')
    net_io = psutil.net_io_counters()
    cores = psutil.cpu_count(logical=True)

    avg_disk_sec_read = 0.0
    avg_disk_sec_write = 0.0
    processor_queue_length = 0
    dpc_percent = 0.0
    try:
        for proc in c.Win32_PerfFormattedData_PerfOS_Processor(Name='_Total'):
            processor_queue_length = proc.ProcessorQueueLength
            dpc_percent = proc.PercentDPCTime
            break
        for disk in c.Win32_PerfFormattedData_PerfDisk_PhysicalDisk(Name='_Total'):
            avg_disk_sec_read = disk.AvgDiskSecPerRead / 100000.0
            avg_disk_sec_write = disk.AvgDiskSecPerWrite / 100000.0
            break
    except:
        pass

    stats1 = psutil.cpu_stats()
    time.sleep(0.5)
    stats2 = psutil.cpu_stats()
    ctx_switches_per_sec = (stats2.ctx_switches - stats1.ctx_switches) / 0.5
    interrupts_per_sec = (stats2.interrupts - stats1.interrupts) / 0.5

    return {
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "cpu": {
            "percent": cpu_percent,
            "cores": cores,
            "queue_length": processor_queue_length,
            "dpc_percent": round(dpc_percent, 2),
            "ctx_switches_sec": round(ctx_switches_per_sec, 0),
            "interrupts_sec": round(interrupts_per_sec, 0)
        },
        "memory": {
            "total_gb": round(mem.total / (1024**3), 2),
            "available_gb": round(mem.available / (1024**3), 2),
            "percent": mem.percent
        },
        "disk": {
            "c_usage_percent": disk_usage.percent,
            "avg_read_sec": round(avg_disk_sec_read, 4),
            "avg_write_sec": round(avg_disk_sec_write, 4)
        },
        "network": {
            "sent_mb": round(net_io.bytes_sent / (1024**2), 2),
            "recv_mb": round(net_io.bytes_recv / (1024**2), 2)
        },
        "process_count": len(psutil.pids())
    }

# ================= 2. 进程管理 =================
def get_process_list() -> List[Dict[str, Any]]:
    processes = []
    for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_info', 
                                     'status', 'create_time', 'cmdline']):
        try:
            pinfo = proc.info
            mem_mb = pinfo['memory_info'].rss / (1024**2) if pinfo['memory_info'] else 0
            create_time = datetime.fromtimestamp(pinfo['create_time']).strftime('%Y-%m-%d %H:%M:%S') if pinfo['create_time'] else ''
            cmdline = ' '.join(pinfo['cmdline']) if pinfo['cmdline'] else ''
            if len(cmdline) > 200:
                cmdline = cmdline[:200] + '...'
            processes.append({
                "pid": pinfo['pid'],
                "name": pinfo['name'] or 'Unknown',
                "cpu_percent": round(pinfo['cpu_percent'] or 0, 1),
                "memory_mb": round(mem_mb, 1),
                "status": pinfo['status'] or 'unknown',
                "create_time": create_time,
                "cmdline": cmdline
            })
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            continue
    processes.sort(key=lambda x: x['cpu_percent'], reverse=True)
    return processes

def kill_process(pid: int) -> bool:
    try:
        p = psutil.Process(pid)
        p.kill()
        return True
    except:
        return False

def suspend_process(pid: int) -> bool:
    try:
        p = psutil.Process(pid)
        p.suspend()
        return True
    except:
        return False

def resume_process(pid: int) -> bool:
    try:
        p = psutil.Process(pid)
        p.resume()
        return True
    except:
        return False

def start_process(command: str) -> bool:
    try:
        psutil.Popen(command, shell=True)
        return True
    except:
        return False

def set_process_priority(pid: int, priority: str) -> bool:
    try:
        p = psutil.Process(pid)
        priority_map = {
            'realtime': psutil.REALTIME_PRIORITY_CLASS,
            'high': psutil.HIGH_PRIORITY_CLASS,
            'above_normal': psutil.ABOVE_NORMAL_PRIORITY_CLASS,
            'normal': psutil.NORMAL_PRIORITY_CLASS,
            'below_normal': psutil.BELOW_NORMAL_PRIORITY_CLASS,
            'idle': psutil.IDLE_PRIORITY_CLASS
        }
        if priority not in priority_map:
            return False
        p.nice(priority_map[priority])
        return True
    except:
        return False

def set_process_affinity(pid: int, cpu_mask: List[int]) -> bool:
    try:
        p = psutil.Process(pid)
        p.cpu_affinity(cpu_mask)
        return True
    except:
        return False

# ================= 3. Windows 服务管理 =================
def get_services_list() -> List[Dict[str, Any]]:
    services = []
    try:
        for s in c.Win32_Service():
            services.append({
                "name": s.Name,
                "display_name": s.DisplayName,
                "status": s.State,
                "start_mode": s.StartMode,
                "process_id": s.ProcessId if s.ProcessId else 0
            })
        services.sort(key=lambda x: 0 if x['status'] == 'Stopped' else 1)
        return services
    except:
        return []

def service_control(name: str, action: str) -> bool:
    try:
        import win32service
        scm = win32service.OpenSCManager(None, None, win32service.SC_MANAGER_ALL_ACCESS)
        h = win32service.OpenService(scm, name, win32service.SERVICE_ALL_ACCESS)
        if action == 'start':
            win32service.StartService(h, None)
        elif action == 'stop':
            win32service.ControlService(h, win32service.SERVICE_CONTROL_STOP)
        elif action == 'restart':
            win32service.ControlService(h, win32service.SERVICE_CONTROL_STOP)
            time.sleep(0.5)
            win32service.StartService(h, None)
        else:
            return False
        win32service.CloseServiceHandle(h)
        win32service.CloseServiceHandle(scm)
        return True
    except:
        return False

# ================= 4. 系统电源控制 =================
def system_power(action: str) -> bool:
    try:
        if action == 'shutdown':
            os.system("shutdown /s /t 5")
        elif action == 'reboot':
            os.system("shutdown /r /t 5")
        elif action == 'sleep':
            os.system("rundll32.exe powrprof.dll,SetSuspendState 0,1,0")
        elif action == 'hibernate':
            os.system("shutdown /h")
        else:
            return False
        return True
    except:
        return False

# ================= 5. 远程命令执行（修正返回类型为 Dict[str, Any]） =================
def execute_command(command: str) -> Dict[str, Any]:
    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=60,
            encoding='gbk',
            cwd=PROJECT_ROOT   # 设置工作目录为项目根目录
        )
        return {
            "stdout": result.stdout.strip(),
            "stderr": result.stderr.strip(),
            "returncode": result.returncode
        }
    except subprocess.TimeoutExpired:
        return {"stdout": "", "stderr": "命令执行超时（60秒）", "returncode": -1}
    except Exception as e:
        return {"stdout": "", "stderr": str(e), "returncode": -1}
# ================= 6. 硬件温度 =================
def get_temperatures() -> Dict[str, float]:
    temps = {}
    try:
        wmi_obj = wmi.WMI(namespace="root\\wmi")
        for tz in wmi_obj.MSAcpi_ThermalZoneTemperature():
            temp_c = (tz.CurrentTemperature / 10.0) - 273.15
            name = tz.InstanceName.split('.')[-1] if tz.InstanceName else 'CPU'
            if 0 < temp_c < 100:
                temps[name] = round(temp_c, 1)
    except:
        pass
    if not temps:
        try:
            for probe in c.Win32_TemperatureProbe():
                if probe.CurrentReading:
                    temps['主板'] = round(probe.CurrentReading, 1)
        except:
            pass
    return temps

# ================= 7. 网络连接 =================
def get_network_connections() -> List[Dict[str, Any]]:
    connections = []
    try:
        for conn in psutil.net_connections(kind='inet'):
            try:
                p = psutil.Process(conn.pid) if conn.pid else None
                pname = p.name() if p else 'System'
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pname = 'Unknown'
            laddr = f"{conn.laddr.ip}:{conn.laddr.port}" if conn.laddr else '*:*'
            raddr = f"{conn.raddr.ip}:{conn.raddr.port}" if conn.raddr else '*:*'
            connections.append({
                "pid": conn.pid or 0,
                "process": pname,
                "family": "IPv4" if conn.family == 2 else "IPv6",
                "type": "TCP" if conn.type == 1 else "UDP",
                "local": laddr,
                "remote": raddr,
                "status": conn.status if conn.status else 'ESTABLISHED'
            })
        connections.sort(key=lambda x: x['process'])
        return connections
    except:
        return []

# ================= 8. 系统事件日志（修正时间转换） =================
def get_recent_errors(log_type: str = "System", count: int = 20) -> List[Dict[str, Any]]:
    logs = []
    try:
        hand = win32evtlog.OpenEventLog(None, log_type)
        flags = win32evtlog.EVENTLOG_BACKWARDS_READ | win32evtlog.EVENTLOG_SEQUENTIAL_READ
        events = win32evtlog.ReadEventLog(hand, flags, 0)
        read_count = 0
        for event in events:
            if read_count >= count:
                break
            if event.EventType in [1, 2]:
                # 修正时间转换
                timestamp = event.TimeGenerated.timestamp()   # pywintypes.Time -> float
                time_str = datetime.fromtimestamp(timestamp).strftime('%Y-%m-%d %H:%M:%S')
                logs.append({
                    "time": time_str,
                    "level": "Error" if event.EventType == 1 else "Warning",
                    "source": event.SourceName,
                    "event_id": event.EventID,
                    "message": win32evtlogutil.SafeFormatMessage(event, log_type)[:150]
                })
                read_count += 1
        win32evtlog.CloseEventLog(hand)
        return logs
    except Exception as e:
        return [{"time": "", "level": "Error", "source": "WMI", "event_id": 0, "message": f"读取日志失败: {e}"}]

# ================= 9. 开机自启项 =================
def get_startup_items() -> List[Dict[str, str]]:
    items = []
    reg_paths = [
        r"SOFTWARE\Microsoft\Windows\CurrentVersion\Run",
        r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Run",
        r"SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce",
    ]
    try:
        for path in reg_paths:
            try:
                key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, path)
                i = 0
                while True:
                    try:
                        name, value, _ = winreg.EnumValue(key, i)
                        items.append({"name": name, "path": value, "location": "HKLM\\" + path})
                        i += 1
                    except OSError:
                        break
                winreg.CloseKey(key)
            except FileNotFoundError:
                pass
    except:
        pass

    try:
        path = r"SOFTWARE\Microsoft\Windows\CurrentVersion\Run"
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, path)
        i = 0
        while True:
            try:
                name, value, _ = winreg.EnumValue(key, i)
                items.append({"name": name, "path": value, "location": "HKCU\\Run"})
                i += 1
            except OSError:
                break
        winreg.CloseKey(key)
    except:
        pass

    startup_folder = os.path.join(os.environ.get('PROGRAMDATA', ''), 
                                  'Microsoft\\Windows\\Start Menu\\Programs\\StartUp')
    if os.path.exists(startup_folder):
        for f in os.listdir(startup_folder):
            full_path = os.path.join(startup_folder, f)
            if os.path.isfile(full_path):
                items.append({"name": f, "path": full_path, "location": "Startup Folder"})
    return items