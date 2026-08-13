<template>
  <div class="voice-wrapper" ref="voiceRef" @click="togglePlay">
    <span class="voice-icon" v-if="!isPlaying">🔊</span>
    <span class="voice-wave" v-else>
      <span class="wave-bar"></span>
      <span class="wave-bar"></span>
      <span class="wave-bar"></span>
    </span>
    <span class="voice-duration">{{ displayDuration }}''</span>
    <audio ref="audio" :src="src" @loadedmetadata="onLoadedMetadata" @ended="onEnded" @error="onError"></audio>
  </div>
</template>

<script>
import { ref, computed, defineComponent, onMounted, onBeforeUnmount } from 'vue'

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
  setup(props, { emit }) {
    const id = `voice-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const voiceRef = ref(null)
    const audio = ref(null)
    const isPlaying = ref(false)
    const audioDuration = ref(0)

    const displayDuration = computed(() => {
      const dur = audioDuration.value || Number(props.duration) || 0
      return Math.round(dur)
    })

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

    const onLoadedMetadata = (e) => {
      const audioEl = e.target
      if (audioEl && audioEl.duration) {
        audioDuration.value = audioEl.duration
      }
    }

    const onEnded = () => {
      isPlaying.value = false
    }

    const onError = () => {
      isPlaying.value = false
    }

    onMounted(() => {
      if (window.__audioManager) {
        window.__audioManager.register(id, resetToInitial)
      }
    })

    onBeforeUnmount(() => {
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
      onEnded,
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