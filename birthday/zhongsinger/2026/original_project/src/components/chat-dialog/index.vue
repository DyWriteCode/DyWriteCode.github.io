<template>
  <div id="mobile">
    <div id="mobile-head">
      <div id="status-bar">
        <span class="status-time">{{ currentTime }}</span>
        <span class="status-icons">
          <var-icon name="wifi" size="16" />
          <var-icon name="battery_std" size="16" style="margin-left:4px;" />
        </span>
      </div>
      <div id="title-bar">
        <div class="left-menu" @click="handleMenuClick">
          <span class="line long"></span>
          <span class="line short"></span>
        </div>
        <div class="title">{{ title }}</div>
        <div class="right-menu" @click="handleMoreClick">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
      </div>
    </div>
    <div id="mobile-body" :style="{ bottom: footHeight + 'px' }">
      <div id="mobile-body-bg"></div>
      <div id="mobile-body-content">
        <div id="mock-msg-row" class="msg-row">
          <div id="mock-msg" class="msg" v-html="latestMsgContent"></div>
        </div>

        <!-- 消息列表 -->
        <div class="msg-row" v-for="(msg, index) in messages" :key="index"
          :class="msg.author === 'me' ? 'msg-me' : 'msg-author'" :data-author="msg.author"
          @dblclick="(e) => handleDoubleClick(msg, e)">
          <!-- 拍一拍提示 -->
          <div v-if="msg.type === 'tip'" class="msg-tip">{{ msg.text }}</div>
          <!-- 普通消息 -->
          <template v-else>
            <img v-if="getRoleInfo(msg.author).avatar" class="msg-avatar" :src="getRoleInfo(msg.author).avatar"
              alt="avatar" />
            <div class="msg-content">
              <div class="msg-nickname">{{ getRoleInfo(msg.author).name }}</div>
              <div class="msg"
                :style="msg.width && msg.height && { width: msg.width - 26 + 'px', height: msg.height - 18 + 'px' }"
                :class="{
                  'msg-bounce-in-left': msg.author !== 'me',
                  'msg-bounce-in-right': msg.author === 'me',
                  'animate_breathe': index === (messages.length - 1) && status === 'componentClose'
                }" @click="$emit('msg-click', msg)">
                <span v-if="msg.type === 'text'" v-html="msg.content"></span>
                <component v-else :is="msg.type" v-bind="msg.props" @open="handleComponentOpen(msg)"
                  @close="handleComponentClose" />
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
    <div id="mobile-foot">
      <div class="foot-wrapper">
        <div class="input-area" ref="inputArea">
          <span v-show="status === 'systemInput'" class="system-input-element" ref="systemInputElement"></span>
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
    options: Array,
    roles: Object   // 角色映射，包含 _default.avatar 和各个角色 { name, avatar, pat? }
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
      typedInstance: null,
      currentTime: '',
      headHeight: 70,
      lastPatTime: 0,
      msgIdCounter: 0,
      recallTimers: [],
      timeInserted: false,
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
    addTimeMessage() {
      const now = new Date();
      const hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const prefix = hours < 12 ? '上午' : '下午';
      const displayHour = hours % 12 || 12;
      const timeStr = `${prefix} ${displayHour}:${minutes}`;

      this.messages.push({
        type: 'tip',
        text: timeStr
      });

      this.$nextTick(() => {
        onMessageSending();   // 外部定义的滚动函数
      });
    },
    // ---- 角色信息获取 ----
    getRoleInfo(roleName) {
      const defaultConfig = (this.roles && this.roles._default) || { avatar: '', pat: '拍了拍TA' };
      const roleConfig = this.roles ? this.roles[roleName] : null;
      if (roleConfig) {
        return {
          name: roleConfig.name || roleName,
          avatar: roleConfig.avatar || defaultConfig.avatar || '',
          pat: roleConfig.pat || defaultConfig.pat || '拍了拍TA'
        };
      }
      return {
        name: roleName || '未知',
        avatar: defaultConfig.avatar || '',
        pat: defaultConfig.pat || '拍了拍TA'
      };
    },

    // ---- 拍一拍相关 ----
    handleDoubleClick(msg) {
      if (msg.type === 'tip') return;
      const now = Date.now();
      if (now - this.lastPatTime < 1000) return;
      this.lastPatTime = now;

      const rowEl = event.currentTarget;
      const avatar = rowEl.querySelector('.msg-avatar');
      if (avatar) {
        avatar.classList.add('shake');
        avatar.addEventListener('animationend', function onEnd() {
          avatar.classList.remove('shake');
          avatar.removeEventListener('animationend', onEnd);
        });
      }

      const targetRole = msg.author;
      const currentUser = 'me';
      const meInfo = this.getRoleInfo(currentUser);
      const targetInfo = this.getRoleInfo(targetRole);
      let patText = targetInfo.pat || this.getRoleInfo('_default')?.pat || '拍了拍TA';
      if (targetRole === currentUser && !targetInfo.pat) {
        patText = '拍了拍自己';
      }
      const displayName = meInfo.name || '我';
      const tip = `${displayName} ${patText}`;
      this.addTipMessage(tip);
    },

    addTipMessage(text) {
      this.messages.push({
        type: 'tip',
        text: text,
      });
      this.$nextTick(() => {
        onMessageSending();
      });
    },

    // ---- 消息链构建（支持 pat 和 recall） ----
    buildMsgChain(messages) {
      // 在开始处理消息链之前，插入时间（仅一次）
      if (!this.timeInserted) {
        this.addTimeMessage();
        this.timeInserted = true;
      }
      messages.forEach(({ msgs, msgInputSpeed, author, triggerNextAction, pat, recall, tip }) => {
        this.msgChain = this.msgChain
          .then(() => this.sendSysMsg(msgs, msgInputSpeed, author, triggerNextAction, pat, recall, tip));
      })
    },

    // ---------- 修改：增加 recall 参数，实现撤回 ----------
    sendSysMsg(messages, inputSpeed = 150, author, triggerNextAction = null, pat = null, recall = null, tip = null) {
      return new Promise((resolve) => {
        // 拍一拍
        if (pat) {
          let target = pat;
          let customText = null;
          if (typeof pat === 'object') {
            target = pat.target || 'me';
            customText = pat.text;
          }
          const targetInfo = this.getRoleInfo(target);
          const authorInfo = this.getRoleInfo(author || 'author');
          const patText = customText || targetInfo.pat || this.getRoleInfo('_default')?.pat || '拍了拍TA';
          const displayName = authorInfo.name || '未知';
          const tip = `${displayName} ${patText}`;
          this.addTipMessage(tip);
        }

        if (!messages || messages.length === 0) {
          resolve();
          return;
        }

        // 记录本组消息在 messages 中的起始索引
        const startIndex = this.messages.length;

        this.sendSysMsgInner(messages, inputSpeed, author).then(() => {
          const endIndex = this.messages.length;

          if (recall && recall > 0) {
            const senderName = this.getRoleInfo(author || 'author').name || '未知';
            const timer = setTimeout(() => {
              // 检查这些消息是否还存在（避免重复撤回或已被删除）
              if (this.messages.length >= endIndex) {
                // 删除本组所有消息
                this.messages.splice(startIndex, endIndex - startIndex);
                // 插入撤回提示
                this.messages.push({
                  type: 'tip',
                  text: `${senderName}撤回了一条消息`
                });
                // 刷新滚动
                this.$nextTick(() => {
                  onMessageSending();
                });
              }
            }, recall);
            // 保存计时器以便清理
            this.recallTimers.push(timer);
          }

          if (tip) {
            this.messages.push({
              type: 'tip',
              text: tip   // 可以是纯文本或 HTML
            });
            this.$nextTick(() => { onMessageSending(); });
          }

          // 触发下一步动作
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

        if (this.typedInstance) {
          this.typedInstance.destroy();
          this.typedInstance = null;
        }

        if (messageType === 'text') {
          const el = this.$refs.systemInputElement;
          if (el) el.innerHTML = '';

          let strings = [''];
          Array.isArray(messages) ? strings = strings.concat(messages) : strings.push(messages);

          this.typedInstance = new Typed(el, {
            strings: strings,
            typeSpeed: inputSpeed,
            backSpeed: inputSpeed,
            cursorChar: '|',
            autoInsertCss: true,
            contentType: 'html',
            onComplete: () => {
              if (this.typedInstance) {
                this.typedInstance.destroy();
                this.typedInstance = null;
              }
              this.pushMsg(message, author || AUTHOR.AUTHOR, messageType);
              delay(500).then(() => resolve());
            },
            onStringTyped: () => {
              this.$nextTick(() => {
                const foot = document.getElementById('mobile-foot');
                if (foot) this.footHeight = foot.offsetHeight;
              });
            }
          });
        } else {
          this.pushMsg(message, author || AUTHOR.AUTHOR, messageType);
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
    },

    updateTime() {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      this.currentTime = h + ':' + m;
    },
    handleMenuClick() { /* 可扩展 */ },
    handleMoreClick() { /* 可扩展 */ },
  },
  mounted() {
    this.updateTime();
    setInterval(this.updateTime, 60000);
    this.$nextTick(() => {
      const body = document.getElementById('mobile-body');
      if (body) body.style.top = this.headHeight + 'px';
    });
    this.$nextTick(() => {
      const foot = document.getElementById('mobile-foot');
      if (foot) this.footHeight = foot.offsetHeight;
    });
  },
  // ---------- 组件销毁前清理所有撤回计时器 ----------
  beforeUnmount() {
    if (this.typedInstance) {
      this.typedInstance.destroy();
      this.typedInstance = null;
    }
    if (this.recallTimers) {
      this.recallTimers.forEach(timer => clearTimeout(timer));
      this.recallTimers = [];
    }
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
/* 空 */
</style>

<style>
/* 全局样式覆盖（非 scoped） */
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
  display: block !important;
}

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

#mobile-foot .system-input-element .typed-cursor {
  display: inline !important;
  position: relative !important;
  vertical-align: baseline !important;
  font-size: inherit;
  line-height: inherit;
  color: black;
  opacity: 1;
  margin-left: 1px;
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

/* 新头部样式 */
#mobile-head {
  height: auto !important;
  background: white;
  display: flex !important;
  flex-direction: column;
  border-bottom: 1px solid #e0e0e0;
}

#status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 16px 2px 16px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  font-size: 12px;
  height: 24px;
}

#status-bar .status-icons {
  display: flex;
  align-items: center;
}

#status-bar .status-icons .var-icon {
  color: white;
}

#title-bar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 12px 16px 6px 16px;
  height: 44px;
  background: white;
  box-sizing: border-box;
}

#title-bar .left-menu,
#title-bar .right-menu {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 30px;
  cursor: pointer;
}

#title-bar .left-menu .line {
  display: block;
  height: 2px;
  background: #333;
  margin: 3px 0;
  border-radius: 1px;
}

#title-bar .left-menu .line.long {
  width: 22px;
  align-self: flex-start;
}

#title-bar .left-menu .line.short {
  width: 14px;
  align-self: flex-start;
}

#title-bar .right-menu .dot {
  width: 4px;
  height: 4px;
  background: #333;
  border-radius: 50%;
  margin: 2px 0;
}

#title-bar .title {
  font-size: 17px;
  font-weight: 500;
  color: #333;
  flex: 1;
  text-align: center;
}

@media (max-width: 480px) {
  #mobile-head {
    display: flex !important;
  }

  #mobile-body {
    top: 70px !important;
  }
}

.msg-tip {
  text-align: center;
  font-size: 12px;
  color: #999;
  padding: 6px 0;
  width: 100%;
  user-select: none;
  pointer-events: none;
}
</style>