# Emotion · agent 分支

## 分支说明

`agent` 分支在 `folder` 分支基础上新增了 **AI 督导分析系统**。咨询师完成逐字稿分块与表格标注后，可以选择不同的督导 Agent 对当前块进行 AI 分析，生成结构化督导报告，并支持下载为 Markdown 或 Word 文件。

---

## 新增功能

### 1. AI 督导面板（`AnalysisPanel.vue`）
- 右侧滑入式面板，不遮挡逐字稿内容
- 选择督导 Agent（5 个预设，可扩展）
- 实时流式输出（SSE）：逐 token 显示分析过程
- 支持中途停止生成
- 内置 API 配置覆盖：可在界面中填入自己的 Key / Base URL / 模型名

### 2. 5 个预设督导 Agent（`src/lib/agentConfig.ts`）

| Agent | 专长方向 |
|-------|---------|
| 通用督导师 | 全面技术分析 + 意图识别，适合日常反思 |
| 人本取向督导 | 共情质量、无条件积极关注、咨访关系深度 |
| CBT 取向督导 | 苏格拉底提问、认知重构、行为干预精准性 |
| 心理动力学督导 | 移情/反移情、防御机制、无意识沟通 |
| 风险评估专项 | 危机信号识别、自杀风险评估、安全计划 |

所有 Agent 输出统一的 **6 章节报告结构**：
> 整体评估 → 优势亮点 → 遗漏与不足 → 模式分析 → 督导建议 → 评分表

### 3. 报告预览 & 下载（`ReportViewer.vue`）
- Markdown 实时渲染（标题、表格、引用块、加粗）
- 多份报告 Tab 切换（同一块可用多个 Agent 分析）
- 下载为 `.md`（Markdown 原文）
- 下载为 `.docx`（Word 文档，含标题层级）

### 4. 统一 Agent 接口层（`src/lib/agentApi.ts`）
一套接口，适配三种平台，详见下方「接口说明」。

### 5. 继承 folder 分支全部功能
用户系统、文件夹管理、Bug 修复均已包含。

---

## 接口说明

### Agent 统一调用接口（`src/lib/agentApi.ts`）

**核心理念：调用方不感知平台差异**

```ts
import { createAgentRunner } from './lib/agentApi'
import type { AgentEndpoint, AnalysisPayload } from './lib/agentApi'

// 1. 定义端点（三选一）
const endpoint: AgentEndpoint = {
  platform: 'openai',   // 'openai' | 'fastgpt' | 'dify'
  baseUrl:  'https://api.openai.com/v1',
  apiKey:   'sk-...',
  model:    'gpt-4o',
}

// 2. 定义分析载荷
const payload: AnalysisPayload = {
  blockName:  '第一次咨询·开始阶段',
  transcript: [
    { role: 'counselor', content: '你最近睡眠怎么样？' },
    { role: 'visitor',   content: '很差，基本睡不着。' },
  ],
  tables: [{
    afterLineIndex: 1,
    rows: [{
      intents: ['2.获得信息'],
      techs:   ['3b 开放式提问（针对情感）'],
      scoreC: '3', scoreV: '4',
      reaction: '来访者主动展开',
      betterIntervention: '',
    }]
  }],
}

// 3. 流式调用（统一 API，平台无关）
const runner = createAgentRunner(endpoint, systemPrompt, payload)

// 方式 A：流式（逐 token）
for await (const event of runner.stream()) {
  if (event.type === 'delta') process.stdout.write(event.text)
  if (event.type === 'done')  console.log('完成:', event.fullText)
  if (event.type === 'error') console.error(event.message)
}

// 方式 B：一次性获取完整结果
const fullText = await runner.result()
```

### 三种平台对应配置

```ts
// OpenAI / DeepSeek / Qwen / Ollama 等兼容接口
{ platform: 'openai', baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-...', model: 'gpt-4o' }

// FastGPT（与 OpenAI 格式相同，改 URL 即可）
{ platform: 'fastgpt', baseUrl: 'https://your-fastgpt.com/api/v1', apiKey: 'your-app-key', model: 'gpt-4o' }

// Dify
{ platform: 'dify', baseUrl: 'https://api.dify.ai', apiKey: 'app-...', appKey: 'app-...' }
```

### AnalysisPayload 数据结构

```ts
interface AnalysisPayload {
  blockName:          string            // 块名称
  transcript:         TranscriptTurn[]  // 对话列表
  tables:             TableAnnotation[] // 咨询师标注的表格
  extraInstruction?:  string            // 额外提示（可选）
}

interface TranscriptTurn {
  role:    'counselor' | 'visitor' | 'plain'
  content: string
}

interface TableAnnotation {
  afterLineIndex: number        // 插入在第几行对话之后
  rows: AnnotationRow[]
}

interface AnnotationRow {
  intents:             string[] // 意图标签，如 ["1.设限", "6.澄清"]
  techs:               string[] // 技术标签，如 ["3a 开放式提问（针对想法）"]
  scoreC:              string   // 咨询师有效性评分 1-5
  scoreV:              string   // 来访者有效性评分 1-5
  reaction:            string   // 来访者反应描述
  betterIntervention:  string   // 更好的干预方式（可空）
}
```

### Agent 配置管理（`src/lib/agentConfig.ts`）

```ts
import { getEnabledAgents, findAgent, overrideEndpoint } from './lib/agentConfig'

// 获取所有可用 Agent
const agents = getEnabledAgents()

// 运行时覆盖 API Key（用于用户自定义配置）
overrideEndpoint('general-supervisor', { apiKey: 'sk-custom-key', model: 'deepseek-chat' })
```

### 环境变量（`.env`）

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# AI 督导（支持任意 OpenAI 兼容接口）
VITE_OPENAI_BASE_URL=https://api.openai.com/v1
VITE_OPENAI_API_KEY=sk-...
VITE_OPENAI_MODEL=gpt-4o
```

---

## 对接外部平台（FastGPT / Dify）

**接 FastGPT**：
1. 在 FastGPT 创建应用，将任意 Agent 的 `systemPrompt` 粘贴进系统提示词
2. 修改端点 `platform: 'fastgpt'`，`baseUrl` 改为 FastGPT API 地址
3. 代码其余部分无需改动

**接 Dify**：
1. 在 Dify 创建聊天助手，系统提示词填入对应 Agent 的 `systemPrompt`
2. 将 `inputs.system_prompt` 变量设为动态（可选）
3. 修改端点 `platform: 'dify'`，`baseUrl` 改为 Dify API 地址

**做成后端 API**：
只需将 `agentApi.ts` 的 `fetch` 调用迁移至 Node.js/Python 后端，前端改为对接自己的 `/api/analyze` 接口，其余类型定义可完整复用。

---

## 快速启动

```bash
cd doc-block-viewer
npm install
cp .env.example .env   # 填入 Supabase + OpenAI 配置
npm run dev
```

---

## 目录结构（新增部分）

```
src/
├── components/
│   ├── AnalysisPanel.vue  # AI 督导面板（Agent 选择 + 流式输出）
│   └── ReportViewer.vue   # 报告预览 + 下载
└── lib/
    ├── agentApi.ts        # 统一 Agent 接口层（核心，平台无关）
    └── agentConfig.ts     # 督导 Agent 配置表（system prompt + 端点）
```

---

## 数据隐私改造

当前分支已补上用户文件的隐私保护方案，目标是避免普通数据库读取者直接看到逐字稿正文、分块结果和角色映射等敏感内容。

### 当前方案

- 继续使用 Supabase Auth，密码仍由 Supabase 官方认证体系管理，不在业务表中自行存储或处理
- 在 `public.user_files` 中，以下敏感字段改为通过后端加密后再落库：
  - `file_content`
  - `blocks_data`
  - `mappings_data`
- 新增 `public.user_encryption_keys`，为每个用户保存一把经服务端 KEK 包裹后的 DEK
- 前端不再把文档内容、分块信息写入 `localStorage`
- 敏感数据的创建、读取、更新统一走 Supabase Edge Function `secure-files`

### 加密与解密边界

- 加密算法：`AES-256-GCM`
- 粒度：按用户、按文件、按字段进行 AAD 绑定
- 解密位置：仅在受信任的后端函数内完成，前端拿到的是已授权解密后的结果
- 明文保留字段：`original_name`

### 当前范围

- 已覆盖：上传文件、打开文件、保存分块、保存角色映射
- 暂不处理：`analysis_data`
- 暂不做历史数据迁移：当前阶段没有线上存量数据，直接基于旧表结构升级

### 相关目录

- `supabase/migrations/20260407120000_secure_user_files.sql`
- `supabase/functions/secure-files/index.ts`
- `supabase/functions/_shared/crypto.ts`
- `doc-block-viewer/src/services/secureFilesApi.ts`
- `doc-block-viewer/src/services/secureFileMapper.ts`
