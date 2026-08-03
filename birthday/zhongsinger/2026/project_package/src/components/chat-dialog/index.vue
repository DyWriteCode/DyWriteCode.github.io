<template>
  <div id="mobile">
    <div id="mobile-head">
      <div id="mobile-head-title">{{ title }}</div>
    </div>
    <div id="mobile-body" :style="{ bottom: footHeight + 'px' }">
      <div id="mobile-body-bg"></div>
      <div id="mobile-body-content">
        <div id="mock-msg-row" class="msg-row">
          <div id="mock-msg" class="msg" v-html="latestMsgContent"></div>
        </div>
        <div class="msg-row" v-for="(msg, index) in messages" :key="index"
          :class="msg.author === 'author' ? 'msg-author' : 'msg-me'">
          <div class="msg"
            :style="msg.width && msg.height && { width: msg.width - 26 + 'px', height: msg.height - 18 + 'px' }" :class="{
              'msg-bounce-in-left': msg.author === 'author',
              'msg-bounce-in-right': msg.author === 'me',
              'animate_breathe': index === (messages.length - 1) && status === 'componentClose'
            }" @click="$emit('msg-click', msg)">
            <span v-if="msg.type === 'text'" v-html="msg.content"></span>
            <component v-else :is="msg.type" v-bind="msg.props" @open="handleComponentOpen(msg)"
              @close="handleComponentClose"></component>
          </div>
        </div>
      </div>
    </div>
    <div id="mobile-foot">
      <div class="foot-wrapper">
        <div class="input-area" ref="inputArea">
          <!-- 系统打字占位 -->
          <span v-show="status === 'systemInput'" class="system-input-element" ref="systemInputElement"></span>
          <!-- 用户输入框 -->
          <textarea ref="userMsgInputRef" v-show="status === 'userInput'" class="user-input-textarea animate_breathe"
            v-model="inputMessage" rows="1" @input="autoResizeTextarea" placeholder="输入消息..."></textarea>
        </div>
        <var-button ref="sendMsgBtnRef" type="success" size="small" :disabled="sendBtnDisabled" @click="sendUserMsg"
          class="send-btn">发送</var-button>
      </div>
    </div>
  </div>
  <MessageDetail v-if="currentOpenComponent" :type="currentOpenComponent.type" :options="currentOpenComponent.props"
    @close="handleComponentClose">
  </MessageDetail>
</template>

<script>
import letter from './letter/cover.vue'
import vlog from './vlog/cover.vue'
import MessageDetail from './MessageDetail.vue'
import Typed from 'typed.js'
import './css/main.scss'

const AUTHOR = {
  AUTHOR: 'author',
  ME: 'me'
};
const TRIGGER_NEXT_ACTION_TYPE = {
  USER_INPUT: 'userInput',
  COMPONENT_CLOSE: 'componentClose'
};

export default {
  components: {
    letter,
    vlog,
    MessageDetail
  },
  props: {
    title: String,
    options: Array
  },
  computed: {
    sendBtnDisabled() {
      if (this.status === 'systemInput') return true;
      return !(this.inputMessage && this.inputMessage.trim().length > 0);
    }
  },
  data() {
    return {
      messages: [],
      msgChain: Promise.resolve(),
      inputMessage: '',
      nextActionTrigger: null,
      status: 'systemInput',
      currentOpenComponent: null,
      isTyping: false,
      latestMsgContent: null,
      footHeight: 55,
      typedInstance: null  // 保存 Typed 实例，便于销毁
    }
  },
  watch: {
    options() {
      this.buildMsgChain(this.options);
    },
    status(newVal) {
      if (newVal === TRIGGER_NEXT_ACTION_TYPE.USER_INPUT) {
        this.setUserInputFoucus();
      }
    },
    inputMessage() {
      this.$nextTick(() => {
        if (this.$refs.userMsgInputRef) {
          this.autoResizeTextarea({ target: this.$refs.userMsgInputRef });
        }
      });
    }
  },
  methods: {
    buildMsgChain(messages) {
      messages.forEach(({ msgs, msgInputSpeed, author, triggerNextAction }) => {
        this.msgChain = this.msgChain
          .then(() => this.sendSysMsg(msgs, msgInputSpeed, author, triggerNextAction));
      })
    },

    sendSysMsg(messages, inputSpeed = 150, author, triggerNextAction = null) {
      return new Promise((resolve) => {
        this.sendSysMsgInner(messages, inputSpeed, author).then(() => {
          if (triggerNextAction) {
            const trigger = () => delay(500).then(() => resolve());
            this.nextActionTrigger = {
              inputSpeed,
              triggerNextAction,
              trigger
            };
            this.status = triggerNextAction.type;
          } else {
            resolve();
          }
        });
      });
    },

    sendSysMsgInner(messages, inputSpeed, author) {
      return new Promise((resolve) => {
        const message = Array.isArray(messages) ? messages[messages.length - 1] : messages;
        const messageType = this.getMsgType(message);
        this.status = 'systemInput';

        // 销毁之前的 Typed 实例（如果有）
        if (this.typedInstance) {
          this.typedInstance.destroy();
          this.typedInstance = null;
        }

        if (messageType === 'text') {
          // 清空占位元素，避免残留
          const el = this.$refs.systemInputElement;
          if (el) el.innerHTML = '';

          let strings = [''];
          Array.isArray(messages) ? strings = strings.concat(messages) : strings.push(messages);

          // 创建新的 Typed 实例
          this.typedInstance = new Typed(el, {
            strings: strings,
            typeSpeed: inputSpeed,
            backSpeed: inputSpeed,
            cursorChar: '|',                // 显式光标字符
            autoInsertCss: true,            // 自动插入光标样式
            contentType: 'html',            // 支持 HTML 标签
            onComplete: () => {
              if (this.typedInstance) {
                this.typedInstance.destroy();
                this.typedInstance = null;
              }
              this.pushMsg(message, author || AUTHOR.AUTHOR, messageType);
              delay(500).then(() => resolve());
            },
            onStringTyped: () => {
              // 每次打字后强制更新底部栏高度（虽然内容高度不变，但保证 scroll 正常）
              this.$nextTick(() => {
                const foot = document.getElementById('mobile-foot');
                if (foot) this.footHeight = foot.offsetHeight;
              });
            }
          });
        } else {
          this.pushMsg(message, AUTHOR.AUTHOR, messageType);
          delay(500).then(() => resolve());
        }
      });
    },

    sendUserMsg() {
      const message = this.inputMessage;
      this.inputMessage = '';
      this.pushMsg(message, AUTHOR.ME, 'text');

      if (!this.nextActionTrigger) return;

      const { triggerNextAction, inputSpeed, tryCnt = 0 } = this.nextActionTrigger;
      const { type, options } = triggerNextAction;
      const { resolveKeyTexts, rejectKeyTexts, rejectHitTexts } = options;

      if (type === TRIGGER_NEXT_ACTION_TYPE.USER_INPUT) {
        if (this.rejectNextMsg(message, resolveKeyTexts, rejectKeyTexts)) {
          const rejectDisabled = tryCnt >= rejectHitTexts.length - 1;
          const rejectText = rejectHitTexts[Math.min(tryCnt, rejectHitTexts.length - 1)];
          let rejectSysMsgChain = Promise.resolve();
          if (Array.isArray(rejectText)) {
            rejectText.forEach(text => {
              rejectSysMsgChain = rejectSysMsgChain
                .then(() => this.sendSysMsg(text, inputSpeed));
            })
          } else {
            rejectSysMsgChain = this.sendSysMsg(rejectText, inputSpeed);
          }
          rejectSysMsgChain.then(() => {
            if (rejectDisabled) {
              this.handleTriggerNextAction();
            } else {
              this.status = TRIGGER_NEXT_ACTION_TYPE.USER_INPUT;
            }
          });
          this.nextActionTrigger.tryCnt = tryCnt + 1;
        } else {
          this.handleTriggerNextAction();
        }
      }
    },

    handleComponentOpen({ type, props }) {
      this.currentOpenComponent = { type, props };
    },

    handleComponentClose() {
      this.currentOpenComponent = null;
      if (!this.nextActionTrigger) return;
      const { triggerNextAction } = this.nextActionTrigger;
      if (triggerNextAction.type === TRIGGER_NEXT_ACTION_TYPE.COMPONENT_CLOSE) {
        this.handleTriggerNextAction();
      }
    },

    handleTriggerNextAction() {
      if (!this.nextActionTrigger) return;
      const { trigger } = this.nextActionTrigger;
      trigger();
      this.nextActionTrigger = null;
    },

    setUserInputFoucus() {
      const iosSpecialProcess = () => {
        try {
          const isiOS = !!navigator.userAgent.match(/\(i[^;]+;( U;)? CPU.+Mac OS X/);
          if (isiOS) {
            this.$refs['userMsgInputRef'].scrollIntoView(true);
          }
        } catch (ignore) { }
      }
      setTimeout(() => {
        this.$nextTick(() => {
          iosSpecialProcess();
          this.$refs['userMsgInputRef'].focus();
        });
      }, 1000);
    },

    rejectNextMsg(message, resolveKeyTexts = [], rejectKeyTexts = []) {
      if (rejectKeyTexts.some(rejectText => message.indexOf(rejectText) > -1)) return true;
      if (resolveKeyTexts.some(resolveKey => message.indexOf(resolveKey) > -1)) return false;
      return true;
    },

    pushMsg(message, author, type = 'text') {
      this.messages.push({
        author: author,
        content: message,
        type,
        props: this.getProps(message, type),
      });
      onMessageSending();
    },

    getProps(message, type) {
      const props = {};
      if (type === 'text') return props;
      const domParse = new DOMParser();
      const messageDoc = domParse.parseFromString(message, 'text/html');
      const messageDoms = messageDoc.getElementsByTagName(type);
      if (messageDoms.length === 1) {
        const messageDom = messageDoms[0];
        const attrs = messageDom.getAttributeNames();
        attrs.forEach(attrName => props[attrName] = messageDom.getAttribute(attrName));
      }
      return props;
    },

    getMsgType(message) {
      const isImg = /<img[^>]+>/.test(message);
      const isLetter = /<letter[^>]+>/.test(message);
      const isVlog = /<vlog[^>]+>/.test(message);
      if (isImg) return 'img';
      if (isLetter) return 'letter';
      if (isVlog) return 'vlog';
      return 'text';
    },

    markMsgSize(msg, content = null) {
      this.latestMsgContent = content || msg.content;
      return delay(0)
        .then(() => msg.type === 'img' && onImageLoad($('#mock-msg img')))
        .then(() => {
          Object.assign(msg, getMockMsgSize());
          this.messages = [...this.messages];
        });
    },

    autoResizeTextarea(e) {
      const el = e.target;
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
      this.$nextTick(() => {
        const foot = document.getElementById('mobile-foot');
        if (foot) this.footHeight = foot.offsetHeight;
      });
    }
  },
  mounted() {
    this.$nextTick(() => {
      const foot = document.getElementById('mobile-foot');
      if (foot) this.footHeight = foot.offsetHeight;
    });
  }
}

// ------------------ 辅助函数 ------------------
function onMessageSending() {
  setTimeout(() => {
    updateScroll();
    const $latestMsg = $('#mobile-body-content .msg-row:last-child .msg');
    $latestMsg.find('a').attr('target', '_blank');
    onImageLoad($latestMsg).then(updateScroll);
  });
}

function updateScroll() {
  const $chatbox = $('#mobile-body-content');
  const distance = $chatbox[0].scrollHeight - $chatbox.height() - $chatbox.scrollTop();
  const duration = 250;
  const startTime = Date.now();
  requestAnimationFrame(function step() {
    const p = Math.min(1, (Date.now() - startTime) / duration);
    $chatbox.scrollTop($chatbox.scrollTop() + distance * p);
    p < 1 && requestAnimationFrame(step);
  });
}

function delay(amount = 0) {
  return new Promise(resolve => setTimeout(resolve, amount));
}

function getMockMsgSize() {
  const $mockMsg = $('#mock-msg');
  return {
    width: $mockMsg.width(),
    height: $mockMsg.height()
  };
}

function onImageLoad($img) {
  return new Promise(resolve => {
    $img.one('load', resolve).each((index, target) => {
      target.complete && $(target).trigger('load');
    });
  });
}
</script>

<style scoped>
/* 使用 scoped 避免污染全局，但内部样式用 :deep 穿透 */
</style>

<style>
/* 全局样式覆盖（非 scoped，确保优先级） */
#mobile-foot {
  position: absolute;
  bottom: 0;
  width: 100%;
  height: auto !important;
  min-height: auto !important;
  background: #f7f8fa;
  border-top: 1px solid #f3f3f3;
  padding: 0 !important;
}

#mobile-foot .foot-wrapper {
  display: flex;
  align-items: flex-end;
  padding: 6px 10px;
  gap: 8px;
}

#mobile-foot .input-area {
  flex: 1;
  min-height: 36px;
  background: white;
  border-radius: 20px;
  box-shadow: 5px 5px 15px 0 rgba(102, 102, 102, 0.1);
  padding: 9px 14px;
  display: flex;
  align-items: center;
  /* 保证内容垂直居中，但 Typed 光标会正常显示 */
}

#mobile-foot .system-input-element {
  display: inline-block;
  width: 100%;
  font-size: 14px;
  line-height: 24px;
  min-height: 24px;
  word-wrap: break-word;
  white-space: pre-wrap;
  color: black;
}

/* 修正 Typed.js 光标样式 */
#mobile-foot .system-input-element .typed-cursor {
  color: black;
  opacity: 1;
  font-size: 14px;
  line-height: 24px;
  display: inline-block;
  font-weight: normal;
}

#mobile-foot .user-input-textarea {
  width: 100%;
  border: none;
  outline: none;
  resize: none;
  font-size: 14px;
  line-height: 24px;
  background: transparent;
  padding: 0;
  margin: 0;
  overflow: hidden;
  min-height: 24px;
  font-family: inherit;
}

#mobile-foot .send-btn {
  flex-shrink: 0;
  height: 36px;
  align-self: flex-end;
}

.animate_breathe {
  -webkit-animation-timing-function: ease-in-out;
  animation-timing-function: ease-in-out;
  -webkit-animation-name: breathe;
  animation-name: breathe;
  -webkit-animation-duration: 1500ms;
  animation-duration: 1500ms;
  animation-delay: 500ms;
  -webkit-animation-delay: 500ms;
  -webkit-animation-iteration-count: infinite;
  animation-iteration-count: infinite;
  -webkit-animation-direction: alternate;
  animation-direction: alternate;
}

@-webkit-keyframes breathe {
  0% {
    opacity: 0.4;
    box-shadow: 0 1px 1px rgba(0, 147, 223, 0.4),
      0 1px 1px rgba(0, 147, 223, 0.1) inset;
  }

  100% {
    opacity: 1;
    box-shadow: 0 1px 15px #0093df, 0 1px 10px #0093df inset;
  }
}

@keyframes breathe {
  0% {
    opacity: 0.4;
    box-shadow: 0 1px 1px rgba(0, 147, 223, 0.4),
      0 1px 1px rgba(0, 147, 223, 0.1) inset;
  }

  100% {
    opacity: 1;
    box-shadow: 0 1px 15px #0093df, 0 1px 10px #0093df inset;
  }
}

/* 重置输入区域布局，避免 flex 影响 */
#mobile-foot .input-area {
  display: block !important;
  padding: 9px 14px;
  background: white;
  border-radius: 20px;
  box-shadow: 5px 5px 15px 0 rgba(102, 102, 102, 0.1);
  min-height: 36px;
}

/* 打字容器使用 inline 布局，随内容自然撑宽 */
#mobile-foot .system-input-element {
  display: inline !important;
  width: auto !important;
  min-width: 10px;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 14px;
  line-height: 24px;
  color: black;
}

/* 强制光标为内联元素，且使用相对定位随文本流 */
#mobile-foot .system-input-element .typed-cursor {
  display: inline !important;
  position: relative !important;
  vertical-align: baseline !important;
  font-size: inherit;
  line-height: inherit;
  color: black;
  opacity: 1;
  margin-left: 1px; /* 与文本保持微小间距，可调整 */
}
</style>