// 极致反调试脚本 - 优化版（降低误报）
(function() {
    'use strict';

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

    // 移动端或小屏幕设备直接跳过反调试（避免误报）
    const isMobile = ('ontouchstart' in window) || window.innerWidth < 768;
    if (isMobile) {
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
    // 3. 检测 DevTools（优化阈值 + 连续确认）
    // ============================================================
    let debugDetected = false;
    let defenseStarted = false;
    let anomalyCount = 0; // 连续异常计数
    const MAX_ANOMALIES = 3; // 连续 3 次才触发
    let lastHtmlWidth = document.documentElement.offsetWidth;
    let lastCheckTime = 0;

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
        // 如果已经检测到，不再重复检测
        if (debugDetected) return;

        let anomaly = false;

        // 1. 性能检测（阈值 120ms）
        const start = performance.now();
        debugger;
        const elapsed = performance.now() - start;
        if (elapsed > 120) {
            anomaly = true;
        }

        // 2. 窗口尺寸差异（阈值 150px）
        const outerW = window.outerWidth;
        const innerW = window.innerWidth;
        const outerH = window.outerHeight;
        const innerH = window.innerHeight;
        if (outerW - innerW > 150 || outerH - innerH > 150) {
            anomaly = true;
        }

        // 3. 尺寸变化（阈值 80px）
        const now = performance.now();
        if (now - lastCheckTime > 1000) {
            const currentWidth = document.documentElement.offsetWidth;
            if (Math.abs(currentWidth - lastHtmlWidth) > 80) {
                const start2 = performance.now();
                debugger;
                const elapsed2 = performance.now() - start2;
                if (elapsed2 > 120) {
                    anomaly = true;
                }
                lastHtmlWidth = currentWidth;
            }
            lastCheckTime = now;
        }

        // 4. 其他检测
        if (window.Firebug && window.Firebug.chrome && window.Firebug.chrome.isInitialized) {
            anomaly = true;
        }
        if (detectDevToolsHooks()) {
            anomaly = true;
        }
        if (detectBreakpoint()) {
            anomaly = true;
        }
        if (detectWebDriver()) {
            anomaly = true;
        }

        // 如果当前检测到异常，增加计数；否则重置计数
        if (anomaly) {
            anomalyCount++;
        } else {
            anomalyCount = 0;
        }

        // 连续异常达到阈值，触发防御
        if (anomalyCount >= MAX_ANOMALIES) {
            debugDetected = true;
            triggerDefense();
        }
    }

    // ============================================================
    // 4. 防御措施（跳转空白页 + 干扰）
    // ============================================================
    function triggerDefense() {
        if (defenseStarted) return;
        defenseStarted = true;

        // 跳转空白页（仅一次）
        if (!sessionStorage.getItem('_debug_redirect_done')) {
            sessionStorage.setItem('_debug_redirect_done', '1');
            setTimeout(() => {
                location.replace('about:blank');
            }, 50);
        }

        // 原有防御措施（debugger 循环、垃圾信息、标题闪烁、hash 干扰等）
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
    // 5. 启动检测
    // ============================================================
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

    window.addEventListener('load', detectDevTools);

    console.log('%c✅ 反调试已启动（低误报模式）', 'color: green; font-size: 16px;');
})();