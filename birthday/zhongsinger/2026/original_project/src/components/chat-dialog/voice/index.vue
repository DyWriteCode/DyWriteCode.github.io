<template>
  <div class="voice-wrapper" ref="voiceRef" @click="togglePlay">
    <span class="voice-icon" v-if="!isPlaying">🔊</span>
    <span class="voice-wave" v-else>
      <span class="wave-bar"></span>
      <span class="wave-bar"></span>
      <span class="wave-bar"></span>
    </span>
    <span class="voice-duration">{{ displayDuration }}''</span>
    <audio ref="audio" :src="src" preload="metadata" @loadedmetadata="onLoadedMetadata" @error="onError"></audio>
  </div>
</template>

<script>
import { ref, computed, defineComponent, onMounted, onBeforeUnmount, watch } from 'vue'

export default defineComponent({
  name: 'Voice',
  props: {
    src: {
      type: String,
      required: true
    },
    alt: {
      type: String,
      default: ''
    },
    duration: {
      type: [Number, String],
      default: 0
    },
    transcripted: {
      type: Boolean,
      default: false
    }
  },
  emits: ['convert', 'cancel-convert'],
  setup(props) {
    const id = `voice-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const voiceRef = ref(null)
    const audio = ref(null)
    const isPlaying = ref(false)
    const audioDuration = ref(0)
    let pollTimer = null
    let retryCount = 0
    const MAX_RETRIES = 15

    const displayDuration = computed(() => {
      let dur = audioDuration.value
      // 如果 audioDuration 无效（包括 Infinity），则使用 props.duration
      if (!isFinite(dur) || dur <= 0) {
        dur = Number(props.duration) || 0
      }
      if (!isFinite(dur) || dur < 0) dur = 0
      return Math.round(dur)
    })

    const tryGetDuration = () => {
      const audioEl = audio.value
      if (!audioEl) return false
      if (audioEl.readyState >= 1 && audioEl.duration && isFinite(audioEl.duration) && audioEl.duration > 0) {
        audioDuration.value = audioEl.duration
        return true
      }
      return false
    }

    const startPolling = () => {
      // 如果 props.duration 已经有效，就不需要轮询了
      const propDur = Number(props.duration)
      if (propDur > 0) {
        audioDuration.value = propDur
        return
      }

      if (pollTimer) clearInterval(pollTimer)
      retryCount = 0
      pollTimer = setInterval(() => {
        if (tryGetDuration()) {
          clearInterval(pollTimer)
          pollTimer = null
          return
        }
        retryCount++
        if (retryCount >= MAX_RETRIES) {
          clearInterval(pollTimer)
          pollTimer = null
          // 如果最终仍无法获取，且没有传入 duration，则置0
          if (!Number(props.duration)) {
            audioDuration.value = 0
          }
          console.warn('[Voice] 获取音频时长超时，src:', props.src)
        }
      }, 300)
    }

    const onLoadedMetadata = (e) => {
      const audioEl = e.target
      if (audioEl && audioEl.duration && isFinite(audioEl.duration) && audioEl.duration > 0) {
        audioDuration.value = audioEl.duration
        if (pollTimer) {
          clearInterval(pollTimer)
          pollTimer = null
        }
      }
    }

    const onError = () => {
      isPlaying.value = false
      tryGetDuration()
    }

    const resetToInitial = () => {
      isPlaying.value = false
      const audioEl = audio.value
      if (audioEl) {
        audioEl.currentTime = 0
        audioEl.pause()
      }
    }

    const togglePlay = () => {
      const audioEl = audio.value
      if (!audioEl) return

      if (!isPlaying.value) {
        if (window.__audioManager) {
          window.__audioManager.play(id, audioEl)
        }
        audioEl.play().catch(() => {
          isPlaying.value = false
        })
        isPlaying.value = true
      } else {
        audioEl.pause()
        isPlaying.value = false
      }
    }

    const loadAudio = () => {
      const audioEl = audio.value
      if (!audioEl) return
      audioDuration.value = 0
      audioEl.load()
      // 如果传入 duration，直接使用，不轮询
      if (Number(props.duration) > 0) {
        audioDuration.value = Number(props.duration)
        return
      }
      if (tryGetDuration()) return
      startPolling()
    }

    watch(() => props.src, () => {
      loadAudio()
    }, { immediate: false })

    onMounted(() => {
      if (window.__audioManager) {
        window.__audioManager.register(id, resetToInitial)
      }
      loadAudio()
    })

    onBeforeUnmount(() => {
      if (pollTimer) {
        clearInterval(pollTimer)
        pollTimer = null
      }
      const audioEl = audio.value
      if (audioEl) {
        audioEl.pause()
        audioEl.src = ''
      }
      if (window.__audioManager) {
        window.__audioManager.unregister(id)
      }
    })

    return {
      voiceRef,
      audio,
      isPlaying,
      audioDuration,
      displayDuration,
      togglePlay,
      onLoadedMetadata,
      onError
    }
  }
})
</script>

<style scoped>
.voice-wrapper {
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 4px 0;
  user-select: none;
  min-width: 80px;
  white-space: nowrap;
  position: relative;
}

.voice-icon {
  font-size: 20px;
  margin-right: 8px;
}

.voice-wave {
  display: flex;
  align-items: center;
  height: 20px;
  margin-right: 8px;
  gap: 3px;
}

.wave-bar {
  display: block;
  width: 4px;
  background: #22c3aa;
  border-radius: 2px;
  animation: wave-bounce 0.8s ease-in-out infinite alternate;
}

.wave-bar:nth-child(1) {
  height: 12px;
  animation-delay: 0s;
}

.wave-bar:nth-child(2) {
  height: 20px;
  animation-delay: 0.2s;
}

.wave-bar:nth-child(3) {
  height: 12px;
  animation-delay: 0.4s;
}

@keyframes wave-bounce {
  0% {
    transform: scaleY(0.4);
  }

  100% {
    transform: scaleY(1);
  }
}

.voice-duration {
  font-size: 14px;
}
</style>