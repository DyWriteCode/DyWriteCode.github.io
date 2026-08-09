<template>
  <div class="voice-wrapper" ref="voiceRef" @click="togglePlay" @contextmenu.prevent="handleContextMenu"
    @touchstart="onTouchStart" @touchend="onTouchEnd">
    <!-- 声波动画 / 静态喇叭 -->
    <span class="voice-icon" v-if="!isPlaying">🔊</span>
    <span class="voice-wave" v-else>
      <span class="wave-bar"></span>
      <span class="wave-bar"></span>
      <span class="wave-bar"></span>
    </span>
    <span class="voice-duration">{{ displayDuration }}''</span>
    <audio ref="audio" :src="src" @loadedmetadata="onLoadedMetadata" @ended="onEnded"></audio>

    <!-- 使用 Teleport 将菜单传送到 body -->
    <Teleport to="body">
      <div v-show="showMenu" class="custom-voice-menu" :style="menuStyle" ref="menuRef">
        <!-- 互斥的菜单项 -->
        <div v-if="!transcripted" class="menu-item" @click="handleSelect('transcript')">
          <var-icon name="translate" class="menu-icon" />
          <span>转文字</span>
        </div>
        <div v-else class="menu-item" @click="handleSelect('cancel')">
          <var-icon name="translate" class="menu-icon" />
          <span>取消转文字</span>
        </div>
      </div>
    </Teleport>
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
    const voiceRef = ref(null)
    const menuRef = ref(null)
    const audio = ref(null)
    const isPlaying = ref(false)
    const audioDuration = ref(0)
    const touchTimer = ref(null)

    const showMenu = ref(false)
    const menuStyle = ref({
      position: 'fixed',
      left: '0px',
      top: '0px',
      zIndex: 99999,
      minWidth: '130px',
      background: 'rgba(255, 255, 255, 0.96)',
      borderRadius: '10px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      padding: '6px 0',
      backdropFilter: 'blur(4px)'
    })

    const displayDuration = computed(() => {
      const dur = audioDuration.value || Number(props.duration) || 0
      return Math.round(dur)
    })

    // ---------- 播放控制 ----------
    const togglePlay = () => {
      const audioEl = audio.value
      if (!audioEl) return
      if (isPlaying.value) {
        audioEl.pause()
      } else {
        audioEl.play().catch(() => { })
      }
      isPlaying.value = !isPlaying.value
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

    // ---------- 菜单控制（基于元素固定位置） ----------
    const openMenu = (clientX, clientY) => {
      const rect = voiceRef.value?.getBoundingClientRect()
      let left, top

      if (rect) {
        left = rect.left
        top = rect.bottom + 8

        const menuWidth = 130
        const menuHeight = 80
        const winWidth = window.innerWidth
        const winHeight = window.innerHeight

        if (left + menuWidth > winWidth - 10) {
          left = winWidth - menuWidth - 10
        }
        if (left < 10) left = 10
        if (top + menuHeight > winHeight - 10) {
          top = rect.top - menuHeight - 8
        }
        if (top < 10) top = 10
      } else {
        if (clientX !== undefined && clientY !== undefined) {
          left = clientX
          top = clientY + 8
        } else {
          left = window.innerWidth / 2 - 65
          top = window.innerHeight / 2 - 40
        }
        left = Math.min(Math.max(left, 10), window.innerWidth - 140)
        top = Math.min(Math.max(top, 10), window.innerHeight - 90)
      }

      menuStyle.value = {
        ...menuStyle.value,
        left: left + 'px',
        top: top + 'px'
      }

      showMenu.value = true
    }

    const closeMenu = () => {
      showMenu.value = false
    }

    const handleSelect = (key) => {
      if (key === 'transcript') {
        emit('convert', props.alt)
      } else if (key === 'cancel') {
        emit('cancel-convert')
      }
      closeMenu()
    }

    // ---------- 事件绑定 ----------
    const handleContextMenu = (e) => {
      e.preventDefault()
      openMenu(e.clientX, e.clientY)
    }

    const onTouchStart = (e) => {
      touchTimer.value = setTimeout(() => {
        const touch = e.touches[0]
        openMenu(touch.clientX, touch.clientY)
        touchTimer.value = null
      }, 600)
    }

    const onTouchEnd = () => {
      if (touchTimer.value) {
        clearTimeout(touchTimer.value)
        touchTimer.value = null
      }
    }

    // ---------- 点击外部关闭菜单 ----------
    const handleClickOutside = (e) => {
      if (!showMenu.value) return
      const target = e.target
      const isInVoice = voiceRef.value?.contains(target)
      const isInMenu = menuRef.value?.contains(target)
      if (!isInVoice && !isInMenu) {
        closeMenu()
      }
    }

    onMounted(() => {
      document.addEventListener('click', handleClickOutside)
    })

    onBeforeUnmount(() => {
      if (touchTimer.value) {
        clearTimeout(touchTimer.value)
        touchTimer.value = null
      }
      const audioEl = audio.value
      if (audioEl) {
        audioEl.pause()
        audioEl.src = ''
      }
      document.removeEventListener('click', handleClickOutside)
    })

    return {
      voiceRef,
      menuRef,
      audio,
      isPlaying,
      audioDuration,
      displayDuration,
      showMenu,
      menuStyle,
      togglePlay,
      onLoadedMetadata,
      onEnded,
      handleContextMenu,
      onTouchStart,
      onTouchEnd,
      handleSelect,
      openMenu,
      closeMenu
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

<!-- 全局样式（Teleport 内容需全局） -->
<style>
.custom-voice-menu {
  position: fixed;
  background: rgba(255, 255, 255, 0.96);
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  padding: 6px 0;
  min-width: 130px;
  backdrop-filter: blur(4px);
  z-index: 99999;
}

.custom-voice-menu .menu-item {
  padding: 10px 18px;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: #333;
  transition: background 0.15s;
}

.custom-voice-menu .menu-item:hover {
  background: #f0f0f0;
}

.custom-voice-menu .menu-icon {
  font-size: 18px;
}
</style>