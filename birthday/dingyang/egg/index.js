(function () {
    'use strict';

    // =============================================================
    // 配置
    // =============================================================
    const CONFIG = {
        girlName: '小雅',
        scienceClickThreshold: 5,
        humanitiesClickThreshold: 9,
        initPasswords: ['love', 'friend', 'lovefriend', 'friendlove'],
        sciencePassword: '304510113664',
        starlightPassword: 'BEACON',
        humanitiesKey: '杜工部集仁者爱人武昌首义',
        clickOrder: ['钥匙', '密语', '心迹', '答案'],
        hexAnswer: 'echo',
        cipherAnswer: 'openlovetruth',
        checkAnswer: '9',
    };

    // =============================================================
    // DOM 引用
    // =============================================================
    const eggTrigger = document.getElementById('eggTrigger');
    const aboutTrigger = document.getElementById('aboutTrigger');
    const aboutLink = document.getElementById('aboutLink');

    const stepInit = document.getElementById('step-init');
    const initInput = document.getElementById('initInput');
    const initBtn = document.getElementById('initBtn');
    const fbInit = document.getElementById('fb-init');

    const stepPasswordSummary = document.getElementById('step-password-summary');
    const passwordSummaryInput = document.getElementById('passwordSummaryInput');
    const passwordSummaryBtn = document.getElementById('passwordSummaryBtn');
    const fbPasswordSummary = document.getElementById('fb-password-summary');

    const stepStarlight = document.getElementById('step-starlight');
    const starlightInput = document.getElementById('starlightInput');
    const starlightBtn = document.getElementById('starlightBtn');
    const fbStarlight = document.getElementById('fb-starlight');

    const stepKeySummary = document.getElementById('step-key-summary');
    const keySummaryInput = document.getElementById('keySummaryInput');
    const keySummaryBtn = document.getElementById('keySummaryBtn');
    const fbKeySummary = document.getElementById('fb-key-summary');

    const stepClick = document.getElementById('step-click');
    const clickWords = document.querySelectorAll('.click-word');
    const fbClick = document.getElementById('fb-click');
    const resetBtn = document.getElementById('clickResetBtn');

    const stepHex = document.getElementById('step-hex');
    const hexInput = document.getElementById('hexInput');
    const hexBtn = document.getElementById('hexBtn');
    const fbHex = document.getElementById('fb-hex');

    const stepCipher = document.getElementById('step-cipher');
    const cipherInput = document.getElementById('cipherInput');
    const cipherBtn = document.getElementById('cipherBtn');
    const fbCipher = document.getElementById('fb-cipher');

    const questionnaire = document.getElementById('questionnaire');
    const submitQ = document.getElementById('submit-q');
    const fbQuestionnaire = document.getElementById('fb-questionnaire');

    const stepCheck = document.getElementById('step-check');
    const checkInput = document.getElementById('checkInput');
    const checkBtn = document.getElementById('checkBtn');
    const fbCheck = document.getElementById('fb-check');

    const stepIdentity = document.getElementById('step-identity');
    const identityInput = document.getElementById('identityInput');
    const identityBtn = document.getElementById('identityBtn');
    const fbIdentity = document.getElementById('fb-identity');

    const resultArea = document.getElementById('result-area');
    const resultIcon = document.getElementById('resultIcon');
    const resultTitle = document.getElementById('resultTitle');
    const resultBody = document.getElementById('resultBody');
    const guestArea = document.getElementById('guest-area');

    const pageScience = document.getElementById('page-science');
    const pageHumanities = document.getElementById('page-humanities');

    // =============================================================
    // 状态
    // =============================================================
    let clickCount = 0;
    let step = 0;
    let isGuest = false;
    let highStatus = false;
    let clickOrder = [];
    let humanitiesClickCount = 0;
    let humanitiesTriggered = false;

    // =============================================================
    // 辅助
    // =============================================================
    function log(msg) { console.log('[🎁 彩蛋] ' + msg); }

    function hideAllSteps() {
        document.querySelectorAll('.egg-step').forEach(el => el.classList.remove('show'));
    }

    function showStep(element) {
        hideAllSteps();
        if (element) {
            element.classList.add('show');
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    function showFeedback(container, message, isError = false) {
        container.innerHTML = `<div class="${isError ? 'error-msg' : 'feedback-message'}">${message}</div>`;
    }

    function clearFeedback(container) { container.innerHTML = ''; }

    function switchPage(pageId) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(pageId).classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // =============================================================
    // 暴露给控制台的辅助函数（增强）
    // =============================================================
    window.__EGG = {
        config: CONFIG,
        status: function () {
            return `当前步骤: ${step}`;
        },
        // 支持参数：__EGG.trigger(次数) 默认为5
        trigger: function (times) {
            times = times || CONFIG.scienceClickThreshold;
            if (step === 0) {
                clickCount = times;
                eggTrigger.click();
            } else {
                console.warn('彩蛋已触发，无需重复操作。');
            }
        },
        // 十六进制解码函数：输入 "65 63 68 6f" 返回 "echo"
        hexDecode: function (hexStr) {
            return hexStr.split(/\s+/).map(function (h) {
                return String.fromCharCode(parseInt(h, 16));
            }).join('');
        },
        // Base64 解码快捷
        base64Decode: function (b64) {
            try { return atob(b64); } catch (e) { return null; }
        }
    };

    // =============================================================
    // 理科触发
    // =============================================================
    eggTrigger.addEventListener('click', function (e) {
        if (step > 0) return;
        clickCount++;
        if (clickCount === CONFIG.scienceClickThreshold) {
            log('理科彩蛋触发！');
            step = 1;
            clickCount = 0;
            eggTrigger.style.color = '#b5654b';
            setTimeout(() => { eggTrigger.style.color = ''; }, 300);
            showStep(stepInit);
            showFeedback(fbInit, '💡 请从两段英文的句首提取密钥。');
            initInput.focus();
        } else if (clickCount > CONFIG.scienceClickThreshold) {
            clickCount = 0;
        }
    });

    // =============================================================
    // 初始密码验证
    // =============================================================
    initBtn.addEventListener('click', function () {
        if (step !== 1) return;
        const val = initInput.value.trim().toLowerCase();
        if (!val) { showFeedback(fbInit, '请输入密钥。', true); return; }
        if (!CONFIG.initPasswords.includes(val)) {
            showFeedback(fbInit, '❌ 密钥错误，再留意句首的字母。', true);
            initInput.value = '';
            return;
        }
        const isCombination = val.length > 5;
        log('初始密码: ' + val);
        step = 8;
        let extraMsg = '';
        if (isCombination) {
            extraMsg = '🌟 你观察得很仔细，竟然发现了隐藏的组合！这份细心，便是解开所有谜题的第一把钥匙。';
        } else if (val === 'love') {
            extraMsg = '🌸 你选择了「爱」，这让我心里泛起温柔的涟漪。';
        } else if (val === 'friend') {
            extraMsg = '🤝 你选择了「友谊」，这是世间最珍贵的默契之一。';
        }
        showFeedback(fbInit, `✅ 正确！${extraMsg} 请根据上面暗示的学科次序输入密码。`);
        setTimeout(() => {
            showStep(stepPasswordSummary);
            showFeedback(fbPasswordSummary, '🔐 请将六个数字按“生命→变化→大地→信息→数理→物理”的顺序拼接。');
            passwordSummaryInput.focus();
        }, 1500);
        initInput.value = '';
    });
    initInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') initBtn.click();
    });

    // =============================================================
    // 理科密码验证 → 星光指引
    // =============================================================
    passwordSummaryBtn.addEventListener('click', function () {
        if (step !== 8) return;
        const val = passwordSummaryInput.value.trim();
        if (!val) { showFeedback(fbPasswordSummary, '请输入12位密码。', true); return; }
        if (val === CONFIG.sciencePassword) {
            log('理科密码验证通过');
            step = 9;
            showFeedback(fbPasswordSummary, '✅ 密码正确！现在需要汇聚散落在诗间的光点。');
            setTimeout(() => {
                showStep(stepStarlight);
                showFeedback(fbStarlight, '✨ 请找出每首诗标题旁那隐约的光点，按顺序拼成一座灯塔的名字。');
                starlightInput.focus();
            }, 1200);
            passwordSummaryInput.value = '';
        } else {
            showFeedback(fbPasswordSummary, '❌ 密码错误，请检查顺序。', true);
            passwordSummaryInput.value = '';
        }
    });
    passwordSummaryInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') passwordSummaryBtn.click();
    });

    // =============================================================
    // 星光指引验证
    // =============================================================
    starlightBtn.addEventListener('click', function () {
        if (step !== 9) return;
        const val = starlightInput.value.trim().toUpperCase();
        if (!val) { showFeedback(fbStarlight, '请输入六个字母。', true); return; }
        if (val === CONFIG.starlightPassword) {
            log('星光指引通过');
            step = 10;
            showFeedback(fbStarlight, '✅ 光塔已点亮！进入文思之间。');
            setTimeout(() => {
                switchPage('page-humanities');
                const hint = document.createElement('div');
                hint.className = 'feedback-message';
                hint.style.marginTop = '20px';
                hint.textContent = '💡 轻触“文思之间”标题下的“关于”链接 9 次，开启文科篇章。';
                pageHumanities.querySelector('.content').appendChild(hint);
                setupHumanitiesTrigger();
            }, 1200);
            starlightInput.value = '';
        } else {
            showFeedback(fbStarlight, '❌ 光点尚未汇聚完整，再仔细观察那些暗淡的字母。', true);
            starlightInput.value = '';
        }
    });
    starlightInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') starlightBtn.click();
    });

    // =============================================================
    // 文科触发（点击“关于”链接9次）
    // =============================================================
    function setupHumanitiesTrigger() {
        if (humanitiesTriggered) return;
        aboutTrigger.addEventListener('click', function (e) {
            e.preventDefault();
            if (step !== 10 || humanitiesTriggered) return;
            humanitiesClickCount++;
            if (humanitiesClickCount === CONFIG.humanitiesClickThreshold) {
                log('文科彩蛋触发！');
                humanitiesTriggered = true;
                humanitiesClickCount = 0;
                aboutTrigger.style.color = '#b5654b';
                setTimeout(() => { aboutTrigger.style.color = ''; }, 300);
                hideAllSteps();
                showStep(stepKeySummary);
                showFeedback(fbKeySummary, '📜 请根据上面暗示的次序，输入12字密钥。');
                keySummaryInput.focus();
            } else if (humanitiesClickCount > CONFIG.humanitiesClickThreshold) {
                humanitiesClickCount = 0;
            }
        });
    }

    if (aboutLink) {
        aboutLink.addEventListener('click', function (e) { e.preventDefault(); });
    }

    // =============================================================
    // 文科密钥验证 → 文心点击
    // =============================================================
    keySummaryBtn.addEventListener('click', function () {
        if (step !== 10 || !humanitiesTriggered) return;
        const val = keySummaryInput.value.trim();
        if (!val) { showFeedback(fbKeySummary, '请输入12字密钥。', true); return; }
        if (val === CONFIG.humanitiesKey) {
            log('文科密钥验证通过');
            step = 11;
            showFeedback(fbKeySummary, '✅ 密钥正确！现在请依次转动心灵的钥匙。');
            setTimeout(() => {
                showStep(stepClick);
                clickOrder = [];
                clickWords.forEach(el => {
                    el.classList.remove('clicked', 'wrong');
                    el.style.pointerEvents = 'auto';
                });
                showFeedback(fbClick, '请按「钥匙 → 密语 → 心迹 → 答案」的顺序点击。双击已选词可取消，或点击重置按钮。');
            }, 1200);
            keySummaryInput.value = '';
        } else {
            showFeedback(fbKeySummary, '❌ 密钥错误，请检查顺序。', true);
            keySummaryInput.value = '';
        }
    });
    keySummaryInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') keySummaryBtn.click();
    });

    // =============================================================
    // 文心点击逻辑
    // =============================================================
    function resetClickState() {
        clickOrder = [];
        clickWords.forEach(el => {
            el.classList.remove('clicked', 'wrong');
            el.style.pointerEvents = 'auto';
        });
        showFeedback(fbClick, '已重置，请按「钥匙 → 密语 → 心迹 → 答案」的顺序重新点击。');
    }

    resetBtn.addEventListener('click', resetClickState);

    clickWords.forEach(word => {
        // 单击选择
        word.addEventListener('click', function () {
            if (step !== 11) return;
            if (this.classList.contains('clicked')) return;
            const order = parseInt(this.dataset.order);
            if (order === clickOrder.length + 1) {
                this.classList.add('clicked');
                clickOrder.push(this.textContent);
                showFeedback(fbClick, `✅ 已点击：${this.textContent}（${clickOrder.length}/${CONFIG.clickOrder.length}）`);
                if (clickOrder.length === CONFIG.clickOrder.length) {
                    log('文心点击完成');
                    step = 12;
                    showFeedback(fbClick, '🎉 所有钥匙已转动！现在请解读影子的密语。');
                    setTimeout(() => {
                        showStep(stepHex);
                        showFeedback(fbHex, '🌑 请将十六进制数转成 ASCII 字母。');
                        hexInput.focus();
                    }, 1000);
                }
            } else {
                this.classList.add('wrong');
                showFeedback(fbClick, '❌ 顺序不对，请重置。', true);
                setTimeout(() => {
                    this.classList.remove('wrong');
                    resetClickState();
                }, 800);
            }
        });

        // 双击取消选中
        word.addEventListener('dblclick', function () {
            if (step !== 11) return;
            if (!this.classList.contains('clicked')) return;
            const text = this.textContent;
            const idx = clickOrder.indexOf(text);
            if (idx !== -1) {
                clickOrder.splice(idx, 1);
                this.classList.remove('clicked');
                const remaining = clickOrder.slice(idx);
                clickOrder = clickOrder.slice(0, idx);
                clickWords.forEach(el => {
                    if (clickOrder.indexOf(el.textContent) === -1) {
                        el.classList.remove('clicked');
                    }
                });
                showFeedback(fbClick, `↩ 已取消「${text}」，当前已选：${clickOrder.join(' → ') || '无'}`);
            }
        });
    });

    // =============================================================
    // 环节A: 影子的密语（十六进制验证）
    // =============================================================
    hexBtn.addEventListener('click', function () {
        if (step !== 12) return;
        const val = hexInput.value.trim().toLowerCase();
        if (!val) { showFeedback(fbHex, '请输入解码后的单词。', true); return; }
        if (val === CONFIG.hexAnswer) {
            log('十六进制验证通过');
            step = 13;
            showFeedback(fbHex, '✅ 影子密语正确！现在请解码 Base64 密文。');
            setTimeout(() => {
                showStep(stepCipher);
                showFeedback(fbCipher, '🔐 请将三段 Base64 密文按顺序解码并拼接，输入最终结果（全小写）。');
                cipherInput.focus();
            }, 1000);
            hexInput.value = '';
        } else {
            showFeedback(fbHex, '❌ 密语错误，请检查十六进制转换。', true);
            hexInput.value = '';
        }
    });
    hexInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') hexBtn.click();
    });

    // =============================================================
    // 环节B: 密语转译（Base64验证）
    // =============================================================
    cipherBtn.addEventListener('click', function () {
        if (step !== 13) return;
        const val = cipherInput.value.trim().toLowerCase();
        if (!val) { showFeedback(fbCipher, '请输入解码后的密语。', true); return; }
        if (val === CONFIG.cipherAnswer) {
            log('Base64 验证通过');
            step = 14;
            showFeedback(fbCipher, '✅ 密语正确！现在请回答几个心里话。');
            setTimeout(() => {
                showStep(questionnaire);
                clearFeedback(fbQuestionnaire);
            }, 1000);
            cipherInput.value = '';
        } else {
            showFeedback(fbCipher, '❌ 密语错误，请检查三段密文的解码和拼接顺序。', true);
            cipherInput.value = '';
        }
    });
    cipherInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') cipherBtn.click();
    });

    // =============================================================
    // 问卷提交 → 心灵的校验
    // =============================================================
    submitQ.addEventListener('click', function () {
        if (step !== 14) return;
        const q1 = document.querySelector('input[name="q1"]:checked');
        const q2 = document.querySelector('input[name="q2"]:checked');
        const q3 = document.querySelector('input[name="q3"]:checked');
        if (!q1 || !q2 || !q3) {
            showFeedback(fbQuestionnaire, '💬 请回答所有问题再提交。', true);
            return;
        }
        const scoreMap = { 'A': 3, 'B': 2, 'C': 1 };
        const total = scoreMap[q1.value] + scoreMap[q2.value] + scoreMap[q3.value];
        highStatus = (total >= 7);
        if (q1.value === 'A' && q2.value === 'A') highStatus = true;

        log('问卷结果: ' + (highStatus ? '高地位' : '一般'));
        step = 15;
        showFeedback(fbQuestionnaire, '✅ 回答完毕。现在进行心灵的校验。');
        setTimeout(() => {
            showStep(stepCheck);
            showFeedback(fbCheck, '🧾 请找出那个唯一的数字。');
            checkInput.focus();
        }, 1200);
    });

    // =============================================================
    // 环节C: 心灵的校验（隐晦提示）
    // =============================================================
    checkBtn.addEventListener('click', function () {
        if (step !== 15) return;
        const val = checkInput.value.trim();
        if (!val) { showFeedback(fbCheck, '请输入一位数字。', true); return; }
        if (val === CONFIG.checkAnswer) {
            log('校验通过');
            step = 16;
            showFeedback(fbCheck, '✅ 校验通过！现在进行最后的身份确认。');
            setTimeout(() => {
                showStep(stepIdentity);
                showFeedback(fbIdentity, '👤 请告诉我，她的名字是？只有她才能看到最后的答案。');
                identityInput.focus();
            }, 1000);
            checkInput.value = '';
        } else {
            showFeedback(fbCheck, '❌ 数字不对，再仔细看看年份与段落。', true);
            checkInput.value = '';
        }
    });
    checkInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') checkBtn.click();
    });

    // =============================================================
    // 身份验证
    // =============================================================
    identityBtn.addEventListener('click', function () {
        if (step !== 16) return;
        const name = identityInput.value.trim();
        if (!name) {
            showFeedback(fbIdentity, '请输入她的名字。', true);
            return;
        }
        if (name === CONFIG.girlName) {
            log('身份验证通过：她是 ' + name);
            step = 17;
            showFeedback(fbIdentity, '✅ 是她！现在为你揭晓答案。');
            setTimeout(() => {
                showResult(highStatus);
            }, 1000);
            identityInput.value = '';
        } else {
            log('身份验证失败，进入访客模式');
            isGuest = true;
            showFeedback(fbIdentity, '👋 你不是她，但依然欢迎你——你是一位细心的访客。', true);
            setTimeout(() => {
                hideAllSteps();
                guestArea.classList.add('show');
                guestArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
                step = 99;
            }, 1500);
            identityInput.value = '';
        }
    });
    identityInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') identityBtn.click();
    });

    // =============================================================
    // 结果展示
    // =============================================================
    function showResult(highStatus) {
        stepIdentity.classList.remove('show');
        resultArea.classList.add('show');
        if (highStatus) {
            resultIcon.textContent = '💖';
            resultTitle.textContent = '🌸 解密成功 · 我的心意';
            resultBody.innerHTML = `
                        <p style="margin-bottom:12px;">亲爱的 <span class="special">${CONFIG.girlName}</span>，</p>
                        <p style="margin-bottom:12px;">其实，这个彩蛋是我为你准备的。<br />从你出现的那天起，我的世界就变得不一样了。</p>
                        <p style="margin-bottom:12px;">我喜欢你，不是一时兴起，<br />而是藏在每一个日升月落里的 <span class="special">温柔执念</span>。</p>
                        <p style="margin-bottom:6px; font-weight:700; color:#b5654b; font-size:18px;">💕 你愿意，让我成为你故事里的一部分吗？</p>
                        <p style="margin-top:14px; font-size:14px; opacity:0.6;">—— 一个用了很久才敢说出这句话的人</p>
                    `;
            triggerCelebration();
        } else {
            resultIcon.textContent = '🎂';
            resultTitle.textContent = '🎉 祝贺你解谜成功！';
            resultBody.innerHTML = `
                        <p style="margin-bottom:12px;">亲爱的 <span class="special">${CONFIG.girlName}</span>，</p>
                        <p style="margin-bottom:12px;">你成功破解了所有的谜题，真的很厉害！👏</p>
                        <p style="margin-bottom:12px;">今天是你的生日，我偷偷准备了这个彩蛋，<br />希望你能感受到一份 <span class="special">特别的惊喜</span>。</p>
                        <p style="margin-bottom:10px; font-size:22px; font-weight:600; color:#b5654b;">🥳 生日快乐！愿你永远快乐、自由、被爱。</p>
                        <p style="margin-top:14px; font-size:14px; opacity:0.6;">—— 永远支持你的朋友</p>
                    `;
        }
        resultArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // =============================================================
    // 庆祝特效
    // =============================================================
    function triggerCelebration() {
        const colors = ['#b5654b', '#d4a08c', '#e8c8b8', '#f0e0d8', '#c0a090'];
        for (let i = 0; i < 40; i++) {
            const el = document.createElement('div');
            el.style.cssText = `
                        position: fixed;
                        left: ${Math.random() * 100}%;
                        top: -10px;
                        width: ${6 + Math.random() * 12}px;
                        height: ${6 + Math.random() * 12}px;
                        background: ${colors[Math.floor(Math.random() * colors.length)]};
                        border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
                        pointer-events: none;
                        z-index: 999;
                        opacity: 0.7;
                        animation: confettiFall ${2 + Math.random() * 4}s linear forwards;
                        animation-delay: ${Math.random() * 1.2}s;
                    `;
            document.body.appendChild(el);
            setTimeout(() => el.remove(), 6000);
        }
        if (!document.getElementById('confettiStyle')) {
            const style = document.createElement('style');
            style.id = 'confettiStyle';
            style.textContent = `
                        @keyframes confettiFall {
                            0% { transform: translateY(-10vh) rotate(0deg); opacity: 0.8; }
                            100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
                        }
                    `;
            document.head.appendChild(style);
        }
    }

    // =============================================================
    // 初始化
    // =============================================================
    hideAllSteps();
    switchPage('page-science');

    console.log('%c📖 光影之间 · 随记', 'color: #b5654b; font-size: 18px; font-weight: bold;');
    console.log('%c🔍 秘密藏在日常的触碰与诗意的数字之间。', 'color: #8a7b70; font-size: 14px;');
    console.log('%c📚 理科次序：生命→变化→大地→信息→数理→物理（分散在文中）', 'color: #8a7b70; font-size: 14px;');
    console.log('%c✨ 星光指引：BEACON（藏在诗题旁）', 'color: #8a7b70; font-size: 14px;');
    console.log('%c📖 文科次序：先贤立言→仁心居中→而后有义举（分散在文中）', 'color: #8a7b70; font-size: 14px;');
    console.log('%c🔑 文心点击：钥匙→密语→心迹→答案（分散在文中）', 'color: #8a7b70; font-size: 14px;');
    console.log('%c🌑 影子的密语：十六进制 65 63 68 6f → echo', 'color: #8a7b70; font-size: 14px;');
    console.log('%c🔐 密语转译：Base64 三段 → open + love + truth → openlovetruth', 'color: #8a7b70; font-size: 14px;');
    console.log('%c🧾 心灵校验：2026 ÷ 7 ≈ 289.428，整数部分个位=9', 'color: #8a7b70; font-size: 14px;');
    console.log('%c💡 控制台可用函数：__EGG.trigger(次数), __EGG.hexDecode("65 63 68 6f")', 'color: #8a7b70; font-size: 14px;');

})();