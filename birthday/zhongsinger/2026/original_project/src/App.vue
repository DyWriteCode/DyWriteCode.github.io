<template>
  <MobileDialog :src="src" :title="title" :roles="roles" />
</template>

<script setup>
import MobileDialog from './pages/mobile-dialog/index.vue'
import { ref, onMounted } from 'vue'

document.title = import.meta.env.VITE_APP_TITLE
const src = import.meta.env.VITE_CHAT_OPTIONS_PATH
const title = import.meta.env.VITE_APP_TITLE
const roles = ref(null)

onMounted(async () => {
  // 优先使用环境变量指定的角色文件
  let rolesSrc = import.meta.env.VITE_ROLES_PATH
  if (!rolesSrc) {
    // 默认：与 chat.json 同目录下的 roles.json
    rolesSrc = src.replace(/chat\.json$/, 'roles.json')
  }

  try {
    const res = await fetch(rolesSrc)
    if (res.ok) {
      roles.value = await res.json()
      console.log('角色配置加载成功', roles.value)
      return
    }
  } catch (e) {
    console.warn('加载 roles.json 失败，尝试回退到 avatars.json', e)
  }

  // 回退：加载 avatars.json（兼容旧版）
  const avatarSrc = src.replace(/chat\.json$/, 'avatars.json')
  try {
    const res = await fetch(avatarSrc)
    if (res.ok) {
      const avatars = await res.json()
      // 转换为 roles 格式（昵称使用 key）
      roles.value = Object.fromEntries(
        Object.entries(avatars).map(([key, url]) => [
          key,
          { name: key, avatar: url }
        ])
      )
      console.log('从 avatars.json 转换角色配置', roles.value)
    } else {
      console.warn('未找到任何角色配置，将使用默认显示')
      roles.value = {}
    }
  } catch (e) {
    console.warn('加载 avatars.json 失败', e)
    roles.value = {}
  }
})
</script>
