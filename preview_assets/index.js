// 极致早期反调试脚本 + 自身调试跳过（增强版 + 跳转空白页）
(function () {
    'use strict';

    // ============================================================
    // 0. 检查是否处于调试模式（URL 参数）
    // ============================================================
    const urlParams = new URLSearchParams(window.location.search);
    const isDebugMode = urlParams.has('debug') || urlParams.has('dev') || urlParams.has('bypass');
    if (isDebugMode) {
        console.log('%c🔓 调试模式已启用，反调试已禁用', 'color: blue; font-size: 16px;');
        return;
    }

    // ============================================================
    // 1. 劫持 console（让控制台失效）【增强：不可恢复】
    // ============================================================
    const noop = () => { };
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

    // ★ 新增：检测 DevTools 全局钩子
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

    // ★ 新增：断点检测
    function detectBreakpoint() {
        let isBreak = false;
        try {
            (function () {
                debugger;
                isBreak = true;
            })();
        } catch (e) { }
        return !isBreak;
    }

    // ★ 新增：检测 navigator.webdriver
    function detectWebDriver() {
        return navigator.webdriver === true;
    }

    // 原有的 detectDevTools 函数增强
    function detectDevTools() {
        // ---- 原有检测 ----
        // 方法1：debugger 性能检测
        const start = performance.now();
        debugger;
        const elapsed = performance.now() - start;
        if (elapsed > 80) {
            debugDetected = true;
            triggerDefense();
            return;
        }

        // 方法2：窗口尺寸差异（侧边栏）
        const outerW = window.outerWidth;
        const innerW = window.innerWidth;
        if (outerW - innerW > 80) {
            debugDetected = true;
            triggerDefense();
            return;
        }

        // 方法3：底部Dock（外高 - 内高）
        const outerH = window.outerHeight;
        const innerH = window.innerHeight;
        if (outerH - innerH > 80) {
            debugDetected = true;
            triggerDefense();
            return;
        }

        // 方法4：documentElement 尺寸变化（二次确认）
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

        // 方法5：检测 Firebug（旧版）
        if (window.Firebug && window.Firebug.chrome && window.Firebug.chrome.isInitialized) {
            debugDetected = true;
            triggerDefense();
            return;
        }

        // ---- ★ 新增检测 ----
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

        // ★★★ 新增：跳转到空白页（仅在第一次触发时执行）
        // 使用 sessionStorage 标记防止无限跳转
        if (!sessionStorage.getItem('_debug_redirect_done')) {
            sessionStorage.setItem('_debug_redirect_done', '1');
            // 延迟一小段时间再跳转，让当前脚本执行完毕
            setTimeout(() => {
                // 使用 location.replace 防止留下历史记录
                location.replace('about:blank');
            }, 50);
            // 注意：跳转后页面会卸载，后续代码可能不会执行，但为了保险，仍然继续执行原有防御
            // 但跳转后页面销毁，以下代码可能没机会执行，但无所谓了。
            // 如果不想跳转后还执行，可以在这里 return，但跳转是异步的，所以这里继续。
        }

        // ---- 原有防御 ----
        // 1) 高频 debugger（每 80ms）
        setInterval(() => {
            try { (function () { debugger; })(); } catch (e) { }
        }, 80);

        // 2) 持续输出垃圾信息
        setInterval(() => {
            for (let i = 0; i < 50; i++) {
                console.log('%c'.repeat(500), 'color: transparent;');
                console.warn('Debugging blocked');
            }
        }, 150);

        // 3) 闪烁标题
        setInterval(() => {
            document.title = document.title === '🔒 调试被阻止' ? '正常页面' : '🔒 调试被阻止';
        }, 300);

        // 4) 干扰 location.hash
        let c = 0;
        setInterval(() => {
            window.location.hash = 'dbg_' + (c++);
            if (c > 1000) c = 0;
        }, 400);

        // 5) 阻止 eval 和 Function 恢复 console
        const originalEval = window.eval;
        window.eval = function (str) {
            if (typeof str === 'string' && (str.includes('console') || str.includes('debugger'))) {
                return undefined;
            }
            return originalEval(str);
        };
        const originalFunction = window.Function;
        window.Function = function (...args) {
            const body = args[args.length - 1] || '';
            if (typeof body === 'string' && (body.includes('console') || body.includes('debugger'))) {
                return function () { };
            }
            return originalFunction.apply(this, args);
        };

        // 6) 定期重新劫持 console（双重保险）
        setInterval(() => {
            consoleMethods.forEach(m => {
                if (console[m]) console[m] = noop;
            });
            console.clear = noop;
        }, 500);

        // ---- ★ 新增防御 ----
        // 7) 更密集的 debugger 注入
        setInterval(() => {
            eval('(function(){debugger;})();');
        }, 50);

        // 8) 阻止 console 对象被删除
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