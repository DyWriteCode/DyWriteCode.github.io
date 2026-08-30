<template>
  <div class="letter-content">
    <div class="letter-title">{{ titleDisplay }}</div>

    <div class="letter-detail" ref="detailContainer">
      <div class="letter-detail-inner">
        <div v-for="item in contents" :key="item.id" class="paragraph-wrapper">
          <div v-if="item.type === 'img' && item.visible" style="text-align: center">
            <span v-html="item.content"></span>
          </div>

          <div v-else-if="item.type === 'text' && item.visible"
            style="color: black; white-space: pre-wrap; word-break: break-word; min-height: 2rem;">
            <!-- ★ HTML 段落：使用块级 div，应用缩进 -->
            <div v-if="item.isHtml" class="html-content" v-html="item.displayText"></div>
            <!-- 纯文本段落 -->
            <p v-else style="margin:0; color:black; white-space: pre-wrap; word-break: break-word;">
              {{ item.displayText }}
              <span v-if="item.isTyping" class="cursor">|</span>
            </p>
          </div>
        </div>

        <div class="finish-action" v-show="finish" @click="$emit('close')">
          <var-icon name="chevron-left" />
          <text>回到聊天页</text>
        </div>
      </div>
    </div>

    <div class="letter-action">
      <var-icon name="window-close" style="font-size: 25px;" @click="$emit('close')" />
    </div>
    <var-back-top style="z-index: 2000;" :duration="300" />
  </div>
</template>

<script>
let idCounter = 0;

export default {
  props: {
    title: String,
    paragraphs: Array,
    speed: Number,
  },
  data() {
    return {
      contents: [],
      finish: false,
      _initialized: false,
      titleDisplay: '',
      _currentIndex: 0,
      isUserAtBottom: false,
      _typingLock: false,
      _resizeObserver: null,
      _lastWidth: 0,
      _lastHeight: 0,
      _stableCheckTimer: null,
      _initPending: false,
    };
  },
  watch: {
    paragraphs: {
      handler(newVal) {
        if (newVal && newVal.length > 0 && !this._initialized && !this._initPending) {
          this.waitForStableLayout();
        }
      },
      immediate: true,
    },
  },
  mounted() {
    const container = this.$refs.detailContainer;
    if (container) {
      container.addEventListener('scroll', this.onScroll);
      this.isUserAtBottom = false;

      this._resizeObserver = new ResizeObserver(() => {
        this.checkStability();
      });
      this._resizeObserver.observe(container);
    }

    if (this.paragraphs && this.paragraphs.length > 0 && !this._initialized && !this._initPending) {
      this.waitForStableLayout();
    }
  },
  beforeUnmount() {
    const container = this.$refs.detailContainer;
    if (container) {
      container.removeEventListener('scroll', this.onScroll);
    }
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
    clearTimeout(this._stableCheckTimer);
  },
  methods: {
    waitForStableLayout() {
      if (this._initPending) return;
      this._initPending = true;
      this._lastWidth = 0;
      this._lastHeight = 0;
      this.$nextTick(() => {
        this.checkStability();
      });
    },

    checkStability() {
      const container = this.$refs.detailContainer;
      if (!container) return;
      const { clientWidth, scrollHeight } = container;
      const currentWidth = clientWidth;
      const currentHeight = scrollHeight;

      if (currentWidth !== this._lastWidth || currentHeight !== this._lastHeight) {
        this._lastWidth = currentWidth;
        this._lastHeight = currentHeight;
        clearTimeout(this._stableCheckTimer);
        this._stableCheckTimer = setTimeout(() => {
          const newWidth = container.clientWidth;
          const newHeight = container.scrollHeight;
          if (newWidth === this._lastWidth && newHeight === this._lastHeight) {
            this._stableCheckTimer = null;
            this.initContent();
          } else {
            this._lastWidth = newWidth;
            this._lastHeight = newHeight;
            this.checkStability();
          }
        }, 50);
      } else {
        clearTimeout(this._stableCheckTimer);
        this._stableCheckTimer = null;
        this.initContent();
      }
    },

    checkIfAtBottom() {
      const container = this.$refs.detailContainer;
      if (!container) return true;
      const { scrollTop, clientHeight, scrollHeight } = container;
      return scrollHeight - scrollTop - clientHeight < 50;
    },
    onScroll() {
      this.isUserAtBottom = this.checkIfAtBottom();
    },
    scrollToBottom() {
      if (!this.isUserAtBottom) return;
      const container = this.$refs.detailContainer;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    },

    async initContent() {
      if (this._initialized) return;
      if (!this.paragraphs || this.paragraphs.length === 0) return;

      this._initialized = true;
      this._initPending = false;
      this.contents = [];

      this.paragraphs.forEach((p) => {
        const isImg = /<img[^>]+>/.test(p);
        const isHtml = !isImg && /<\/?[a-z][\s\S]*>/i.test(p);
        this.contents.push({
          id: idCounter++,
          type: isImg ? 'img' : 'text',
          content: p,
          fullText: isImg ? '' : p,
          isHtml: isHtml,
          visible: false,
          displayText: '',
          isTyping: false,
          done: false,
        });
      });

      this.titleDisplay = this.title || '无标题';
      await this.$nextTick();

      const container = this.$refs.detailContainer;
      if (container) container.scrollTop = 0;
      this.isUserAtBottom = false;

      this._currentIndex = 0;
      this.processNext();
    },

    processNext() {
      if (this._typingLock) return;

      if (this._currentIndex >= this.contents.length) {
        this.finish = true;
        return;
      }

      const item = this.contents[this._currentIndex];

      if (item.type === 'img') {
        item.visible = true;
        this._currentIndex++;
        this.$nextTick(() => this.scrollToBottom());
        this.processNext();
      } else if (item.type === 'text') {
        item.visible = true;
        this.typeParagraph(item);
      }
    },

    parseHtmlTokens(text) {
      const tokens = [];
      let i = 0;
      while (i < text.length) {
        if (text[i] === '^') {
          let numStr = '';
          let j = i + 1;
          while (j < text.length && /\d/.test(text[j])) {
            numStr += text[j];
            j++;
          }
          if (numStr) {
            tokens.push({ type: 'delay', ms: parseInt(numStr, 10) });
            i = j;
            continue;
          } else {
            tokens.push({ type: 'text', value: text[i] });
            i++;
            continue;
          }
        }

        if (text[i] === '<') {
          let tag = '';
          let j = i;
          while (j < text.length && text[j] !== '>') {
            tag += text[j];
            j++;
          }
          if (j < text.length && text[j] === '>') {
            tag += '>';
            tokens.push({ type: 'tag', value: tag });
            i = j + 1;
            continue;
          } else {
            tokens.push({ type: 'text', value: text[i] });
            i++;
          }
        } else {
          tokens.push({ type: 'text', value: text[i] });
          i++;
        }
      }
      return tokens;
    },

    async typeParagraph(item) {
      if (this._typingLock) return;
      this._typingLock = true;

      this.contents.forEach(p => (p.isTyping = false));

      const fullText = item.fullText;
      const tokens = this.parseHtmlTokens(fullText);

      item.displayText = '';
      item.isTyping = true;
      item.done = false;

      const speed = this.speed || 80;

      try {
        for (let idx = 0; idx < tokens.length; idx++) {
          const token = tokens[idx];
          if (token.type === 'text') {
            let textToAdd = token.value;
            if (item.isHtml) {
              textToAdd = textToAdd.replace(/\n/g, '<br>');
            }
            item.displayText += textToAdd;
            this.scrollToBottom();
            await this.delay(speed);
          } else if (token.type === 'tag') {
            item.displayText += token.value;
            this.scrollToBottom();
            await this.delay(15);
          } else if (token.type === 'delay') {
            await this.delay(token.ms);
          }
        }
      } catch (err) {
        console.warn('打字过程出错:', err);
      } finally {
        item.isTyping = false;
        item.done = true;
        this._currentIndex++;
        this.$nextTick(() => this.scrollToBottom());
        this._typingLock = false;
        this.processNext();
      }
    },

    delay(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    },
  },
};
</script>

<style>
/* ========== 字体本地化 ========== */
@font-face {
  font-family: 'Lato';
  src: url('../css/font/lato400.woff') format('woff');
  font-weight: 400;
  font-style: normal;
}

@font-face {
  font-family: 'Lato';
  src: url('../css/font/lato400.woff') format('woff');
  font-weight: 700;
  font-style: normal;
}

.letter-content {
  font-family: '楷体', 'KaiTi', 'STKaiti', '华文楷体', 'Georgia', 'Times New Roman', serif !important;
  font-size: 16px;
  color: black !important;
  background-color: #f9f9f9;
  padding: 15px 32px 29px;
  min-height: 100vh;
  box-sizing: border-box;
}

/* 所有子元素默认继承字号，允许内联样式覆盖 */
.letter-content * {
  font-size: inherit;
}

.letter-title {
  font-size: 1.25rem;
  margin: 15px 0;
  text-align: center;
  color: black !important;
}

.letter-detail {
  position: relative;
  height: 70vh;
  min-height: 70vh;
  overflow-y: scroll;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  scrollbar-gutter: stable;
  padding-right: 6px;
  box-sizing: border-box;
}

.letter-detail-inner {
  position: relative;
  z-index: 1;
  min-height: 100%;
  padding: 10px 0;
  background: repeating-linear-gradient(to bottom,
      #f9f9f9,
      #f9f9f9 31px,
      #d46466 2px,
      #f9f9f9);
  background-size: 100% 32px;
  background-repeat: repeat-y;
}

/* 纯文本段落 */
.letter-detail-inner p {
  line-height: 2rem !important;
  text-indent: 2em;
  color: black !important;
  display: block !important;
  opacity: 1 !important;
  margin: 0 !important;
  white-space: pre-wrap;
  word-break: break-word;
}

/* ★ HTML 段落容器：块级，首行缩进，保持与纯文本一致 */
.html-content {
  display: block;
  text-indent: 2em;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 2rem;
}

.letter-detail {
  scrollbar-width: thin;
  scrollbar-color: #d46466 #f9f9f9;
}

.letter-detail::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.letter-detail::-webkit-scrollbar-track {
  background: #f9f9f9;
  border-radius: 3px;
}

.letter-detail::-webkit-scrollbar-thumb {
  background: #d46466;
  border-radius: 3px;
}

.letter-detail::-webkit-scrollbar-thumb:hover {
  background: #b84a4c;
}

.letter-action {
  position: absolute;
  top: 10px;
  right: 20px;
  color: red;
}

.finish-action {
  float: right;
  margin-top: 30px;
  color: red;
  cursor: pointer;
}

.cursor {
  display: inline;
  font-size: inherit;
  font-weight: normal;
  background: transparent;
  color: black;
  animation: blink 0.7s step-end infinite;
  vertical-align: baseline;
  margin-left: 1px;
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
</style>