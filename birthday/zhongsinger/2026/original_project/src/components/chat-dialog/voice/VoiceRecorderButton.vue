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
    },
    emits: ['start', 'stop', 'cancel', 'result', 'error', 'processing'],
    data() {
        return {
            isRecording: false,
            isPcClickMode: false,
            mediaRecorder: null,
            audioChunks: [],
            currentRecognition: null,
            sessionText: '',
            lastInterimText: '',
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
            _recognitionSupported: true,
            _isRecognitionActive: false,
            _recognitionStarted: false,   // 标记识别是否已成功启动
        };
    },
    mounted() {
        this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        this.isPcClickMode = !this.isTouchDevice;
        console.log('[VoiceRecorderButton] mounted, isTouchDevice =', this.isTouchDevice);
    },
    methods: {
        createRecognition() {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                console.warn('[VoiceRecorderButton] SpeechRecognition not supported');
                this._recognitionSupported = false;
                return null;
            }
            const rec = new SpeechRecognition();
            rec.lang = 'zh-CN';
            rec.continuous = true;          // 连续识别，防止过早结束
            rec.interimResults = true;
            rec.maxAlternatives = 1;

            rec.onstart = () => {
                this._isRecognitionActive = true;
                this._recognitionStarted = true;
                this.sessionText = '';
                this.lastInterimText = '';
                console.log('[VoiceRecorderButton] 识别已激活');
            };

            rec.onresult = (event) => {
                let interim = '';
                let final = '';
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const result = event.results[i];
                    const transcript = result[0].transcript;
                    if (result.isFinal) {
                        final += transcript;
                    } else {
                        interim += transcript;
                    }
                }
                if (final) {
                    this.sessionText = final;
                    console.log('[VoiceRecorderButton] 识别最终文字:', final);
                }
                if (interim) {
                    this.lastInterimText = interim;
                    console.log('[VoiceRecorderButton] 识别临时文字:', interim);
                }
            };

            rec.onerror = (event) => {
                if (event.error === 'aborted') {
                    console.log('[VoiceRecorderButton] 识别被主动终止（符合预期）');
                    this._isRecognitionActive = false;
                    return;
                }
                console.warn('[VoiceRecorderButton] 识别错误', event.error);
                this._isRecognitionActive = false;
                if (event.error === 'not-allowed') {
                    this.$emit('error', event);
                }
            };

            rec.onend = () => {
                console.log('[VoiceRecorderButton] 识别结束');
                this._isRecognitionActive = false;
                this.recognitionEnded = true;
                // 如果没有最终结果，使用临时结果兜底
                if (!this.sessionText && this.lastInterimText) {
                    this.sessionText = this.lastInterimText;
                    console.log('[VoiceRecorderButton] 使用临时结果作为最终文字:', this.sessionText);
                }
            };

            this._recognitionSupported = true;
            return rec;
        },

        // 设置 MediaRecorder（单独抽离，便于启动时机控制）
        setupMediaRecorder(stream) {
            let mimeType = 'audio/webm';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = 'audio/ogg; codecs=opus';
                if (!MediaRecorder.isTypeSupported(mimeType)) {
                    mimeType = '';
                }
            }
            try {
                this.mediaRecorder = new MediaRecorder(stream, { mimeType: mimeType || undefined });
            } catch (e) {
                console.warn('[VoiceRecorderButton] MediaRecorder 构造降级', e);
                this.mediaRecorder = new MediaRecorder(stream);
            }

            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    this.audioChunks.push(e.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                console.log('[VoiceRecorderButton] MediaRecorder onstop 触发');
                this.handleStop();
            };
        },

        startRecording() {
            console.log('[VoiceRecorderButton] startRecording called, disabled=', this.disabled);
            if (this.disabled || this.isRecording || this.isRecordingStarted) {
                console.log('[VoiceRecorderButton] 被阻止');
                return;
            }

            this._cancelled = false;
            this.fullCleanup();

            navigator.mediaDevices
                .getUserMedia({ audio: true })
                .then((stream) => {
                    console.log('[VoiceRecorderButton] getUserMedia 成功');
                    this.stream = stream;

                    // ---- 先启动 SpeechRecognition ----
                    const rec = this.createRecognition();
                    this.currentRecognition = rec;
                    if (rec) {
                        // 保存原始 onstart，以便在识别启动后启动 MediaRecorder
                        const originalOnStart = rec.onstart;
                        rec.onstart = (event) => {
                            if (originalOnStart) originalOnStart.call(rec, event);
                            // 识别已激活，此时启动 MediaRecorder
                            if (!this.mediaRecorder) {
                                this.setupMediaRecorder(this.stream);
                                try {
                                    this.mediaRecorder.start();
                                    console.log('[VoiceRecorderButton] MediaRecorder 启动成功（识别激活后）');
                                    this.isRecording = true;
                                    this.isRecordingStarted = true;
                                    this.$emit('start');
                                } catch (err) {
                                    console.error('[VoiceRecorderButton] MediaRecorder 启动失败', err);
                                    this.releaseStream();
                                    this.resetState();
                                    this.$emit('error', err);
                                }
                            }
                        };

                        try {
                            rec.start();
                            console.log('[VoiceRecorderButton] SpeechRecognition 启动指令已发送');
                        } catch (e) {
                            console.warn('[VoiceRecorderButton] SpeechRecognition start 异常', e);
                            this.currentRecognition = null;
                            this._isRecognitionActive = false;
                            this._recognitionSupported = false;
                            // 识别启动失败，直接启动 MediaRecorder 作为后备
                            if (!this.mediaRecorder) {
                                this.setupMediaRecorder(this.stream);
                                try {
                                    this.mediaRecorder.start();
                                    this.isRecording = true;
                                    this.isRecordingStarted = true;
                                    this.$emit('start');
                                } catch (err) {
                                    this.releaseStream();
                                    this.resetState();
                                    this.$emit('error', err);
                                }
                            }
                        }
                    } else {
                        // 不支持识别，直接启动 MediaRecorder
                        this.setupMediaRecorder(this.stream);
                        try {
                            this.mediaRecorder.start();
                            this.isRecording = true;
                            this.isRecordingStarted = true;
                            this.$emit('start');
                        } catch (err) {
                            this.releaseStream();
                            this.resetState();
                            this.$emit('error', err);
                        }
                        this.recognitionEnded = true;
                        this._recognitionSupported = false;
                    }

                    // 防止识别启动失败但 MediaRecorder 已启动时，仍需有超时保护
                    // 如果 3 秒后识别仍未激活，强制启动 MediaRecorder（但上面已经启动，所以这里不重复）
                })
                .catch((err) => {
                    console.error('[VoiceRecorderButton] getUserMedia 失败', err);
                    this.releaseStream();
                    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                        this.$emit('error', err);
                    } else {
                        this.resetState();
                    }
                });
        },

        stopRecordingManually() {
            console.log('[VoiceRecorderButton] stopRecordingManually');
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
            console.log('[VoiceRecorderButton] cleanupAfterStop');
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

            // 如果识别仍活跃，调用 stop() 让它结束并生成最终结果
            if (this.currentRecognition && this._isRecognitionActive) {
                try {
                    this.currentRecognition.stop();
                    console.log('[VoiceRecorderButton] 已调用 recognition.stop()');
                } catch (e) {
                    console.warn('[VoiceRecorderButton] stop 调用异常', e);
                }
            } else {
                console.log('[VoiceRecorderButton] 识别已非活跃，跳过 stop 调用');
                this.recognitionEnded = true;
            }

            // 等待识别结束或超时
            const waitForEnd = () => {
                return new Promise((resolve) => {
                    if (this.recognitionEnded) {
                        resolve();
                        return;
                    }
                    this.waitRecognitionTimer = setTimeout(() => {
                        console.log('[VoiceRecorderButton] 等待识别超时，强行继续');
                        resolve();
                    }, 2000);
                    if (this.currentRecognition) {
                        const originalOnEnd = this.currentRecognition.onend;
                        this.currentRecognition.onend = () => {
                            clearTimeout(this.waitRecognitionTimer);
                            this.waitRecognitionTimer = null;
                            if (originalOnEnd) originalOnEnd.call(this.currentRecognition);
                            resolve();
                        };
                    }
                });
            };

            waitForEnd().then(() => {
                this.processStopResult();
            });
        },

        processStopResult() {
            console.log('[VoiceRecorderButton] processStopResult');
            this.$emit('stop');

            if (this.audioChunks.length === 0) {
                console.log('[VoiceRecorderButton] 无音频数据，取消');
                this.clearPending();
                this.$emit('cancel');
                this.fullCleanup();
                this._sending = false;
                this.isProcessing = false;
                return;
            }

            const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
            const url = URL.createObjectURL(blob);
            const text = this.sessionText.trim() || '';
            console.log('[VoiceRecorderButton] 录音结束，识别文本:', text || '(空)');

            if (blob.size < 1024) {
                console.log('[VoiceRecorderButton] 录音太短，取消');
                this.clearPending();
                this.$emit('cancel');
                this.audioChunks = [];
                this.releaseStream();
                this.fullCleanup();
                this._sending = false;
                this.isProcessing = false;
                return;
            }

            if (this.autoSend) {
                this.$emit('result', { blob, url, text });
                this.clearPending();
            } else {
                this.pendingBlob = blob;
                this.pendingUrl = url;
                this.pendingText = text;
            }

            this.audioChunks = [];
            this.releaseStream();
            this.fullCleanup();
            this._sending = false;
            this.isProcessing = false;
        },

        resetState() {
            console.log('[VoiceRecorderButton] resetState');
            this.isRecording = false;
            this.isRecordingStarted = false;
            this._isRecognitionActive = false;
            this._recognitionStarted = false;
            if (this.currentRecognition) {
                try {
                    this.currentRecognition.abort();
                } catch (_) { }
                this.currentRecognition = null;
            }
            this.sessionText = '';
            this.lastInterimText = '';
            this.recognitionEnded = false;
            clearTimeout(this.waitRecognitionTimer);
            this.waitRecognitionTimer = null;
        },

        fullCleanup() {
            console.log('[VoiceRecorderButton] fullCleanup');
            this.releaseStream();
            this.resetState();
            this.clearPending();
            this.audioChunks = [];
            this.isRecording = false;
            this.isRecordingStarted = false;
            this._sending = false;
            this.isProcessing = false;
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
        },

        cancelRecording() {
            if (this._cancelled) {
                console.log('[VoiceRecorderButton] 重复取消，忽略');
                return;
            }
            this._cancelled = true;
            console.log('[VoiceRecorderButton] cancelRecording 被调用');

            if (this.currentRecognition && this._isRecognitionActive) {
                try {
                    this.currentRecognition.abort();
                } catch (_) { }
            } else {
                console.log('[VoiceRecorderButton] 识别已非活跃，跳过 abort');
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
            console.log('[VoiceRecorderButton] handleTouchStart, disabled=', this.disabled);
            e.preventDefault();
            if (this.disabled || this.isRecording || this.isRecordingStarted) {
                console.log('[VoiceRecorderButton] touch 被阻止');
                return;
            }
            this._cancelled = false;
            this.startRecording();
            this.touchStartTime = Date.now();
        },

        handleTouchEnd(e) {
            console.log('[VoiceRecorderButton] handleTouchEnd');
            if (!this.isTouchDevice) return;
            const duration = Date.now() - (this.touchStartTime || 0);
            console.log('[VoiceRecorderButton] 触摸时长(ms):', duration);

            if (!this.isRecording && !this.isRecordingStarted) {
                console.log('[VoiceRecorderButton] 录音未开始，忽略触摸结束');
                return;
            }
            this.stopRecordingManually();
        },

        handleTouchCancel(e) {
            console.log('[VoiceRecorderButton] handleTouchCancel, ignore');
        },

        // ----- 鼠标事件 -----
        handlePointerDown(e) {
            console.log('[VoiceRecorderButton] handlePointerDown');
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
        if (this.currentRecognition && this._isRecognitionActive) {
            try {
                this.currentRecognition.abort();
            } catch (_) { }
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
        clearTimeout(this.waitRecognitionTimer);
        this._sending = false;
        this.isProcessing = false;
        this._isRecognitionActive = false;
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