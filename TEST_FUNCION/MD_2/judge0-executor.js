/**
 * Judge0 代码执行器 - 轻量核心
 * @version 1.0.0
 * @description 通过语言常量或名称执行代码，内置语言常量集合
 * @dependencies 无 (使用原生 fetch)
 *
 * @example
 * // 浏览器引入
 * <script src="judge0-executor.js"></script>
 * <script>
 *   const result = await Judge0Executor.execute({
 *       source_code: 'print("Hello")',
 *       language: Judge0Executor.Language.PYTHON   // 使用常量
 *   });
 *   console.log(result.stdout);
 * </script>
 *
 * @example
 * // ES Module
 * import Judge0Executor from './judge0-executor.js';
 * const result = await Judge0Executor.execute({
 *     source_code: 'console.log("Hi")',
 *     language: Judge0Executor.Language.JAVASCRIPT
 * });
 */

(function (global) {
    'use strict';

    // ============================================================
    // 语言常量集合 (枚举)
    // ============================================================
    const Language = {
        PYTHON: 71,
        PYTHON3: 71,
        PYTHON2: 70,
        JAVASCRIPT: 63,
        NODEJS: 63,
        JS: 63,
        BASH: 46,
        SHELL: 46,
        C: 50,
        CPP: 54,
        C_PLUS_PLUS: 54,
        JAVA: 62,
        RUBY: 72,
        RUST: 73,
        TYPESCRIPT: 74,
        TS: 74,
        PHP: 68,
        GO: 60,
        SWIFT: 83,
        R: 80,
        PERL: 85,
        LUA: 86,
        HASKELL: 87,
        ELIXIR: 88,
        ERLANG: 89,
        CLOJURE: 90,
        KOTLIN: 91,
        SCALA: 92,
        DART: 93,
        JULIA: 94,
        CRYSTAL: 95,
        ZIG: 96,
        NIM: 97,
        V: 98,
        GROOVY: 99,
        CSHARP: 51,
        C_SHARP: 51,
        FSHARP: 52,
        VBNET: 53,
        SQLITE: 55,
        POSTGRESQL: 56,
        MYSQL: 57,
        RLANG: 80,
    };

    // ============================================================
    // 辅助：字符串名称映射（可选，便于兼容）
    // ============================================================
    const LANGUAGE_NAME_MAP = {
        python: 71,
        python3: 71,
        python2: 70,
        javascript: 63,
        nodejs: 63,
        js: 63,
        bash: 46,
        shell: 46,
        c: 50,
        cpp: 54,
        'c++': 54,
        java: 62,
        ruby: 72,
        rust: 73,
        typescript: 74,
        ts: 74,
        php: 68,
        go: 60,
        swift: 83,
        r: 80,
        perl: 85,
        lua: 86,
        haskell: 87,
        elixir: 88,
        erlang: 89,
        clojure: 90,
        kotlin: 91,
        scala: 92,
        dart: 93,
        julia: 94,
        crystal: 95,
        zig: 96,
        nim: 97,
        v: 98,
        groovy: 99,
        csharp: 51,
        'c#': 51,
        fsharp: 52,
        vbnet: 53,
        sqlite: 55,
        postgresql: 56,
        mysql: 57,
        rlang: 80,
    };

    /**
     * 解析语言参数：接受数字 ID、字符串名称或 undefined
     * @param {number|string} lang - 语言 ID 或名称
     * @returns {number} 语言 ID
     * @throws {Error} 如果无法识别
     */
    function resolveLanguage(lang) {
        if (typeof lang === 'number') {
            return lang;
        }
        if (typeof lang === 'string') {
            const key = lang.toLowerCase().trim();
            const id = LANGUAGE_NAME_MAP[key];
            if (id === undefined) {
                throw new Error(`未知语言名称 "${lang}"`);
            }
            return id;
        }
        throw new Error('language 参数必须是数字或字符串');
    }

    // ============================================================
    // 核心执行函数
    // ============================================================

    /**
     * 在 Judge0 上执行代码
     * @param {Object} params
     * @param {string} params.source_code - 源代码
     * @param {number|string} params.language - 语言 ID 或名称（推荐使用 Language 常量）
     * @param {string} [params.stdin=''] - 标准输入
     * @param {number} [params.cpu_time_limit=5] - CPU 时间限制（秒）
     * @param {number} [params.memory_limit=256000] - 内存限制（KB）
     * @param {string} [params.apiBase='https://ce.judge0.com'] - API 地址
     * @returns {Promise<Object>} 执行结果
     */
    async function executeCode(params) {
        const {
            source_code,
            language,
            stdin = '',
            cpu_time_limit = 5,
            memory_limit = 256000,
            apiBase = 'https://ce.judge0.com',
        } = params;

        if (!source_code || source_code.trim() === '') {
            throw new Error('源代码不能为空');
        }

        const language_id = resolveLanguage(language);

        const payload = {
            language_id,
            source_code,
            stdin,
            cpu_time_limit,
            memory_limit,
        };

        const url = `${apiBase}/submissions?base64_encoded=false&wait=true`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            let errMsg = `HTTP ${response.status}`;
            try {
                const errJson = await response.json();
                errMsg = errJson.error || errMsg;
            } catch (_) { }
            throw new Error(`API 请求失败: ${errMsg}`);
        }

        const result = await response.json();
        if (result.error) {
            throw new Error(result.error);
        }
        return result;
    }

    // ============================================================
    // 导出
    // ============================================================

    const Judge0Executor = {
        version: '1.0.0',
        Language,               // 语言常量集合
        execute: executeCode,
        // 工具函数（可选）
        resolveLanguage,
        languageNameMap: LANGUAGE_NAME_MAP,
    };

    // 浏览器全局
    if (typeof window !== 'undefined') {
        window.Judge0Executor = Judge0Executor;
    }

    // CommonJS / Node.js
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Judge0Executor;
        module.exports.default = Judge0Executor;
    }

    // AMD
    if (typeof define === 'function' && define.amd) {
        define([], function () {
            return Judge0Executor;
        });
    }

    return Judge0Executor;
})(this);