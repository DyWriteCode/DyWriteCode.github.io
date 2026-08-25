# ✨ DyWriteCode 的个人空间 · 全栈创意工坊

> **一个以代码为笔，记录情感与思考的静态站点集合**  
> 这不是一个简单的项目仓库，而是一座由**生日祝福、青春纪念、硬核推导、自动化 DevOps** 共同构成的数字花园。

---

## 📖 目录

1. [项目哲学 · 为何而建](#-项目哲学--为何而建)
2. [全景功能导览（深度拆解）](#-全景功能导览深度拆解)
   - [🏠 首页 · 几何美学入口](#-首页--几何美学入口)
   - [🎂 Birthday 系列 · 代码里的浪漫与谜题](#-Birthday-系列-·-代码里的浪漫与谜题)
     - [2025 · 心形交互与时光走廊](#-2025-·-心形交互与时光走廊)
     - [2026 · 全栈聊天式祝福引擎](#-2026-·-全栈聊天式祝福引擎)
     - [彩蛋 · 四重加密的终极试炼](#-彩蛋-·-四重加密的终极试炼)
   - [🎓 初中毕业纪念册 · Swiper 驱动的青春蒙太奇](#-初中毕业纪念册--swiper-驱动的青春蒙太奇)
   - [📝 技术笔记 · AI短剧“发刀子”数学建模](#-技术笔记--ai短剧发刀子数学建模)
   - [🎙️ 语音实验 · Deepgram 实时流式转录](#-语音实验--deepgram-实时流式转录)
   - [📜 提交历史 · 可搜索的Git可视化面板](#-提交历史--可搜索的git可视化面板)
3. [技术栈与设计模式详解](#-技术栈与设计模式详解)
4. [自动化 DevOps 与 GitHub Actions 深度解析](#-自动化-devops-与-github-actions-深度解析)
5. [本地开发与调试指南](#-本地开发与调试指南)
6. [项目目录结构（带注释）](#-项目目录结构带注释)
7. [许可证与致谢](#-许可证与致谢)

---

## 🌱 项目哲学 · 为何而建

这个项目的核心驱动力是 **“用技术表达情感”**。

- **对朋友**：生日页并非套用模板，而是通过**对话式UI（2026版）**和**时光相册（2025版）**，模拟真实的人际交互，让远程祝福拥有温度。
- **对自我**：“丁杨的彩蛋”和“技术笔记”是个人思维训练的映射——解密游戏考验逻辑，数学建模锤炼抽象能力。
- **对技术**：项目大胆混合**静态HTML、Vue 3 SPA、Python脚本、CI/CD**，是一个典型的“全栈个人开发者”实验场。

---

## 🧭 全景功能导览（深度拆解）

### 🏠 首页 · 几何美学入口

- **布局**：采用响应式 CSS Grid（1/2/4列自适应），卡片背景为毛玻璃质感（`backdrop-filter`）。
- **交互**：
  - 悬停时，卡片背景**放大并模糊**（`transform: scale(1.05)` + `blur(4px)`），同时**浮现二维码**（仅悬停展示）。
  - 全站点击触发**涟漪特效**（`Ripple`），颜色为动态随机生成的径向渐变（青蓝/粉白/紫），增强浏览沉浸感。
- **性能**：所有资源链接均通过自动化脚本注入 `?v=timestamp`，彻底解决 CDN 缓存问题。

### 🎂 Birthday 系列 · 代码里的浪漫与谜题

####  2025 · 心形交互与时光走廊

- **心形门**：CSS 绘制的心形（`clip-path`），门环（`gate-knob`）点击后触发跳转。
- **时光走廊**（`memory.html`）：
  - 基于 **Swiper** 的纵向滚动时间轴，左右交错布局。
  - **拍一拍彩蛋**：双击任意消息气泡或头像，触发“拍一拍”抖动动画与文字提示（如“Dy 拍了拍我的脑袋”）。
  - **灯箱**：点击图片/视频缩略图，弹出全屏模态框（支持视频播放）。
- **吹蜡烛许愿**（`secret.html`）：
  - 使用 **Canvas/JS 动画** 模拟火焰跳动。
  - 点击蜡烛触发“吹灭”粒子特效（`wind-particle`），随后自动绽放五彩纸屑（Confetti）并显示祝福语。

#### 2026 · 全栈聊天式祝福引擎

> 这是一个 **伪装成聊天界面的 Vue 3 单页应用**。

- **消息驱动架构**：整个祝福流程由 `chat.json` 定义（类似于 DSL）。每条消息支持：
  - **打字机效果**（可配置速度 `msgInputSpeed`）。
  - **富媒体组件**：通过自定义标签 `<letter src="..." />`、`<vlog src="..." />`、`<voice src="..." />` 动态渲染。
  - **分支叙事**：`triggerNextAction` 支持 `userInput` 和 `componentClose`，实现简单的对话树（判断用户输入是否包含关键词）。
- **语音输入**：集成 **Deepgram** WebSocket API，支持长按录制、松开发送、上滑取消（类似微信手势）。
- **数据持久化**：使用 `window.__audioManager` 单例管理全局音频播放（确保同一时间只有一个语音消息在播放）。
- **表情系统**：内置 100+ 微信风格表情包，通过 `[微笑]` 语法替换为 `<img>`。

#### 彩蛋 · 四重加密的终极试炼

> 位于 `birthday/dingyang/egg/index.html`，这是一个**多步骤解密游戏**，需破解四层谜题才能看到最终信笺。

|    步骤    | 谜题形式          | 密钥/解法                    | 对应线索               |
| :--------: | :---------------- | :--------------------------- | :--------------------- |
| **Step 1** | 英文首字母提取    | `FRIND` → 修正为 `FRIEND`    | 文中加粗英文首字母     |
| **Step 2** | 理科/文科混合密码 | 12位学科缩写（如 `LIFE...`） | 页面中的诗句与公式线索 |
| **Step 3** | 十六进制转 ASCII  | `65 63 68 6f` → `echo`       | 书页边角的十六进制数   |
| **Step 4** | Base64 解码       | `bG92ZQ==` → `love`          | 手写笔记的密文         |

- **防暴力破解**：理科部分使用**点击顺序验证**（必须按特定顺序点击“钥匙→密语→心迹→答案”）；文科部分包含**九宫格数字推演**（基于年份与段落数）。
- **视觉反馈**：正确时触发涟漪与页面切换，错误时出现抖动（`shake` 动画）和红色提示。

### 🎓 初中毕业纪念册 · Swiper 驱动的青春蒙太奇

- **全屏滑动**：基于 Swiper 4 的垂直全屏翻页（`direction: 'vertical'`）。
- **精细化动画编排**：每个 `.item` 都绑定了 `swiper-animate-effect`（如 `fadeIn`、`rotateIn`、`zoomIn`），通过 `swiper-animate-delay` 实现错落有致的入场序列。
- **双版本结尾**：最后一页包含两套不同的致敬文案（一版致同学，一版致老师），通过复制页面实现。
- **自动播放策略**：背景音乐（`Music.mp3`）利用浏览器策略，在用户首次交互（点击/触摸）时触发 `audio.play()`。

### 📝 技术笔记 · AI短剧“发刀子”数学建模

- **推导深度**：从零构建 **12 个核心变量**（`L` 时长、`P` 情感冲击、`δ` 视觉放大等），运用**微元积分**、**朗伯 W 函数**、**逻辑斯蒂增长** 等数学工具，推导出最终的热度公式 \( H(t) \)。
- **交互式公式渲染**：页面使用 **KaTeX** 服务端渲染（`auto-render`），确保所有复杂公式（含分数、指数、分段函数）在浏览器中完美展示。
- **理论依据页**（`theory.html`）：以卡片网格形式，将模型中涉及的 **15+ 种理论**（如 Kahneman 的峰终定律、Sweller 的认知负荷理论）逐一对应解释，体现了极强的学术严谨性。

### 🎙️ 语音实验 · Deepgram 实时流式转录

- **技术原理**：通过 WebSocket 连接 Deepgram 的 `v1/listen` 端点，采用 `audio/webm;codecs=opus` 编码实时推送音频流。
- **状态机设计**：界面状态包含 `idle`、`connecting`、`connected`、`error`，通过状态点（绿/红/灰）清晰反馈。
- **临时结果与最终结果分离**：`is_final` 为 `true` 时追加到最终文本，否则显示为灰色斜体（`interim`），模拟专业转录软件的体验。

### 📜 提交历史 · 可搜索的Git可视化面板

- **自动生成**：由 `.github/workflows/update-commit-history.yml` 触发，执行 `generate_commit_history.py` 解析 `git log` 生成静态 HTML。
- **高级搜索**：支持 **字段限定搜索**（如 `author:DyAdmin`、`date:2026-08-16`）和**全局模糊搜索**，匹配项高亮显示（黄色背景）。
- **快捷操作**：键盘 `Ctrl/Cmd + F` 自动聚焦搜索框，`Enter` 跳转下一个匹配项，双击行跳转至 GitHub Commit 页面。

---

## 🧱 技术栈与设计模式详解

| 模块           | 核心技术                            | 设计模式/架构                 |
| :------------- | :---------------------------------- | :---------------------------- |
| **基础渲染**   | HTML5, CSS3, Vanilla JS             | 渐进增强、模块化 IIFE         |
| **复杂交互页** | Vue 3 (CDN), Varlet UI, Animate.css | 组件化、单向数据流            |
| **滑动/动画**  | Swiper 4, Swiper Animate            | 声明式动画绑定                |
| **数学渲染**   | KaTeX (0.16.9)                      | 服务端预渲染 + 客户端自动渲染 |
| **语音识别**   | Deepgram WebSocket API              | 事件驱动、发布-订阅           |
| **自动化脚本** | Python 3 (正则、Pathlib)            | 管道模式（读取→处理→写入）    |
| **CI/CD**      | GitHub Actions (YAML)               | 事件触发、原子提交            |
| **版本管理**   | Git + `version.json`                | 缓存破坏策略（Cache Busting） |

---

## 🤖 自动化 DevOps 与 GitHub Actions 深度解析

项目包含两条核心自动化流水线，确保部署无需人工干预：

### 1. 版本与资源更新流水线 (`version.yml`)
- **触发条件**：推送到 `main` 分支。
- **执行步骤**：
  1. 生成时间戳（`%Y%m%d%H%M%S`）与短哈希（`git rev-parse --short HEAD`）拼接为版本号。
  2. 写入 `version.json`。
  3. 执行 `update_resources.py`：遍历所有 `.html` 文件，使用**正则表达式**查找 `src`、`href`、`srcset`、`style` 属性中的 URL。
     - 若包含 `cdn.jsdmirror.com`，将 `@latest` 或旧哈希替换为 `@新哈希`。
     - 若无 `?v=` 参数，则自动追加 `?v=时间戳`。
  4. 提交并推送变更（附带 `[skip ci]` 防止死循环）。

### 2. 提交历史流水线 (`update-commit-history.yml`)
- **触发条件**：同样在 `push` 时触发。
- **防冲突机制**：提交前执行 `git pull --rebase`，并重试最多 3 次推送，避免并发冲突导致的失败。

---

## 💻 本地开发与调试指南

### 标准静态页（HTML/CSS/JS）
- 直接使用 **VS Code Live Server** 或任意 HTTP 服务器（如 Python `http.server`）。
- 无需安装依赖。

### Vue 3 聊天子项目（`birthday/zhongsinger/2026/original_project`）
1. 进入目录：
   ```bash
   cd birthday/zhongsinger/2026/original_project
   ```
2. 安装依赖：
   ```bash
   npm install
   ```
3. 启动开发服务器（支持 HTTPS）：
   ```bash
   npm run dev
   ```
4. 构建生产版本（用于部署）：
   ```bash
   npm run build
   ```

### 环境变量配置
Vue 子项目使用 `.env.development`、`.env.production` 管理变量：
- `VITE_CHAT_OPTIONS_PATH`：聊天内容 JSON 路径。
- `VITE_ROLES_PATH`：角色头像/昵称配置。
- `VITE_DEEPGRAM_API_KEY`：语音识别 API 密钥。

---

## 📂 项目目录结构（带注释）

```
DyWriteCode.github.io/
├── .github/                          # DevOps 核心
│   ├── workflows/
│   │   ├── version.yml               # 版本生成与资源替换
│   │   └── update-commit-history.yml # 提交历史生成
│   └── scripts/
│       ├── generate_commit_history.py # 解析 git log 生成 HTML
│       └── update_resources.py        # 正则替换资源链接（缓存破坏）
│
├── birthday/                          # 🌹 生日主题大本营
│   ├── dingyang/                     # 丁杨个人彩蛋（四重加密解密）
│   │   └── egg/                      # 含混淆 JS、加密 CSS、解密逻辑
│   ├── zhongsinger/                  # 钟芯尔双版本祝福
│   │   ├── 2025/                     # 心形门+时光相册+吹蜡烛
│   │   └── 2026/                     # Vue3 聊天式 SPA（含 Deepgram 语音）
│   └── preview_assets/               # 共享样式（涟漪、弹窗）
│
├── MiddleSchoolYearBook/              # 🎓 初中毕业纪念册（Swiper 全屏滑动）
│   ├── css/Pages/                    # 每一页的独立样式（First~Sixth）
│   └── js/                           # Swiper 配置与音乐控制
│
├── Notes/                             # 📝 硬核知识库
│   └── 2026.8.13/
│       ├── index.html                # AI短剧“发刀子”完整推导（含公式）
│       └── theory.html               # 15+ 理论依据卡片（心理学/数学）
│
├── TEST_FUNCION/                      # 🧪 实验田
│   ├── index.html                    # Deepgram 实时语音转录
│   └── DEEPGRAM_API.txt              # API Key 占位
│
├── preview_assets/                    # 🎨 全站共享资源
│   ├── check-update.js               # 版本轮询（30秒/次，检测更新）
│   ├── click.js                      # 全局涟漪特效
│   └── style.css                     # 卡片网格基础样式
│
├── base64_loop.py                     # 🛠 命令行编解码工具（支持多次循环）
├── commit-history.html                # 📜 Git 提交历史可视化
├── version.json                       # 🏷️ 当前部署版本（时间戳-哈希）
├── index.html                         # 🏠 首页入口
└── LICENSE                            # MIT 协议
```

---

## 📜 许可证与致谢

- **开源协议**：本项目采用 [MIT License](LICENSE)，欢迎 Fork 与二次创作。
- **特别感谢**：
  - Deepgram 提供的免费 API 额度（用于语音实验）。
  - Varlet UI 与 Vue 3 生态，极大地提升了复杂交互页的开发效率。

---

**愿代码如诗，愿创意不息。**  
																																																												   —— DyWriteCode