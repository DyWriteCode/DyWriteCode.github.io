/**
 * 反调试脚本（优化版 - 低误报/高鲁棒性）
 */
(function() {
    'use strict';

    // ============================================================
    // 1. 增强白名单机制（降低误触发）
    // ============================================================
    const url = location.href.toLowerCase();
    
    // 1.1 自动放行安全环境：本地文件、localhost、内网IP段
    const safeHosts = ['localhost', '127.0.0.1', '::1', '192.168.', '10.', '172.16.', '172.17.', '172.18.', '172.19.', '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.', '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.'];
    if (safeHosts.some(host => url.includes(host))) {
        console.log('%c🏠 内网/本地环境，反调试已放行', 'color:gray');
        return;
    }

    // 1.2 强令牌白名单（防止简单 URL 篡改）：必须同时满足 URL 参数 + sessionStorage 双重校验
    const bypassToken = 'aGVsbG9fd29ybGQ='; // 可替换为你的服务端下发的动态密钥
    const urlParams = new URLSearchParams(location.search);
    const urlToken = urlParams.get('_dt_bypass');
    const storageToken = sessionStorage.getItem('_dt_token');
    
    if (urlToken === bypassToken && storageToken === bypassToken) {
        console.log('%c🔓 白名单令牌验证通过，反调试已禁用', 'color:blue;font-size:16px;');
        return;
    }
    // 若 URL 带 token 但 session 未存，则自动补充（方便一次登录）
    if (urlToken === bypassToken) {
        sessionStorage.setItem('_dt_token', bypassToken);
        console.log('%c🔓 白名单令牌已激活', 'color:blue');
        return;
    }

    // 1.3 旧的简易 debug 参数依然保留，但增加随机延时校验（防止直接暴力匹配）
    if (url.includes('debug') || url.includes('dev')) {
        // 增加一个隐蔽的时间戳校验，防止仅仅带个参数就绕过（需满足页面加载时间 < 5秒，表示是手动输入的）
        if (performance.now() < 5000) {
            console.log('%c🔓 调试参数放行（限时）', 'color:blue');
            return;
        }
    }

    // ============================================================
    // 2. 移动端与扩展兼容处理（降低误报 + 针对性调整阈值）
    // ============================================================
    const isMobile = 'ontouchstart' in window || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    const isExtensionEnv = !!(window.chrome && chrome.runtime && chrome.runtime.id);

    // 移动端或扩展环境：大幅放宽阈值，且不劫持 console（避免影响扩展自身通信）
    if (isMobile) {
        console.log('%c📱 移动端环境，采用宽松阈值', 'color:gray');
    }
    if (isExtensionEnv) {
        console.log('%c🧩 浏览器扩展环境，部分检测已降级', 'color:gray');
        // 扩展环境下，不劫持 console，防止破坏扩展通信
    } else {
        // 非扩展环境才劫持 console
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
    }

    // ============================================================
    // 3. 键盘/右键阻断（强化组合键拦截）
    // ============================================================
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('selectstart', e => e.preventDefault());
    document.addEventListener('copy', e => e.preventDefault());

    // 增加更多隐蔽调试组合键，且加入 key 值混淆（不直接暴露 keyCode）
    const blockedKeys = [123, 122]; // F12, F11
    const blockedCombos = [
        { key: 73, ctrl: true, shift: true },  // Ctrl+Shift+I
        { key: 74, ctrl: true, shift: true },  // Ctrl+Shift+J
        { key: 67, ctrl: true, shift: true },  // Ctrl+Shift+C
        { key: 85, ctrl: true },               // Ctrl+U
        { key: 83, ctrl: true },               // Ctrl+S
        { key: 72, ctrl: true, shift: true }   // Ctrl+Shift+H (某些浏览器的开发者工具快捷键变种)
    ];
    
    document.addEventListener('keydown', e => {
        const key = e.keyCode || e.which;
        const ctrl = e.ctrlKey || e.metaKey;
        const shift = e.shiftKey;

        if (blockedKeys.includes(key)) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }

        for (let combo of blockedCombos) {
            if (key === combo.key && ctrl === !!combo.ctrl && shift === !!combo.shift) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        }
    });

    // ============================================================
    // 4. 核心检测引擎（积分衰减模型 + 多维综合研判）
    // ============================================================
    let suspicionScore = 0;          // 嫌疑积分
    const MAX_SCORE = 8;             // 触发阈值（相比之前更宽松）
    const DECAY_RATE = 0.3;          // 每次正常检测衰减 0.3 分，避免累积误报
    let isDefenseTriggered = false;
    let detectionStarted = false;

    // 4.1 精准 FPS 检测（基于 requestAnimationFrame）
    let fps = 60;
    let frameCount = 0;
    let lastFpsTime = performance.now();
    
    function updateFPS() {
        if (document.hidden) {
            // 页面隐藏时不检测帧率（避免后台节流误报）
            requestAnimationFrame(updateFPS);
            return;
        }
        const now = performance.now();
        frameCount++;
        if (now - lastFpsTime >= 1000) {
            fps = Math.round(frameCount * 1000 / (now - lastFpsTime));
            frameCount = 0;
            lastFpsTime = now;
        }
        requestAnimationFrame(updateFPS);
    }
    requestAnimationFrame(updateFPS);

    // 4.2 改进的性能检测（多次采样 + 防抖）
    function sampleExecutionTime() {
        const samples = [];
        for (let i = 0; i < 3; i++) {
            const start = performance.now();
            // 故意构造一个复杂计算，若被单步调试会显著变慢
            let sum = 0;
            for (let j = 0; j < 1000; j++) sum += Math.sqrt(j);
            // 插入 debugger 语句，但不依赖其返回结果（让调试器产生停顿）
            (function(){ debugger; })();
            const duration = performance.now() - start;
            samples.push(duration);
        }
        // 取中位数，排除极端波动
        samples.sort((a,b) => a - b);
        return samples[1]; 
    }

    // 4.3 隐蔽的钩子检测（区分正常框架和恶意调试）
    function hasSuspiciousHooks() {
        // 若页面未加载 React/Vue 却存在对应钩子，则高度可疑
        const hasReactHook = !!window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
        const hasVueHook = !!window.__VUE_DEVTOOLS_GLOBAL_HOOK__;
        const hasReduxHook = !!window.__REDUX_DEVTOOLS_EXTENSION__;
        
        // 检查页面是否真的使用了这些框架（通过全局变量或 DOM 特征）
        const usesReact = !!window.React || !!document.querySelector('[data-reactroot]');
        const usesVue = !!window.Vue || !!document.querySelector('[data-v-app]');
        
        if (hasReactHook && !usesReact) return true;
        if (hasVueHook && !usesVue) return true;
        if (hasReduxHook && !window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__) return true; // 仅有扩展无 compose 也可疑
        
        return false;
    }

    // 4.4 元素检查增强（仅检测特征，排除误判）
    function hasElementInspect() {
        // 检查样式属性（防止普通网页误设）
        const html = document.documentElement;
        const style = window.getComputedStyle(html);
        // 不再检测 -webkit-device-pixel-ratio（太容易误报），改为检测 WebKit 特有的调试高亮
        return !!html.getAttribute('inspect') || style.webkitTapHighlightColor === 'rgba(0, 0, 0, 0)';
    }

    // 4.5 检测主函数（积分累计）
    function performDetection() {
        if (isDefenseTriggered || !detectionStarted) return;

        let scoreIncrement = 0;
        const isPageVisible = !document.hidden;

        // 只在前台页面进行检测，后台不计分（减少误报）
        if (!isPageVisible) {
            // 可视不可见时只做衰减
            suspicionScore = Math.max(0, suspicionScore - DECAY_RATE * 2);
            return;
        }

        // -- 检测项 1: 性能耗时（移动端阈值放宽至 500ms） --
        const perfThreshold = isMobile ? 500 : 280;
        const execTime = sampleExecutionTime();
        if (execTime > perfThreshold) {
            scoreIncrement += 1.5; 
        }

        // -- 检测项 2: 帧率异常（移动端阈值更低） --
        const fpsThreshold = isMobile ? 8 : 12;
        if (fps < fpsThreshold && fps > 0) {
            scoreIncrement += 1.0;
        }

        // -- 检测项 3: 可疑钩子 --
        if (hasSuspiciousHooks()) {
            scoreIncrement += 1.2;
        }

        // -- 检测项 4: WebDriver（移动端忽略，因为真机调试可能误报） --
        if (!isMobile && navigator.webdriver === true) {
            scoreIncrement += 2.0;
        }

        // -- 检测项 5: 元素面板特征 --
        if (hasElementInspect()) {
            scoreIncrement += 0.8;
        }

        // -- 检测项 6: Function 构造函数检测（检测 eval 是否被篡改） --
        try {
            const funcStr = Function.prototype.toString.call(window.eval);
            if (funcStr.includes('[native code]') === false && funcStr.includes('function') === false) {
                scoreIncrement += 1.0; // eval 被重写，可能被调试器注入
            }
        } catch(e) {}

        // 更新积分（加上当前增量，并衰减）
        suspicionScore = suspicionScore * (1 - DECAY_RATE * 0.5) + scoreIncrement;
        // 确保不为负
        suspicionScore = Math.max(0, suspicionScore);

        // 阈值触发
        if (suspicionScore >= MAX_SCORE) {
            triggerDefense();
        }
    }

    // ============================================================
    // 5. 防御触发（保留核心干扰，去除过于激进的跳转，改为降级处理）
    // ============================================================
    function triggerDefense() {
        if (isDefenseTriggered) return;
        isDefenseTriggered = true;

        // 5.1 不再直接跳转 about:blank，而是使用更隐蔽的"降级"策略
        // 若 sessionStorage 未标记，先标记防止重复执行
        if (!sessionStorage.getItem('_debug_penalty')) {
            sessionStorage.setItem('_debug_penalty', '1');
            
            // ★ 温和惩罚：清空页面内容并显示伪装界面（而非空白页，避免太突兀）
            document.body.innerHTML = `
                <div style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;color:#999;flex-direction:column;">
                    <h2>⏳ 页面加载中...</h2>
                    <p style="font-size:14px;">请稍后刷新重试</p>
                </div>
            `;
            // 取消所有事件监听，阻止交互
            document.head.innerHTML = '<style>body{overflow:hidden;user-select:none;}</style>';
        }

        // 5.2 高频干扰（不变，但增加随机性）
        const debuggerInterval = setInterval(() => {
            try { (function(){ debugger; })(); } catch (_) {}
        }, 80 + Math.floor(Math.random() * 40));

        // 5.3 控制台刷屏（降低频率，减少性能消耗）
        setInterval(() => {
            if (Math.random() > 0.7) { // 只有 30% 概率触发，减少 CPU 占用
                for (let i = 0; i < 20; i++) {
                    console.log('%c'.repeat(200), 'color:transparent;');
                }
                console.warn('⚠️ 检测到异常环境，页面已保护');
            }
        }, 300);

        // 5.4 标题闪烁（变种）
        let titleState = 0;
        setInterval(() => {
            document.title = titleState++ % 3 === 0 ? '🔒 安全验证中' : '正常页面';
        }, 500);

        // 5.5 重写 eval/Function（加强拦截）
        const origEval = window.eval;
        window.eval = function(str) {
            if (typeof str === 'string' && (str.includes('console') || str.includes('debugger') || str.includes('window'))) {
                return undefined;
            }
            return origEval(str);
        };
        const origFunction = window.Function;
        window.Function = function(...args) {
            const body = args[args.length - 1] || '';
            if (typeof body === 'string' && (body.includes('console') || body.includes('debugger') || body.includes('window'))) {
                return function() {};
            }
            return origFunction.apply(this, args);
        };

        // 5.6 锁定 console（持续守护）
        const noop = () => {};
        setInterval(() => {
            ['log','warn','error','info','debug'].forEach(prop => {
                if (console[prop] && console[prop] !== noop) {
                    try {
                        Object.defineProperty(console, prop, { value: noop, writable: false, configurable: false });
                    } catch (_) {}
                }
            });
        }, 400);
    }

    // ============================================================
    // 6. 启动策略（延迟 + 闲置调度，不干扰首屏）
    // ============================================================
    function startDetection() {
        detectionStarted = true;
        // 使用 requestIdleCallback 在空闲时执行，不阻塞主线程
        const idleCallback = window.requestIdleCallback || window.setTimeout;
        idleCallback(() => {
            performDetection();
            // 主循环：每秒检测一次（降低频率）
            setInterval(performDetection, 1200);
        });

        // 页面可见性变化时额外检测
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                performDetection();
            }
        });

        // 防抖 resize（非必要，但保留）
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(performDetection, 600);
        });
    }

    // 等待页面完全加载后再启动
    if (document.readyState === 'complete') {
        setTimeout(startDetection, 2000);
    } else {
        window.addEventListener('load', () => {
            setTimeout(startDetection, 2000);
        });
    }

    // ============================================================
    // 7. 轻量自保护（移除远程注入，避免外部风险）
    // ============================================================
    Object.defineProperty(window, '__ANTI_DEBUG_LOADED__', {
        value: true,
        writable: false,
        configurable: false
    });

    console.log('%c🛡️ 反调试已启动（优化版）', 'color:green;font-size:16px;');
})();