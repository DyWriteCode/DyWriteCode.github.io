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
        <div class="msg-row" v-for="(msg, index) in messages" :key="index"
          :class="msg.author === 'me' ? 'msg-me' : 'msg-author'" :data-author="msg.author"
          @dblclick="(e) => handleDoubleClick(msg, e)">
          <div v-if="msg.type === 'tip'" class="msg-tip">{{ msg.text }}</div>
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
                <span v-if="msg.type === 'text'" v-html="renderEmoji(msg.content)"></span>
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

        <!-- 表情按钮 -->
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
  </div>
  <MessageDetail v-if="currentOpenComponent" :type="currentOpenComponent.type" :options="currentOpenComponent.props"
    @close="handleComponentClose">
  </MessageDetail>
</template>

<script>
import letter from './letter/cover.vue'
import vlog from './vlog/cover.vue'
import MessageDetail from './MessageDetail.vue'
import './css/main.scss'

// 导入 wechat-emojis 并重命名原始函数
import { getAllEmojis, getEmojiPath as originalGetEmojiPath, hasEmoji } from 'wechat-emojis';

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

      // 表情相关
      showEmojiPicker: false,
      allEmojis: getAllEmojis(),

      // 打字机实例管理
      typingInstance: null,
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
    // ---- 原有方法（完整保留） ----
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

        // 停止之前的打字机
        if (this.typingInstance) {
          this.typingInstance.stop();
          this.typingInstance = null;
        }

        const el = this.$refs.systemInputElement;
        if (!el) {
          // 如果元素不存在，直接推送消息并继续
          this.pushMsg(message, author || AUTHOR.AUTHOR, messageType);
          delay(500).then(() => resolve());
          return;
        }

        // 清空元素
        el.innerHTML = '';

        // 检测是否包含 HTML 标签
        const hasHtml = /<[^>]+>/.test(message);

        if (messageType === 'text') {
          // 准备 strings 数组（和原逻辑一致）
          let strings = [''];
          if (Array.isArray(messages)) {
            strings = strings.concat(messages);
          } else {
            strings.push(messages);
          }

          // 启动打字机
          const instance = this.startTyping(el, strings, inputSpeed, inputSpeed, hasHtml, () => {
            // 打字完成
            if (this.typingInstance === instance) {
              this.typingInstance = null;
            }
            // 推送消息到列表
            this.pushMsg(message, author || AUTHOR.AUTHOR, messageType);
            // 清空输入区域，避免残留
            el.innerHTML = '';
            delay(500).then(() => resolve());
          });

          this.typingInstance = instance;
        } else {
          // 非文本消息直接推送
          this.pushMsg(message, author || AUTHOR.AUTHOR, messageType);
          // 清空输入区域
          el.innerHTML = '';
          delay(500).then(() => resolve());
        }
      });
    },
    /**
     * 自实现打字机（支持 HTML 内容）
     * @param {HTMLElement} element - 用于显示打字内容的容器
     * @param {string[]} strings - 要依次显示的字符串数组
     * @param {number} typeSpeed - 正向打字速度（毫秒/字符）
     * @param {number} backSpeed - 退格速度（毫秒/字符）
     * @param {boolean} isHtml - 是否按 HTML 方式渲染
     * @param {Function} onComplete - 全部完成后的回调
     * @returns {Object} { stop: Function } 用于停止打字
     */
    startTyping(element, strings, typeSpeed, backSpeed, isHtml, onComplete) {
      let canceled = false;
      let timeoutId = null;

      // 用于存储当前所有字符串拼接后的完整内容（纯文本或 HTML）
      let fullContent = '';
      // 用于存储当前已输出的内容（纯文本或 HTML）
      let output = '';

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

      // 将 strings 合并为一个完整字符串（typed.js 行为：依次显示并退格）
      // 但为了简化，这里我们只使用最后一个字符串作为内容
      // 因为原逻辑中，messages 数组的最后一个元素是最终显示的消息
      // 但 typed.js 原有行为是依次显示所有字符串，退格删除再显示下一个
      // 这里我们保持这个行为
      // 构建一个包含所有字符串的数组，用于逐步显示
      const allStrings = strings.slice(1); // 去掉第一个空字符串

      // 如果只有一个字符串，直接使用
      // 如果多个，需要依次显示并退格
      let currentStringIndex = 0;
      let currentCharIndex = 0;
      let isDeleting = false;

      // 获取当前字符串
      const getCurrentString = () => {
        if (currentStringIndex < allStrings.length) {
          return allStrings[currentStringIndex] || '';
        }
        return '';
      };

      // 检查 HTML 标签是否完整
      const isTagComplete = (html) => {
        const openTags = (html.match(/</g) || []).length;
        const closeTags = (html.match(/>/g) || []).length;
        return openTags === closeTags;
      };

      // 更新元素内容
      const updateElement = (content) => {
        if (isHtml) {
          // 只有当标签完整时才更新
          if (isTagComplete(content)) {
            element.innerHTML = content;
          }
          // 如果标签不完整，不更新显示，但内容继续累积
        } else {
          element.textContent = content;
        }
        // 滚动到底部
        this.$nextTick(() => {
          const container = document.getElementById('mobile-body-content');
          if (container) {
            container.scrollTop = container.scrollHeight;
          }
          if (element) {
            element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
        });
      };

      // 延迟函数
      const delayMs = (ms) => new Promise(resolve => {
        if (canceled) return resolve();
        timeoutId = setTimeout(() => {
          timeoutId = null;
          resolve();
        }, ms);
      });

      // 主循环
      const run = async () => {
        // 如果没有字符串需要显示，直接完成
        if (allStrings.length === 0) {
          if (!canceled) {
            onComplete();
          }
          instance.isRunning = false;
          return;
        }

        // 正打：逐个字符输出
        const typeForward = async () => {
          const str = getCurrentString();
          if (currentCharIndex < str.length) {
            const char = str[currentCharIndex];
            output += char;
            currentCharIndex++;
            updateElement(output);
            await delayMs(typeSpeed);
            return true; // 继续
          } else {
            // 当前字符串输出完毕
            return false; // 需要切换到退格或下一个字符串
          }
        };

        // 退格：逐个字符删除
        const typeBackward = async () => {
          if (output.length > 0) {
            // 如果按 HTML 模式，退格时需要确保标签完整
            if (isHtml) {
              let removed = 0;
              let tempOutput = output;
              while (tempOutput.length > 0) {
                tempOutput = tempOutput.slice(0, -1);
                removed++;
                if (isTagComplete(tempOutput) || tempOutput.length === 0) {
                  break;
                }
                // 如果标签不完整，继续删除
              }
              // 一次性删除多个字符（直到标签完整）
              output = tempOutput;
              updateElement(output);
              // 退格速度按字符数计算
              await delayMs(backSpeed * removed);
            } else {
              // 纯文本：逐个删除
              output = output.slice(0, -1);
              updateElement(output);
              await delayMs(backSpeed);
            }
            return true; // 继续退格
          } else {
            return false; // 已经删完
          }
        };

        // 处理所有字符串
        while (currentStringIndex < allStrings.length && !canceled) {
          // 正打当前字符串
          while (currentCharIndex < allStrings[currentStringIndex].length && !canceled) {
            const result = await typeForward();
            if (!result) break;
          }
          if (canceled) break;

          // 如果当前字符串不是最后一个，需要退格删除
          if (currentStringIndex < allStrings.length - 1) {
            // 退格删除所有字符
            while (output.length > 0 && !canceled) {
              const result = await typeBackward();
              if (!result) break;
            }
            if (canceled) break;
            // 移动到下一个字符串
            currentStringIndex++;
            currentCharIndex = 0;
          } else {
            // 最后一个字符串，不需要退格
            break;
          }
        }

        // 完成
        if (!canceled) {
          // 确保最终内容正确显示
          if (isHtml) {
            // 如果最终内容包含不完整的标签，补充完整
            let finalContent = output;
            // 检查是否有未闭合的标签
            const openTags = (finalContent.match(/</g) || []).length;
            const closeTags = (finalContent.match(/>/g) || []).length;
            if (openTags > closeTags) {
              // 补全未闭合的标签（简单处理：添加 > 使标签闭合）
              // 更复杂的补全需要解析 HTML 结构，这里简单处理
              // 但这种情况很少发生，因为内容通常是完整的 HTML
            }
            element.innerHTML = finalContent;
          } else {
            element.textContent = output;
          }
          // 移除光标
          const cursorSpan = element.querySelector('.typed-cursor');
          if (cursorSpan) {
            cursorSpan.remove();
          }
          onComplete();
        }
        instance.isRunning = false;
      };

      // 创建光标元素（仅在纯文本模式下使用，HTML 模式使用光标动画）
      if (!isHtml) {
        const cursorSpan = document.createElement('span');
        cursorSpan.className = 'typed-cursor';
        cursorSpan.textContent = '|';
        element.appendChild(cursorSpan);
      } else {
        // HTML 模式，使用 CSS 光标（在全局样式中已定义）
        const cursorSpan = document.createElement('span');
        cursorSpan.className = 'typed-cursor';
        cursorSpan.textContent = '|';
        element.appendChild(cursorSpan);
      }

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

    // ---- 新增表情相关方法 ----
    getEmojiPath(name) {
      const rawPath = originalGetEmojiPath(name);
      if (!rawPath) return null;
      return 'assets/WeChat/' + rawPath.replace('assets/', '');
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
          if (path) {
            return `<img src="/${path}" class="inline-emoji" alt="${name}" />`;
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
    this.$nextTick(() => {
      const foot = document.getElementById('mobile-foot');
      if (foot) this.footHeight = foot.offsetHeight;
    });
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
    document.removeEventListener('click', this._boundCloseEmojiPicker);
  }
}

// ---- 辅助函数（完整保留，使用 $） ----
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
  height: auto !important;
  min-height: auto !important;
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

/* ====== 修复自定义光标换行问题 ====== */
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
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
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

/* ====== 表情按钮 ====== */
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

/* ====== 表情面板 ====== */
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

/* 移动端适配 */
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

/* ====== 原有样式（呼吸动画、头部等） ====== */
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