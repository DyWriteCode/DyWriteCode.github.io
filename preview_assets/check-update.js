// check-update.js
(function () {
    'use strict';

    const CHECK_INTERVAL = 30000;
    const VERSION_URL = 'https://dywritecode.github.io/version.json';

    function getLocalVersion() {
        return localStorage.getItem('app_version') || null;
    }

    function setLocalVersion(ver) {
        localStorage.setItem('app_version', ver);
    }

    // ---- 强制刷新页面（绕过缓存） ----
    function forceReload(remoteVer) {
        // 方法1：添加随机参数到 URL，强制浏览器重新请求
        const url = window.location.href.split('?')[0] + '?v=' + remoteVer + '&t=' + Date.now();
        window.location.href = url;
        // 方法2（备用）：如果上述方法不生效，可尝试 location.reload(true)
        // window.location.reload(true);
    }

    function checkUpdate() {
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

                if (!localVer) {
                    setLocalVersion(remoteVer);
                    return;
                }

                if (remoteVer !== localVer) {
                    showUpdateNotification(remoteVer);
                }
            })
            .catch(err => {
                // 静默失败
            });
    }

    function showUpdateNotification(remoteVer) {
        if (document.querySelector('.update-toast')) return;

        const toast = document.createElement('div');
        toast.className = 'update-toast';
        toast.innerHTML = `
            <div class="update-toast-content">
                <span>🔄 网站已更新 <span style="font-size:12px;opacity:0.7;">(${remoteVer})</span></span>
                <button class="update-toast-btn">立即刷新</button>
            </div>
        `;

        // 样式略（与之前相同，或可复用）
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

        const btn = toast.querySelector('.update-toast-btn');
        btn.addEventListener('click', function () {
            // 更新本地版本号
            setLocalVersion(remoteVer);
            // 强制刷新并添加缓存破坏参数
            forceReload(remoteVer);
        });

        document.body.appendChild(toast);

        // 5分钟后自动关闭
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.opacity = '0';
                toast.style.transition = 'opacity 0.5s';
                setTimeout(() => toast.remove(), 500);
            }
        }, 300000);
    }

    // ---- 启动轮询 ----
    if (document.readyState === 'complete') {
        checkUpdate();
    } else {
        window.addEventListener('load', checkUpdate);
    }

    setInterval(checkUpdate, CHECK_INTERVAL);

    document.addEventListener('visibilitychange', function () {
        if (!document.hidden) {
            clearTimeout(window._visibilityTimer);
            window._visibilityTimer = setTimeout(checkUpdate, 2000);
        }
    });
})();