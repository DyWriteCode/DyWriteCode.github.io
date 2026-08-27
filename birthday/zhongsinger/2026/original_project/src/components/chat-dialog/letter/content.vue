<template>
  <div class="letter-content">
    <div class="letter-title">{{ titleDisplay }}</div>

    <div class="letter-detail" ref="detailContainer">
      <!-- 背景横线由伪元素绘制，一次性加载 -->
      <div v-for="item in contents" :key="item.id" class="paragraph-wrapper">
        <!-- 图片段落 -->
        <div v-if="item.type === 'img' && item.visible" style="text-align: center">
          <span v-html="item.content"></span>
        </div>

        <!-- 文本段落 -->
        <p v-else-if="item.type === 'text' && item.visible"
          style="color: black; display: block; white-space: pre-wrap; word-break: break-word; min-height: 2rem;">
          {{ item.displayText }}
          <!-- 仅当前正在打字的段落显示光标 -->
          <span v-if="item.isTyping" class="cursor">|</span>
        </p>

        <!-- 隐藏占位（无实际显示） -->
        <div v-if="item.type === 'text' && !item.visible" style="visibility: hidden; height: 0;">
          {{ item.fullText }}
        </div>
      </div>

      <div class="finish-action" v-show="finish" @click="$emit('close')">
        <var-icon name="chevron-left" />
        <text>回到聊天页</text>
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
      isUserAtBottom: true,
      _typingLock: false, // 互斥锁，防止并发打字
    };
  },
  watch: {
    paragraphs: {
      handler(newVal) {
        if (newVal && newVal.length > 0 && !this._initialized) {
          this.initContent();
        }
      },
      immediate: true,
    },
  },
  mounted() {
    const container = this.$refs.detailContainer;
    if (container) {
      container.addEventListener('scroll', this.onScroll);
      this.isUserAtBottom = this.checkIfAtBottom();
    }
  },
  beforeUnmount() {
    const container = this.$refs.detailContainer;
    if (container) {
      container.removeEventListener('scroll', this.onScroll);
    }
  },
  methods: {
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
      this.contents = [];

      this.paragraphs.forEach((p) => {
        const isImg = /<img[^>]+>/.test(p);
        this.contents.push({
          id: idCounter++, // 唯一ID，用于v-for的key
          type: isImg ? 'img' : 'text',
          content: p,
          fullText: isImg ? '' : p,
          visible: false,
          displayText: '',
          isTyping: false,
          done: false,
        });
      });

      this.titleDisplay = this.title || '无标题';
      await this.$nextTick();

      // 预占位（使所有文本段落可见，但内容为空）
      for (const item of this.contents) {
        if (item.type === 'text') {
          item.visible = true;
          item.displayText = '';
        }
      }
      await this.$nextTick();

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
        this.typeParagraph(item);
      }
    },

    async typeParagraph(item) {
      if (this._typingLock) return;
      this._typingLock = true;

      // 清除所有段落的打字状态（避免残留）
      this.contents.forEach(p => p.isTyping = false);

      const fullText = item.fullText;
      const tokens = this.parseTextWithDelays(fullText);

      item.displayText = '';
      item.visible = true;
      item.isTyping = true;
      item.done = false;

      try {
        for (let i = 0; i < tokens.length; i++) {
          const token = tokens[i];
          if (token.type === 'char') {
            item.displayText += token.char;
            this.scrollToBottom();
            await this.delay(this.speed || 80);
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

    parseTextWithDelays(text) {
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
            tokens.push({ type: 'char', char: text[i] });
            i++;
          }
        } else {
          tokens.push({ type: 'char', char: text[i] });
          i++;
        }
      }
      return tokens;
    },

    delay(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    },
  },
};
</script>

<style scoped>
.letter-content {
  color: black !important;
  background-color: #f9f9f9;
  padding: 15px 32px 29px;
  min-height: 100vh;
  font-family: "Architects Daughter", cursive !important;
  box-sizing: border-box;
}

.letter-title {
  font-size: 1.25rem;
  margin: 15px 0;
  text-align: center;
  color: black !important;
}

.letter-detail {
  position: relative;
  min-height: 70vh;
  background: transparent;
  padding: 10px 0;
  max-height: 70vh;
  overflow-y: auto;
  overflow-x: hidden;
}

/* 伪元素绘制完整横线背景，一次性加载 */
.letter-detail::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 0;
  background: repeating-linear-gradient(to bottom,
      #f9f9f9,
      #f9f9f9 31px,
      #d46466 2px,
      #f9f9f9);
  background-size: 100% 32px;
  pointer-events: none;
}

/* 所有内容层置于伪元素之上 */
.letter-detail>* {
  position: relative;
  z-index: 1;
}

.letter-detail p {
  line-height: 2rem !important;
  text-indent: 2em;
  font-size: 1rem !important;
  color: black !important;
  display: block !important;
  opacity: 1 !important;
  margin: 0 !important;
  white-space: pre-wrap;
  word-break: break-word;
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

/* 光标样式优化：内联且对齐基线，避免垂直偏移 */
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