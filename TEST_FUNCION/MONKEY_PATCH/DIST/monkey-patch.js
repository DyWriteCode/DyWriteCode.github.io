/**
 * 猴子补丁工具 - Monkey Patch Utility
 * @version 1.0.0
 * @description 替换第三方 API 的方法、拦截 fetch / XMLHttpRequest 请求
 * @example 在页面中引入此脚本后，通过全局函数 patchMethod, patchFetch, patchXHR, patchAPI, restoreAll, getPatches 进行操作
 */
(function (global) {
    'use strict';

    // ---------- 私有状态 ----------
    const patchRegistry = {
        methods: [], // { target, methodName, original, replacement }
        fetch: [],   // { matcher, handler, originalFetch }
        xhr: []      // { matcher, handler, originalOpen }
    };

    // ---------- 工具函数 ----------
    function isRegex(obj) { return obj instanceof RegExp; }
    function isFunction(obj) { return typeof obj === 'function'; }
    function isString(obj) { return typeof obj === 'string'; }

    function matchUrl(matcher, url) {
        if (isRegex(matcher)) return matcher.test(url);
        if (isString(matcher)) return url.includes(matcher);
        if (isFunction(matcher)) return matcher(url) === true;
        return false;
    }

    function resolveTarget(path) {
        if (!isString(path)) return path;
        const parts = path.split('.');
        let target = global;
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (part === 'window') continue;
            if (target == null) return null;
            target = target[part];
            if (target === undefined) return null;
        }
        return target;
    }

    function getOriginalMethod(target, methodName) {
        if (target == null) return null;
        const proto = Object.getPrototypeOf(target);
        if (proto && isFunction(proto[methodName])) return proto[methodName];
        if (isFunction(target[methodName])) return target[methodName];
        return null;
    }

    // ---------- 核心补丁函数 ----------

    /**
     * 替换对象上的方法
     * @param {object|string} target - 目标对象或对象路径字符串 (如 'window.ThirdAPI')
     * @param {string} methodName - 方法名
     * @param {function} replacement - 替换方法，签名为 (original, ...args) => 任何值
     * @param {object} options - 可选 { bindContext: true }
     * @returns {boolean} 是否成功
     */
    function patchMethod(target, methodName, replacement, options = {}) {
        const { bindContext = true } = options;

        let resolvedTarget = isString(target) ? resolveTarget(target) : target;
        if (resolvedTarget == null) {
            console.error(`[MonkeyPatch] 目标对象不存在: ${target}`);
            return false;
        }

        const original = getOriginalMethod(resolvedTarget, methodName);
        if (!isFunction(original)) {
            console.error(`[MonkeyPatch] 方法不存在: ${methodName}`);
            return false;
        }

        const patched = function (...args) {
            try {
                return replacement.call(this, original.bind(this), ...args);
            } catch (err) {
                console.warn(`[MonkeyPatch] 补丁方法执行出错，降级为原始方法: ${err.message}`);
                return original.apply(this, args);
            }
        };

        Object.defineProperty(patched, 'name', { value: `patched_${methodName}`, configurable: true });

        patchRegistry.methods.push({ target: resolvedTarget, methodName, original, replacement: patched });
        resolvedTarget[methodName] = patched;
        console.log(`[MonkeyPatch] 方法补丁应用: ${methodName}`);
        return true;
    }

    /**
     * 拦截 fetch 请求
     * @param {string|RegExp|function} matcher - URL 匹配规则
     * @param {string|function} newUrlOrHandler - 新 URL 或处理函数 (url, options) => newUrl | {url, options}
     * @returns {boolean} 是否成功
     */
    function patchFetch(matcher, newUrlOrHandler) {
        if (!isFunction(global.fetch)) {
            console.error('[MonkeyPatch] fetch 不可用');
            return false;
        }

        const originalFetch = global.fetch;
        let isFirstPatch = patchRegistry.fetch.length === 0;

        let handler;
        if (isFunction(newUrlOrHandler)) {
            handler = newUrlOrHandler;
        } else if (isString(newUrlOrHandler)) {
            handler = (url, options) => ({ url: newUrlOrHandler, options });
        } else {
            console.error('[MonkeyPatch] 无效的处理器参数');
            return false;
        }

        patchRegistry.fetch.push({ matcher, handler, originalFetch });

        if (isFirstPatch || global.fetch === originalFetch) {
            global.fetch = function (input, init) {
                const url = isString(input) ? input : (input && input.url ? input.url : String(input));
                const options = init || {};
                let matched = false;
                let result = { url, options };

                for (const rule of patchRegistry.fetch) {
                    try {
                        if (matchUrl(rule.matcher, url)) {
                            const handlerResult = rule.handler(url, options);
                            if (handlerResult) {
                                if (isString(handlerResult)) {
                                    result.url = handlerResult;
                                } else if (handlerResult.url) {
                                    result.url = handlerResult.url;
                                    if (handlerResult.options) {
                                        result.options = { ...result.options, ...handlerResult.options };
                                    }
                                }
                                matched = true;
                                console.log(`[MonkeyPatch] fetch 拦截: ${url} → ${result.url}`);
                                break;
                            }
                        }
                    } catch (err) {
                        console.warn(`[MonkeyPatch] fetch 补丁规则执行出错: ${err.message}`);
                    }
                }

                const finalUrl = matched ? result.url : url;
                const finalOptions = matched ? result.options : options;
                return originalFetch(finalUrl, finalOptions);
            };

            // 保留原始 fetch 的静态属性
            for (const key in originalFetch) {
                if (isFunction(originalFetch[key]) && !global.fetch[key]) {
                    global.fetch[key] = originalFetch[key];
                }
            }
            console.log('[MonkeyPatch] fetch 拦截器已安装');
        }

        return true;
    }

    /**
     * 拦截 XMLHttpRequest 请求
     * @param {string|RegExp|function} matcher - URL 匹配规则
     * @param {string|function} newUrlOrHandler - 新 URL 或处理函数 (url, method) => newUrl
     * @returns {boolean} 是否成功
     */
    function patchXHR(matcher, newUrlOrHandler) {
        if (typeof XMLHttpRequest === 'undefined') {
            console.error('[MonkeyPatch] XMLHttpRequest 不可用');
            return false;
        }

        const originalXHROpen = XMLHttpRequest.prototype.open;
        let isFirstPatch = patchRegistry.xhr.length === 0;

        let handler;
        if (isFunction(newUrlOrHandler)) {
            handler = newUrlOrHandler;
        } else if (isString(newUrlOrHandler)) {
            handler = (url, method) => newUrlOrHandler;
        } else {
            console.error('[MonkeyPatch] 无效的处理器参数');
            return false;
        }

        patchRegistry.xhr.push({ matcher, handler, originalOpen: originalXHROpen });

        if (isFirstPatch || XMLHttpRequest.prototype.open === originalXHROpen) {
            XMLHttpRequest.prototype.open = function (method, url, async, user, password) {
                let finalUrl = url;
                let matched = false;

                for (const rule of patchRegistry.xhr) {
                    try {
                        if (matchUrl(rule.matcher, url)) {
                            const result = rule.handler(url, method);
                            if (isString(result)) {
                                finalUrl = result;
                            } else if (result && result.url) {
                                finalUrl = result.url;
                            }
                            matched = true;
                            console.log(`[MonkeyPatch] XHR 拦截: ${url} → ${finalUrl}`);
                            break;
                        }
                    } catch (err) {
                        console.warn(`[MonkeyPatch] XHR 补丁规则执行出错: ${err.message}`);
                    }
                }

                if (async !== undefined) {
                    return originalXHROpen.call(this, method, finalUrl, async, user, password);
                }
                return originalXHROpen.call(this, method, finalUrl);
            };

            // 复制静态属性
            for (const key in originalXHROpen) {
                if (isFunction(originalXHROpen[key]) && !XMLHttpRequest.prototype.open[key]) {
                    XMLHttpRequest.prototype.open[key] = originalXHROpen[key];
                }
            }
            console.log('[MonkeyPatch] XHR 拦截器已安装');
        }

        return true;
    }

    /**
     * 批量配置补丁
     * @param {object} config - 配置对象
     * @param {object} config.methods - 方法替换 { 'target.method': replacementFn }
     * @param {array} config.fetch - fetch 拦截规则 [{ match, replace }]
     * @param {array} config.xhr - xhr 拦截规则 [{ match, replace }]
     * @returns {array} 每个规则的应用结果
     */
    function patchAPI(config) {
        const results = [];

        if (config.methods && typeof config.methods === 'object') {
            for (const [path, fn] of Object.entries(config.methods)) {
                const lastDot = path.lastIndexOf('.');
                if (lastDot === -1) {
                    console.error(`[MonkeyPatch] 无效的方法路径: ${path}，需要包含 '.'`);
                    results.push({ path, ok: false });
                    continue;
                }
                const targetPath = path.substring(0, lastDot);
                const methodName = path.substring(lastDot + 1);
                const target = resolveTarget(targetPath);
                if (target) {
                    const ok = patchMethod(target, methodName, fn);
                    results.push({ path, ok });
                } else {
                    console.error(`[MonkeyPatch] 目标对象不存在: ${targetPath}`);
                    results.push({ path, ok: false });
                }
            }
        }

        if (Array.isArray(config.fetch)) {
            for (const rule of config.fetch) {
                if (rule.match && rule.replace) {
                    const ok = patchFetch(rule.match, rule.replace);
                    results.push({ rule: 'fetch', match: rule.match, ok });
                }
            }
        }

        if (Array.isArray(config.xhr)) {
            for (const rule of config.xhr) {
                if (rule.match && rule.replace) {
                    const ok = patchXHR(rule.match, rule.replace);
                    results.push({ rule: 'xhr', match: rule.match, ok });
                }
            }
        }

        console.log(`[MonkeyPatch] 批量补丁应用完成，共 ${results.length} 条规则`);
        return results;
    }

    /**
     * 恢复所有补丁
     */
    function restoreAll() {
        // 恢复方法
        for (const record of patchRegistry.methods) {
            try {
                if (record.target && record.target[record.methodName] === record.replacement) {
                    record.target[record.methodName] = record.original;
                }
            } catch (err) {
                console.warn(`[MonkeyPatch] 恢复方法失败: ${record.methodName} - ${err.message}`);
            }
        }
        patchRegistry.methods = [];

        // 恢复 fetch
        if (patchRegistry.fetch.length > 0 && global.fetch !== patchRegistry.fetch[0].originalFetch) {
            global.fetch = patchRegistry.fetch[0].originalFetch;
        }
        patchRegistry.fetch = [];

        // 恢复 XHR
        if (patchRegistry.xhr.length > 0) {
            const original = patchRegistry.xhr[0].originalOpen;
            if (XMLHttpRequest.prototype.open !== original) {
                XMLHttpRequest.prototype.open = original;
            }
        }
        patchRegistry.xhr = [];

        console.log('[MonkeyPatch] 所有补丁已恢复');
    }

    /**
     * 获取当前补丁列表
     */
    function getPatches() {
        return {
            methods: patchRegistry.methods.map(r => ({
                target: r.target?.constructor?.name || 'unknown',
                method: r.methodName,
            })),
            fetch: patchRegistry.fetch.map(r => ({ matcher: String(r.matcher) })),
            xhr: patchRegistry.xhr.map(r => ({ matcher: String(r.matcher) })),
        };
    }

    // ---------- 导出到全局 ----------
    const monkey = {
        patchMethod,
        patchFetch,
        patchXHR,
        patchAPI,
        restoreAll,
        getPatches,
    };

    global.MonkeyPatch = monkey;
    global.patchMethod = patchMethod;
    global.patchFetch = patchFetch;
    global.patchXHR = patchXHR;
    global.patchAPI = patchAPI;
    global.restoreAll = restoreAll;
    global.getPatches = getPatches;

    console.log('[MonkeyPatch] 工具已加载');
})(typeof window !== 'undefined' ? window : this);