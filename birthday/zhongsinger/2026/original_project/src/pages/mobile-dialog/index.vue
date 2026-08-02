<template>
  <ChatDialog :options="chatOptions" :title="props.title" :avatars="props.avatars" @msg-click="handleMsgClick" />
</template>

<script setup>
import { ref, defineProps, onMounted } from 'vue'
import ChatDialog from '../../components/chat-dialog/index.vue'

const props = defineProps({
  src: String,
  title: String,
  avatars: Object
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