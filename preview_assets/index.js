/**
 * ============================================================
 * 反调试脚本 - 终极优化版
 * 功能：console劫持、键盘阻止、多维检测、自保护、跳转空白页
 * ============================================================
 */
(function() {
    'use strict';

    // ========== 0. 调试模式放行（URL 或 localStorage） ==========
    const url = location.href.toLowerCase();
    if (url.includes('debug') || url.includes('dev') || url.includes('bypass') || localStorage.getItem('debug_mode') === '1') {
        console.log('%c🔓 调试模式已启用，反调试已禁用', 'color:blue;font-size:16px;');
        return;
    }

    // 移动端（触屏）跳过，因无法打开 DevTools
    if ('ontouchstart' in window) {
        console.log('%c📱 移动端已跳过反调试', 'color:gray;font-size:14px;');
        return;
    }

    // ========== 1. console 劫持（不可恢复） ==========
    const noop = () => {};
    const consoleProps = ['log','warn','error','info','debug','trace','dir','dirxml','group','groupEnd','time','timeEnd','table','count','assert','profile','profileEnd','clear'];
    consoleProps.forEach(prop => {
        if (console[prop]) {
            Object.defineProperty(console, prop, {
                value: noop,
                writable: false,
                configurable: false
            });
        }
    });

    // ========== 2. 阻止右键、复制、选择 ==========
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('selectstart', e => e.preventDefault());
    document.addEventListener('copy', e => e.preventDefault());

    // ========== 3. 阻止开发者工具快捷键 ==========
    const keyMap = {
        123: true,                         // F12
        '73_shift_ctrl': true,             // Ctrl+Shift+I
        '74_shift_ctrl': true,             // Ctrl+Shift+J
        '67_shift_ctrl': true,             // Ctrl+Shift+C
        '85_ctrl': true,                   // Ctrl+U
        '83_ctrl': true                    // Ctrl+S
    };
    document.addEventListener('keydown', e => {
        const key = e.keyCode || e.which;
        const ctrl = e.ctrlKey || e.metaKey;
        const shift = e.shiftKey;
        let combo = '';
        if (ctrl) combo += 'ctrl';
        if (shift) combo += (combo ? '_shift' : 'shift');
        if (combo) combo = key + '_' + combo;
        else combo = String(key);
        if (keyMap[combo] || keyMap[key]) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    });

    // ========== 4. 检测引擎（多维度，低误报） ==========
    let anomalyCount = 0;
    const MAX_ANOMALIES = 5;          // 连续5次异常才触发
    let isDebugDetected = false;
    let isDefenseTriggered = false;
    let detectionStarted = false;

    // --- 帧率检测 ---
    let fpsCheckCount = 0;
    let fpsAnomalyCount = 0;
    const FPS_THRESHOLD = 20;          // 低于20fps视为异常
    const FPS_CHECK_INTERVAL = 2000;   // 2秒检测周期
    let lastFpsCheck = performance.now();

    function detectFPS() {
        const now = performance.now();
        const delta = now - lastFpsCheck;
        if (delta < FPS_CHECK_INTERVAL) {
            const frameInterval = delta / (++fpsCheckCount);
            if (frameInterval > (1000 / FPS_THRESHOLD)) {
                fpsAnomalyCount++;
            } else {
                fpsAnomalyCount = Math.max(0, fpsAnomalyCount - 0.5);
            }
        } else {
            fpsCheckCount = 0;
            lastFpsCheck = now;
        }
        return fpsAnomalyCount >= 3;   // 连续3次帧率异常
    }

    // --- DevTools 全局钩子检测 ---
    function hasDevToolsHooks() {
        const hooks = [
            window.__REACT_DEVTOOLS_GLOBAL_HOOK__,
            window.__VUE_DEVTOOLS_GLOBAL_HOOK__,
            window.__REDUX_DEVTOOLS_EXTENSION__,
            window.devtools,
            window.chrome?.devtools
        ];
        return hooks.some(hook => !!hook);
    }

    // --- 断点检测（debugger 后变量是否被赋值） ---
    function detectBreakpoint() {
        let flag = false;
        try {
            (function() {
                debugger;
                flag = true;
            })();
        } catch (_) {}
        return !flag;   // 如果 flag 为 false，说明 debugger 被跳过（调试器附着）
    }

    // --- webdriver 检测 ---
    function detectWebDriver() {
        return navigator.webdriver === true;
    }

    // --- 元素面板检测（某些调试器会注入属性） ---
    function detectElementInspect() {
        const html = document.documentElement;
        if (html.getAttribute('inspect') !== null) return true;
        if (html.style['-webkit-device-pixel-ratio']) return true;
        return false;
    }

    // --- Firebug（旧版）检测 ---
    function detectFirebug() {
        return !!(window.Firebug && window.Firebug.chrome && window.Firebug.chrome.isInitialized);
    }

    // --- 综合检测 ---
    function detectDevTools() {
        if (isDebugDetected || !detectionStarted) return;

        let anomaly = false;

        // 1. 性能检测（debugger 执行耗时 > 150ms 判定异常）
        const start = performance.now();
        debugger;
        if (performance.now() - start > 150) {
            anomaly = true;
        }

        // 2. 窗口尺寸差异（侧边栏/底部面板 > 250px）
        const outerW = window.outerWidth;
        const innerW = window.innerWidth;
        const outerH = window.outerHeight;
        const innerH = window.innerHeight;
        if ((outerW - innerW > 250) || (outerH - innerH > 250)) {
            anomaly = true;
        }

        // 3. 其他检测
        if (hasDevToolsHooks()) anomaly = true;
        if (detectBreakpoint()) anomaly = true;
        if (detectWebDriver()) anomaly = true;
        if (detectFirebug()) anomaly = true;
        if (detectElementInspect()) anomaly = true;

        // 4. 帧率检测（单独判断，避免与其他检测耦合）
        if (detectFPS()) anomaly = true;

        // 更新连续异常计数
        if (anomaly) {
            anomalyCount++;
        } else {
            anomalyCount = 0;
        }

        if (anomalyCount >= MAX_ANOMALIES) {
            isDebugDetected = true;
            triggerDefense();
        }
    }

    // ========== 5. 防御触发（保留跳转空白页） ==========
    function triggerDefense() {
        if (isDefenseTriggered) return;
        isDefenseTriggered = true;

        // ---- 跳转空白页（仅一次） ----
        if (!sessionStorage.getItem('_debug_redirect_done')) {
            sessionStorage.setItem('_debug_redirect_done', '1');
            setTimeout(() => {
                location.replace('about:blank');
            }, 50);
        }

        // ---- 高频 debugger 干扰 ----
        setInterval(() => {
            try { (function(){ debugger; })(); } catch (_) {}
        }, 80);

        // ---- 控制台刷屏 ----
        setInterval(() => {
            for (let i = 0; i < 50; i++) {
                console.log('%c'.repeat(500), 'color:transparent;');
                console.warn('Debugging blocked');
            }
        }, 150);

        // ---- 标题闪烁 ----
        let titleState = 0;
        setInterval(() => {
            document.title = titleState++ % 2 === 0 ? '🔒 调试被阻止' : '正常页面';
        }, 300);

        // ---- 哈希干扰 ----
        let hashCounter = 0;
        setInterval(() => {
            location.hash = 'dbg_' + (hashCounter++);
            if (hashCounter > 1000) hashCounter = 0;
        }, 400);

        // ---- 阻止 eval/Function 恢复 console ----
        const origEval = window.eval;
        window.eval = function(str) {
            if (typeof str === 'string' && (str.includes('console') || str.includes('debugger'))) {
                return undefined;
            }
            return origEval(str);
        };
        const origFunction = window.Function;
        window.Function = function(...args) {
            const body = args[args.length - 1] || '';
            if (typeof body === 'string' && (body.includes('console') || body.includes('debugger'))) {
                return function() {};
            }
            return origFunction.apply(this, args);
        };

        // ---- 定期重劫持 console ----
        setInterval(() => {
            consoleProps.forEach(prop => {
                if (console[prop]) {
                    try {
                        Object.defineProperty(console, prop, {
                            value: noop,
                            writable: false,
                            configurable: false
                        });
                    } catch (_) {}
                }
            });
        }, 500);

        // ---- 额外 debugger 注入（eval 动态） ----
        setInterval(() => {
            eval('(function(){debugger;})();');
        }, 50);

        // ---- 锁定 console 对象 ----
        try {
            Object.defineProperty(window, 'console', {
                value: console,
                writable: false,
                configurable: false
            });
        } catch (_) {}
    }

    // ========== 6. 自保护机制 ==========
    function selfProtect() {
        // 标记自身存在
        Object.defineProperty(window, '__ANTI_DEBUG_LOADED__', {
            value: true,
            writable: false,
            configurable: false
        });

        // 监控 script 标签是否被删除
        setInterval(() => {
            const scripts = document.querySelectorAll('script[src*="preview_assets/index.js"]');
            if (scripts.length === 0) {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdmirror.com/gh/DyWriteCode/DyWriteCode.github.io@main/preview_assets/index.js';
                script.crossOrigin = 'anonymous';
                document.head.appendChild(script);
            }
        }, 1000);

        // 保护 console 方法不被覆盖（双重保险）
        setInterval(() => {
            consoleProps.forEach(prop => {
                if (console[prop] !== noop) {
                    try {
                        Object.defineProperty(console, prop, {
                            value: noop,
                            writable: false,
                            configurable: false
                        });
                    } catch (_) {}
                }
            });
        }, 300);
    }

    // ========== 7. 启动检测（延迟 2 秒） ==========
    function startDetection() {
        detectionStarted = true;
        detectDevTools();

        setInterval(detectDevTools, 200);

        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                detectDevTools();
            }, 300);
        });

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                detectDevTools();
            }
        });
    }

    if (document.readyState === 'complete') {
        setTimeout(startDetection, 2000);
    } else {
        window.addEventListener('load', () => {
            setTimeout(startDetection, 2000);
        });
    }

    // ========== 8. 启动自保护 ==========
    selfProtect();

    console.log('%c✅ 反调试终极版已启动（含跳转空白页、自保护）', 'color:green;font-size:16px;');
})();