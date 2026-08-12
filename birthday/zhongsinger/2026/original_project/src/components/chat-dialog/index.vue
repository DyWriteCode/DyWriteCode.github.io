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

        <!-- 消息列表：添加右键/长按事件 -->
        <div class="msg-row" v-for="(msg, index) in messages" :key="index" :class="[
          msg.author === 'me' ? 'msg-me' : 'msg-author',
          { 'no-avatar': !msg.author }
        ]" :data-author="msg.author" :data-msg-id="msg.id" @dblclick="(e) => handleDoubleClick(msg, e)"
          @contextmenu.prevent="(e) => openMsgContextMenu(msg, e)" @touchstart="(e) => onMsgTouchStart(msg, e)"
          @touchend="onMsgTouchEnd" @touchmove="onMsgTouchMove">
          <div v-if="msg.type === 'tip'" class="msg-tip">{{ msg.text }}</div>
          <div v-else-if="msg.isTranscript" class="msg-transcript"
            :class="{ 'msg-transcript-right': msg.author === 'me' }">
            <div class="msg" :class="{
              'msg-bounce-in-left': msg.author !== 'me',
              'msg-bounce-in-right': msg.author === 'me'
            }" v-html="renderEmoji(msg.content)"></div>
          </div>
          <template v-else>
            <img v-if="msg.author && getRoleInfo(msg.author).avatar" class="msg-avatar"
              :src="getRoleInfo(msg.author).avatar" alt="avatar" />
            <div v-else class="msg-avatar-placeholder"></div>

            <div class="msg-content">
              <div v-if="msg.author" class="msg-nickname">{{ getRoleInfo(msg.author).name }}</div>
              <!-- 引用信息 -->
              <div v-if="msg.quoteInfo" class="msg-quote">
                <div class="quote-line"></div>
                <div class="quote-content">
                  <span class="quote-author">{{ msg.quoteInfo.authorName }}</span>
                  <span class="quote-text">{{ msg.quoteInfo.contentPreview }}</span>
                </div>
              </div>
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

    <!-- 底部输入区域，包含引用条 -->
    <div id="mobile-foot">
      <!-- 引用条：使用 v-if 确保 quoteMsg 不为 null 时才渲染，避免空指针 -->
      <div v-if="showQuoteBar && quoteMsg" class="quote-bar" ref="quoteBarRef" :key="'quote-bar-' + (quoteMsg ? quoteMsg.id : 'none')">
        <div class="quote-bar-content">
          <span class="quote-bar-author">{{ getRoleInfo(quoteMsg.author).name || '未知' }}</span>
          <span class="quote-bar-text">{{ getContentPreview(quoteMsg) }}</span>
        </div>
        <span class="quote-bar-close" @click.stop="clearQuote" @touchstart.stop="clearQuote">✕</span>
      </div>

      <div class="foot-wrapper">
        <div class="input-area" ref="inputArea" :style="{ height: voiceInputMode ? '40px' : 'auto' }">
          <span class="voice-toggle-btn" @click="toggleVoiceInputMode" :class="{ active: voiceInputMode }">
            🎤
          </span>

          <template v-if="!voiceInputMode">
            <span v-show="status === 'systemInput'" class="system-input-element" ref="systemInputElement"></span>
            <textarea ref="userMsgInputRef" v-show="status === 'userInput'" class="user-input-textarea animate_breathe"
              v-model="inputMessage" rows="1" @input="autoResizeTextarea" placeholder="输入消息..."></textarea>
          </template>

          <template v-else>
            <VoiceRecorderButton ref="voiceRecorderRef" @start="startUserRecording" @stop="onVoiceStop"
              @cancel="cancelUserRecording" @result="handleUserVoiceResult" @error="handleVoiceError"
              @processing="onVoiceProcessing" />
          </template>
        </div>

        <div class="emoji-btn-wrapper" v-if="status === 'userInput' && !voiceInputMode">
          <span class="emoji-toggle-btn" @click="toggleEmojiPicker">😊</span>
        </div>

        <var-button ref="sendMsgBtnRef" type="success" size="small" :disabled="sendBtnDisabled" @click="sendUserMsg"
          class="send-btn">{{ isProcessing ? '处理中...' : '发送' }}</var-button>
      </div>
    </div>

    <div class="emoji-picker-wrapper" v-show="status === 'userInput' && showEmojiPicker && !voiceInputMode">
      <div class="emoji-grid">
        <img v-for="emoji in allEmojis" :key="emoji.name" :src="getEmojiPath(emoji.name)" :alt="emoji.name"
          :title="emoji.name" @click="selectEmoji(emoji)" class="emoji-item" loading="lazy" />
      </div>
    </div>

    <div v-if="voiceInputActive" class="voice-input-overlay system-voice-overlay">
      <div class="voice-input-bubble" :class="{ 'voice-canceled': voiceCancelActive }">
        <div class="voice-wave">
          <span></span><span></span><span></span><span></span><span></span>
        </div>
        <span class="voice-input-duration">{{ voiceInputDuration }}''</span>
      </div>
      <div class="voice-bottom-area">
        <div class="voice-cancel-btn" :class="{ 'cancel-active': voiceCancelActive, 'disabled': true }">取消</div>
        <div class="voice-send-area">松开发送</div>
      </div>
    </div>

    <div v-if="userVoiceActive" class="voice-input-overlay user-voice-overlay">
      <div class="voice-input-bubble" :class="{ 'voice-canceled': userVoiceCancelActive }">
        <div class="voice-wave">
          <span></span><span></span><span></span><span></span><span></span>
        </div>
        <span class="voice-input-duration">{{ userVoiceDuration }}''</span>
      </div>
      <div class="voice-bottom-area voice-bottom-area-with-send">
        <div class="voice-cancel-btn" :class="{ 'cancel-active': userVoiceCancelActive }" @click="cancelUserRecording">
          取消
        </div>
        <div class="voice-send-btn" @click="sendUserRecording" :disabled="isProcessing">
          {{ isProcessing ? '处理中...' : '发送' }}
        </div>
      </div>
    </div>

    <MessageDetail v-if="currentOpenComponent" :type="currentOpenComponent.type" :options="currentOpenComponent.props"
      @close="handleComponentClose">
    </MessageDetail>

    <!-- 消息上下文菜单 -->
    <Teleport to="body">
      <div v-if="showMsgMenu" class="custom-voice-menu" :style="msgMenuStyle" ref="msgMenuRef">
        <div class="menu-item" @click="handleMenuQuote">
          <var-icon name="format_quote" class="menu-icon" />
          <span>引用</span>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script>
import letter from './letter/cover.vue'
import vlog from './vlog/cover.vue'
import voice from './voice/index.vue'
import VoiceRecorderButton from './voice/VoiceRecorderButton.vue'
import MessageDetail from './MessageDetail.vue'
import './css/main.scss'
import { getAllEmojis, getEmojiPath as originalGetEmojiPath, hasEmoji } from 'wechat-emojis'
import { Snackbar } from '@varlet/ui'

const AUTHOR = {
  AUTHOR: 'author',
  ME: 'me'
}
const TRIGGER_NEXT_ACTION_TYPE = {
  USER_INPUT: 'userInput',
  COMPONENT_CLOSE: 'componentClose'
}

export default {
  components: {
    letter,
    vlog,
    voice,
    VoiceRecorderButton,
    MessageDetail,
  },
  props: {
    title: String,
    options: Array,
    roles: Object
  },
  computed: {
    sendBtnDisabled() {
      if (this.status === 'systemInput') return true
      if (this.voiceInputMode) return true
      if (this.isProcessing) return true
      return !(this.inputMessage && this.inputMessage.trim().length > 0)
    },
    isTouchDevice() {
      return 'ontouchstart' in window || navigator.maxTouchPoints > 0
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
      voiceCancelActive: false,
      voicePushTimer: null,
      voiceResolve: null,
      autoCancelTimer: null,

      voiceInputMode: false,
      userVoiceActive: false,
      userVoiceDuration: 0,
      userVoiceCancelActive: false,
      userVoiceTimer: null,
      userVoiceRecording: false,
      pendingVoiceResult: null,
      voiceStopReceived: false,

      voiceBlobUrls: [],
      isProcessing: false,

      // 引用
      quoteMsg: null,
      showQuoteBar: false,

      // 菜单
      showMsgMenu: false,
      msgMenuStyle: {
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
      },
      contextMsg: null,
      touchTimer: null,
      isTouchMoved: false,
    }
  },
  watch: {
    options() {
      this.buildMsgChain(this.options)
    },
    status(newVal) {
      if (newVal === TRIGGER_NEXT_ACTION_TYPE.USER_INPUT) {
        this.setUserInputFoucus()
      }
      if (newVal === 'systemInput') {
        this.voiceInputMode = false
      }
    },
    inputMessage() {
      this.$nextTick(() => {
        if (this.$refs.userMsgInputRef) {
          this.autoResizeTextarea({ target: this.$refs.userMsgInputRef })
        }
      })
    },
    voiceInputMode(val) {
      if (val) {
        this.showEmojiPicker = false
      }
    }
  },
  methods: {
    addTimeMessage() {
      const now = new Date()
      const hours = now.getHours()
      const minutes = String(now.getMinutes()).padStart(2, '0')
      const prefix = hours < 12 ? '上午' : '下午'
      const displayHour = hours % 12 || 12
      const timeStr = `${prefix} ${displayHour}:${minutes}`

      this.messages.push({ type: 'tip', text: timeStr })
      this.$nextTick(() => { this.scrollToBottom(false) })
    },
    getRoleInfo(roleName) {
      const defaultConfig = (this.roles && this.roles._default) || { avatar: '', pat: '拍了拍TA' }
      const roleConfig = this.roles ? this.roles[roleName] : null
      if (roleConfig) {
        return {
          name: roleConfig.name || roleName,
          avatar: roleConfig.avatar || defaultConfig.avatar || '',
          pat: roleConfig.pat || defaultConfig.pat || '拍了拍TA'
        }
      }
      return {
        name: roleName || '未知',
        avatar: defaultConfig.avatar || '',
        pat: defaultConfig.pat || '拍了拍TA'
      }
    },
    handleDoubleClick(msg, event) {
      if (msg.isTranscript) return
      if (msg.quoteId) {
        const targetMsg = this.messages.find(m => m.externalId === msg.quoteId)
        if (targetMsg) {
          const targetEl = document.querySelector(`.msg-row[data-msg-id="${targetMsg.id}"]`)
          if (targetEl) {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
            targetEl.style.transition = 'background-color 0.3s'
            targetEl.style.backgroundColor = 'rgba(34, 195, 170, 0.2)'
            setTimeout(() => {
              targetEl.style.backgroundColor = ''
            }, 800)
          }
          return
        } else {
          Snackbar({
            content: '消息已撤回',
            duration: 2000,
            type: 'warning'
          })
          return
        }
      }

      const now = Date.now()
      if (now - this.lastPatTime < 1000) return
      this.lastPatTime = now

      const rowEl = event.currentTarget
      const avatar = rowEl.querySelector('.msg-avatar')
      if (avatar) {
        avatar.classList.add('shake')
        avatar.addEventListener('animationend', function onEnd() {
          avatar.classList.remove('shake')
          avatar.removeEventListener('animationend', onEnd)
        })
      }

      const targetRole = msg.author
      const currentUser = 'me'
      const meInfo = this.getRoleInfo(currentUser)
      const targetInfo = this.getRoleInfo(targetRole)
      let patText = targetInfo.pat || this.getRoleInfo('_default')?.pat || '拍了拍TA'
      if (targetRole === currentUser && !targetInfo.pat) {
        patText = '拍了拍自己'
      }
      const displayName = meInfo.name || '我'
      const tip = `${displayName} ${patText}`
      this.addTipMessage(tip)
    },
    addTipMessage(text) {
      this.messages.push({ type: 'tip', text })
      this.$nextTick(() => { this.scrollToBottom(false) })
    },
    buildMsgChain(messages) {
      if (!this.timeInserted) {
        this.addTimeMessage()
        this.timeInserted = true
      }
      messages.forEach((block) => {
        this.msgChain = this.msgChain.then(() => this.sendSysMsg(block))
      })
    },
    sendSysMsg(block) {
      return new Promise((resolve) => {
        const { msgs, msgInputSpeed, author, triggerNextAction, pat, recall, tip, id, quote } = block

        if (pat) {
          let target = pat
          let customText = null
          if (typeof pat === 'object') {
            target = pat.target || 'me'
            customText = pat.text
          }
          const targetInfo = this.getRoleInfo(target)
          const authorInfo = this.getRoleInfo(author || 'author')
          const patText = customText || targetInfo.pat || this.getRoleInfo('_default')?.pat || '拍了拍TA'
          const displayName = authorInfo.name || '未知'
          this.addTipMessage(`${displayName} ${patText}`)
        }

        if (!msgs || msgs.length === 0) {
          resolve()
          return
        }

        const startIndex = this.messages.length

        this.sendSysMsgInner(msgs, msgInputSpeed, author, id, quote).then(() => {
          const endIndex = this.messages.length

          if (recall && recall > 0) {
            const senderName = this.getRoleInfo(author || 'author').name || '未知'
            const timer = setTimeout(() => {
              if (this.messages.length >= endIndex) {
                this.messages.splice(startIndex, endIndex - startIndex)
                this.messages.push({ type: 'tip', text: `${senderName}撤回了一条消息` })
                this.$nextTick(() => { this.scrollToBottom(false) })
              }
            }, recall)
            this.recallTimers.push(timer)
          }

          if (tip) {
            this.messages.push({ type: 'tip', text: tip })
            this.$nextTick(() => { this.scrollToBottom(false) })
          }

          if (triggerNextAction) {
            const trigger = () => delay(500).then(() => resolve())
            this.nextActionTrigger = {
              inputSpeed: msgInputSpeed,
              triggerNextAction,
              trigger
            }
            this.status = triggerNextAction.type
          } else {
            resolve()
          }
        })
      })
    },
    sendSysMsgInner(messages, inputSpeed, author, externalId = null, quoteId = null) {
      return new Promise((resolve) => {
        const message = Array.isArray(messages) ? messages[messages.length - 1] : messages
        const messageType = this.getMsgType(message)
        this.status = 'systemInput'
        this.voiceInputMode = false

        if (this.typingInstance) {
          this.typingInstance.stop()
          this.typingInstance = null
        }

        const el = this.$refs.systemInputElement
        if (!el) {
          this.pushMsg(message, author || AUTHOR.AUTHOR, messageType, externalId, quoteId)
          delay(500).then(() => resolve())
          return
        }

        el.innerHTML = ''
        const hasHtml = /<[^>]+>/.test(message)

        if (messageType === 'text') {
          let strings = ['']
          if (Array.isArray(messages)) {
            strings = strings.concat(messages)
          } else {
            strings.push(messages)
          }

          const instance = this.startTyping(el, strings, inputSpeed, inputSpeed, hasHtml, () => {
            if (this.typingInstance === instance) {
              this.typingInstance = null
            }
            this.pushMsg(message, author || AUTHOR.AUTHOR, messageType, externalId, quoteId)
            el.innerHTML = ''
            delay(500).then(() => resolve())
          })

          this.typingInstance = instance
        } else if (messageType === 'voice') {
          const voiceProps = this.getProps(message, messageType)
          const delayMs = parseInt(voiceProps.delay, 10)
          const totalDelay = !isNaN(delayMs) && delayMs > 0 ? delayMs : 5000

          this.voiceInputActive = true
          this.voiceInputDuration = 0
          this.voiceCancelActive = false
          this.voiceResolve = resolve

          const shouldAutoCancel = (voiceProps.cancel === 'true' || voiceProps.cancel === true)
          const startTime = Date.now()
          this.voiceInputTimer = setInterval(() => {
            const elapsed = (Date.now() - startTime) / 1000
            this.voiceInputDuration = Math.floor(elapsed)
          }, 100)

          this.voicePushTimer = setTimeout(() => {
            clearInterval(this.voiceInputTimer)
            this.voiceInputTimer = null

            if (shouldAutoCancel) {
              this.voiceCancelActive = true
              const msg = this.pushMsg(message, author || AUTHOR.AUTHOR, messageType, externalId, quoteId)
              this.autoCancelTimer = setTimeout(() => {
                const msgId = msg.id
                const idx = this.messages.findIndex(m => m.id === msgId)
                if (idx !== -1) {
                  const senderName = this.getRoleInfo(author || 'author').name || '未知'
                  this.messages.splice(idx, 1)
                  this.messages.push({ type: 'tip', text: `${senderName}撤回了一条消息` })
                  this.$nextTick(() => { this.scrollToBottom(false) })
                }
                this.voiceInputActive = false
                this.voiceCancelActive = false
                if (this.voiceResolve) {
                  this.voiceResolve()
                  this.voiceResolve = null
                }
              }, 1000)
            } else {
              this.pushMsg(message, author || AUTHOR.AUTHOR, messageType, externalId, quoteId)
              el.innerHTML = ''
              this.voiceInputActive = false
              if (this.voiceResolve) {
                this.voiceResolve()
                this.voiceResolve = null
              }
            }
          }, totalDelay)
        } else {
          this.pushMsg(message, author || AUTHOR.AUTHOR, messageType, externalId, quoteId)
          el.innerHTML = ''
          delay(500).then(() => resolve())
        }
      })
    },
    startTyping(element, strings, typeSpeed, backSpeed, isHtml, onComplete) {
      let canceled = false
      let timeoutId = null
      let output = ''
      let currentStringIndex = 0
      let currentCharIndex = 0
      let buffer = ''

      element.innerHTML = ''
      const contentSpan = document.createElement('span')
      contentSpan.className = 'typing-content'
      element.appendChild(contentSpan)
      const cursorSpan = document.createElement('span')
      cursorSpan.className = 'typed-cursor'
      cursorSpan.textContent = '|'
      element.appendChild(cursorSpan)

      const instance = {
        stop: () => {
          canceled = true
          if (timeoutId) {
            clearTimeout(timeoutId)
            timeoutId = null
          }
        },
        isRunning: true
      }

      const allStrings = strings.slice(1)
      const getCurrentString = () => allStrings[currentStringIndex] || ''

      const endsWithCompleteTag = (str) => {
        const lastOpen = str.lastIndexOf('<')
        if (lastOpen === -1) return false
        const tagPart = str.slice(lastOpen)
        return tagPart.includes('>')
      }

      const getLastCompleteTag = (str) => {
        const lastOpen = str.lastIndexOf('<')
        if (lastOpen === -1) return ''
        const tagPart = str.slice(lastOpen)
        const closeIdx = tagPart.indexOf('>')
        if (closeIdx !== -1) {
          return tagPart.slice(0, closeIdx + 1)
        }
        return ''
      }

      const updateDisplay = () => {
        if (isHtml) {
          contentSpan.innerHTML = output
        } else {
          contentSpan.textContent = output
        }
        this.$nextTick(() => {
          requestAnimationFrame(() => {
            const container = document.getElementById('mobile-body-content')
            if (container) {
              container.scrollTop = container.scrollHeight
            }
            element.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
          })
        })
      }

      const delayMs = (ms) => new Promise(resolve => {
        if (canceled) return resolve()
        timeoutId = setTimeout(() => {
          timeoutId = null
          resolve()
        }, ms)
      })

      const run = async () => {
        if (allStrings.length === 0) {
          if (!canceled) {
            contentSpan.innerHTML = output
            cursorSpan.remove()
            onComplete()
          }
          instance.isRunning = false
          return
        }

        const typeForward = async () => {
          const str = getCurrentString()
          if (currentCharIndex >= str.length) return false

          const char = str[currentCharIndex]
          let charsToAdd = ''
          let delayTime = typeSpeed

          if (isHtml && char === '<') {
            buffer = '<'
            currentCharIndex++
            while (currentCharIndex < str.length) {
              const nextChar = str[currentCharIndex]
              buffer += nextChar
              currentCharIndex++
              if (nextChar === '>') break
            }
            charsToAdd = buffer
            buffer = ''
            delayTime = 20
          } else {
            charsToAdd = char
            currentCharIndex++
            delayTime = typeSpeed
          }

          output += charsToAdd
          updateDisplay()
          await delayMs(delayTime)
          return true
        }

        const typeBackward = async () => {
          if (output.length === 0) return false

          let removed = ''
          let delayTime = backSpeed
          if (isHtml && endsWithCompleteTag(output)) {
            const tag = getLastCompleteTag(output)
            if (tag) {
              removed = tag
              output = output.slice(0, -tag.length)
              delayTime = 20
            } else {
              removed = output.slice(-1)
              output = output.slice(0, -1)
            }
          } else {
            removed = output.slice(-1)
            output = output.slice(0, -1)
          }
          updateDisplay()
          await delayMs(delayTime)
          return true
        }

        while (currentStringIndex < allStrings.length && !canceled) {
          while (currentCharIndex < allStrings[currentStringIndex].length && !canceled) {
            const result = await typeForward()
            if (!result) break
          }
          if (canceled) break

          if (currentStringIndex < allStrings.length - 1) {
            while (output.length > 0 && !canceled) {
              const result = await typeBackward()
              if (!result) break
            }
            if (canceled) break
            currentStringIndex++
            currentCharIndex = 0
          } else {
            break
          }
        }

        if (!canceled) {
          if (isHtml) {
            contentSpan.innerHTML = output
          } else {
            contentSpan.textContent = output
          }
          cursorSpan.remove()
          onComplete()
        }
        instance.isRunning = false
      }

      run()
      return instance
    },
    sendUserMsg() {
      const message = this.inputMessage
      this.inputMessage = ''
      const quoteId = this.quoteMsg ? this.quoteMsg.id : null
      this.pushMsg(message, AUTHOR.ME, 'text', null, quoteId)
      this.clearQuote()

      if (!this.nextActionTrigger) return

      const { triggerNextAction, inputSpeed, tryCnt = 0 } = this.nextActionTrigger
      const { type, options } = triggerNextAction
      const { resolveKeyTexts, rejectKeyTexts, rejectHitTexts } = options

      if (type === TRIGGER_NEXT_ACTION_TYPE.USER_INPUT) {
        if (this.rejectNextMsg(message, resolveKeyTexts, rejectKeyTexts)) {
          const rejectDisabled = tryCnt >= rejectHitTexts.length
          const rejectIndex = Math.min(tryCnt, rejectHitTexts.length - 1)
          const rejectText = rejectHitTexts[rejectIndex]
          let rejectSysMsgChain = Promise.resolve()
          if (Array.isArray(rejectText)) {
            rejectText.forEach(text => {
              rejectSysMsgChain = rejectSysMsgChain
                .then(() => this.sendSysMsg({ msgs: [text], msgInputSpeed: inputSpeed }))
            })
          } else {
            rejectSysMsgChain = this.sendSysMsg({ msgs: [rejectText], msgInputSpeed: inputSpeed })
          }
          rejectSysMsgChain.then(() => {
            if (rejectDisabled) {
              this.handleTriggerNextAction()
            } else {
              this.status = TRIGGER_NEXT_ACTION_TYPE.USER_INPUT
            }
          })
          this.nextActionTrigger.tryCnt = tryCnt + 1
        } else {
          this.handleTriggerNextAction()
        }
      }
    },
    handleComponentOpen({ type, props }) {
      this.currentOpenComponent = { type, props }
    },
    handleComponentClose() {
      this.currentOpenComponent = null
      if (!this.nextActionTrigger) return
      const { triggerNextAction } = this.nextActionTrigger
      if (triggerNextAction.type === TRIGGER_NEXT_ACTION_TYPE.COMPONENT_CLOSE) {
        this.handleTriggerNextAction()
      }
    },
    handleTriggerNextAction() {
      if (!this.nextActionTrigger) return
      const { trigger } = this.nextActionTrigger
      trigger()
      this.nextActionTrigger = null
    },
    setUserInputFoucus() {
      const iosSpecialProcess = () => {
        try {
          const isiOS = !!navigator.userAgent.match(/\(i[^;]+;( U;)? CPU.+Mac OS X/)
          if (isiOS && this.$refs['userMsgInputRef']) {
            this.$refs['userMsgInputRef'].scrollIntoView(true)
          }
        } catch (ignore) { }
      }
      setTimeout(() => {
        this.$nextTick(() => {
          iosSpecialProcess()
          if (this.$refs['userMsgInputRef']) {
            this.$refs['userMsgInputRef'].focus()
          }
        })
      }, 1000)
    },
    rejectNextMsg(message, resolveKeyTexts = [], rejectKeyTexts = []) {
      const trimmed = message.trim()
      if (rejectKeyTexts.some(key => trimmed.includes(key))) return true
      if (resolveKeyTexts.some(key => trimmed.includes(key))) return false
      return true
    },
    pushMsg(message, author, type = 'text', externalId = null, quoteId = null) {
      this.msgIdCounter++
      const msg = {
        id: this.msgIdCounter,
        author,
        content: message,
        type,
        props: this.getProps(message, type),
        transcripted: false,
        transcriptMsgId: null,
        externalId,
        quoteId,
        quoteInfo: null,
        isTranscript: false
      }

      if (quoteId) {
        const quotedMsg = this.messages.find(m => m.id === quoteId)
        if (quotedMsg) {
          msg.quoteInfo = {
            authorName: this.getRoleInfo(quotedMsg.author).name || '未知',
            contentPreview: this.getContentPreview(quotedMsg)
          }
        } else {
          msg.quoteInfo = {
            authorName: '未知',
            contentPreview: '[消息已撤回]'
          }
        }
      }

      this.messages.push(msg)
      this.scrollToBottom(false)
      return msg
    },
    getContentPreview(msg) {
      const { type, content } = msg
      switch (type) {
        case 'text':
          const plainText = content.replace(/<[^>]+>/g, '').trim()
          return plainText.length > 30 ? plainText.slice(0, 30) + '...' : plainText
        case 'img': return '[图片]'
        case 'voice': return '[语音]'
        case 'vlog': return '[视频]'
        case 'letter': return '[信件]'
        default: return '[消息]'
      }
    },
    getProps(message, type) {
      const props = {}
      if (type === 'text') return props
      const domParse = new DOMParser()
      const messageDoc = domParse.parseFromString(message, 'text/html')
      const messageDoms = messageDoc.getElementsByTagName(type)
      if (messageDoms.length === 1) {
        const messageDom = messageDoms[0]
        const attrs = messageDom.getAttributeNames()
        attrs.forEach(attrName => props[attrName] = messageDom.getAttribute(attrName))
      }
      return props
    },
    getMsgType(message) {
      const isImg = /<img[^>]+>/.test(message)
      const isLetter = /<letter[^>]+>/.test(message)
      const isVlog = /<vlog[^>]+>/.test(message)
      const isVoice = /<voice[^>]+>/.test(message)
      if (isImg) return 'img'
      if (isLetter) return 'letter'
      if (isVlog) return 'vlog'
      if (isVoice) return 'voice'
      return 'text'
    },
    markMsgSize(msg, content = null) {
      this.latestMsgContent = content || msg.content
      return delay(0)
        .then(() => msg.type === 'img' && onImageLoad($('#mock-msg img')))
        .then(() => {
          Object.assign(msg, getMockMsgSize())
          this.messages = [...this.messages]
        })
    },
    autoResizeTextarea(e) {
      const el = e.target
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
      el.scrollTop = el.scrollHeight
      this.$nextTick(() => {
        const foot = document.getElementById('mobile-foot')
        if (foot) this.footHeight = foot.offsetHeight
        requestAnimationFrame(() => {
          const container = document.getElementById('mobile-body-content')
          if (container) {
            container.scrollTop = container.scrollHeight
          }
          el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        })
      })
    },
    updateTime() {
      const now = new Date()
      const h = String(now.getHours()).padStart(2, '0')
      const m = String(now.getMinutes()).padStart(2, '0')
      this.currentTime = h + ':' + m
    },
    handleMenuClick() { },
    handleMoreClick() { },

    scrollToBottom(force = true) {
      if (!force) return
      this.$nextTick(() => {
        const container = document.getElementById('mobile-body-content')
        if (container) {
          container.scrollTop = container.scrollHeight
        }
      })
    },

    handleVoiceConvert(alt, originalMsg) {
      if (!alt) return
      if (originalMsg.transcripted) {
        this.handleVoiceCancel(originalMsg)
        return
      }
      const transcriptMsg = {
        id: ++this.msgIdCounter,
        type: 'text',
        content: alt,
        author: originalMsg.author,
        isTranscript: true,
        transcripted: false
      }
      const index = this.messages.indexOf(originalMsg)
      if (index === -1) return
      this.messages.splice(index + 1, 0, transcriptMsg)
      originalMsg.transcripted = true
      originalMsg.transcriptMsgId = transcriptMsg.id
    },
    handleVoiceCancel(originalMsg) {
      if (!originalMsg.transcripted) return
      const transcriptId = originalMsg.transcriptMsgId
      if (transcriptId === null) return
      const idx = this.messages.findIndex(m => m.id === transcriptId)
      if (idx !== -1) {
        this.messages.splice(idx, 1)
      }
      originalMsg.transcripted = false
      originalMsg.transcriptMsgId = null
    },

    getEmojiPath(name) {
      const rawPath = originalGetEmojiPath(name)
      if (!rawPath) return null
      const relativePath = rawPath.replace(/^assets\//, '')
      return "https://cdn.jsdmirror.com/gh/DyWriteCode/DyWriteCode.github.io@latest/birthday/zhongsinger/2026/assets/WeChat/" + relativePath
    },
    toggleEmojiPicker() {
      this.showEmojiPicker = !this.showEmojiPicker
      if (this.showEmojiPicker) {
        this.$nextTick(() => {
          this.$refs.userMsgInputRef?.focus()
        })
      }
    },
    selectEmoji(emoji) {
      const textarea = this.$refs.userMsgInputRef
      if (!textarea) return
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const before = this.inputMessage.substring(0, start)
      const after = this.inputMessage.substring(end)
      this.inputMessage = before + `[${emoji.name}]` + after

      this.$nextTick(() => {
        const newPos = start + emoji.name.length + 2
        textarea.selectionStart = newPos
        textarea.selectionEnd = newPos
        textarea.focus()
        this.autoResizeTextarea({ target: textarea })
      })
      this.showEmojiPicker = false
    },
    renderEmoji(text) {
      if (!text) return ''
      return text.replace(/\[([^\]]+)\]/g, (match, name) => {
        if (hasEmoji(name)) {
          const path = this.getEmojiPath(name)
          if (path) {
            const cleanPath = path.replace(/^\/+/, '')
            return `<img src="${cleanPath}" class="inline-emoji" alt="${name}" />`
          }
        }
        return match
      })
    },
    closeEmojiPicker(e) {
      const container = this.$refs.mobileRef
      if (!container) return
      const picker = container.querySelector('.emoji-picker-wrapper')
      const btn = container.querySelector('.emoji-toggle-btn')
      if (this.showEmojiPicker && picker && !picker.contains(e.target) && !btn?.contains(e.target)) {
        this.showEmojiPicker = false
      }
    },

    toggleVoiceInputMode() {
      this.voiceInputMode = !this.voiceInputMode
      if (this.voiceInputMode) {
        this.showEmojiPicker = false
        if (this.userVoiceActive) {
          this.cancelUserRecording()
        }
      }
    },

    startUserRecording() {
      if (this.userVoiceTimer) {
        clearInterval(this.userVoiceTimer)
        this.userVoiceTimer = null
      }
      this.userVoiceActive = true
      this.userVoiceDuration = 0
      this.userVoiceCancelActive = false
      this.userVoiceRecording = true
      this.pendingVoiceResult = null
      this.voiceStopReceived = false

      const startTime = Date.now()
      this.userVoiceTimer = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000
        this.userVoiceDuration = Math.floor(elapsed)
      }, 100)
    },

    onVoiceStop() {
      this.voiceStopReceived = true
      this.isProcessing = false
      this.clearUserVoiceTimer()
    },

    stopUserRecording() {
      if (this.userVoiceTimer) {
        clearInterval(this.userVoiceTimer)
        this.userVoiceTimer = null
      }
      this.userVoiceActive = false
      this.userVoiceRecording = false
    },

    cancelUserRecording() {
      this.isProcessing = false
      this.userVoiceCancelActive = true
      this.clearUserVoiceTimer()
      setTimeout(() => {
        if (this.userVoiceTimer) {
          clearInterval(this.userVoiceTimer)
          this.userVoiceTimer = null
        }
        this.userVoiceActive = false
        this.userVoiceRecording = false
        this.userVoiceCancelActive = false
        if (this.$refs.voiceRecorderRef) {
          this.$refs.voiceRecorderRef.cancelRecording()
        }
      }, 300)
    },

    sendUserRecording() {
      if (this.isProcessing) return
      this.clearUserVoiceTimer()
      if (this.$refs.voiceRecorderRef) {
        this.$refs.voiceRecorderRef.sendRecording()
      }
    },

    clearUserVoiceTimer() {
      if (this.userVoiceTimer) {
        clearInterval(this.userVoiceTimer)
        this.userVoiceTimer = null
      }
    },

    handleVoiceError() {
      this.isProcessing = false
      this.stopUserRecording()
      this.voiceInputMode = false
      Snackbar({
        content: '无法访问麦克风，请检查权限',
        duration: 2000,
        type: 'error'
      })
    },

    handleUserVoiceResult(result) {
      this.isProcessing = false
      this.pendingVoiceResult = result
      this.stopUserRecording()

      const text = result.text.trim()
      if (!text) {
        Snackbar({
          content: '没听清，请再说一遍',
          duration: 1500,
          type: 'warning'
        })
        if (this.nextActionTrigger) {
          this.status = TRIGGER_NEXT_ACTION_TYPE.USER_INPUT
        }
        return
      }

      let audioUrl = null
      if (result.blob) {
        audioUrl = URL.createObjectURL(result.blob)
        this.voiceBlobUrls.push(audioUrl)
      } else {
        audioUrl = result.url
      }

      const voiceMsg = {
        src: audioUrl,
        alt: text,
        delay: 0,
      }
      const msg = this.pushMsg('', AUTHOR.ME, 'voice', null, null)
      msg.props = voiceMsg
      msg.content = ''

      if (this.nextActionTrigger) {
        const { triggerNextAction, inputSpeed, tryCnt = 0 } = this.nextActionTrigger
        const { type, options } = triggerNextAction
        if (type === TRIGGER_NEXT_ACTION_TYPE.USER_INPUT) {
          if (this.rejectNextMsg(text, options.resolveKeyTexts, options.rejectKeyTexts)) {
            const rejectDisabled = tryCnt >= options.rejectHitTexts.length
            const rejectIndex = Math.min(tryCnt, options.rejectHitTexts.length - 1)
            const rejectText = options.rejectHitTexts[rejectIndex]
            let rejectSysMsgChain = Promise.resolve()
            if (Array.isArray(rejectText)) {
              rejectText.forEach(text => {
                rejectSysMsgChain = rejectSysMsgChain
                  .then(() => this.sendSysMsg({ msgs: [text], msgInputSpeed: inputSpeed }))
              })
            } else {
              rejectSysMsgChain = this.sendSysMsg({ msgs: [rejectText], msgInputSpeed: inputSpeed })
            }
            rejectSysMsgChain.then(() => {
              if (rejectDisabled) {
                this.handleTriggerNextAction()
              } else {
                this.status = TRIGGER_NEXT_ACTION_TYPE.USER_INPUT
              }
            })
            this.nextActionTrigger.tryCnt = tryCnt + 1
          } else {
            this.handleTriggerNextAction()
          }
        }
      }
    },

    onVoiceProcessing() {
      this.isProcessing = true
    },

    // ----- 引用方法 -----
    openMsgContextMenu(msg, event) {
      if (msg.type === 'tip') return
      this.contextMsg = msg
      // 防御性获取元素：优先使用 currentTarget，若为空则使用 target 或 srcElement
      let targetEl = event.currentTarget
      if (!targetEl) {
        targetEl = event.target || event.srcElement
      }
      if (!targetEl) {
        targetEl = document.querySelector(`.msg-row[data-msg-id="${msg.id}"]`)
      }
      if (!targetEl) {
        targetEl = this.$refs.mobileRef
      }

      let rect = null
      if (targetEl) {
        rect = targetEl.getBoundingClientRect()
      }
      let left = event.clientX || (rect ? rect.left + rect.width / 2 : window.innerWidth / 2)
      let top = event.clientY || (rect ? rect.top : window.innerHeight / 2)

      const menuWidth = 130
      const menuHeight = 80
      const winWidth = window.innerWidth
      const winHeight = window.innerHeight

      if (left + menuWidth > winWidth - 10) left = winWidth - menuWidth - 10
      if (left < 10) left = 10
      if (top + menuHeight > winHeight - 10) top = (rect ? rect.top : 0) - menuHeight - 8
      if (top < 10) top = 10

      this.msgMenuStyle = {
        ...this.msgMenuStyle,
        left: left + 'px',
        top: top + 'px'
      }
      this.showMsgMenu = true
    },

    handleMenuQuote() {
      if (!this.contextMsg) return
      this.quoteMsg = this.contextMsg
      this.showQuoteBar = true
      this.closeMsgMenu()
      this.$nextTick(() => {
        if (this.$refs.userMsgInputRef) {
          this.$refs.userMsgInputRef.focus()
        }
      })
    },

    closeMsgMenu() {
      this.showMsgMenu = false
      this.contextMsg = null
    },

    clearQuote() {
      // 重置数据
      this.quoteMsg = null
      this.showQuoteBar = false
      // 强制更新视图
      this.$forceUpdate()
      // 直接操作 DOM 隐藏引用条（确保视觉移除）
      const el = this.$refs.quoteBarRef
      if (el) {
        el.style.display = 'none'
        // 彻底移除占位空间
        el.style.height = '0'
        el.style.padding = '0'
        el.style.margin = '0'
        el.style.overflow = 'hidden'
        el.style.border = 'none'
      }
      // 额外通过类名查找隐藏（防止 ref 未更新）
      const quoteBarEl = document.querySelector('.quote-bar')
      if (quoteBarEl && quoteBarEl.parentNode === document.getElementById('mobile-foot')) {
        quoteBarEl.style.display = 'none'
        quoteBarEl.style.height = '0'
        quoteBarEl.style.padding = '0'
        quoteBarEl.style.margin = '0'
        quoteBarEl.style.overflow = 'hidden'
        quoteBarEl.style.border = 'none'
      }
      // 重新计算底部高度并滚动
      this.$nextTick(() => {
        const foot = document.getElementById('mobile-foot')
        if (foot) {
          this.footHeight = foot.offsetHeight
        }
        const container = document.getElementById('mobile-body-content')
        if (container) {
          container.scrollTop = container.scrollHeight
        }
      })
    },

    onMsgTouchStart(msg, event) {
      if (msg.type === 'tip') return
      this.isTouchMoved = false
      this.touchTimer = setTimeout(() => {
        this.openMsgContextMenu(msg, event)
        event.preventDefault()
        this.touchTimer = null
      }, 500)
    },

    onMsgTouchEnd() {
      if (this.touchTimer) {
        clearTimeout(this.touchTimer)
        this.touchTimer = null
      }
    },

    onMsgTouchMove() {
      this.isTouchMoved = true
      if (this.touchTimer) {
        clearTimeout(this.touchTimer)
        this.touchTimer = null
      }
    },

    closeMsgMenuOnClickOutside(e) {
      if (this.showMsgMenu) {
        const menuEl = this.$refs.msgMenuRef
        if (menuEl && !menuEl.contains(e.target)) {
          this.closeMsgMenu()
        }
      }
    }
  },
  mounted() {
    this.updateTime()
    setInterval(this.updateTime, 60000)
    this.$nextTick(() => {
      const body = document.getElementById('mobile-body')
      if (body) body.style.top = this.headHeight + 'px'
    })
    setTimeout(() => {
      const foot = document.getElementById('mobile-foot')
      if (foot) this.footHeight = foot.offsetHeight
    }, 100)
    this._boundCloseEmojiPicker = this.closeEmojiPicker.bind(this)
    document.addEventListener('click', this._boundCloseEmojiPicker)

    this._boundCloseMsgMenu = this.closeMsgMenuOnClickOutside.bind(this)
    document.addEventListener('click', this._boundCloseMsgMenu)

    if (!window.__audioManager) {
      window.__audioManager = {
        currentId: null,
        currentAudio: null,
        registered: {},

        register(id, resetFn) {
          this.registered[id] = resetFn
        },
        unregister(id) {
          delete this.registered[id]
          if (this.currentId === id) {
            this.currentId = null
            this.currentAudio = null
          }
        },
        play(id, audioEl) {
          if (this.currentId !== null && this.currentId !== id) {
            const resetFn = this.registered[this.currentId]
            if (resetFn) {
              resetFn()
            }
            if (this.currentAudio && this.currentAudio !== audioEl) {
              this.currentAudio.pause()
              this.currentAudio.currentTime = 0
            }
          }
          this.currentId = id
          this.currentAudio = audioEl
        }
      }
    }
  },
  beforeUnmount() {
    if (this.typingInstance) {
      this.typingInstance.stop()
      this.typingInstance = null
    }
    if (this.recallTimers) {
      this.recallTimers.forEach(timer => clearTimeout(timer))
      this.recallTimers = []
    }
    if (this.voiceInputTimer) {
      clearInterval(this.voiceInputTimer)
      this.voiceInputTimer = null
    }
    if (this.voicePushTimer) {
      clearTimeout(this.voicePushTimer)
      this.voicePushTimer = null
    }
    if (this.autoCancelTimer) {
      clearTimeout(this.autoCancelTimer)
      this.autoCancelTimer = null
    }
    if (this.voiceResolve) {
      this.voiceResolve = null
    }
    this.clearUserVoiceTimer()
    document.removeEventListener('click', this._boundCloseEmojiPicker)
    document.removeEventListener('click', this._boundCloseMsgMenu)

    this.voiceBlobUrls.forEach(url => URL.revokeObjectURL(url))
    this.voiceBlobUrls = []
    this.clearQuote()
    this.closeMsgMenu()
  }
}

function delay(amount = 0) {
  return new Promise(resolve => setTimeout(resolve, amount))
}

function getMockMsgSize() {
  const $mockMsg = $('#mock-msg')
  return {
    width: $mockMsg.width(),
    height: $mockMsg.height()
  }
}

function onImageLoad($img) {
  return new Promise(resolve => {
    $img.one('load', resolve).each((index, target) => {
      target.complete && $(target).trigger('load')
    })
  })
}
</script>

<style scoped></style>

<style>
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
  position: relative;
  z-index: 5;  /* 低于引用条 */
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
  gap: 8px;
  overflow: visible;
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
  white-space: pre-wrap;
  word-wrap: break-word;
}

#mobile-foot .send-btn {
  flex: 0 0 auto;
  height: 36px;
  align-self: flex-end;
}

.voice-toggle-btn {
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #e8e8e8;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 20px;
  color: #555;
  transition: background 0.2s, color 0.2s;
}

.voice-toggle-btn:hover {
  background: #d0d0d0;
}

.voice-toggle-btn.active {
  background: #22c3aa;
  color: white;
}

.voice-recorder-button {
  padding: 6px 0 !important;
}

.voice-recorder-button .recorder-btn {
  height: 32px !important;
  padding: 4px 16px !important;
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

.voice-input-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  pointer-events: none;
}

.system-voice-overlay {
  z-index: 500;
}

.user-voice-overlay {
  z-index: 600;
}

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
}

.voice-bottom-area {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 150px;
  background: rgba(200, 200, 200, 0.7);
  border-radius: 50% 50% 0 0 / 100% 100% 0 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  padding-bottom: 30px;
  pointer-events: auto;
  gap: 40px;
}

.voice-bottom-area-with-send {
  justify-content: center;
  gap: 60px;
}

.voice-cancel-btn,
.voice-send-btn {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 500;
  color: #333;
  background: rgba(220, 220, 220, 0.95);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
  user-select: none;
  cursor: pointer;
  transition: background 0.3s, color 0.3s;
}

.voice-cancel-btn.cancel-active {
  background: #e05555;
  color: white;
}

.voice-send-btn {
  background: #22c3aa;
  color: white;
}

.voice-send-btn:hover {
  background: #1aa08b;
}

.voice-cancel-btn:hover {
  background: #c0c0c0;
}

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

.msg-transcript {
  display: flex;
  justify-content: flex-start;
  margin-bottom: 4px;
  padding-left: 0;
  padding-right: 0;
  width: 100%;
}

.msg-transcript-right {
  justify-content: flex-end;
}

.msg-transcript .msg {
  max-width: 80%;
  word-wrap: break-word;
  white-space: pre-wrap;
  background: #e8e8e8;
  color: #333;
  border-radius: 4px;
  padding: 4px 12px;
  font-size: 13px;
  height: auto !important;
}

.msg-avatar-placeholder {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  margin: 0 8px;
  visibility: hidden;
}

/* 所有消息气泡强制换行 */
.msg {
  max-width: 100% !important;
  word-break: break-word;
  white-space: pre-wrap;
  word-wrap: break-word;
}

/* 消息内部的引用信息自动换行 */
.msg-quote .quote-text {
  white-space: normal;
  word-wrap: break-word;
  overflow: visible;
  max-height: none;
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

/* ----- 引用框样式（消息内部）----- */
.msg-quote {
  display: flex;
  align-items: center;
  background: #f0f0f0 !important;
  border-radius: 4px;
  padding: 4px 8px;
  margin-bottom: 4px;
  font-size: 12px;
  color: #333 !important;
  max-width: 100%;
  box-sizing: border-box;
  min-height: 24px;
  white-space: normal !important;
  word-wrap: break-word !important;
  max-height: 3.2em;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  line-height: 1.4 !important;
}

.msg-quote .quote-line {
  width: 3px;
  background: #c0c0c0;
  border-radius: 2px;
  height: 20px;
  margin-right: 6px;
  flex-shrink: 0;
}

.msg-quote .quote-author {
  font-weight: 500;
  color: #333 !important;
  margin-right: 4px;
  white-space: nowrap;
}

.msg-quote .quote-text {
  white-space: normal;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
  color: #333 !important;
  word-wrap: break-word;
}

.msg-me .msg-quote {
  background: rgba(255, 255, 255, 0.3) !important;
  color: #333 !important;
}

.msg-me .msg-quote .quote-line {
  background: rgba(255, 255, 255, 0.6) !important;
}

.msg-me .msg-quote .quote-author,
.msg-me .msg-quote .quote-text {
  color: #333 !important;
}

/* ----- 引用条（输入框上方）----- */
.quote-bar {
  position: relative;
  z-index: 20;  /* 高于输入区域 */
  pointer-events: auto !important;
  background: #f0f0f0 !important;
  padding: 4px 12px !important;
  border-bottom: 1px solid #ddd !important;
  min-height: 32px !important;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-sizing: border-box;
}

.quote-bar-content {
  flex: 1;
  overflow: hidden;
  word-wrap: break-word;
  white-space: normal;
  max-height: 40px;
  line-height: 1.4;
  min-width: 0;
  word-break: break-word;
}

.quote-bar-author {
  font-weight: bold;
  margin-right: 6px;
  color: #22c3aa !important;
}

.quote-bar-text {
  color: #555 !important;
  word-break: break-word;
}

.quote-bar-close {
  pointer-events: auto !important;
  cursor: pointer;
  padding: 6px 14px;   /* 增大点击区域 */
  font-size: 20px;
  color: #999;
  user-select: none;
  flex-shrink: 0;
  transition: color 0.2s;
  z-index: 30;
  line-height: 1;
}

.quote-bar-close:hover {
  color: #333;
}
</style>