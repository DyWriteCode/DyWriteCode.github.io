from fastapi import FastAPI, Request, Query, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates
import os
from typing import Optional

from .metrics import (
    get_system_metrics,
    get_process_list,
    kill_process,
    suspend_process,
    resume_process,
    start_process,
    set_process_priority,
    set_process_affinity,
    get_services_list,
    service_control,
    system_power,
    execute_command,
    get_temperatures,
    get_network_connections,
    get_recent_errors,
    get_startup_items
)
from .config import API_TOKEN, HOST, PORT

app = FastAPI(title="PC Ghost Lag Monitor Pro")
templates = Jinja2Templates(directory=os.path.join(os.path.dirname(__file__), "templates"))

def verify_token(token: Optional[str] = None):
    if not token:
        raise HTTPException(status_code=401, detail="Missing token")
    if token != API_TOKEN:
        raise HTTPException(status_code=403, detail="Invalid token")

# ---------- 首页（仅传递 token，前端使用相对路径） ----------
@app.get("/", response_class=HTMLResponse)
async def dashboard(request: Request):
    # 获取项目根目录
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    template = templates.get_template("dashboard.html")
    html = template.render({
        "request": request,
        "token": API_TOKEN,
        "cwd": project_root   # 传递工作目录给前端
    })
    return HTMLResponse(content=html)

# ---------- 概览 ----------
@app.get("/metrics")
async def metrics(token: Optional[str] = Query(None)):
    verify_token(token)
    return JSONResponse(content=get_system_metrics())

# ---------- 进程列表 ----------
@app.get("/processes")
async def processes(token: Optional[str] = Query(None)):
    verify_token(token)
    return JSONResponse(content=get_process_list())

# ---------- 进程操作 ----------
@app.post("/process/kill")
async def process_kill(pid: int, token: Optional[str] = Query(None)):
    verify_token(token)
    return {"success": kill_process(pid), "pid": pid}

@app.post("/process/suspend")
async def process_suspend(pid: int, token: Optional[str] = Query(None)):
    verify_token(token)
    return {"success": suspend_process(pid), "pid": pid}

@app.post("/process/resume")
async def process_resume(pid: int, token: Optional[str] = Query(None)):
    verify_token(token)
    return {"success": resume_process(pid), "pid": pid}

@app.post("/process/start")
async def process_start_cmd(command: str, token: Optional[str] = Query(None)):
    verify_token(token)
    return {"success": start_process(command), "command": command}

@app.post("/process/priority")
async def process_priority(pid: int, priority: str, token: Optional[str] = Query(None)):
    verify_token(token)
    success = set_process_priority(pid, priority)
    return {"success": success, "pid": pid, "priority": priority}

@app.post("/process/affinity")
async def process_affinity(pid: int, cores: str, token: Optional[str] = Query(None)):
    verify_token(token)
    try:
        core_list = [int(x.strip()) for x in cores.split(',') if x.strip()]
        if not core_list:
            return {"success": False, "error": "无效核心列表"}
        success = set_process_affinity(pid, core_list)
        return {"success": success, "pid": pid, "cores": core_list}
    except Exception as e:
        return {"success": False, "error": str(e)}

# ---------- 服务管理 ----------
@app.get("/services")
async def services_list(token: Optional[str] = Query(None)):
    verify_token(token)
    return JSONResponse(content=get_services_list())

@app.post("/service/control")
async def service_control_op(name: str, action: str, token: Optional[str] = Query(None)):
    verify_token(token)
    if action not in ['start', 'stop', 'restart']:
        return {"success": False, "error": "无效操作"}
    success = service_control(name, action)
    return {"success": success, "service": name, "action": action}

# ---------- 系统电源 ----------
@app.post("/system/power")
async def power_control(action: str, token: Optional[str] = Query(None)):
    verify_token(token)
    if action not in ['shutdown', 'reboot', 'sleep', 'hibernate']:
        return {"success": False, "error": "无效电源操作"}
    success = system_power(action)
    return {"success": success, "action": action}

# ---------- 远程命令 ----------
@app.post("/system/command")
async def run_command(cmd: str, token: Optional[str] = Query(None)):
    verify_token(token)
    result = execute_command(cmd)
    return result

# ---------- 温度 ----------
@app.get("/temperatures")
async def temperatures(token: Optional[str] = Query(None)):
    verify_token(token)
    return JSONResponse(content=get_temperatures())

# ---------- 网络连接 ----------
@app.get("/connections")
async def connections(token: Optional[str] = Query(None)):
    verify_token(token)
    return JSONResponse(content=get_network_connections())

# ---------- 事件日志 ----------
@app.get("/events")
async def events(log_type: str = "System", token: Optional[str] = Query(None)):
    verify_token(token)
    return JSONResponse(content=get_recent_errors(log_type, 20))

# ---------- 开机自启 ----------
@app.get("/startup")
async def startup_items(token: Optional[str] = Query(None)):
    verify_token(token)
    return JSONResponse(content=get_startup_items())

# ---------- 健康检查 ----------
@app.get("/health")
async def health():
    return {"status": "alive"}