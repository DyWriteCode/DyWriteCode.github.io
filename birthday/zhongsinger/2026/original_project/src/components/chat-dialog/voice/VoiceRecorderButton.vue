<template>
    <div class="voice-recorder-button" :class="{ active: isRecording || isProcessing }">
        <div class="recorder-btn" @mousedown="handlePointerDown" @mouseup="handlePointerUp"
            @mouseleave="handlePointerLeave" @touchstart="handleTouchStart" @touchend="handleTouchEnd"
            @touchcancel="handleTouchCancel">
            <span v-if="isProcessing">处理中...</span>
            <span v-else-if="!isRecording && !isPcClickMode">按住  说话</span>
            <span v-else-if="isRecording && isPcClickMode">点击  结束</span>
            <span v-else-if="isRecording && !isPcClickMode">松开  结束</span>
            <span v-else-if="!isRecording && isPcClickMode">按住  说话</span>
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
            default: true
        }
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
            recognitionEnded: false,
            holdTimer: null,
            isTouchDevice: false,
            stream: null,
            pendingBlob: null,
            pendingUrl: null,
            pendingText: '',
            isStoppedManually: false,
            isRecordingStarted: false,
            waitRecognitionTimer: null,
            touchStartTime: 0,
            isProcessing: false,
            _sending: false,
        }
    },
    mounted() {
        this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
        this.isPcClickMode = !this.isTouchDevice
    },
    methods: {
        createRecognition() {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
            if (!SpeechRecognition) {
                this.$emit('error', new Error('浏览器不支持语音识别'))
                return null
            }
            const rec = new SpeechRecognition()
            rec.lang = 'zh-CN'
            rec.continuous = true
            rec.interimResults = true

            rec.onresult = (event) => {
                let interim = ''
                let final = ''
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const result = event.results[i]
                    const transcript = result[0].transcript
                    if (result.isFinal) {
                        final += transcript
                    } else {
                        interim += transcript
                    }
                }
                if (final) {
                    this.sessionText = final
                } else if (interim) {
                    this.sessionText = interim
                }
            }

            rec.onerror = (event) => {
                console.warn('识别错误', event.error)
                if (event.error === 'not-allowed') {
                    this.$emit('error', event)
                } else {
                    try { rec.stop() } catch (e) { }
                    this.$emit('cancel')
                    this.resetState()
                    this._sending = false
                    this.isProcessing = false
                }
            }

            rec.onend = () => {
                this.recognitionEnded = true
            }

            return rec
        },

        startRecording() {
            if (this.disabled) return

            if (this.currentRecognition) {
                try { this.currentRecognition.abort() } catch (e) { }
                this.currentRecognition = null
            }

            this.sessionText = ''
            this.recognitionEnded = false
            this.audioChunks = []
            this.pendingBlob = null
            this.pendingUrl = null
            this.pendingText = ''
            this.isStoppedManually = false
            this.isRecordingStarted = false
            this.isProcessing = false
            this._sending = false

            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(stream => {
                    this.stream = stream

                    const rec = this.createRecognition()
                    if (!rec) {
                        this.releaseStream()
                        return
                    }
                    this.currentRecognition = rec
                    try {
                        rec.start()
                    } catch (e) { /* ignore */ }

                    this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
                    this.mediaRecorder.ondataavailable = (e) => {
                        if (e.data.size > 0) {
                            this.audioChunks.push(e.data)
                        }
                    }
                    this.mediaRecorder.onstop = () => {
                        this.handleStop()
                    }
                    this.mediaRecorder.start()
                    this.isRecording = true
                    this.isRecordingStarted = true
                    this.$emit('start')
                })
                .catch(err => {
                    console.error('麦克风获取失败', err)
                    this.$emit('error', err)
                    this.isRecording = false
                })
        },

        handleStop() {
            if (this.currentRecognition) {
                try {
                    this.currentRecognition.stop()
                } catch (e) { }
            }

            const waitForEnd = () => {
                return new Promise((resolve) => {
                    if (this.recognitionEnded) {
                        resolve()
                        return
                    }
                    this.waitRecognitionTimer = setTimeout(() => {
                        resolve()
                    }, 2000)
                    if (this.currentRecognition) {
                        const originalOnEnd = this.currentRecognition.onend
                        this.currentRecognition.onend = () => {
                            clearTimeout(this.waitRecognitionTimer)
                            this.waitRecognitionTimer = null
                            if (originalOnEnd) originalOnEnd.call(this.currentRecognition)
                            resolve()
                        }
                    }
                })
            }

            waitForEnd().then(() => {
                this.processStopResult()
            })
        },

        processStopResult() {
            // 先发出 stop 事件，让父组件停止计时器
            this.$emit('stop')

            if (this.audioChunks.length === 0) {
                this.clearPending()
                this.$emit('cancel')
                this.resetState()
                this._sending = false
                this.isProcessing = false
                return
            }

            const blob = new Blob(this.audioChunks, { type: 'audio/webm' })
            const url = URL.createObjectURL(blob)
            const text = this.sessionText.trim() || ''

            if (!text) {
                this.clearPending()
                this.$emit('cancel')
                this.audioChunks = []
                this.releaseStream()
                this.resetState()
                this._sending = false
                this.isProcessing = false
                return
            }

            if (this.autoSend) {
                this.$emit('result', { blob, url, text })
                this.clearPending()
            } else {
                this.pendingBlob = blob
                this.pendingUrl = url
                this.pendingText = text
            }

            this.audioChunks = []
            this.releaseStream()
            this.resetState()
            this._sending = false
            this.isProcessing = false
        },

        resetState() {
            this.isRecording = false
            this.isRecordingStarted = false
            if (this.currentRecognition) {
                try { this.currentRecognition.abort() } catch (e) { }
                this.currentRecognition = null
            }
            this.sessionText = ''
            this.recognitionEnded = false
            clearTimeout(this.waitRecognitionTimer)
            this.waitRecognitionTimer = null
        },

        cancelRecording() {
            if (this.currentRecognition) {
                try { this.currentRecognition.abort() } catch (e) { }
                this.currentRecognition = null
            }
            if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                this.mediaRecorder.onstop = null
                this.mediaRecorder.stop()
            }
            this.releaseStream()
            this.audioChunks = []
            this.clearPending()
            this.$emit('cancel')
            this.resetState()
            this._sending = false
            this.isProcessing = false
        },

        releaseStream() {
            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop())
                this.stream = null
            }
        },

        clearPending() {
            if (this.pendingUrl) {
                URL.revokeObjectURL(this.pendingUrl)
                this.pendingUrl = null
            }
            this.pendingBlob = null
            this.pendingText = ''
        },

        sendRecording() {
            if (this._sending || this.isProcessing) return

            if (this.pendingBlob && this.pendingUrl !== null) {
                this.$emit('result', {
                    blob: this.pendingBlob,
                    url: this.pendingUrl,
                    text: this.pendingText
                })
                this.clearPending()
                return
            }

            if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                this._sending = true
                this.isProcessing = true
                this.$emit('processing')
                this.mediaRecorder.stop()
                return
            }

            this.$emit('cancel')
        },

        // 触摸/鼠标事件
        handleTouchStart(e) {
            if (this.disabled) return
            if (!this.isTouchDevice) return
            this.startRecording()
            this.touchStartTime = Date.now()
        },

        handleTouchEnd(e) {
            if (!this.isTouchDevice) return
            const duration = Date.now() - (this.touchStartTime || 0)
            if (duration < 300) {
                this.cancelRecording()
                return
            }
            if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                this.mediaRecorder.stop()
            }
        },

        handleTouchCancel(e) {
            if (!this.isTouchDevice) return
            this.cancelRecording()
        },

        handlePointerDown(e) {
            if (this.disabled) return
            if (this.isTouchDevice) return
            if (!this.isRecording && !this.isRecordingStarted) {
                this.startRecording()
            } else {
                if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                    this.mediaRecorder.stop()
                }
            }
        },

        handlePointerUp(e) { },
        handlePointerLeave(e) { },
    },
    beforeUnmount() {
        if (this.currentRecognition) {
            try { this.currentRecognition.abort() } catch (e) { }
            this.currentRecognition = null
        }
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop()
        }
        this.releaseStream()
        this.clearPending()
        clearTimeout(this.waitRecognitionTimer)
        this._sending = false
        this.isProcessing = false
    }
}
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
}

.recorder-btn:active {
    background: #d0d0d0;
}

.recorder-btn.active {
    background: #22c3aa;
    color: white;
}
</style>