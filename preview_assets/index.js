// 本段脚本与整个网站有直接关联
// 若禁用将无法访问网站
(function antiDebug() {
    'use strict';

    // ---------- 1. 禁止右键菜单 ----------
    document.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        // 可选：给用户一个友好提示（静默处理更隐蔽，这里演示）
        // console.log('右键已禁用');
        return false;
    });

    // ---------- 2. 禁止文本选择 / 复制 (辅助) ----------
    document.addEventListener('selectstart', function (e) {
        e.preventDefault();
    });
    document.addEventListener('copy', function (e) {
        e.preventDefault();
        // 可选：提示或静默
    });

    // ---------- 3. 拦截键盘快捷键 ----------
    const forbiddenKeys = {
        // F12
        123: true,
        // Ctrl+Shift+I (73 = I)
        '73_shift_ctrl': true,
        // Ctrl+Shift+J (74 = J)
        '74_shift_ctrl': true,
        // Ctrl+U (85 = U)
        '85_ctrl': true,
        // Ctrl+Shift+C (67 = C) 元素选择
        '67_shift_ctrl': true,
        // Ctrl+S (83) 保存页面 —— 虽然不是开调试工具，但阻止保存源代码
        '83_ctrl': true,
    };

    document.addEventListener('keydown', function (e) {
        const key = e.keyCode || e.which;
        const ctrl = e.ctrlKey || e.metaKey;
        const shift = e.shiftKey;

        // 构建组合键标识
        let combo = '';
        if (ctrl) combo += 'ctrl';
        if (shift) combo += (combo ? '_shift' : 'shift');
        if (combo) {
            combo = key + '_' + combo;
        } else {
            combo = String(key);
        }

        // 检查是否在禁止列表中
        if (forbiddenKeys[combo] || forbiddenKeys[key]) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }

        // 额外：单独拦截 F12 (keyCode 123)
        if (key === 123) {
            e.preventDefault();
            return false;
        }
    });

    // ---------- 4. 检测开发者工具是否打开 (基于 debugger) ----------
    // 方法：使用 setInterval 不断触发 debugger，如果开发者工具打开则会中断
    // 但为了避免干扰正常用户，使用 try/catch 静默处理
    // 并且当 debugger 被触发时，执行一些操作（如清空控制台、跳转等）

    function detectDevTools() {
        const start = performance.now();
        // 使用 debugger 语句，如果 DevTools 打开，执行时间会显著变长
        debugger;
        const end = performance.now();
        const elapsed = end - start;
        // 如果执行时间超过 100ms，认为 DevTools 可能打开
        // 但为了更准确，结合其他检测
        if (elapsed > 100) {
            // 开发者工具可能打开，执行反制
            handleDevToolsOpen();
        }
    }

    function handleDevToolsOpen() {
        // 反制策略：清空控制台、使页面跳转、或不断触发 debugger 干扰
        // 这里使用组合策略：清空控制台 + 不断触发 debugger

        // 1. 清空控制台（如果可用）
        if (window.console && console.clear) {
            console.clear();
        }

        // 2. 不断触发 debugger 让调试者难以操作
        // 但注意：这会阻塞主线程，所以使用间隔触发
        if (!window._debuggerInterval) {
            window._debuggerInterval = setInterval(function () {
                // 使用 Function 构造器避免被某些工具拦截
                (function () {
                    debugger;
                })();
                // 再次清空控制台
                if (window.console && console.clear) {
                    console.clear();
                }
            }, 500);
        }

        // 3. 可选：跳转到其他页面（慎用，会影响用户体验）
        // window.location.href = 'about:blank';
    }

    // ---------- 5. 使用 Element 尺寸检测法 (更隐蔽) ----------
    // 原理：当 DevTools 打开时，某些元素的尺寸会变化（如 <html> 或 <body>）
    // 利用 getBoundingClientRect 检测

    function detectByElementSize() {
        const threshold = 150; // 毫秒
        const start = performance.now();

        // 创建一个不可见元素，检测其尺寸变化
        const div = document.createElement('div');
        div.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:100px;height:100px;z-index:-9999;';
        document.body.appendChild(div);

        // 不断检测
        let lastWidth = div.offsetWidth;
        let lastHeight = div.offsetHeight;

        setInterval(function () {
            const w = div.offsetWidth;
            const h = div.offsetHeight;
            // 如果尺寸发生变化，可能 DevTools 正在调整
            if (w !== lastWidth || h !== lastHeight) {
                // 触发反制
                handleDevToolsOpen();
                // 更新记录
                lastWidth = w;
                lastHeight = h;
            }
        }, 1000);

        // 稍后移除元素（但为了持续检测，保留）
        // 实际上我们保留它，但为了不影响页面，放在角落
    }

    // ---------- 6. 监听控制台输出 (console.log 重写) ----------
    // 如果控制台被打开，某些浏览器会触发 console.log 的调用
    // 这里不重点使用，因为容易被绕过

    // ---------- 7. 结合多种检测，定期执行 ----------
    function startDetection() {
        // 每 2 秒检测一次 debugger 方法
        setInterval(function () {
            detectDevTools();
        }, 2000);

        // 启动尺寸检测
        detectByElementSize();

        // 额外：检测窗口尺寸变化 (F12 侧边栏会改变窗口大小)
        let lastWindowWidth = window.outerWidth;
        let lastWindowHeight = window.outerHeight;

        setInterval(function () {
            const w = window.outerWidth;
            const h = window.outerHeight;
            // 如果窗口尺寸显著变化，可能 DevTools 打开/关闭
            // 但用户正常调整窗口也会触发，所以结合其他检测
            if (Math.abs(w - lastWindowWidth) > 100 || Math.abs(h - lastWindowHeight) > 100) {
                // 不立即触发，而是用 debugger 检测确认
                detectDevTools();
            }
            lastWindowWidth = w;
            lastWindowHeight = h;
        }, 3000);
    }

    // ---------- 8. 防挂起：如果页面被挂起，重新激活检测 ----------
    // 当页面可见性变化时，重新初始化
    document.addEventListener('visibilitychange', function () {
        if (!document.hidden) {
            // 页面重新可见，确保检测运行
            if (!window._antiDebugStarted) {
                startDetection();
                window._antiDebugStarted = true;
            }
        }
    });

    // ---------- 9. 针对 iframe 内嵌的防护 ----------
    // 如果页面在 iframe 中，部分检测可能失效，但这里不做特殊处理

    // ---------- 10. 启动 ----------
    // 标记已启动
    window._antiDebugStarted = true;
    startDetection();

    // 额外：页面加载完成后再次强化
    window.addEventListener('load', function () {
        // 再次确保所有监听生效
        // 重新注册一些关键事件
        document.addEventListener('contextmenu', function (e) {
            e.preventDefault();
            return false;
        });
    });

    // 控制台输出警告（但会被后续清空）
    console.log('%c⚠️ 开发者工具已被检测', 'color:red;font-size:20px;');

    // ---------- 11. 终极：如果检测到 console 被打开，持续干扰 ----------
    // 利用 Function.prototype.toString 检测 console 是否被篡改
    // 但这里不深入，避免过度复杂

    console.log('🔒 防调试脚本已加载 ✅');

    // 为了防止被轻易禁用，使用 Object.defineProperty 保护关键函数
    // （但这在浏览器中有限制，仅做示意）
    try {
        Object.defineProperty(window, '_antiDebugStarted', {
            writable: false,
            configurable: false,
        });
    } catch (_) { /* 忽略 */ }

    let h = window.innerHeight
    let w = window.innerWidth;
    window.onresize = function () {
        if (h !== window.innerHeight || w !== window.innerWidth) {
            window.close(); // 尝试关闭
        }
    };

})();