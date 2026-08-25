/**
 *  页面访问验证脚本
 * @version 1.0.0
 * @description 分组密码验证、跨页面状态共享、事件拦截、蒙版覆盖
 * @dependencies 无 
 * 
 * @example
 * // 浏览器引入
 * <script src="page-auth.js"></script>
 */
(function () {
    'use strict';


    //  📋 配置区域 —— 请根据项目需求修改

    const AUTH_CONFIG = {
        // 存储方式：'localStorage' 或 'sessionStorage'
        storageType: 'localStorage',

        // 存储 key 前缀，用于区分不同项目的验证状态
        storageKeyPrefix: 'page_auth_',

        // ----- 分组配置 -----
        // 每个分组包含：
        //   - id       : 唯一标识（必填）
        //   - match    : 匹配规则（必填），支持 字符串 | 正则 | 函数
        //   - password : 该组密码（必填）
        //   - name     : 组名称（可选，用于显示）
        //
        // 匹配规则说明：
        //   - 字符串  ：当前页面路径包含该字符串即匹配
        //   - 正则    ：使用正则测试当前页面路径
        //   - 函数    ：接收 URL 对象，返回 true 表示匹配
        groups: [
            {
                id: 'admin',
                name: '管理后台',
                match: '/admin',
                password: 'admin123'
            },
            {
                id: 'dashboard',
                name: '数据看板',
                match: /^\/dashboard/,
                password: 'dash2024'
            },
            {
                id: 'settings',
                name: '系统设置',
                match: function (url) {
                    return url.pathname.includes('/settings') ||
                        url.pathname.includes('/config');
                },
                password: 'set@2024'
            },
            // ... 可继续添加更多分组
        ],

        // ----- 默认组（当页面未匹配任何组时使用）-----
        // 如果设置为 null，则未匹配的页面不进行验证（直接放行）
        // 如果设置了一个组对象，则未匹配的页面使用该组密码
        defaultGroup: null,
        // 例如：
        // defaultGroup: {
        //   id: 'default',
        //   password: 'default123',
        //   name: '默认组'
        // },

        // ----- UI 配置 -----
        ui: {
            overlayColor: 'rgba(0, 0, 0, 0.82)',
            cardBg: '#ffffff',
            cardRadius: '16px',
            cardMaxWidth: '420px',
            title: '🔐 页面访问验证',
            subtitle: '此页面需要密码验证，请输入密码继续', // 可使用 {group} 占位符
            inputPlaceholder: '请输入密码',
            confirmText: '确认访问',
            errorText: '❌ 密码错误，请重新输入',
            maxAttempts: 5,          // 0 表示无限制
            lockSeconds: 60,         // 超过尝试次数后锁定时间（秒）
            showToggle: true,        // 显示密码可见切换按钮
        },

        // ----- 调试模式（开启后控制台输出日志）-----
        debug: true,
    };


    //  核心逻辑 —— 无需修改下方代码


    // ---- 工具函数 ----
    function log(...args) {
        if (AUTH_CONFIG.debug) {
            console.log('[PageAuth]', ...args);
        }
    }

    function warn(...args) {
        if (AUTH_CONFIG.debug) {
            console.warn('[PageAuth]', ...args);
        }
    }

    function getStorage() {
        return AUTH_CONFIG.storageType === 'sessionStorage' ?
            sessionStorage :
            localStorage;
    }

    function getStorageKey(groupId) {
        return AUTH_CONFIG.storageKeyPrefix + groupId;
    }

    function getCurrentUrl() {
        return new URL(window.location.href);
    }

    // ---- 分组匹配 ----
    function matchGroup(group, url) {
        const rule = group.match;
        if (typeof rule === 'string') {
            return url.pathname.includes(rule) || url.href.includes(rule);
        } else if (rule instanceof RegExp) {
            return rule.test(url.pathname) || rule.test(url.href);
        } else if (typeof rule === 'function') {
            try {
                return rule(url) === true;
            } catch (e) {
                warn('匹配函数执行出错:', e);
                return false;
            }
        }
        return false;
    }

    function findMatchingGroup(url) {
        for (const group of AUTH_CONFIG.groups) {
            if (matchGroup(group, url)) {
                return group;
            }
        }
        if (AUTH_CONFIG.defaultGroup) {
            return AUTH_CONFIG.defaultGroup;
        }
        return null;
    }

    // ---- 验证状态管理 ----
    function getAuthStatus(groupId) {
        const storage = getStorage();
        const key = getStorageKey(groupId);
        try {
            const data = storage.getItem(key);
            if (!data) return null;
            const parsed = JSON.parse(data);
            if (parsed && typeof parsed === 'object' && parsed.verified === true) {
                return parsed;
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    function setAuthStatus(groupId, status) {
        const storage = getStorage();
        const key = getStorageKey(groupId);
        const data = JSON.stringify({
            verified: true,
            timestamp: Date.now(),
            groupId: groupId,
            ...status
        });
        storage.setItem(key, data);
        log('验证状态已保存:', groupId);
    }

    function clearAuthStatus(groupId) {
        const storage = getStorage();
        const key = getStorageKey(groupId);
        storage.removeItem(key);
        log('验证状态已清除:', groupId);
    }

    function clearAllAuthStatus() {
        const storage = getStorage();
        const prefix = AUTH_CONFIG.storageKeyPrefix;
        const keys = [];
        for (let i = 0; i < storage.length; i++) {
            const key = storage.key(i);
            if (key && key.startsWith(prefix)) {
                keys.push(key);
            }
        }
        keys.forEach(key => storage.removeItem(key));
        log('所有验证状态已清除');
    }

    // ---- 事件拦截器 ----
    let eventBlockers = [];
    let isBlocking = false;

    function enableEventBlocking() {
        if (isBlocking) return;
        isBlocking = true;

        const eventTypes = [
            'click', 'dblclick', 'mousedown', 'mouseup', 'mousemove',
            'mouseenter', 'mouseleave', 'mouseover', 'mouseout',
            'touchstart', 'touchend', 'touchmove', 'touchcancel',
            'pointerdown', 'pointerup', 'pointermove', 'pointercancel',
            'keydown', 'keyup', 'keypress',
            'scroll', 'wheel',
            'contextmenu', 'selectstart', 'dragstart', 'dragend',
            'focus', 'blur', 'focusin', 'focusout',
            'submit', 'reset', 'change', 'input',
            'resize', 'orientationchange',
        ];

        function blocker(e) {
            const overlay = document.getElementById('__auth_overlay');
            if (overlay && overlay.contains(e.target)) {
                return;
            }
            e.stopPropagation();
            e.stopImmediatePropagation();
            e.preventDefault();
        }

        eventTypes.forEach(type => {
            document.addEventListener(type, blocker, true);
            if (['scroll', 'resize', 'orientationchange'].includes(type)) {
                window.addEventListener(type, blocker, true);
            }
        });

        eventBlockers = eventTypes.map(type => ({ type, blocker }));
        log('事件拦截已启用');
    }

    function disableEventBlocking() {
        if (!isBlocking) return;
        isBlocking = false;

        eventBlockers.forEach(({ type, blocker }) => {
            document.removeEventListener(type, blocker, true);
            if (['scroll', 'resize', 'orientationchange'].includes(type)) {
                window.removeEventListener(type, blocker, true);
            }
        });
        eventBlockers = [];
        log('事件拦截已禁用');
    }

    // ---- 阻止滚动 ----
    function disableScroll() {
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        document.addEventListener('touchmove', preventScroll, { passive: false });
        log('滚动已禁用');
    }

    function enableScroll() {
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        document.removeEventListener('touchmove', preventScroll);
        log('滚动已启用');
    }

    function preventScroll(e) {
        const overlay = document.getElementById('__auth_overlay');
        if (overlay && overlay.contains(e.target)) {
            return;
        }
        e.preventDefault();
    }

    // ---- 创建覆盖层 UI ----
    function createOverlay(group) {
        const existing = document.getElementById('__auth_overlay');
        if (existing) existing.remove();

        const ui = AUTH_CONFIG.ui;
        const groupName = group && group.name ? group.name : '此页面';

        const overlay = document.createElement('div');
        overlay.id = '__auth_overlay';
        overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: ${ui.overlayColor};
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 999999;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                backdrop-filter: blur(6px);
                -webkit-backdrop-filter: blur(6px);
                transition: opacity 0.3s ease;
            `;

        // 注入动画样式
        if (!document.getElementById('__auth_style')) {
            const style = document.createElement('style');
            style.id = '__auth_style';
            style.textContent = `
                    @keyframes __auth_modal_in {
                        from { opacity: 0; transform: scale(0.92) translateY(20px); }
                        to { opacity: 1; transform: scale(1) translateY(0); }
                    }
                    @keyframes __auth_shake {
                        0%, 100% { transform: translateX(0); }
                        20% { transform: translateX(-12px); }
                        40% { transform: translateX(12px); }
                        60% { transform: translateX(-6px); }
                        80% { transform: translateX(6px); }
                    }
                    #__auth_overlay .__auth-input:focus {
                        outline: none;
                        border-color: #4f8cf7;
                        box-shadow: 0 0 0 4px rgba(79, 140, 247, 0.15);
                    }
                    #__auth_overlay .__auth-btn:active {
                        transform: scale(0.96);
                    }
                    #__auth_overlay .__auth-error-shake {
                        animation: __auth_shake 0.5s ease;
                    }
                `;
            document.head.appendChild(style);
        }

        const card = document.createElement('div');
        card.style.cssText = `
                background: ${ui.cardBg};
                border-radius: ${ui.cardRadius};
                padding: 40px 36px 32px;
                max-width: ${ui.cardMaxWidth};
                width: 90%;
                box-shadow: 0 25px 60px rgba(0,0,0,0.5);
                position: relative;
                text-align: center;
                animation: __auth_modal_in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
            `;

        // 标题
        const title = document.createElement('h2');
        title.textContent = ui.title;
        title.style.cssText = `
                margin: 0 0 8px 0;
                font-size: 24px;
                font-weight: 600;
                color: #1a1a2e;
                letter-spacing: -0.5px;
            `;

        // 副标题
        const subtitle = document.createElement('p');
        subtitle.textContent = ui.subtitle.replace(/\{group\}/g, groupName);
        subtitle.style.cssText = `
                margin: 0 0 24px 0;
                font-size: 15px;
                color: #6b7280;
                line-height: 1.5;
            `;

        // 组信息
        if (group && group.name) {
            const groupInfo = document.createElement('div');
            groupInfo.textContent = `📍 访问组：${group.name}`;
            groupInfo.style.cssText = `
                    font-size: 13px;
                    color: #9ca3af;
                    margin-bottom: 18px;
                    background: #f3f4f6;
                    padding: 4px 14px;
                    border-radius: 20px;
                    display: inline-block;
                `;
            card.appendChild(groupInfo);
        }

        // 密码输入框
        const inputWrapper = document.createElement('div');
        inputWrapper.style.cssText = `
                position: relative;
                margin-bottom: 16px;
            `;

        const input = document.createElement('input');
        input.type = 'password';
        input.id = '__auth_password_input';
        input.className = '__auth-input';
        input.placeholder = ui.inputPlaceholder;
        input.autofocus = true;
        input.style.cssText = `
                width: 100%;
                padding: 14px 16px;
                font-size: 16px;
                border: 2px solid #e5e7eb;
                border-radius: 12px;
                background: #fafafa;
                color: #1a1a2e;
                transition: border-color 0.2s, box-shadow 0.2s;
                box-sizing: border-box;
                font-family: inherit;
                padding-right: ${ui.showToggle ? '48px' : '16px'};
            `;

        // 显示/隐藏密码切换
        if (ui.showToggle) {
            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.textContent = '👁';
            toggle.style.cssText = `
                    position: absolute;
                    right: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    background: none;
                    border: none;
                    font-size: 20px;
                    cursor: pointer;
                    padding: 4px 8px;
                    border-radius: 8px;
                    color: #9ca3af;
                    transition: color 0.2s;
                    line-height: 1;
                `;
            toggle.addEventListener('mousedown', e => e.preventDefault());
            toggle.addEventListener('click', function () {
                const isPassword = input.type === 'password';
                input.type = isPassword ? 'text' : 'password';
                this.textContent = isPassword ? '🙈' : '👁';
            });
            inputWrapper.appendChild(toggle);
        }

        inputWrapper.appendChild(input);

        // 错误提示
        const errorEl = document.createElement('p');
        errorEl.id = '__auth_error';
        errorEl.textContent = ui.errorText;
        errorEl.style.cssText = `
                margin: 0 0 16px 0;
                font-size: 14px;
                color: #ef4444;
                min-height: 22px;
                display: none;
                align-items: center;
                justify-content: center;
                gap: 6px;
            `;

        // 尝试次数信息
        const attemptInfo = document.createElement('p');
        attemptInfo.id = '__auth_attempt_info';
        attemptInfo.style.cssText = `
                margin: 0 0 12px 0;
                font-size: 13px;
                color: #9ca3af;
                min-height: 20px;
            `;

        // 确认按钮
        const btn = document.createElement('button');
        btn.id = '__auth_submit_btn';
        btn.className = '__auth-btn';
        btn.textContent = ui.confirmText;
        btn.style.cssText = `
                width: 100%;
                padding: 14px;
                font-size: 16px;
                font-weight: 600;
                border: none;
                border-radius: 12px;
                background: #4f8cf7;
                color: #fff;
                cursor: pointer;
                transition: background 0.2s, transform 0.15s;
                font-family: inherit;
                letter-spacing: 0.3px;
            `;
        btn.addEventListener('mouseenter', function () {
            this.style.background = '#3b7ae6';
        });
        btn.addEventListener('mouseleave', function () {
            this.style.background = '#4f8cf7';
        });

        // 清除验证状态（隐藏功能）
        const clearLink = document.createElement('a');
        clearLink.href = '#';
        clearLink.textContent = '清除验证状态';
        clearLink.style.cssText = `
                display: inline-block;
                margin-top: 16px;
                font-size: 12px;
                color: #d1d5db;
                text-decoration: none;
                cursor: pointer;
                transition: color 0.2s;
            `;
        clearLink.addEventListener('click', function (e) {
            e.preventDefault();
            if (confirm('确定要清除所有验证状态吗？')) {
                clearAllAuthStatus();
                location.reload();
            }
        });
        clearLink.addEventListener('mouseenter', function () {
            this.style.color = '#9ca3af';
        });
        clearLink.addEventListener('mouseleave', function () {
            this.style.color = '#d1d5db';
        });

        // 组装卡片
        card.appendChild(title);
        card.appendChild(subtitle);
        card.appendChild(inputWrapper);
        card.appendChild(errorEl);
        card.appendChild(attemptInfo);
        card.appendChild(btn);
        card.appendChild(clearLink);
        overlay.appendChild(card);
        document.body.appendChild(overlay);

        // ---- 状态变量 ----
        let attemptCount = 0;
        let lockedUntil = 0;

        function updateAttemptInfo() {
            const max = ui.maxAttempts;
            if (max > 0) {
                const remaining = max - attemptCount;
                if (remaining > 0) {
                    attemptInfo.textContent = `剩余尝试次数：${remaining} 次`;
                    attemptInfo.style.display = 'block';
                } else {
                    const lockSec = ui.lockSeconds || 60;
                    const remainSec = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
                    if (remainSec > 0) {
                        attemptInfo.textContent = `🔒 账户已锁定，请等待 ${remainSec} 秒后重试`;
                        attemptInfo.style.display = 'block';
                    } else {
                        attemptInfo.textContent = '已超过最大尝试次数，请稍后重试';
                        attemptInfo.style.display = 'block';
                    }
                }
            } else {
                attemptInfo.style.display = 'none';
            }
        }

        function showError(message) {
            errorEl.textContent = message || ui.errorText;
            errorEl.style.display = 'flex';
            errorEl.className = '__auth-error-shake';
            setTimeout(() => errorEl.className = '', 500);
            input.value = '';
            input.focus();
        }

        function hideError() {
            errorEl.style.display = 'none';
        }

        function verifyPassword() {
            const inputVal = input.value.trim();

            // 检查锁定
            const max = ui.maxAttempts;
            if (max > 0 && attemptCount >= max) {
                const lockSec = ui.lockSeconds || 60;
                if (Date.now() < lockedUntil) {
                    const remainSec = Math.ceil((lockedUntil - Date.now()) / 1000);
                    showError(`🔒 账户已锁定，请等待 ${remainSec} 秒`);
                    updateAttemptInfo();
                    input.value = '';
                    return;
                } else {
                    attemptCount = 0;
                    lockedUntil = 0;
                    updateAttemptInfo();
                }
            }

            if (!inputVal) {
                showError('请输入密码');
                return;
            }

            const groupId = group ? group.id : null;
            const correctPassword = group ? group.password : null;

            if (correctPassword && inputVal === correctPassword) {
                // 成功
                hideError();
                if (groupId) {
                    setAuthStatus(groupId, { verified: true, timestamp: Date.now() });
                    log('✅ 密码验证成功，组:', groupId);
                }
                removeOverlayAndUnblock();
            } else {
                // 失败
                attemptCount++;
                const maxAttempts = ui.maxAttempts;
                if (maxAttempts > 0 && attemptCount >= maxAttempts) {
                    const lockSec = ui.lockSeconds || 60;
                    lockedUntil = Date.now() + lockSec * 1000;
                    showError(`❌ 密码错误次数过多，已锁定 ${lockSec} 秒`);
                    updateAttemptInfo();
                    input.disabled = true;
                    btn.disabled = true;
                    btn.style.opacity = '0.6';
                    btn.style.cursor = 'not-allowed';
                    setTimeout(() => {
                        input.disabled = false;
                        btn.disabled = false;
                        btn.style.opacity = '1';
                        btn.style.cursor = 'pointer';
                        attemptCount = 0;
                        lockedUntil = 0;
                        updateAttemptInfo();
                        input.focus();
                    }, lockSec * 1000);
                } else {
                    showError(`❌ 密码错误，请重试${maxAttempts > 0 ? `（剩余 ${maxAttempts - attemptCount} 次）` : ''}`);
                    updateAttemptInfo();
                }
                input.value = '';
                input.focus();
            }
        }

        function removeOverlayAndUnblock() {
            const overlayEl = document.getElementById('__auth_overlay');
            if (overlayEl) {
                overlayEl.style.opacity = '0';
                setTimeout(() => overlayEl.remove(), 300);
            }
            disableEventBlocking();
            enableScroll();
            log('✅ 覆盖层已移除，页面恢复正常访问');
        }

        // 事件绑定
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                verifyPassword();
            }
        });
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            verifyPassword();
        });
        input.addEventListener('focus', hideError);

        setTimeout(() => input.focus(), 200);

        return {
            overlay,
            input,
            btn,
            errorEl,
            verifyPassword,
            remove: removeOverlayAndUnblock,
            focus: () => input.focus(),
        };
    }

    // ---- 主流程 ----
    function init() {
        log('🚀 页面访问验证脚本启动');

        const url = getCurrentUrl();
        log('当前页面:', url.href);

        const matchedGroup = findMatchingGroup(url);
        if (!matchedGroup) {
            log('ℹ️ 当前页面未匹配任何分组，无需验证，直接放行');
            return;
        }

        log('✅ 匹配到分组:', matchedGroup.id, matchedGroup.name || '');

        const status = getAuthStatus(matchedGroup.id);
        if (status && status.verified === true) {
            log('✅ 该组已验证通过，直接放行 (验证时间:', new Date(status.timestamp).toLocaleString(), ')');
            return;
        }

        log('🔐 该组未验证，显示密码验证界面');
        enableEventBlocking();
        disableScroll();
        const overlayCtrl = createOverlay(matchedGroup);

        // 暴露全局 API
        window.__pageAuth = {
            config: AUTH_CONFIG,
            status: status,
            group: matchedGroup,
            overlay: overlayCtrl,
            clear: clearAllAuthStatus,
            reload: () => location.reload(),
        };

        log('🔐 密码验证界面已显示，等待用户输入');
    }

    // ---- 启动 ----
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ---- 暴露公共 API ----
    window.PageAuth = {
        recheck: function () {
            log('手动重新检查验证状态');
            const overlay = document.getElementById('__auth_overlay');
            if (overlay) {
                overlay.remove();
                disableEventBlocking();
                enableScroll();
            }
            init();
        },
        clearAll: clearAllAuthStatus,
        clearGroup: function (groupId) {
            clearAuthStatus(groupId);
        },
        getConfig: function () {
            return AUTH_CONFIG;
        },
        getStatus: function (groupId) {
            if (groupId) {
                return getAuthStatus(groupId);
            }
            const url = getCurrentUrl();
            const group = findMatchingGroup(url);
            if (group) {
                return getAuthStatus(group.id);
            }
            return null;
        },
    };

    log('📦 PageAuth API 已暴露，可通过 window.PageAuth 调用');
    log('💡 调试: window.PageAuth.recheck() 可手动重新验证');

    // 双击页面左下角三次清除状态（方便测试）
    let doubleClickCount = 0;
    let doubleClickTimer = null;
    document.addEventListener('dblclick', function (e) {
        if (e.clientX < 80 && e.clientY > window.innerHeight - 80) {
            doubleClickCount++;
            if (doubleClickCount >= 3) {
                doubleClickCount = 0;
                if (confirm('🔓 是否清除所有验证状态并刷新页面？')) {
                    clearAllAuthStatus();
                    location.reload();
                }
            }
            clearTimeout(doubleClickTimer);
            doubleClickTimer = setTimeout(() => { doubleClickCount = 0; }, 2000);
        }
    });

})();