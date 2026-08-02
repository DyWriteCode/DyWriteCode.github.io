<template>
  <MobileDialog :src="src" :title="title" :avatars="avatars" />
</template>

<script setup>
import MobileDialog from './pages/mobile-dialog/index.vue'
import { ref, onMounted } from 'vue'
document.title = import.meta.env.VITE_APP_TITLE
const src = import.meta.env.VITE_CHAT_OPTIONS_PATH
const title = import.meta.env.VITE_APP_TITLE
const avatars = ref(null)

onMounted(async () => {
  // 优先使用环境变量指定的头像路径，否则自动推导
  let avatarsSrc = import.meta.env.VITE_AVATARS_PATH
  if (!avatarsSrc) {
    avatarsSrc = src.replace(/chat\.json$/, 'avatars.json')
  }
  try {
    const res = await fetch(avatarsSrc)
    if (res.ok) {
      avatars.value = await res.json()
    } else {
      console.warn('avatars.json not found, avatars will be hidden.')
    }
  } catch (e) {
    console.warn('Failed to load avatars:', e)
  }
})
</script>
