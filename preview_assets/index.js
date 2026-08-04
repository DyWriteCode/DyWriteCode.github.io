/**
 * 反调试脚本
 */
(function () {
    'use strict';

    // ========== 调试模式放行 ==========
    const url = location.href.toLowerCase();
    if (url.includes('debug') || url.includes('dev') || url.includes('bypass') || localStorage.getItem('debug_mode') === '1') {
        console.log('%c🔓 调试模式已启用，反调试已禁用', 'color:blue;font-size:16px;');
        return;
    }

    // 移动端跳过（无法打开 DevTools）
    if ('ontouchstart' in window) {
        console.log('%c📱 移动端已跳过反调试', 'color:gray;font-size:14px;');
        return;
    }

    // ========== console 劫持（不可恢复） ==========
    const noop = () => { };
    const consoleProps = ['log', 'warn', 'error', 'info', 'debug', 'trace', 'dir', 'dirxml', 'group', 'groupEnd', 'time', 'timeEnd', 'table', 'count', 'assert', 'profile', 'profileEnd', 'clear'];
    consoleProps.forEach(prop => {
        if (console[prop]) {
            Object.defineProperty(console, prop, {
                value: noop,
                writable: false,
                configurable: false
            });
        }
    });

    // ========== 键盘/右键阻止 ==========
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('selectstart', e => e.preventDefault());
    document.addEventListener('copy', e => e.preventDefault());

    const keyMap = {
        123: true,
        '73_shift_ctrl': true,
        '74_shift_ctrl': true,
        '67_shift_ctrl': true,
        '85_ctrl': true,
        '83_ctrl': true
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

    // ========== 检测逻辑（极宽松） ==========
    let anomalyCount = 0;
    const MAX_ANOMALIES = 15;          // 连续15次异常才触发
    let isDebugDetected = false;
    let isDefenseTriggered = false;
    let detectionStarted = false;

    // 帧率检测（阈值 5fps）
    let fpsCheckCount = 0;
    let fpsAnomalyCount = 0;
    const FPS_THRESHOLD = 5;
    const FPS_CHECK_INTERVAL = 3000;
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
        return fpsAnomalyCount >= 5;
    }

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

    function detectBreakpoint() {
        let flag = false;
        try {
            (function () {
                debugger;
                flag = true;
            })();
        } catch (_) { }
        return !flag;
    }

    function detectWebDriver() {
        return navigator.webdriver === true;
    }

    function detectElementInspect() {
        const html = document.documentElement;
        if (html.getAttribute('inspect') !== null) return true;
        if (html.style['-webkit-device-pixel-ratio']) return true;
        return false;
    }

    function detectFirebug() {
        return !!(window.Firebug && window.Firebug.chrome && window.Firebug.chrome.isInitialized);
    }

    function detectDevTools() {
        if (isDebugDetected || !detectionStarted) return;

        let anomaly = false;

        // 性能检测（阈值 500ms）
        const start = performance.now();
        debugger;
        if (performance.now() - start > 500) {
            anomaly = true;
        }

        // 窗口尺寸差异（阈值 500px）
        const outerW = window.outerWidth;
        const innerW = window.innerWidth;
        const outerH = window.outerHeight;
        const innerH = window.innerHeight;
        if ((outerW - innerW > 500) || (outerH - innerH > 500)) {
            anomaly = true;
        }

        // 其他检测
        if (hasDevToolsHooks()) anomaly = true;
        if (detectBreakpoint()) anomaly = true;
        if (detectWebDriver()) anomaly = true;
        if (detectFirebug()) anomaly = true;
        if (detectElementInspect()) anomaly = true;
        if (detectFPS()) anomaly = true;

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

    // ========== 防御（保留跳转） ==========
    function triggerDefense() {
        if (isDefenseTriggered) return;
        isDefenseTriggered = true;

        // ★ 跳转空白页（仅一次）
        if (!sessionStorage.getItem('_debug_redirect_done')) {
            sessionStorage.setItem('_debug_redirect_done', '1');
            setTimeout(() => {
                location.replace('about:blank');
            }, 50);
        }

        // 其他干扰措施...
        setInterval(() => {
            try { (function () { debugger; })(); } catch (_) { }
        }, 80);

        setInterval(() => {
            for (let i = 0; i < 50; i++) {
                console.log('%c'.repeat(500), 'color:transparent;');
                console.warn('Debugging blocked');
            }
        }, 150);

        let titleState = 0;
        setInterval(() => {
            document.title = titleState++ % 2 === 0 ? '🔒 调试被阻止' : '正常页面';
        }, 300);

        let hashCounter = 0;
        setInterval(() => {
            location.hash = 'dbg_' + (hashCounter++);
            if (hashCounter > 1000) hashCounter = 0;
        }, 400);

        const origEval = window.eval;
        window.eval = function (str) {
            if (typeof str === 'string' && (str.includes('console') || str.includes('debugger'))) {
                return undefined;
            }
            return origEval(str);
        };

        const origFunction = window.Function;
        window.Function = function (...args) {
            const body = args[args.length - 1] || '';
            if (typeof body === 'string' && (body.includes('console') || body.includes('debugger'))) {
                return function () { };
            }
            return origFunction.apply(this, args);
        };

        setInterval(() => {
            consoleProps.forEach(prop => {
                if (console[prop]) {
                    try {
                        Object.defineProperty(console, prop, {
                            value: noop,
                            writable: false,
                            configurable: false
                        });
                    } catch (_) { }
                }
            });
        }, 500);

        setInterval(() => {
            eval('(function(){debugger;})();');
        }, 50);

        try {
            Object.defineProperty(window, 'console', {
                value: console,
                writable: false,
                configurable: false
            });
        } catch (_) { }
    }

    // ========== 自保护 ==========
    function selfProtect() {
        Object.defineProperty(window, '__ANTI_DEBUG_LOADED__', {
            value: true,
            writable: false,
            configurable: false
        });

        setInterval(() => {
            const scripts = document.querySelectorAll('script[src*="preview_assets/index.js"]');
            if (scripts.length === 0) {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdmirror.com/gh/DyWriteCode/DyWriteCode.github.io@main/preview_assets/index.js';
                script.crossOrigin = 'anonymous';
                document.head.appendChild(script);
            }
        }, 1000);

        setInterval(() => {
            consoleProps.forEach(prop => {
                if (console[prop] !== noop) {
                    try {
                        Object.defineProperty(console, prop, {
                            value: noop,
                            writable: false,
                            configurable: false
                        });
                    } catch (_) { }
                }
            });
        }, 300);
    }

    // ========== 启动（延迟5秒，检测间隔1秒） ==========
    function startDetection() {
        detectionStarted = true;
        detectDevTools();
        setInterval(detectDevTools, 1000);

        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                detectDevTools();
            }, 500);
        });

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                detectDevTools();
            }
        });
    }

    if (document.readyState === 'complete') {
        setTimeout(startDetection, 5000);
    } else {
        window.addEventListener('load', () => {
            setTimeout(startDetection, 5000);
        });
    }

    selfProtect();
    console.log('%c✅ 反调试已启动', 'color:green;font-size:16px;');
})();