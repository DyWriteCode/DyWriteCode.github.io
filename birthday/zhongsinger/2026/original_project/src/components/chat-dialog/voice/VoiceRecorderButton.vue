<template>
    <div class="voice-recorder-button" :class="{ active: isRecording || isProcessing }">
        <div class="recorder-btn" @mousedown="handlePointerDown" @mouseup="handlePointerUp"
            @mouseleave="handlePointerLeave" @touchstart="handleTouchStart" @touchend="handleTouchEnd"
            @touchcancel="handleTouchCancel" style="touch-action: none; cursor: pointer;">
            <span v-if="isProcessing">处理中...</span>
            <span v-else-if="!isRecording && !isPcClickMode">按住 说话</span>
            <span v-else-if="isRecording && isPcClickMode">点击 结束</span>
            <span v-else-if="isRecording && !isPcClickMode">松开 结束</span>
            <span v-else-if="!isRecording && isPcClickMode">按住 说话</span>
        </div>
    </div>
</template>

<script>
export default {
    name: 'VoiceRecorderButton',
    props: {
        disabled: Boolean,
        autoSend: {
            type: Boolean,
            default: true,
        },
        apiKey: {
            type: String,
            default: () => import.meta.env.VITE_DEEPGRAM_API_KEY || '',
        },
    },
    emits: ['start', 'stop', 'cancel', 'result', 'error', 'processing'],
    data() {
        return {
            isRecording: false,
            isPcClickMode: false,
            mediaRecorder: null,
            audioChunks: [],
            sessionText: '',
            recognitionEnded: false,
            isTouchDevice: false,
            stream: null,
            pendingBlob: null,
            pendingUrl: null,
            pendingText: '',
            isRecordingStarted: false,
            waitRecognitionTimer: null,
            touchStartTime: 0,
            isProcessing: false,
            _sending: false,
            _cancelled: false,

            socket: null,
            deepgramConnected: false,
            deepgramFinalText: '',
            deepgramInterimText: '',
            isDeepgramClosing: false,
            _processLock: false,
            _processed: false,

            _recordStartTime: 0,
            _recordDuration: 0,

            MIN_PACKET_SIZE: 1024,
        };
    },
    mounted() {
        this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        this.isPcClickMode = !this.isTouchDevice;
        console.log('[VoiceRecorderButton] mounted, isTouchDevice =', this.isTouchDevice);
    },
    methods: {
        // -------------------- Deepgram 连接 --------------------
        connectDeepgram() {
            return new Promise((resolve, reject) => {
                const apiKey = this.apiKey;
                if (!apiKey) {
                    reject(new Error('Deepgram API Key 未配置'));
                    return;
                }
                const WS_URL = `wss://api.deepgram.com/v1/listen?model=nova-3&language=zh-CN&interim_results=true&punctuate=true`;
                try {
                    this.socket = new WebSocket(WS_URL, ['token', apiKey]);
                } catch (err) {
                    reject(new Error('WebSocket 创建失败: ' + err.message));
                    return;
                }
                this.socket.onopen = () => {
                    console.log('[Deepgram] WebSocket 已连接');
                    this.deepgramConnected = true;
                    resolve();
                };
                this.socket.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        if (data.type === 'Results') {
                            const channel = data.channel;
                            if (channel && channel.alternatives && channel.alternatives.length > 0) {
                                const alt = channel.alternatives[0];
                                const transcript = alt.transcript || '';
                                const isFinal = data.is_final === true;
                                if (isFinal && transcript) {
                                    this.deepgramFinalText += (this.deepgramFinalText ? ' ' : '') + transcript;
                                    this.sessionText = this.deepgramFinalText;
                                    console.log('[Deepgram] 最终识别:', transcript);
                                } else if (transcript) {
                                    this.deepgramInterimText = transcript;
                                    this.sessionText = this.deepgramFinalText
                                        ? this.deepgramFinalText + ' ' + transcript
                                        : transcript;
                                    console.log('[Deepgram] 临时识别:', transcript);
                                }
                            }
                        }
                    } catch (err) {
                        console.warn('[Deepgram] 解析消息失败:', err);
                    }
                };
                this.socket.onerror = (err) => {
                    console.error('[Deepgram] WebSocket 错误:', err);
                    this.deepgramConnected = false;
                    reject(new Error('Deepgram 连接错误，请检查 API Key 和网络'));
                };
                this.socket.onclose = (event) => {
                    console.log('[Deepgram] WebSocket 已关闭', event.code, event.reason);
                    this.deepgramConnected = false;
                    if (!this.recognitionEnded) {
                        this.recognitionEnded = true;
                        if (this.waitRecognitionTimer) {
                            clearTimeout(this.waitRecognitionTimer);
                            this.waitRecognitionTimer = null;
                        }
                        if (!this.isRecording && !this.isRecordingStarted && !this._processLock) {
                            this.processStopResult();
                        }
                    }
                };
            });
        },

        sendAudioData(data) {
            if (data.byteLength < this.MIN_PACKET_SIZE) {
                console.log('[VoiceRecorderButton] 数据包过小，丢弃:', data.byteLength, 'bytes');
                return;
            }
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(data);
                console.log('[VoiceRecorderButton] 音频数据已发送, size:', data.byteLength);
            } else {
                console.warn('[Deepgram] 连接未就绪，丢弃音频数据');
            }
        },

        // -------------------- 录音控制（关键修改：先获取麦克风，再连 WebSocket）--------------------
        startRecording() {
            if (this.disabled || this.isRecording || this.isRecordingStarted) return;
            this._cancelled = false;
            this._processed = false;
            this.fullCleanup();

            this._recordStartTime = Date.now();

            // 1. 先获取麦克风流（同步，保证用户手势上下文）
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then((stream) => {
                    this.stream = stream;
                    // 2. 连接 Deepgram（异步，此时仍在用户手势后的微任务中，部分浏览器仍允许）
                    return this.connectDeepgram().then(() => stream);
                })
                .then((stream) => {
                    // 3. 创建 MediaRecorder
                    let mimeType = this.getSupportedMimeType();
                    try {
                        this.mediaRecorder = new MediaRecorder(stream, { mimeType: mimeType || undefined });
                    } catch (e) {
                        this.mediaRecorder = new MediaRecorder(stream);
                    }
                    console.log('[VoiceRecorderButton] MediaRecorder 使用 MIME:', this.mediaRecorder.mimeType);

                    this.mediaRecorder.ondataavailable = (e) => {
                        if (e.data.size > 0) {
                            this.audioChunks.push(e.data);
                            e.data.arrayBuffer().then((buffer) => {
                                this.sendAudioData(buffer);
                            }).catch((err) => {
                                console.warn('[VoiceRecorderButton] 转换音频数据失败', err);
                            });
                        }
                    };

                    this.mediaRecorder.onstop = () => {
                        console.log('[VoiceRecorderButton] MediaRecorder onstop 触发');
                        this._recordDuration = (Date.now() - this._recordStartTime) / 1000;
                        this.handleStop();
                    };

                    try {
                        this.mediaRecorder.start(500);
                    } catch (e) {
                        console.error('[VoiceRecorderButton] MediaRecorder.start 失败', e);
                        this.releaseStream();
                        this.$emit('error', new Error('无法启动录音，请检查麦克风权限或浏览器兼容性'));
                        return;
                    }

                    this.isRecording = true;
                    this.isRecordingStarted = true;
                    this.recognitionEnded = false;
                    this.deepgramFinalText = '';
                    this.deepgramInterimText = '';
                    this.sessionText = '';
                    this.$emit('start');
                })
                .catch((err) => {
                    console.error('[VoiceRecorderButton] 启动失败', err);
                    this.releaseStream();
                    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                        this.$emit('error', new Error('未获取到麦克风权限，请在浏览器设置中允许'));
                    } else if (err.message && err.message.includes('API Key')) {
                        this.$emit('error', err);
                    } else {
                        // 其他错误（如无设备）也提示用户
                        this.$emit('error', new Error('无法访问麦克风，请检查设备或权限'));
                    }
                    this.resetState();
                });
        },

        // 检测支持的 MIME 类型（移动端兼容）
        getSupportedMimeType() {
            const types = [
                'audio/webm;codecs=opus',
                'audio/webm',
                'audio/mp4',
                'audio/ogg;codecs=opus',
                'audio/ogg'
            ];
            for (let type of types) {
                if (MediaRecorder.isTypeSupported(type)) {
                    return type;
                }
            }
            return '';
        },

        stopRecordingManually() {
            if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                try {
                    this.mediaRecorder.stop();
                } catch (e) {
                    console.warn('[VoiceRecorderButton] stop 异常', e);
                    this.cleanupAfterStop();
                }
            } else {
                this.cleanupAfterStop();
            }
        },

        cleanupAfterStop() {
            if (this.mediaRecorder) {
                this.mediaRecorder.onstop = null;
            }
            this.releaseStream();
            this.resetState();
            this._sending = false;
            this.isProcessing = false;
        },

        handleStop() {
            console.log('[VoiceRecorderButton] handleStop');
            this.recognitionEnded = false;

            if (this.waitRecognitionTimer) clearTimeout(this.waitRecognitionTimer);
            this.waitRecognitionTimer = setTimeout(() => {
                console.log('[VoiceRecorderButton] 等待识别超时，强制处理');
                this.recognitionEnded = true;
                this.waitRecognitionTimer = null;
                if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                    try { this.socket.close(); } catch (_) { }
                }
                if (!this._processLock) {
                    this.processStopResult();
                }
            }, 5000);
        },

        processStopResult() {
            if (this._processLock || this._processed) {
                console.log('[VoiceRecorderButton] 结果已被处理，忽略');
                return;
            }
            this._processLock = true;
            this._processed = true;
            console.log('[VoiceRecorderButton] processStopResult');
            this.$emit('stop');

            if (this.audioChunks.length === 0) {
                console.log('[VoiceRecorderButton] 无音频数据，取消');
                this.clearPending();
                this.$emit('cancel');
                this.fullCleanup();
                this._sending = false;
                this.isProcessing = false;
                this._processLock = false;
                return;
            }

            const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
            const url = URL.createObjectURL(blob);
            const text = this.sessionText.trim() || '';
            const duration = Math.max(1, Math.round(this._recordDuration));

            console.log('[VoiceRecorderButton] 录音结束，识别文本:', text || '(空)', '时长:', duration, '秒');

            if (blob.size < 1024) {
                console.log('[VoiceRecorderButton] 录音太短，取消');
                this.clearPending();
                this.$emit('cancel');
                this.audioChunks = [];
                this.releaseStream();
                this.fullCleanup();
                this._sending = false;
                this.isProcessing = false;
                this._processLock = false;
                return;
            }

            if (this.autoSend) {
                this.$emit('result', { blob, url, text, duration });
                this.clearPending();
            } else {
                this.pendingBlob = blob;
                this.pendingUrl = url;
                this.pendingText = text;
                this.pendingDuration = duration;
            }

            this.audioChunks = [];
            this.releaseStream();
            this.fullCleanup();
            this._sending = false;
            this.isProcessing = false;
            this._processLock = false;
        },

        resetState() {
            this.isRecording = false;
            this.isRecordingStarted = false;
            this.recognitionEnded = false;
            if (this.waitRecognitionTimer) {
                clearTimeout(this.waitRecognitionTimer);
                this.waitRecognitionTimer = null;
            }
        },

        fullCleanup() {
            this.releaseStream();
            this.resetState();
            this.clearPending();
            this.audioChunks = [];
            this.isRecording = false;
            this.isRecordingStarted = false;
            this._sending = false;
            this.isProcessing = false;
            if (this.socket) {
                try { this.socket.close(); } catch (_) { }
                this.socket = null;
            }
            this.deepgramConnected = false;
            this.isDeepgramClosing = false;
            this._processLock = false;
            this._recordStartTime = 0;
            this._recordDuration = 0;
        },

        releaseStream() {
            if (this.stream) {
                this.stream.getTracks().forEach((track) => track.stop());
                this.stream = null;
                console.log('[VoiceRecorderButton] 释放媒体流');
            }
        },

        clearPending() {
            if (this.pendingUrl) {
                URL.revokeObjectURL(this.pendingUrl);
                this.pendingUrl = null;
            }
            this.pendingBlob = null;
            this.pendingText = '';
            this.pendingDuration = 0;
        },

        cancelRecording() {
            if (this._cancelled) return;
            this._cancelled = true;
            console.log('[VoiceRecorderButton] cancelRecording');
            if (this.socket) {
                try { this.socket.close(); } catch (_) { }
                this.socket = null;
            }
            if (this.mediaRecorder) {
                try {
                    if (this.mediaRecorder.state === 'recording') {
                        this.mediaRecorder.stop();
                    }
                } catch (_) { }
                this.mediaRecorder = null;
            }
            this.fullCleanup();
            this.$emit('cancel');
        },

        sendRecording() {
            console.log('[VoiceRecorderButton] sendRecording');
            if (this._sending || this.isProcessing) return;

            if (this.pendingBlob && this.pendingUrl !== null) {
                this.$emit('result', {
                    blob: this.pendingBlob,
                    url: this.pendingUrl,
                    text: this.pendingText,
                    duration: this.pendingDuration || 0,
                });
                this.clearPending();
                return;
            }

            if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                this._sending = true;
                this.isProcessing = true;
                this.$emit('processing');
                this.mediaRecorder.stop();
                return;
            }

            this.$emit('cancel');
        },

        // ----- 触摸事件 -----
        handleTouchStart(e) {
            e.preventDefault();
            if (this.disabled || this.isRecording || this.isRecordingStarted) return;
            this._cancelled = false;
            this.startRecording();
            this.touchStartTime = Date.now();
        },
        handleTouchEnd(e) {
            if (!this.isTouchDevice) return;
            if (!this.isRecording && !this.isRecordingStarted) return;
            this.stopRecordingManually();
        },
        handleTouchCancel(e) {
            console.log('[VoiceRecorderButton] touchcancel 被忽略');
        },

        // ----- 鼠标事件 -----
        handlePointerDown(e) {
            if (this.disabled || this.isTouchDevice) return;
            if (this.isRecording || this.isRecordingStarted) {
                this.stopRecordingManually();
            } else {
                this.startRecording();
            }
        },
        handlePointerUp(e) { },
        handlePointerLeave(e) { },
    },

    beforeUnmount() {
        console.log('[VoiceRecorderButton] beforeUnmount');
        if (this.socket) {
            try { this.socket.close(); } catch (_) { }
            this.socket = null;
        }
        if (this.mediaRecorder) {
            try {
                if (this.mediaRecorder.state === 'recording') {
                    this.mediaRecorder.stop();
                }
            } catch (_) { }
            this.mediaRecorder = null;
        }
        this.releaseStream();
        this.clearPending();
        if (this.waitRecognitionTimer) {
            clearTimeout(this.waitRecognitionTimer);
            this.waitRecognitionTimer = null;
        }
        this._sending = false;
        this.isProcessing = false;
        this._processLock = false;
        this._processed = false;
    },
};
</script>

<style scoped>
.voice-recorder-button {
    width: 100%;
    padding: 6px 0;
}

.recorder-btn {
    background: #e8e8e8;
    border-radius: 20px;
    padding: 4px 16px;
    text-align: center;
    font-size: 16px;
    color: #333;
    cursor: pointer;
    user-select: none;
    transition: background 0.2s;
    height: 32px;
    line-height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    touch-action: none;
}

.recorder-btn:active {
    background: #d0d0d0;
}

.recorder-btn.active {
    background: #22c3aa;
    color: white;
}
</style>