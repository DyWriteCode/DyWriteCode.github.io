<template>
  <ChatDialog :options="chatOptions" :title="props.title" :roles="props.roles" @msg-click="handleMsgClick" />
</template>

<script setup>
import { ref, defineProps, onMounted } from 'vue'
import ChatDialog from '../../components/chat-dialog/index.vue'

const props = defineProps({
  src: String,
  title: String,
  roles: Object   // 角色配置
})

const chatOptions = ref()
onMounted(() => {
  $.getJSON(props.src, (options) => {
    chatOptions.value = options
  })
})

function handleMsgClick({ author, content, type }) {
  console.log(author, content, type)
}
</script>