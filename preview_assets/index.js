// 极致反调试脚本 - 仅使用可靠检测，保留跳转
(function() {
    'use strict';

    // ============================================================
    // 自保护：检测自身是否被篡改或移除
    // ============================================================
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
                console.warn('⚠️ 检测到反调试脚本被移除，已重新注入');
            }
        }, 1000);
    }

    // ============================================================
    // 0. 检查调试模式（URL 或 localStorage）
    // ============================================================
    const url = window.location.href.toLowerCase();
    const isDebugByUrl = url.includes('debug') || url.includes('dev') || url.includes('bypass');
    const isDebugByStorage = localStorage.getItem('debug_mode') === '1';
    if (isDebugByUrl || isDebugByStorage) {
        console.log('%c🔓 调试模式已启用，反调试已禁用', 'color: blue; font-size: 16px;');
        return;
    }

    // 移动端跳过（无法打开 DevTools）
    if ('ontouchstart' in window) {
        console.log('%c📱 移动端已跳过反调试', 'color: gray; font-size: 14px;');
        return;
    }

    // ============================================================
    // 1. 劫持 console（不可恢复）
    // ============================================================
    const noop = () => {};
    const consoleMethods = ['log', 'warn', 'error', 'info', 'debug', 'trace', 'dir', 'dirxml', 'group', 'groupEnd', 'time', 'timeEnd', 'table', 'count', 'assert', 'profile', 'profileEnd'];
    consoleMethods.forEach(m => {
        if (console[m]) {
            Object.defineProperty(console, m, {
                value: noop,
                writable: false,
                configurable: false
            });
        }
    });
    Object.defineProperty(console, 'clear', {
        value: noop,
        writable: false,
        configurable: false
    });

    // ============================================================
    // 2. 阻止键盘快捷键、右键、复制
    // ============================================================
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('selectstart', e => e.preventDefault());
    document.addEventListener('copy', e => e.preventDefault());

    const keyBlock = {
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
        if (keyBlock[combo] || keyBlock[key]) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    });

    // ============================================================
    // 3. 可靠检测（移除窗口尺寸检测，仅保留性能+钩子+断点+webdriver）
    // ============================================================
    let debugDetected = false;
    let defenseStarted = false;
    let anomalyCount = 0;
    const MAX_ANOMALIES = 5;
    let detectionStarted = false;

    function detectDevToolsHooks() {
        const hooks = [
            window.__REACT_DEVTOOLS_GLOBAL_HOOK__,
            window.__VUE_DEVTOOLS_GLOBAL_HOOK__,
            window.__REDUX_DEVTOOLS_EXTENSION__,
            window.devtools,
            window.chrome?.devtools
        ];
        for (let hook of hooks) {
            if (hook) return true;
        }
        return false;
    }

    function detectBreakpoint() {
        let isBreak = false;
        try {
            (function() {
                debugger;
                isBreak = true;
            })();
        } catch(e) {}
        return !isBreak;
    }

    function detectWebDriver() {
        return navigator.webdriver === true;
    }

    function detectDevTools() {
        if (debugDetected || !detectionStarted) return;

        let anomaly = false;

        // 1. 性能检测（阈值 150ms）
        const start = performance.now();
        debugger;
        const elapsed = performance.now() - start;
        if (elapsed > 150) {
            anomaly = true;
        }

        // 2. DevTools 钩子
        if (detectDevToolsHooks()) {
            anomaly = true;
        }

        // 3. 断点检测
        if (detectBreakpoint()) {
            anomaly = true;
        }

        // 4. webdriver
        if (detectWebDriver()) {
            anomaly = true;
        }

        // 5. Firebug（旧版）
        if (window.Firebug && window.Firebug.chrome && window.Firebug.chrome.isInitialized) {
            anomaly = true;
        }

        if (anomaly) {
            anomalyCount++;
        } else {
            anomalyCount = 0;
        }

        if (anomalyCount >= MAX_ANOMALIES) {
            debugDetected = true;
            triggerDefense();
        }
    }

    // ============================================================
    // 4. 防御措施（保留全部，含跳转空白页）
    // ============================================================
    function triggerDefense() {
        if (defenseStarted) return;
        defenseStarted = true;

        // ★ 跳转空白页（仅一次）
        if (!sessionStorage.getItem('_debug_redirect_done')) {
            sessionStorage.setItem('_debug_redirect_done', '1');
            setTimeout(() => {
                location.replace('about:blank');
            }, 50);
        }

        // ---- 原有全部防御 ----
        setInterval(() => {
            try { (function(){ debugger; })(); } catch (e) {}
        }, 80);

        setInterval(() => {
            for (let i = 0; i < 50; i++) {
                console.log('%c'.repeat(500), 'color: transparent;');
                console.warn('Debugging blocked');
            }
        }, 150);

        setInterval(() => {
            document.title = document.title === '🔒 调试被阻止' ? '正常页面' : '🔒 调试被阻止';
        }, 300);

        let c = 0;
        setInterval(() => {
            window.location.hash = 'dbg_' + (c++);
            if (c > 1000) c = 0;
        }, 400);

        const originalEval = window.eval;
        window.eval = function(str) {
            if (typeof str === 'string' && (str.includes('console') || str.includes('debugger'))) {
                return undefined;
            }
            return originalEval(str);
        };
        const originalFunction = window.Function;
        window.Function = function(...args) {
            const body = args[args.length - 1] || '';
            if (typeof body === 'string' && (body.includes('console') || body.includes('debugger'))) {
                return function() {};
            }
            return originalFunction.apply(this, args);
        };

        setInterval(() => {
            consoleMethods.forEach(m => {
                if (console[m]) console[m] = noop;
            });
            console.clear = noop;
        }, 500);

        setInterval(() => {
            eval('(function(){debugger;})();');
        }, 50);

        Object.defineProperty(window, 'console', {
            value: console,
            writable: false,
            configurable: false
        });
    }

    // ============================================================
    // 5. 延迟启动检测（2 秒后，且页面完全加载）
    // ============================================================
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

    // ============================================================
    // 6. 自保护
    // ============================================================
    selfProtect();

    console.log('%c✅ 反调试已启动（仅可靠检测，保留跳转，自保护已启用）', 'color: green; font-size: 16px;');
})();