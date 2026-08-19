// ============================================================
//  JavaScript 逻辑
// ============================================================

// ---------- DOM 引用 ----------
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const statusHint = document.getElementById('statusHint');
const transcriptEl = document.getElementById('transcript');
const wordCountEl = document.getElementById('wordCount');
const btnStart = document.getElementById('btnStart');
const btnStop = document.getElementById('btnStop');

// ---------- 配置 ----------
// ⚠️ 请替换成你自己的 Deepgram API Key
// 可以在 https://console.deepgram.com 免费获取
const DEEPGRAM_API_KEY = '063998309ee3b9ff33a6cb2ad09452f11052c07e';

// WebSocket 地址（使用 v1/listen 端点）
const WS_URL = `wss://api.deepgram.com/v1/listen?model=nova-3&language=zh&interim_results=true&punctuate=true`;

// ---------- 状态变量 ----------
let socket = null; // WebSocket 实例
let mediaRecorder = null; // MediaRecorder 实例
let stream = null; // 麦克风 MediaStream
let isRecording = false;
let finalTranscript = ''; // 累积的最终转录文本

// ---------- 辅助函数 ----------
function setStatus(state, hint = '') {
    // state: 'idle' | 'connecting' | 'connected' | 'error' | 'disconnected'
    statusDot.className = 'status-dot';
    if (state === 'connected') {
        statusDot.classList.add('connected');
        statusText.textContent = '已连接';
        statusHint.textContent = hint || '🎤 正在聆听…';
    } else if (state === 'error') {
        statusDot.classList.add('error');
        statusText.textContent = '错误';
        statusHint.textContent = hint || '⚠️ 请刷新重试';
    } else if (state === 'connecting') {
        statusText.textContent = '连接中…';
        statusHint.textContent = hint || '⏳ 正在建立连接';
    } else if (state === 'disconnected') {
        statusText.textContent = '已断开';
        statusHint.textContent = hint || '🔌 连接已关闭';
    } else {
        // idle
        statusText.textContent = '未连接';
        statusHint.textContent = hint || '⚡ 准备就绪';
    }
}

function updateTranscript(text, isInterim = false) {
    // 清除占位符
    if (transcriptEl.querySelector('.placeholder')) {
        transcriptEl.innerHTML = '';
    }

    if (isInterim) {
        // 临时结果：用特殊样式显示，但保留最终文本在前
        const finalText = finalTranscript ? `<span>${finalTranscript}</span>` : '';
        transcriptEl.innerHTML = `${finalText} <span class="interim">${text}</span>`;
    } else {
        // 最终结果：追加到累积文本
        if (text && !finalTranscript.includes(text)) {
            finalTranscript = finalTranscript ? finalTranscript + ' ' + text : text;
        }
        transcriptEl.innerHTML = `<span>${finalTranscript}</span>`;
    }

    // 更新字符数
    const displayText = transcriptEl.textContent || '';
    wordCountEl.textContent = `${displayText.length} 字符`;
}

function resetUI() {
    if (transcriptEl.querySelector('.placeholder')) return;
    transcriptEl.innerHTML = `<span class="placeholder">说话后，文字会出现在这里…</span>`;
    finalTranscript = '';
    wordCountEl.textContent = '0 字符';
}

// ---------- 核心：连接 Deepgram ----------
function connectDeepgram() {
    return new Promise((resolve, reject) => {
        try {
            socket = new WebSocket(WS_URL, ['token', DEEPGRAM_API_KEY]);
        } catch (err) {
            reject(new Error('无法创建 WebSocket: ' + err.message));
            return;
        }

        setStatus('connecting', '⏳ 正在连接 Deepgram…');

        socket.onopen = () => {
            setStatus('connected', '🎤 已连接，开始说话吧');
            resolve();
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                // Deepgram 返回的消息结构
                if (data.type === 'Results') {
                    const channel = data.channel;
                    if (channel && channel.alternatives && channel.alternatives.length > 0) {
                        const alt = channel.alternatives[0];
                        const transcript = alt.transcript || '';
                        // 判断是否为临时结果
                        const isFinal = data.is_final === true;
                        if (transcript) {
                            if (isFinal) {
                                // 最终结果：追加
                                updateTranscript(transcript, false);
                            } else {
                                // 临时结果：显示为草稿
                                updateTranscript(transcript, true);
                            }
                        }
                    }
                }
            } catch (err) {
                console.warn('解析消息失败:', err);
            }
        };

        socket.onerror = (err) => {
            console.error('WebSocket 错误:', err);
            setStatus('error', '❌ 连接出错，请检查 API Key');
            reject(new Error('WebSocket 错误'));
        };

        socket.onclose = (event) => {
            if (isRecording) {
                // 如果还在录音但连接断了，视为异常断开
                setStatus('error', '⚠️ 连接意外断开');
                stopRecording(true); // 静默停止
            } else {
                setStatus('disconnected', '🔌 连接已关闭');
            }
        };
    });
}

// ---------- 开始录音 ----------
async function startRecording() {
    if (isRecording) return;

    try {
        // 1. 获取麦克风权限
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
        setStatus('error', '❌ 无法访问麦克风: ' + err.message);
        return;
    }

    try {
        // 2. 连接 Deepgram
        await connectDeepgram();

        // 3. 创建 MediaRecorder，以 250ms 为间隔发送数据
        mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm;codecs=opus',
        });

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0 && socket && socket.readyState === WebSocket.OPEN) {
                socket.send(event.data);
            }
        };

        // 每 250ms 触发一次 dataavailable
        mediaRecorder.start(250);

        isRecording = true;
        btnStart.disabled = true;
        btnStop.disabled = false;
        resetUI(); // 清空之前的转录

        setStatus('connected', '🎤 正在聆听…');

    } catch (err) {
        setStatus('error', '❌ ' + err.message);
        // 清理资源
        if (stream) {
            stream.getTracks().forEach(t => t.stop());
            stream = null;
        }
        if (socket) {
            socket.close();
            socket = null;
        }
    }
}

// ---------- 停止录音 ----------
function stopRecording(silent = false) {
    if (!isRecording && !silent) return;

    isRecording = false;

    // 停止 MediaRecorder
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
    mediaRecorder = null;

    // 停止麦克风
    if (stream) {
        stream.getTracks().forEach(t => t.stop());
        stream = null;
    }

    // 关闭 WebSocket
    if (socket) {
        socket.close();
        socket = null;
    }

    btnStart.disabled = false;
    btnStop.disabled = true;

    if (!silent) {
        setStatus('disconnected', '⏹ 已停止录音');
    }
}

// ---------- 事件绑定 ----------
btnStart.addEventListener('click', startRecording);

btnStop.addEventListener('click', () => {
    stopRecording(false);
});

// 页面关闭时清理资源
window.addEventListener('beforeunload', () => {
    if (isRecording) {
        stopRecording(true);
    }
});

// 初始状态
setStatus('idle', '⚡ 点击「开始录音」');
btnStop.disabled = true;

// 检查 API Key 是否已配置
if (DEEPGRAM_API_KEY === 'YOUR_DEEPGRAM_API_KEY') {
    setStatus('error', '⚠️ 请先设置 Deepgram API Key');
    btnStart.disabled = true;
    statusHint.textContent = '请在代码中替换 DEEPGRAM_API_KEY';
}