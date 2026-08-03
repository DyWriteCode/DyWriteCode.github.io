// 极致早期反调试脚本 + 自身调试跳过
(function() {
    'use strict';

    // ============================================================
    // 0. 检查是否处于调试模式（URL 参数）
    // ============================================================
    const urlParams = new URLSearchParams(window.location.search);
    const isDebugMode = urlParams.has('debug') || urlParams.has('dev') || urlParams.has('bypass');
    if (isDebugMode) {
        // 恢复 console（如果之前被劫持）
        // 但这里因为还未劫持，所以无需恢复，直接返回
        console.log('%c🔓 调试模式已启用，反调试已禁用', 'color: blue; font-size: 16px;');
        return; // 直接退出，不执行任何反调试逻辑
    }

    // ============================================================
    // 1. 保存原始 console 方法（以便在需要时恢复，但此处不恢复）
    // ============================================================
    // 但我们直接劫持，所以无需保存

    // ============================================================
    // 2. 劫持 console（让控制台失效）
    // ============================================================
    const noop = () => {};
    const consoleMethods = ['log', 'warn', 'error', 'info', 'debug', 'trace', 'dir', 'dirxml', 'group', 'groupEnd', 'time', 'timeEnd', 'table', 'count', 'assert', 'profile', 'profileEnd'];
    consoleMethods.forEach(m => {
        if (console[m]) console[m] = noop;
    });
    console.clear = noop;

    // ============================================================
    // 3. 阻止常见键盘快捷键和右键
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
    // 4. 早期检测（立即执行一次）
    // ============================================================
    let debugDetected = false;
    let defenseStarted = false;
    let lastHtmlWidth = document.documentElement.offsetWidth;
    let lastCheckTime = 0;

    function detectDevTools() {
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

        // 方法4：documentElement 尺寸变化（需要结合时间，避免误报）
        const now = performance.now();
        if (now - lastCheckTime > 1000) { // 每秒检测一次尺寸变化
            const currentWidth = document.documentElement.offsetWidth;
            if (Math.abs(currentWidth - lastHtmlWidth) > 50) {
                // 尺寸变化可能由窗口调整引起，进行二次确认
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

        // 方法6：检测是否重写了 console（如果恢复，说明在调试）
        // 但由于我们不断重写，这个检测意义不大，跳过
    }

    // ============================================================
    // 5. 防御措施（温和但有效）
    // ============================================================
    function triggerDefense() {
        if (defenseStarted) return;
        defenseStarted = true;

        // 1) 高频 debugger（每 80ms）
        setInterval(() => {
            try { (function(){ debugger; })(); } catch (e) {}
        }, 80);

        // 2) 持续输出垃圾信息（但 console 已被劫持）
        setInterval(() => {
            for (let i = 0; i < 50; i++) {
                console.log('%c'.repeat(500), 'color: transparent;');
                console.warn('Debugging blocked');
            }
        }, 150);

        // 3) 闪烁标题（提示）
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

        // 6) 定期重新劫持 console（防止被恢复）
        setInterval(() => {
            consoleMethods.forEach(m => {
                if (console[m]) console[m] = noop;
            });
            console.clear = noop;
        }, 500);

        // 7) 额外：阻止页面被关闭（但不要太过分，我们只阻止简单的关闭尝试）
        // 可以通过 onbeforeunload 但会打扰用户，所以不采用
    }

    // ============================================================
    // 6. 启动检测（立即、高频、持续）
    // ============================================================
    // 立即执行一次
    detectDevTools();

    // 高频检测（每 200ms）
    setInterval(detectDevTools, 200);

    // 窗口 resize 时也触发检测（但会频繁触发，小心）
    // 改为防抖
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            detectDevTools();
        }, 300);
    });

    // 页面可见性变化时检测
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            detectDevTools();
        }
    });

    // 加载完成后检测一次
    window.addEventListener('load', detectDevTools);

    // 标记启动
    console.log('%c✅ 安全保护已激活（早期检测 + 补充检测）', 'color: green; font-size: 16px;');
})();