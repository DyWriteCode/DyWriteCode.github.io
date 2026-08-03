// check-update.js
(function () {
    'use strict';

    const CHECK_INTERVAL = 30000;
    const VERSION_URL = 'https://dywritecode.github.io/version.json'; // 如果是项目站点，可能需要加仓库名前缀，如 '/仓库名/version.json'

    // ---------- 工具：获取当前版本（存在 localStorage） ----------
    function getLocalVersion() {
        return localStorage.getItem('app_version') || null;
    }

    function setLocalVersion(ver) {
        localStorage.setItem('app_version', ver);
    }

    // ---------- 检测更新 ----------
    function checkUpdate() {
        // 加随机参数破除缓存
        const url = VERSION_URL + '?t=' + Date.now();

        fetch(url)
            .then(res => {
                if (!res.ok) throw new Error('Version file not found');
                return res.json();
            })
            .then(data => {
                const remoteVer = data.version;
                const localVer = getLocalVersion();

                if (!remoteVer) return;

                // 首次访问：存下当前版本，不提示
                if (!localVer) {
                    setLocalVersion(remoteVer);
                    return;
                }

                // 如果远程版本与本地不同，说明有新部署
                if (remoteVer !== localVer) {
                    showUpdateNotification(remoteVer);
                }
            })
            .catch(err => {
                // 静默失败，不影响网站主逻辑
                // console.warn('Version check failed:', err);
            });
    }

    // ---------- 显示更新通知（定制样式，与你的网站风格一致） ----------
    function showUpdateNotification(remoteVer) {
        // 防止重复弹窗
        if (document.querySelector('.update-toast')) return;

        const toast = document.createElement('div');
        toast.className = 'update-toast';
        toast.innerHTML = `
            <div class="update-toast-content">
                <span>🔄 网站已更新 <span style="font-size:12px;opacity:0.7;">(${remoteVer})</span></span>
                <button class="update-toast-btn">立即刷新</button>
            </div>
        `;

        // 样式设计（适配你网站暖色调）
        const style = document.createElement('style');
        style.textContent = `
            .update-toast {
                position: fixed;
                bottom: 30px;
                left: 50%;
                transform: translateX(-50%);
                background: #3d352e;
                color: #f5f2eb;
                padding: 12px 24px;
                border-radius: 40px;
                box-shadow: 0 8px 30px rgba(0,0,0,0.2);
                z-index: 99999;
                font-family: 'Montserrat', sans-serif;
                font-size: 14px;
                border: 1px solid #b5654b;
                animation: slideUp 0.4s ease-out;
                backdrop-filter: blur(4px);
                background: rgba(45, 42, 36, 0.92);
            }
            .update-toast-content {
                display: flex;
                align-items: center;
                gap: 18px;
            }
            .update-toast-btn {
                background: #b5654b;
                border: none;
                color: #fff;
                padding: 6px 20px;
                border-radius: 30px;
                font-weight: 600;
                font-size: 13px;
                cursor: pointer;
                transition: background 0.2s;
                letter-spacing: 0.5px;
                box-shadow: 0 2px 8px rgba(181, 101, 75, 0.3);
            }
            .update-toast-btn:hover {
                background: #9a4f38;
                transform: scale(1.02);
            }
            .update-toast-btn:active {
                transform: scale(0.96);
            }
            @keyframes slideUp {
                from { opacity: 0; transform: translateX(-50%) translateY(20px); }
                to { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
            @media (max-width: 640px) {
                .update-toast {
                    width: 90%;
                    padding: 12px 16px;
                    bottom: 16px;
                    font-size: 13px;
                }
                .update-toast-content {
                    flex-wrap: wrap;
                    justify-content: center;
                    gap: 10px;
                }
            }
        `;

        document.head.appendChild(style);

        // 点击刷新按钮：更新本地存储并刷新页面
        const btn = toast.querySelector('.update-toast-btn');
        btn.addEventListener('click', function () {
            setLocalVersion(remoteVer);
            window.location.reload();
        });

        // 也可以点击整个 Toast 刷新（可选）
        toast.addEventListener('click', function (e) {
            if (e.target.tagName !== 'BUTTON') {
                setLocalVersion(remoteVer);
                window.location.reload();
            }
        });

        document.body.appendChild(toast);

        // 5分钟后自动关闭（可选）
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.opacity = '0';
                toast.style.transition = 'opacity 0.5s';
                setTimeout(() => toast.remove(), 500);
            }
        }, 300000);
    }

    // ---------- 启动轮询 ----------
    // 1. 首次加载立即检测
    if (document.readyState === 'complete') {
        checkUpdate();
    } else {
        window.addEventListener('load', checkUpdate);
    }

    // 2. 定时轮询
    setInterval(checkUpdate, CHECK_INTERVAL);

    // 3. 用户切回页面时（从后台恢复）主动检测一次
    document.addEventListener('visibilitychange', function () {
        if (!document.hidden) {
            // 切回页面时，延迟2秒检测（避免频繁请求）
            clearTimeout(window._visibilityTimer);
            window._visibilityTimer = setTimeout(checkUpdate, 2000);
        }
    });

})();