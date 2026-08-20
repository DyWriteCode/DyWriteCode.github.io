/**
 * LaTeX 公式计算器 - 独立核心库
 * @version 1.0.0
 * @description 支持 LaTeX 公式转 MathJS 表达式、数值计算、KaTeX 渲染
 * @dependencies mathjs (全局 math), katex (全局 katex)
 *
 * @example
 * // 在 HTML 中通过 script 标签引入
 * <script src="https://cdnjs.cloudflare.com/ajax/libs/mathjs/11.8.0/math.min.js"></script>
 * <script src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js"></script>
 * <script src="latex-calculator.js"></script>
 * <script>
 *   const result = LaTeXCalculator.compute('\\sum_{i=1}^{10} i');
 *   console.log(result); // { success: true, result: '55', mathExpr: '55' }
 * </script>
 *
 * @example
 * // 在 ES Module 中使用
 * import LaTeXCalculator from './latex-calculator.js';
 * const result = LaTeXCalculator.compute('\\int_{0}^{1} {x^2} dx');
 * console.log(result.result); // 0.3333333333333333
 */

(function (global) {
    'use strict';

    // ============================================================
    // 1. 依赖检查
    // ============================================================
    if (typeof math === 'undefined') {
        console.warn('[LaTeXCalculator] 未找到 mathjs 全局对象，请先加载 mathjs 库。');
    }
    if (typeof katex === 'undefined') {
        console.warn('[LaTeXCalculator] 未找到 katex 全局对象，请先加载 katex 库。');
    }

    // ============================================================
    // 2. 工具函数 - 数值积分（复合辛普森法）
    // ============================================================

    /**
     * 使用复合辛普森法计算数值积分
     * @param {string} expr - MathJS 表达式，变量名为 varName
     * @param {string} varName - 积分变量名（默认 'x'）
     * @param {number} a - 积分下限
     * @param {number} b - 积分上限
     * @param {number} [n=1000] - 等分数（自动调整为偶数）
     * @returns {number} 积分近似值
     * @throws {Error} 如果表达式求值失败
     */
    function numericalIntegral(expr, varName, a, b, n) {
        if (typeof math === 'undefined') {
            throw new Error('mathjs 库未加载，无法进行数值积分');
        }
        if (n === undefined || n < 2) n = 1000;
        if (n % 2 === 1) n++; // 确保为偶数
        const h = (b - a) / n;
        let sum = 0;
        const vars = {};
        for (let i = 0; i <= n; i++) {
            const x = a + i * h;
            vars[varName] = x;
            const y = math.evaluate(expr, vars);
            if (i === 0 || i === n) {
                sum += y;
            } else if (i % 2 === 0) {
                sum += 2 * y;
            } else {
                sum += 4 * y;
            }
        }
        return (sum * h) / 3;
    }

    // ============================================================
    // 3. 核心转换函数 - LaTeX → MathJS
    // ============================================================

    /**
     * 将 LaTeX 公式转换为 MathJS 可计算的表达式字符串
     * @param {string} latex - LaTeX 公式字符串
     * @returns {string} MathJS 表达式字符串
     * @throws {Error} 如果转换失败
     */
    function latexToMathJS(latex) {
        if (!latex || latex.trim() === '') return '';
        let s = latex.trim();
        s = s.replace(/\s+/g, ' ');

        // ---- 0. 预处理：移除 \limits 和 \, ----
        s = s.replace(/\\limits/g, '');
        s = s.replace(/\\,/g, ' ');

        // ---- 1. 三角函数等（递归处理参数） ----
        const funcMap = {
            'sin': 'sin',
            'cos': 'cos',
            'tan': 'tan',
            'cot': 'cot',
            'sec': 'sec',
            'csc': 'csc',
            'arcsin': 'asin',
            'arccos': 'acos',
            'arctan': 'atan',
            'log': 'log',
            'ln': 'log',
            'lg': 'log10',
            'exp': 'exp',
            'sinh': 'sinh',
            'cosh': 'cosh',
            'tanh': 'tanh'
        };
        let prevTrig;
        do {
            prevTrig = s;
            for (const [latexCmd, mathFn] of Object.entries(funcMap)) {
                const regex1 = new RegExp('\\\\' + latexCmd + '\\{([^}]*)\\}', 'g');
                const regex2 = new RegExp('\\\\' + latexCmd + '\\(([^)]*)\\)', 'g');
                s = s.replace(regex1, (m, args) => `${mathFn}(${latexToMathJS(args)})`);
                s = s.replace(regex2, (m, args) => `${mathFn}(${latexToMathJS(args)})`);
            }
        } while (s !== prevTrig);

        // ---- 2. 分数 ----
        let prev;
        do {
            prev = s;
            s = s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, (match, num, den) => {
                return `${latexToMathJS(num)}/${latexToMathJS(den)}`;
            });
        } while (s !== prev);

        // ---- 3. 根号 ----
        do {
            prev = s;
            s = s.replace(/\\sqrt\[([^{}]*)\]\{([^{}]*)\}/g, (match, n, expr) => {
                return `(${latexToMathJS(expr)})^(1/(${latexToMathJS(n)}))`;
            });
            s = s.replace(/\\sqrt\{([^{}]*)\}/g, (match, expr) => {
                return `sqrt(${latexToMathJS(expr)})`;
            });
        } while (s !== prev);

        // ---- 4. 常数替换 ----
        const constMap = {
            '\\pi': 'pi',
            '\\Pi': 'pi',
            '\\infty': 'Infinity',
            '\\e': 'e',
            '\\E': 'e',
            '\\mathrm{e}': 'e',
            '\\mathrm{E}': 'e'
        };
        for (const [lc, mc] of Object.entries(constMap)) {
            s = s.replace(new RegExp(lc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), mc);
        }

        // ---- 5. 希腊字母 ----
        const greekMap = {
            '\\alpha': 'alpha',
            '\\beta': 'beta',
            '\\gamma': 'gamma',
            '\\delta': 'delta',
            '\\epsilon': 'epsilon',
            '\\zeta': 'zeta',
            '\\eta': 'eta',
            '\\theta': 'theta',
            '\\iota': 'iota',
            '\\kappa': 'kappa',
            '\\lambda': 'lambda',
            '\\mu': 'mu',
            '\\nu': 'nu',
            '\\xi': 'xi',
            '\\omicron': 'omicron',
            '\\pi': 'pi',
            '\\rho': 'rho',
            '\\sigma': 'sigma',
            '\\tau': 'tau',
            '\\upsilon': 'upsilon',
            '\\phi': 'phi',
            '\\chi': 'chi',
            '\\psi': 'psi',
            '\\omega': 'omega',
            '\\Gamma': 'Gamma',
            '\\Delta': 'Delta',
            '\\Theta': 'Theta',
            '\\Lambda': 'Lambda',
            '\\Xi': 'Xi',
            '\\Pi': 'Pi',
            '\\Sigma': 'Sigma',
            '\\Upsilon': 'Upsilon',
            '\\Phi': 'Phi',
            '\\Psi': 'Psi',
            '\\Omega': 'Omega'
        };
        for (const [lc, mc] of Object.entries(greekMap)) {
            s = s.replace(new RegExp(lc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), mc);
        }

        // ---- 6. 求和与连乘 ----
        let prev2 = '';
        let maxIter = 80;
        while (maxIter-- > 0 && s !== prev2) {
            prev2 = s;
            s = replaceSumOrProd(s, 'sum');
            s = replaceSumOrProd(s, 'prod');
        }
        if (/\\sum|\\prod/.test(s)) {
            throw new Error('转换失败，残留求和/连乘命令: ' + s);
        }

        // ---- 7. 定积分 ----
        s = processIntegrals(s);

        // ---- 8. 运算符映射 ----
        const opMap = {
            '\\times': '*',
            '\\cdot': '*',
            '\\div': '/',
            '\\pm': '±',
            '\\mp': '∓',
            '\\left(': '(',
            '\\right)': ')',
            '\\left[': '[',
            '\\right]': ']',
            '\\left\\{': '{',
            '\\right\\}': '}',
            '\\left|': 'abs(',
            '\\right|': ')',
            '\\left.': '',
            '\\right.': '',
            '\\left': '',
            '\\right': ''
        };
        for (const [lc, mc] of Object.entries(opMap)) {
            s = s.replace(new RegExp(lc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), mc);
        }

        // ---- 9. 阶乘支持 (i! → factorial(i)) ----
        s = s.replace(/([a-zA-Z0-9]+)\s*!/g, 'factorial($1)');

        // ---- 10. 清理孤立的 { } ----
        s = s.replace(/\{([^{}]*)\}/g, (match, content) => {
            if (!/[+\-*/^=<>]/.test(content)) return content;
            return `(${content})`;
        });

        s = s.replace(/\s+/g, ' ').trim();
        return s;
    }

    // ============================================================
    // 4. 辅助函数 - 处理求和 / 连乘
    // ============================================================

    /**
     * 替换 LaTeX 中的 \sum 或 \prod 为数值计算结果
     * @param {string} s - 当前字符串
     * @param {string} type - 'sum' 或 'prod'
     * @returns {string} 替换后的字符串
     */
    function replaceSumOrProd(s, type) {
        if (typeof math === 'undefined') {
            throw new Error('mathjs 库未加载，无法计算求和/连乘');
        }
        const cmd = type === 'sum' ? 'sum' : 'prod';
        const regex = new RegExp(
            `\\\\${cmd}\\s*_\\s*\\{([^}]*)\\}\\s*\\^\\s*\\{([^}]*)\\}\\s*((?:\\{[^}]*\\})|\\S+)`,
            'g'
        );

        let newS = s;
        let match;
        while ((match = regex.exec(newS)) !== null) {
            const fullMatch = match[0];
            const lower = match[1];
            const upper = match[2];
            let expr = match[3];
            if (expr.startsWith('{') && expr.endsWith('}')) {
                expr = expr.slice(1, -1);
            }

            if (/\\sum|\\prod/.test(expr)) {
                regex.lastIndex = match.index + fullMatch.length;
                continue;
            }

            const lowerC = latexToMathJS(lower);
            const upperC = latexToMathJS(upper);
            const exprC = latexToMathJS(expr);

            let varName = 'x';
            let lowerVal = lowerC;
            const eqIdx = lowerC.indexOf('=');
            if (eqIdx !== -1) {
                varName = lowerC.substring(0, eqIdx).trim();
                lowerVal = lowerC.substring(eqIdx + 1).trim();
            } else {
                varName = 'i';
                lowerVal = lowerC;
            }

            const upperVal = upperC;

            function isNumeric(str) {
                return /^-?\d+(\.\d+)?$/.test(str.trim());
            }

            let replacement = '';
            if (isNumeric(lowerVal) && isNumeric(upperVal)) {
                const lowerNum = parseFloat(lowerVal);
                const upperNum = parseFloat(upperVal);
                if (lowerNum <= upperNum) {
                    const exprWithVar = exprC.replace(new RegExp(`\\b${varName}\\b`, 'g'), 'x');
                    let result;
                    if (type === 'sum') {
                        result = 0;
                        for (let x = lowerNum; x <= upperNum; x++) {
                            result += math.evaluate(exprWithVar, { x: x });
                        }
                    } else {
                        result = 1;
                        for (let x = lowerNum; x <= upperNum; x++) {
                            result *= math.evaluate(exprWithVar, { x: x });
                        }
                    }
                    replacement = result.toString();
                } else {
                    replacement = type === 'sum' ? '0' : '1';
                }
            } else {
                replacement = `(function(){ throw new Error("求和/积的上下限必须为数值"); })()`;
            }

            newS = newS.replace(fullMatch, replacement);
            regex.lastIndex = 0;
            if (!newS.includes(`\\${cmd}`)) break;
        }
        return newS;
    }

    // ============================================================
    // 5. 辅助函数 - 处理定积分
    // ============================================================

    /**
     * 处理 LaTeX 中的 \int 定积分，替换为数值计算结果
     * @param {string} s - 当前字符串
     * @returns {string} 替换后的字符串
     */
    function processIntegrals(s) {
        if (typeof math === 'undefined') {
            throw new Error('mathjs 库未加载，无法计算定积分');
        }
        let newS = s;
        let maxLoop = 50;
        while (maxLoop-- > 0) {
            const idx = newS.indexOf('\\int');
            if (idx === -1) break;

            let rest = newS.slice(idx + 4);
            rest = rest.trimStart();
            if (!rest.startsWith('_')) break;
            rest = rest.slice(1);

            // 提取下限
            let lower = '';
            let lowerEnd = 0;
            if (rest.startsWith('{')) {
                let braceCount = 1;
                let i = 1;
                while (i < rest.length && braceCount > 0) {
                    if (rest[i] === '{') braceCount++;
                    else if (rest[i] === '}') braceCount--;
                    i++;
                }
                lower = rest.slice(1, i - 1);
                lowerEnd = i;
            } else {
                let i = 0;
                while (i < rest.length && rest[i] !== '^' && !/\s/.test(rest[i])) i++;
                lower = rest.slice(0, i);
                lowerEnd = i;
            }
            if (lowerEnd >= rest.length) break;
            rest = rest.slice(lowerEnd);
            rest = rest.trimStart();
            if (!rest.startsWith('^')) break;
            rest = rest.slice(1);

            // 提取上限
            let upper = '';
            let upperEnd = 0;
            if (rest.startsWith('{')) {
                let braceCount = 1;
                let i = 1;
                while (i < rest.length && braceCount > 0) {
                    if (rest[i] === '{') braceCount++;
                    else if (rest[i] === '}') braceCount--;
                    i++;
                }
                upper = rest.slice(1, i - 1);
                upperEnd = i;
            } else {
                let i = 0;
                while (i < rest.length && !/\s/.test(rest[i]) && rest[i] !== 'd') i++;
                upper = rest.slice(0, i);
                upperEnd = i;
            }
            if (upperEnd >= rest.length) break;
            rest = rest.slice(upperEnd);

            // 找到 dx 位置
            const dxIndex = rest.search(/\s*d\s*x\s*/);
            if (dxIndex === -1) break;
            let expr = rest.slice(0, dxIndex).trim();
            if (expr.startsWith('{') && expr.endsWith('}')) expr = expr.slice(1, -1);

            const lowerC = latexToMathJS(lower);
            const upperC = latexToMathJS(upper);
            const exprC = latexToMathJS(expr);

            let a, b;
            try {
                a = math.evaluate(lowerC);
                b = math.evaluate(upperC);
            } catch (_) {
                const aNum = parseFloat(lowerC);
                const bNum = parseFloat(upperC);
                if (!isNaN(aNum) && !isNaN(bNum)) {
                    a = aNum;
                    b = bNum;
                } else {
                    break;
                }
            }
            if (typeof a !== 'number' || typeof b !== 'number' || !isFinite(a) || !isFinite(b)) break;

            let result;
            try {
                result = numericalIntegral(exprC, 'x', a, b);
                if (!isFinite(result)) break;
            } catch (_) {
                break;
            }

            const matchEnd = newS.indexOf('dx', idx) + 2;
            newS = newS.slice(0, idx) + result.toString() + newS.slice(matchEnd);
        }
        return newS;
    }

    // ============================================================
    // 6. 高层 API - 计算与渲染
    // ============================================================

    /**
     * 计算 LaTeX 公式
     * @param {string} latex - LaTeX 公式字符串
     * @param {Object} [options] - 可选配置
     * @param {number} [options.integralSteps=1000] - 积分等分数
     * @returns {Object} { success: boolean, result?: string, mathExpr?: string, error?: string }
     */
    function compute(latex, options) {
        if (!latex || latex.trim() === '') {
            return { success: false, error: '请输入 LaTeX 公式' };
        }
        try {
            const mathExpr = latexToMathJS(latex);
            if (!mathExpr || mathExpr.trim() === '') {
                return { success: false, error: '转换后的表达式为空' };
            }
            if (mathExpr.includes('throw new Error')) {
                const errMatch = mathExpr.match(/throw new Error\("([^"]*)"\)/);
                if (errMatch) return { success: false, error: errMatch[1] };
            }
            if (typeof math === 'undefined') {
                return { success: false, error: 'mathjs 库未加载，无法计算' };
            }
            const result = math.evaluate(mathExpr);
            let displayResult;
            if (typeof result === 'number') {
                if (Number.isInteger(result)) {
                    displayResult = result.toString();
                } else {
                    displayResult = parseFloat(result.toPrecision(12)).toString();
                }
            } else if (typeof result === 'string') {
                displayResult = result;
            } else if (result && typeof result === 'object' && result.toString) {
                displayResult = result.toString();
            } else {
                displayResult = String(result);
            }
            return { success: true, result: displayResult, mathExpr };
        } catch (err) {
            let msg = err.message || '计算错误';
            if (msg.includes('undefined')) {
                msg = '表达式包含未定义的变量，请确保所有变量都有数值';
            }
            return { success: false, error: msg };
        }
    }

    /**
     * 将 LaTeX 转换为 MathJS 表达式字符串（不计算）
     * @param {string} latex - LaTeX 公式字符串
     * @returns {string} MathJS 表达式字符串
     * @throws {Error} 如果转换失败
     */
    function parse(latex) {
        return latexToMathJS(latex);
    }

    /**
     * 使用 KaTeX 渲染 LaTeX 到目标 DOM 元素
     * @param {string} latex - LaTeX 公式字符串
     * @param {HTMLElement} target - 目标 DOM 元素
     * @param {Object} [options] - KaTeX 渲染选项
     * @returns {boolean} 是否渲染成功
     */
    function render(latex, target, options) {
        if (!target) return false;
        if (!latex || latex.trim() === '') {
            target.innerHTML = '';
            return false;
        }
        if (typeof katex === 'undefined') {
            target.innerHTML = '<span style="color:#c0392b;">⚠️ KaTeX 库未加载</span>';
            return false;
        }
        try {
            const html = katex.renderToString(latex, Object.assign({
                throwOnError: false,
                displayMode: true,
                trust: true,
            }, options || {}));
            target.innerHTML = html;
            return true;
        } catch (err) {
            target.innerHTML = `<span style="color:#c0392b;font-size:16px;">⚠️ 渲染失败: ${err.message}</span>`;
            return false;
        }
    }

    // ============================================================
    // 7. 导出
    // ============================================================

    const LaTeXCalculator = {
        /**
         * 计算 LaTeX 公式
         * @param {string} latex - LaTeX 公式字符串
         * @param {Object} [options] - 可选配置
         * @returns {Object} { success, result, mathExpr } 或 { success, error }
         */
        compute: compute,

        /**
         * 将 LaTeX 转换为 MathJS 表达式字符串（不计算）
         * @param {string} latex - LaTeX 公式字符串
         * @returns {string} MathJS 表达式字符串
         */
        parse: parse,

        /**
         * 使用 KaTeX 渲染 LaTeX 到 DOM 元素
         * @param {string} latex - LaTeX 公式字符串
         * @param {HTMLElement} target - 目标元素
         * @param {Object} [options] - KaTeX 选项
         * @returns {boolean} 是否成功
         */
        render: render,

        /**
         * 数值积分工具函数（复合辛普森法）
         * @param {string} expr - MathJS 表达式
         * @param {string} varName - 变量名
         * @param {number} a - 下限
         * @param {number} b - 上限
         * @param {number} [n=1000] - 等分数
         * @returns {number} 积分值
         */
        integral: numericalIntegral,

        /**
         * 版本号
         */
        version: '1.0.0',

        /**
         * 依赖检查
         */
        deps: {
            mathjs: typeof math !== 'undefined',
            katex: typeof katex !== 'undefined'
        }
    };

    // ---- 浏览器全局 ----
    if (typeof window !== 'undefined') {
        window.LaTeXCalculator = LaTeXCalculator;
    }

    // ---- CommonJS / Node.js ----
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = LaTeXCalculator;
        module.exports.default = LaTeXCalculator;
    }

    // ---- AMD ----
    if (typeof define === 'function' && define.amd) {
        define([], function () {
            return LaTeXCalculator;
        });
    }

    // ---- 返回（用于 IIFE 链式调用） ----
    return LaTeXCalculator;

})(typeof globalThis !== 'undefined' ? globalThis :
    typeof window !== 'undefined' ? window :
        typeof global !== 'undefined' ? global :
            this);