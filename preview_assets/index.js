// 极致反调试脚本 - 保留跳转，优化误判 + 自保护
(function() {
    'use strict';

    // ============================================================
    // 自保护：检测自身是否被篡改或移除
    // ============================================================
    function selfProtect() {
        // 标记自身存在
        window.__ANTI_DEBUG_LOADED__ = true;

        // 定期检查自身是否被删除（针对通过删除 script 标签绕过）
        setInterval(() => {
            const scripts = document.querySelectorAll('script[src*="preview_assets/index.js"]');
            if (scripts.length === 0) {
                // 如果自身被移除，重新注入（递归注入防止被再次删除）
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdmirror.com/gh/DyWriteCode/DyWriteCode.github.io@main/preview_assets/index.js';
                script.crossOrigin = 'anonymous';
                document.head.appendChild(script);
                // 记录攻击行为
                console.warn('⚠️ 检测到反调试脚本被移除，已重新注入');
            }
        }, 1000);

        // 防止通过 Object.defineProperty 覆盖 window.__ANTI_DEBUG_LOADED__
        Object.defineProperty(window, '__ANTI_DEBUG_LOADED__', {
            value: true,
            writable: false,
            configurable: false
        });
    }

    // ============================================================
    // 0. 检查调试模式（URL 或 localStorage）
    // ============================================================
    const url = window.location.href.toLowerCase();
    const isDebugByUrl = url.includes('debug') || url.includes('dev') || url.includes('bypass');
    const isDebugByStorage = localStorage.getItem('debug_mode') === '1';
    if (isDebugByUrl || isDebugByStorage) {
        console.log('%c🔓 调试模式已启用，反调试已禁用', 'color: blue; font-size: 16px;');
        return; // 调试模式下不加载任何反调试，但自保护仍可保留，但既然已放行，就不需要了
    }

    // 移动端或小屏幕跳过（移动端无法打开 DevTools）
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
    // 3. 检测 DevTools（优化：更高阈值 + 连续确认 + 延迟启动）
    // ============================================================
    let debugDetected = false;
    let defenseStarted = false;
    let anomalyCount = 0;
    const MAX_ANOMALIES = 5;          // 连续 5 次异常才触发（避免偶发波动）
    let lastHtmlWidth = document.documentElement.offsetWidth;
    let lastCheckTime = 0;
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

        // 1. 性能检测（阈值提升至 150ms）
        const start = performance.now();
        debugger;
        const elapsed = performance.now() - start;
        if (elapsed > 150) {
            anomaly = true;
        }

        // 2. 窗口尺寸差异（阈值提升至 200px，避免小窗口误判）
        const outerW = window.outerWidth;
        const innerW = window.innerWidth;
        const outerH = window.outerHeight;
        const innerH = window.innerHeight;
        if (outerW - innerW > 200 || outerH - innerH > 200) {
            anomaly = true;
        }

        // 3. 尺寸变化（阈值提升至 100px）
        const now = performance.now();
        if (now - lastCheckTime > 1000) {
            const currentWidth = document.documentElement.offsetWidth;
            if (Math.abs(currentWidth - lastHtmlWidth) > 100) {
                const start2 = performance.now();
                debugger;
                const elapsed2 = performance.now() - start2;
                if (elapsed2 > 150) {
                    anomaly = true;
                }
                lastHtmlWidth = currentWidth;
            }
            lastCheckTime = now;
        }

        // 4. 其他检测（Firebug、DevTools 钩子、断点、webdriver）
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

        // 连续异常计数
        if (anomaly) {
            anomalyCount++;
        } else {
            anomalyCount = 0;
        }

        // 只有连续达到阈值才触发防御
        if (anomalyCount >= MAX_ANOMALIES) {
            debugDetected = true;
            triggerDefense();
        }
    }

    // ============================================================
    // 4. 防御措施（保留所有原有手段，包括跳转空白页）
    // ============================================================
    function triggerDefense() {
        if (defenseStarted) return;
        defenseStarted = true;

        // ★ 跳转空白页（仅执行一次）
        if (!sessionStorage.getItem('_debug_redirect_done')) {
            sessionStorage.setItem('_debug_redirect_done', '1');
            setTimeout(() => {
                location.replace('about:blank');
            }, 50);
        }

        // ---- 原有防御（全部保留） ----
        // 1) 高频 debugger
        setInterval(() => {
            try { (function(){ debugger; })(); } catch (e) {}
        }, 80);

        // 2) 垃圾信息
        setInterval(() => {
            for (let i = 0; i < 50; i++) {
                console.log('%c'.repeat(500), 'color: transparent;');
                console.warn('Debugging blocked');
            }
        }, 150);

        // 3) 标题闪烁
        setInterval(() => {
            document.title = document.title === '🔒 调试被阻止' ? '正常页面' : '🔒 调试被阻止';
        }, 300);

        // 4) hash 干扰
        let c = 0;
        setInterval(() => {
            window.location.hash = 'dbg_' + (c++);
            if (c > 1000) c = 0;
        }, 400);

        // 5) 阻止 eval 和 Function 恢复 console
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

        // 6) 定期重劫持 console
        setInterval(() => {
            consoleMethods.forEach(m => {
                if (console[m]) console[m] = noop;
            });
            console.clear = noop;
        }, 500);

        // 7) 额外的 debugger 注入（通过 eval）
        setInterval(() => {
            eval('(function(){debugger;})();');
        }, 50);

        // 8) 锁定 console 对象
        Object.defineProperty(window, 'console', {
            value: console,
            writable: false,
            configurable: false
        });
    }

    // ============================================================
    // 5. 启动检测（延迟 2 秒，避免页面初始布局波动）
    // ============================================================
    setTimeout(() => {
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

        window.addEventListener('load', detectDevTools);
    }, 2000);

    // ============================================================
    // 6. 启动自保护
    // ============================================================
    selfProtect();

    console.log('%c✅ 反调试已启动（保留跳转，优化误判，自保护已启用）', 'color: green; font-size: 16px;');
})();