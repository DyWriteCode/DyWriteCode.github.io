<template>
  <div id="mobile" ref="mobileRef">
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
        <div class="msg-row" v-for="(msg, index) in messages" :key="index" :class="[
          msg.author === 'me' ? 'msg-me' : 'msg-author',
          { 'no-avatar': !msg.author }
        ]" :data-author="msg.author" @dblclick="(e) => handleDoubleClick(msg, e)">
          <div v-if="msg.type === 'tip'" class="msg-tip">{{ msg.text }}</div>
          <template v-else>
            <img v-if="msg.author && getRoleInfo(msg.author).avatar" class="msg-avatar"
              :src="getRoleInfo(msg.author).avatar" alt="avatar" />
            <div v-else class="msg-avatar-placeholder"></div>

            <div class="msg-content">
              <div v-if="msg.author" class="msg-nickname">{{ getRoleInfo(msg.author).name }}</div>
              <div class="msg"
                :style="msg.width && msg.height && { width: msg.width - 26 + 'px', height: msg.height - 18 + 'px' }"
                :class="{
                  'msg-bounce-in-left': msg.author !== 'me',
                  'msg-bounce-in-right': msg.author === 'me',
                  'animate_breathe': index === (messages.length - 1) && status === 'componentClose'
                }" @click="$emit('msg-click', msg)">
                <span v-if="msg.type === 'text'" v-html="renderEmoji(msg.content)"></span>
                <component v-else :is="msg.type" v-bind="msg.props" :transcripted="!!msg.transcripted"
                  @convert="(alt) => handleVoiceConvert(alt, msg)" @cancel-convert="() => handleVoiceCancel(msg)" />
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

        <div class="emoji-btn-wrapper" v-if="status === 'userInput'">
          <span class="emoji-toggle-btn" @click="toggleEmojiPicker">😊</span>
        </div>

        <var-button ref="sendMsgBtnRef" type="success" size="small" :disabled="sendBtnDisabled" @click="sendUserMsg"
          class="send-btn">发送</var-button>
      </div>
    </div>

    <!-- 表情面板 -->
    <div class="emoji-picker-wrapper" v-show="status === 'userInput' && showEmojiPicker">
      <div class="emoji-grid">
        <img v-for="emoji in allEmojis" :key="emoji.name" :src="'/' + getEmojiPath(emoji.name)" :alt="emoji.name"
          :title="emoji.name" @click="selectEmoji(emoji)" class="emoji-item" loading="lazy" />
      </div>
    </div>

    <!-- 语音输入蒙版 -->
    <div v-if="voiceInputActive" class="voice-input-overlay">
      <!-- 中央气泡 -->
      <div class="voice-input-bubble" :class="{ 'voice-canceled': voiceCancelActive }">
        <div class="voice-wave">
          <span></span><span></span><span></span><span></span><span></span>
        </div>
        <span class="voice-input-duration">{{ voiceInputDuration }}''</span>
      </div>

      <!-- 底部弧形区域（始终不变红） -->
      <div class="voice-bottom-area">
        <!-- 取消按钮 - 圆形，始终禁用，取消时变红 -->
        <div class="voice-cancel-btn" :class="{
          'cancel-active': voiceCancelActive,
          'disabled': true
        }">
          取消
        </div>
        <div class="voice-send-area">松开发送</div>
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
import voice from './voice/index.vue'
import MessageDetail from './MessageDetail.vue'
import './css/main.scss'

import { getAllEmojis, getEmojiPath as originalGetEmojiPath, hasEmoji } from 'wechat-emojis';

const AUTHOR = {
  AUTHOR: 'author',
  ME: 'me'
};
const TRIGGER_NEXT_ACTION_TYPE = {
  USER_INPUT: 'userInput',
  COMPONENT_CLOSE: 'componentClose'
};

// const VOICE_INPUT_SPEED_MULTIPLIER = 30;

export default {
  components: {
    letter,
    vlog,
    voice,
    MessageDetail,
  },
  props: {
    title: String,
    options: Array,
    roles: Object
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
      currentTime: '',
      headHeight: 70,
      lastPatTime: 0,
      msgIdCounter: 0,
      recallTimers: [],
      timeInserted: false,

      showEmojiPicker: false,
      allEmojis: getAllEmojis(),

      typingInstance: null,

      voiceInputActive: false,
      voiceInputDuration: 0,
      voiceInputTimer: null,
      voiceCancelActive: false,    // 界面红色状态（气泡 + 按钮）
      voicePushTimer: null,
      voiceResolve: null,
      autoCancelTimer: null,       // 用于自动撤回的定时器
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
        onMessageSending();
      });
    },
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
    buildMsgChain(messages) {
      if (!this.timeInserted) {
        this.addTimeMessage();
        this.timeInserted = true;
      }
      messages.forEach(({ msgs, msgInputSpeed, author, triggerNextAction, pat, recall, tip }) => {
        this.msgChain = this.msgChain
          .then(() => this.sendSysMsg(msgs, msgInputSpeed, author, triggerNextAction, pat, recall, tip));
      })
    },
    sendSysMsg(messages, inputSpeed = 150, author, triggerNextAction = null, pat = null, recall = null, tip = null) {
      return new Promise((resolve) => {
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

        const startIndex = this.messages.length;

        this.sendSysMsgInner(messages, inputSpeed, author).then(() => {
          const endIndex = this.messages.length;

          if (recall && recall > 0) {
            const senderName = this.getRoleInfo(author || 'author').name || '未知';
            const timer = setTimeout(() => {
              if (this.messages.length >= endIndex) {
                this.messages.splice(startIndex, endIndex - startIndex);
                this.messages.push({
                  type: 'tip',
                  text: `${senderName}撤回了一条消息`
                });
                this.$nextTick(() => {
                  onMessageSending();
                });
              }
            }, recall);
            this.recallTimers.push(timer);
          }

          if (tip) {
            this.messages.push({
              type: 'tip',
              text: tip
            });
            this.$nextTick(() => { onMessageSending(); });
          }

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

        if (this.typingInstance) {
          this.typingInstance.stop();
          this.typingInstance = null;
        }

        const el = this.$refs.systemInputElement;
        if (!el) {
          this.pushMsg(message, author || AUTHOR.AUTHOR, messageType);
          delay(500).then(() => resolve());
          return;
        }

        el.innerHTML = '';
        const hasHtml = /<[^>]+>/.test(message);

        if (messageType === 'text') {
          let strings = [''];
          if (Array.isArray(messages)) {
            strings = strings.concat(messages);
          } else {
            strings.push(messages);
          }

          const instance = this.startTyping(el, strings, inputSpeed, inputSpeed, hasHtml, () => {
            if (this.typingInstance === instance) {
              this.typingInstance = null;
            }
            this.pushMsg(message, author || AUTHOR.AUTHOR, messageType);
            el.innerHTML = '';
            delay(500).then(() => resolve());
          });

          this.typingInstance = instance;
        } else if (messageType === 'voice') {
          // const totalDelay = inputSpeed * VOICE_INPUT_SPEED_MULTIPLIER;
          const totalDelay = 5000;
          // 重置状态
          this.voiceInputActive = true;
          this.voiceInputDuration = 0;
          this.voiceCancelActive = false;
          this.voiceResolve = resolve;

          // 获取 cancel 属性
          const props = this.getProps(message, messageType);
          const shouldAutoCancel = (props.cancel === 'true' || props.cancel === true);

          const startTime = Date.now();
          this.voiceInputTimer = setInterval(() => {
            const elapsed = (Date.now() - startTime) / 1000;
            this.voiceInputDuration = Math.floor(elapsed);
          }, 100);

          this.voicePushTimer = setTimeout(() => {
            clearInterval(this.voiceInputTimer);
            this.voiceInputTimer = null;
            // 注意：此时蒙版还未关闭，语音消息已经播放完毕

            if (shouldAutoCancel) {
              this.voiceCancelActive = true;   // 气泡和按钮变红

              // 先发送消息（让用户看到消息出现）
              const msg = this.pushMsg(message, author || AUTHOR.AUTHOR, messageType);

              // 延迟撤回
              this.autoCancelTimer = setTimeout(() => {
                const msgId = msg.id;
                const idx = this.messages.findIndex(m => m.id === msgId);
                if (idx !== -1) {
                  const senderName = this.getRoleInfo(author || 'author').name || '未知';
                  this.messages.splice(idx, 1);
                  this.messages.push({
                    type: 'tip',
                    text: `${senderName}撤回了一条消息`
                  });
                  this.$nextTick(() => {
                    onMessageSending();
                  });
                }
                // 关闭蒙版并重置状态
                this.voiceInputActive = false;
                this.voiceCancelActive = false;
                if (this.voiceResolve) {
                  this.voiceResolve();
                  this.voiceResolve = null;
                }
              }, 1000);
            } else {
              this.pushMsg(message, author || AUTHOR.AUTHOR, messageType);
              el.innerHTML = '';
              this.voiceInputActive = false;
              if (this.voiceResolve) {
                this.voiceResolve();
                this.voiceResolve = null;
              }
            }
          }, totalDelay);
        } else {
          this.pushMsg(message, author || AUTHOR.AUTHOR, messageType);
          el.innerHTML = '';
          delay(500).then(() => resolve());
        }
      });
    },
    startTyping(element, strings, typeSpeed, backSpeed, isHtml, onComplete) {
      let canceled = false;
      let timeoutId = null;
      let output = '';
      let currentStringIndex = 0;
      let currentCharIndex = 0;
      let buffer = '';

      element.innerHTML = '';
      const contentSpan = document.createElement('span');
      contentSpan.className = 'typing-content';
      element.appendChild(contentSpan);
      const cursorSpan = document.createElement('span');
      cursorSpan.className = 'typed-cursor';
      cursorSpan.textContent = '|';
      element.appendChild(cursorSpan);

      const instance = {
        stop: () => {
          canceled = true;
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
        },
        isRunning: true
      };

      const allStrings = strings.slice(1);
      const getCurrentString = () => allStrings[currentStringIndex] || '';

      const endsWithCompleteTag = (str) => {
        const lastOpen = str.lastIndexOf('<');
        if (lastOpen === -1) return false;
        const tagPart = str.slice(lastOpen);
        return tagPart.includes('>');
      };

      const getLastCompleteTag = (str) => {
        const lastOpen = str.lastIndexOf('<');
        if (lastOpen === -1) return '';
        const tagPart = str.slice(lastOpen);
        const closeIdx = tagPart.indexOf('>');
        if (closeIdx !== -1) {
          return tagPart.slice(0, closeIdx + 1);
        }
        return '';
      };

      const updateDisplay = () => {
        if (isHtml) {
          contentSpan.innerHTML = output;
        } else {
          contentSpan.textContent = output;
        }
        this.$nextTick(() => {
          requestAnimationFrame(() => {
            const container = document.getElementById('mobile-body-content');
            if (container) {
              container.scrollTop = container.scrollHeight;
            }
            element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          });
        });
      };

      const delayMs = (ms) => new Promise(resolve => {
        if (canceled) return resolve();
        timeoutId = setTimeout(() => {
          timeoutId = null;
          resolve();
        }, ms);
      });

      const run = async () => {
        if (allStrings.length === 0) {
          if (!canceled) {
            contentSpan.innerHTML = output;
            cursorSpan.remove();
            onComplete();
          }
          instance.isRunning = false;
          return;
        }

        const typeForward = async () => {
          const str = getCurrentString();
          if (currentCharIndex >= str.length) return false;

          const char = str[currentCharIndex];
          let charsToAdd = '';
          let delayTime = typeSpeed;

          if (isHtml && char === '<') {
            buffer = '<';
            currentCharIndex++;
            while (currentCharIndex < str.length) {
              const nextChar = str[currentCharIndex];
              buffer += nextChar;
              currentCharIndex++;
              if (nextChar === '>') break;
            }
            charsToAdd = buffer;
            buffer = '';
            delayTime = 20;
          } else {
            charsToAdd = char;
            currentCharIndex++;
            delayTime = typeSpeed;
          }

          output += charsToAdd;
          updateDisplay();
          await delayMs(delayTime);
          return true;
        };

        const typeBackward = async () => {
          if (output.length === 0) return false;

          let removed = '';
          let delayTime = backSpeed;
          if (isHtml && endsWithCompleteTag(output)) {
            const tag = getLastCompleteTag(output);
            if (tag) {
              removed = tag;
              output = output.slice(0, -tag.length);
              delayTime = 20;
            } else {
              removed = output.slice(-1);
              output = output.slice(0, -1);
            }
          } else {
            removed = output.slice(-1);
            output = output.slice(0, -1);
          }
          updateDisplay();
          await delayMs(delayTime);
          return true;
        };

        while (currentStringIndex < allStrings.length && !canceled) {
          while (currentCharIndex < allStrings[currentStringIndex].length && !canceled) {
            const result = await typeForward();
            if (!result) break;
          }
          if (canceled) break;

          if (currentStringIndex < allStrings.length - 1) {
            while (output.length > 0 && !canceled) {
              const result = await typeBackward();
              if (!result) break;
            }
            if (canceled) break;
            currentStringIndex++;
            currentCharIndex = 0;
          } else {
            break;
          }
        }

        if (!canceled) {
          if (isHtml) {
            contentSpan.innerHTML = output;
          } else {
            contentSpan.textContent = output;
          }
          cursorSpan.remove();
          onComplete();
        }
        instance.isRunning = false;
      };

      run();
      return instance;
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
      this.msgIdCounter++;
      const msg = {
        id: this.msgIdCounter,
        author: author,
        content: message,
        type,
        props: this.getProps(message, type),
        transcripted: false,
        transcriptMsgId: null,
      };
      this.messages.push(msg);
      onMessageSending();
      return msg;
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
      const isVoice = /<voice[^>]+>/.test(message);
      if (isImg) return 'img';
      if (isLetter) return 'letter';
      if (isVlog) return 'vlog';
      if (isVoice) return 'voice';
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
      el.scrollTop = el.scrollHeight;
      this.$nextTick(() => {
        const foot = document.getElementById('mobile-foot');
        if (foot) this.footHeight = foot.offsetHeight;
        requestAnimationFrame(() => {
          const container = document.getElementById('mobile-body-content');
          if (container) {
            container.scrollTop = container.scrollHeight;
          }
          el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        });
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

    handleVoiceConvert(alt, originalMsg) {
      if (!alt) return;
      if (originalMsg.transcripted) {
        this.handleVoiceCancel(originalMsg);
        return;
      }
      const transcriptMsg = {
        id: ++this.msgIdCounter,
        type: 'text',
        content: alt,
        author: null,
        isTranscript: true
      };
      const index = this.messages.indexOf(originalMsg);
      if (index === -1) return;
      this.messages.splice(index + 1, 0, transcriptMsg);
      originalMsg.transcripted = true;
      originalMsg.transcriptMsgId = transcriptMsg.id;
      this.$nextTick(() => {
        onMessageSending();
      });
    },
    handleVoiceCancel(originalMsg) {
      if (!originalMsg.transcripted) return;
      const transcriptId = originalMsg.transcriptMsgId;
      if (transcriptId === null) return;
      const idx = this.messages.findIndex(m => m.id === transcriptId);
      if (idx !== -1) {
        this.messages.splice(idx, 1);
      }
      originalMsg.transcripted = false;
      originalMsg.transcriptMsgId = null;
    },

    getEmojiPath(name) {
      const rawPath = originalGetEmojiPath(name);
      if (!rawPath) return null;
      // 移除可能的 'assets/' 前缀
      const relativePath = rawPath.replace(/^assets\//, '');
      // 使用 URL 构造函数来拼接，更安全
      return new URL(relativePath, 'https://cdn.jsdmirror.com/gh/DyWriteCode/DyWriteCode.github.io@latest/birthday/zhongsinger/2026/assets/WeChat').href;
    },
    toggleEmojiPicker() {
      this.showEmojiPicker = !this.showEmojiPicker;
      if (this.showEmojiPicker) {
        this.$nextTick(() => {
          this.$refs.userMsgInputRef?.focus();
        });
      }
    },
    selectEmoji(emoji) {
      const textarea = this.$refs.userMsgInputRef;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = this.inputMessage.substring(0, start);
      const after = this.inputMessage.substring(end);
      this.inputMessage = before + `[${emoji.name}]` + after;

      this.$nextTick(() => {
        const newPos = start + emoji.name.length + 2;
        textarea.selectionStart = newPos;
        textarea.selectionEnd = newPos;
        textarea.focus();
        this.autoResizeTextarea({ target: textarea });
      });
      this.showEmojiPicker = false;
    },
    renderEmoji(text) {
      if (!text) return '';
      return text.replace(/\[([^\]]+)\]/g, (match, name) => {
        if (hasEmoji(name)) {
          const path = this.getEmojiPath(name);
          console.log('Rendering emoji:', name, 'Path:', path);
          if (path) {
            return `<img src="${path}" class="inline-emoji" alt="${name}" />`;
          }
        }
        return match;
      });
    },
    closeEmojiPicker(e) {
      const container = this.$refs.mobileRef;
      if (!container) return;
      const picker = container.querySelector('.emoji-picker-wrapper');
      const btn = container.querySelector('.emoji-toggle-btn');
      if (this.showEmojiPicker && picker && !picker.contains(e.target) && !btn?.contains(e.target)) {
        this.showEmojiPicker = false;
      }
    },
  },
  mounted() {
    this.updateTime();
    setInterval(this.updateTime, 60000);
    this.$nextTick(() => {
      const body = document.getElementById('mobile-body');
      if (body) body.style.top = this.headHeight + 'px';
    });
    setTimeout(() => {
      const foot = document.getElementById('mobile-foot');
      if (foot) this.footHeight = foot.offsetHeight;
    }, 100);
    this._boundCloseEmojiPicker = this.closeEmojiPicker.bind(this);
    document.addEventListener('click', this._boundCloseEmojiPicker);
  },
  beforeUnmount() {
    if (this.typingInstance) {
      this.typingInstance.stop();
      this.typingInstance = null;
    }
    if (this.recallTimers) {
      this.recallTimers.forEach(timer => clearTimeout(timer));
      this.recallTimers = [];
    }
    if (this.voiceInputTimer) {
      clearInterval(this.voiceInputTimer);
      this.voiceInputTimer = null;
    }
    if (this.voicePushTimer) {
      clearTimeout(this.voicePushTimer);
      this.voicePushTimer = null;
    }
    if (this.autoCancelTimer) {
      clearTimeout(this.autoCancelTimer);
      this.autoCancelTimer = null;
    }
    if (this.voiceResolve) {
      this.voiceResolve = null;
    }
    document.removeEventListener('click', this._boundCloseEmojiPicker);
  }
}

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
/* ====== 全局样式（包含表情相关及光标修复） ====== */
#mobile-foot {
  position: absolute;
  bottom: 0;
  width: 100%;
  min-height: 55px;
  height: auto;
  background: #f7f8fa;
  border-top: 1px solid #f3f3f3;
  padding: 0 !important;
  overflow: visible !important;
}

#mobile-foot .foot-wrapper {
  display: flex;
  align-items: flex-end;
  padding: 6px 10px;
  gap: 8px;
  flex-wrap: nowrap;
  min-height: 55px;
}

#mobile-foot .input-area {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  background: white;
  border-radius: 20px;
  padding: 4px 14px;
  min-height: 40px;
  box-shadow: 5px 5px 15px 0 rgba(102, 102, 102, 0.1);
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
  vertical-align: baseline !important;
  font-size: inherit !important;
  line-height: inherit !important;
  color: black;
  opacity: 1;
  margin-left: 1px;
  animation: blink 1s step-end infinite;
}

@keyframes blink {

  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0;
  }
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
  overflow-y: auto;
  min-height: 24px;
  max-height: 80px;
  font-family: inherit;
}

#mobile-foot .send-btn {
  flex: 0 0 auto;
  height: 36px;
  align-self: flex-end;
}

.emoji-btn-wrapper {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  margin: 0 2px;
}

.emoji-toggle-btn {
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
  color: #555;
  transition: color 0.2s;
  user-select: none;
}

.emoji-toggle-btn:hover {
  color: #22c3aa;
}

#mobile .emoji-picker-wrapper {
  position: absolute;
  bottom: 55px;
  left: 0;
  right: 0;
  background: white;
  border-top: 1px solid #e0e0e0;
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.1);
  padding: 8px 4px;
  max-height: 200px;
  overflow-y: auto;
  z-index: 1000;
  border-radius: 12px 12px 0 0;
}

.emoji-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px;
}

.emoji-item {
  width: 32px;
  height: 32px;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.2s;
  object-fit: contain;
}

.emoji-item:hover {
  background: #f0f0f0;
}

.inline-emoji {
  width: 24px;
  height: 24px;
  vertical-align: middle;
  margin: 0 1px;
}

@media (max-width: 480px) {
  #mobile .emoji-picker-wrapper {
    max-height: 150px;
    padding: 4px 2px;
    bottom: 50px;
  }

  .emoji-item {
    width: 28px;
    height: 28px;
  }
}

/* ===== 语音输入蒙版 - 居中布局 ===== */
.voice-input-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  z-index: 500;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  pointer-events: none;
}

/* 中央气泡 - 被取消时变红 */
.voice-input-bubble {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 20px 20px 20px 20px;
  padding: 16px 24px;
  display: flex;
  align-items: center;
  gap: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  min-width: 160px;
  justify-content: center;
  margin-bottom: 20vh;
  transition: background 0.3s;
}

.voice-input-bubble.voice-canceled {
  background: rgba(255, 80, 80, 0.9);
  /* 变红 */
}

/* 底部弧形区域（始终灰色，不变红） */
.voice-bottom-area {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 150px;
  background: rgba(200, 200, 200, 0.7);
  border-radius: 50% 50% 0 0 / 100% 100% 0 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  padding-bottom: 30px;
  pointer-events: auto;
}

/* ===== 取消按钮 - 圆形，始终禁用 ===== */
.voice-cancel-btn {
  position: absolute;
  top: -30px;
  left: 50%;
  transform: translateX(-50%);
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: rgba(200, 200, 200, 0.92);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 500;
  color: #333;
  z-index: 2;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  user-select: none;
  transition: background 0.3s, color 0.3s;
  /* 强制禁用，类似发送按钮禁用效果 */
  pointer-events: none;
  cursor: not-allowed;
  opacity: 0.85;
}

/* 取消激活（变红） */
.voice-cancel-btn.cancel-active {
  background: #e05555;
  color: white;
}

.voice-send-area {
  font-size: 18px;
  color: #333;
  font-weight: 500;
}

/* 声波动画 */
.voice-wave {
  display: flex;
  align-items: center;
  height: 30px;
  gap: 4px;
}

.voice-wave span {
  display: block;
  width: 4px;
  background: #22c3aa;
  border-radius: 2px;
  animation: wave 0.8s ease-in-out infinite alternate;
}

.voice-wave span:nth-child(1) {
  height: 12px;
  animation-delay: 0.0s;
}

.voice-wave span:nth-child(2) {
  height: 20px;
  animation-delay: 0.2s;
}

.voice-wave span:nth-child(3) {
  height: 28px;
  animation-delay: 0.4s;
}

.voice-wave span:nth-child(4) {
  height: 20px;
  animation-delay: 0.6s;
}

.voice-wave span:nth-child(5) {
  height: 12px;
  animation-delay: 0.8s;
}

@keyframes wave {
  0% {
    transform: scaleY(0.4);
  }

  100% {
    transform: scaleY(1);
  }
}

.voice-input-duration {
  font-size: 18px;
  font-weight: bold;
  color: #333;
}

/* ====== 无头像消息占位 ====== */
.msg-avatar-placeholder {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  margin: 0 8px;
  visibility: hidden;
}

.msg {
  max-width: 100% !important;
  word-break: break-word;
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
    box-shadow: 0 1px 1px rgba(0, 147, 223, 0.4), 0 1px 1px rgba(0, 147, 223, 0.1) inset;
  }

  100% {
    opacity: 1;
    box-shadow: 0 1px 15px #0093df, 0 1px 10px #0093df inset;
  }
}

@keyframes breathe {
  0% {
    opacity: 0.4;
    box-shadow: 0 1px 1px rgba(0, 147, 223, 0.4), 0 1px 1px rgba(0, 147, 223, 0.1) inset;
  }

  100% {
    opacity: 1;
    box-shadow: 0 1px 15px #0093df, 0 1px 10px #0093df inset;
  }
}

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