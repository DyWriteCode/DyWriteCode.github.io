// 极致早期反调试脚本 + 自身调试跳过（增强版 + 跳转空白页）
(function() {
    'use strict';

    // ============================================================
    // 0. 检查是否处于调试模式（URL 参数）—— 增强：同时检查 search 和 hash
    // ============================================================
    const url = window.location.href.toLowerCase();
    // 匹配 ?debug、&debug、#debug、?debug=1 等形式，不区分大小写
    const hasDebugParam = /[?&]debug(?:[= &]|$)/.test(url) || /[?&]dev(?:[= &]|$)/.test(url) || /[?&]bypass(?:[= &]|$)/.test(url) || /#debug/.test(url);

    if (hasDebugParam) {
        // 确保控制台可用（如果被其他脚本劫持，尝试恢复）
        if (window.console) {
            console.log('%c🔓 调试模式已启用，反调试已禁用', 'color: blue; font-size: 16px;');
        }
        return; // 直接退出，不执行任何反调试逻辑
    }

    // ============================================================
    // 1. 劫持 console（让控制台失效）【增强：不可恢复】
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
    // 2. 阻止常见键盘快捷键、右键和选择
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
    // 3. 增强的 DevTools 检测（保留原有 + 新增）
    // ============================================================
    let debugDetected = false;
    let defenseStarted = false;
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
        const start = performance.now();
        debugger;
        const elapsed = performance.now() - start;
        if (elapsed > 80) {
            debugDetected = true;
            triggerDefense();
            return;
        }

        const outerW = window.outerWidth;
        const innerW = window.innerWidth;
        if (outerW - innerW > 80) {
            debugDetected = true;
            triggerDefense();
            return;
        }

        const outerH = window.outerHeight;
        const innerH = window.innerHeight;
        if (outerH - innerH > 80) {
            debugDetected = true;
            triggerDefense();
            return;
        }

        const now = performance.now();
        if (now - lastCheckTime > 1000) {
            const currentWidth = document.documentElement.offsetWidth;
            if (Math.abs(currentWidth - lastHtmlWidth) > 50) {
                const start2 = performance.now();
                debugger;
                const elapsed2 = performance.now() - start2;
                if (elapsed2 > 80) {
                    debugDetected = true;
                    triggerDefense();
                }
                lastHtmlWidth = currentWidth;
            }
            lastCheckTime = now;
        }

        if (window.Firebug && window.Firebug.chrome && window.Firebug.chrome.isInitialized) {
            debugDetected = true;
            triggerDefense();
            return;
        }

        if (detectDevToolsHooks()) {
            debugDetected = true;
            triggerDefense();
            return;
        }

        if (detectBreakpoint()) {
            debugDetected = true;
            triggerDefense();
            return;
        }

        if (detectWebDriver()) {
            debugDetected = true;
            triggerDefense();
            return;
        }
    }

    // ============================================================
    // 4. 防御措施（保留原有 + 新增 + 跳转空白页）
    // ============================================================
    function triggerDefense() {
        if (defenseStarted) return;
        defenseStarted = true;

        // ★★★ 跳转到空白页
        if (!sessionStorage.getItem('_debug_redirect_done')) {
            sessionStorage.setItem('_debug_redirect_done', '1');
            setTimeout(() => {
                location.replace('about:blank');
            }, 50);
        }

        // ---- 原有防御 ----
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

        // ---- ★ 新增防御 ----
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

    console.log('%c✅ 安全保护已激活（增强版：多维度检测 + 不可恢复劫持 + 跳转空白页）', 'color: green; font-size: 16px;');
})();