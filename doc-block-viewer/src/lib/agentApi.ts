/**
 * Agent 统一接口层
 *
 * 设计目标：一套调用接口，适配三种平台：
 *   - "openai"   → 直连 OpenAI / 兼容 API（如 DeepSeek、Qwen、本地 Ollama）
 *   - "fastgpt"  → FastGPT 应用 API（/api/v1/chat/completions 格式）
 *   - "dify"     → Dify Chat API（/v1/chat-messages）
 *
 * 调用方只需：
 *   const runner = createAgentRunner(agentConfig, inputPayload)
 *   for await (const chunk of runner.stream()) { ... }
 *   const report = await runner.result()
 */

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** 三种平台类型 */
export type PlatformType = 'openai' | 'fastgpt' | 'dify'

/** Agent 连接配置（存储在 agentConfig.ts 或用户自定义） */
export interface AgentEndpoint {
  platform: PlatformType
  /** API 地址，例如 https://api.openai.com/v1 */
  baseUrl: string
  /** API Key */
  apiKey: string
  /** 仅 openai/fastgpt 需要：模型名或应用 ID */
  model?: string
  /** 仅 dify 需要：应用 API key（通常等同于 apiKey） */
  appKey?: string
  /** 请求超时（毫秒），默认 60000 */
  timeoutMs?: number
}

/** 传入 Agent 的结构化分析载荷 */
export interface AnalysisPayload {
  /** 块名称，如"第一次咨询 · 开始阶段" */
  blockName: string
  /** 该块的完整对话文本（已格式化） */
  transcript: TranscriptTurn[]
  /** 咨询师填写的所有表格数据 */
  tables: TableAnnotation[]
  /** 额外的提示词补充（可选） */
  extraInstruction?: string
}

export interface TranscriptTurn {
  role: 'counselor' | 'visitor' | 'plain'
  content: string
}

export interface TableAnnotation {
  /** 插入在哪一句对话之后（0-indexed） */
  afterLineIndex: number
  /** 咨询师对该片段的标注 */
  rows: AnnotationRow[]
}

export interface AnnotationRow {
  intents: string[]   // 如 ["1.设限", "6.澄清"]
  techs: string[]     // 如 ["3a 开放式提问（针对想法）"]
  scoreC: string      // 咨询师评分
  scoreV: string      // 来访者评分
  reaction: string    // 来访者反应
  betterIntervention: string  // 更好的干预方式
}

/** 分析结果（流式组装完毕后的最终结构） */
export interface AnalysisReport {
  agentId: string
  agentName: string
  blockName: string
  /** 原始 markdown 文本 */
  markdown: string
  createdAt: string
}

/** 流式事件 */
export type StreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; fullText: string }
  | { type: 'error'; message: string }

// ─────────────────────────────────────────────
// Payload 序列化：将结构化数据转成 prompt
// ─────────────────────────────────────────────

export function buildUserPrompt(payload: AnalysisPayload): string {
  const lines: string[] = []

  lines.push(`## 咨询片段：${payload.blockName}`)
  lines.push('')
  lines.push('### 逐字稿')

  payload.transcript.forEach((turn, i) => {
    const prefix =
      turn.role === 'counselor' ? '【咨询师】' :
      turn.role === 'visitor'   ? '【来访者】' : ''
    lines.push(`${prefix}${turn.content}`)

    // 在对应行后插入表格标注
    const table = payload.tables.find(t => t.afterLineIndex === i)
    if (table) {
      lines.push('')
      lines.push('> **咨询师标注：**')
      table.rows.forEach((row, ri) => {
        lines.push(`> 片段 ${ri + 1}：`)
        if (row.intents.length)  lines.push(`>   意图：${row.intents.join('、')}`)
        if (row.techs.length)    lines.push(`>   技术：${row.techs.join('、')}`)
        if (row.scoreC)          lines.push(`>   咨询师评分：${row.scoreC}`)
        if (row.scoreV)          lines.push(`>   来访者评分：${row.scoreV}`)
        if (row.reaction)        lines.push(`>   来访者反应：${row.reaction}`)
        if (row.betterIntervention) lines.push(`>   更好的干预：${row.betterIntervention}`)
      })
      lines.push('')
    }
  })

  if (payload.extraInstruction) {
    lines.push('')
    lines.push('### 额外关注点')
    lines.push(payload.extraInstruction)
  }

  return lines.join('\n')
}

// ─────────────────────────────────────────────
// 各平台流式请求实现
// ─────────────────────────────────────────────

async function* streamOpenAI(
  endpoint: AgentEndpoint,
  systemPrompt: string,
  userPrompt: string,
): AsyncGenerator<StreamEvent> {
  const url = `${endpoint.baseUrl.replace(/\/$/, '')}/chat/completions`
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${endpoint.apiKey}`,
    },
    body: JSON.stringify({
      model: endpoint.model ?? 'gpt-4o',
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
    }),
    signal: AbortSignal.timeout(endpoint.timeoutMs ?? 120_000),
  })

  if (!resp.ok) {
    const errText = await resp.text()
    yield { type: 'error', message: `HTTP ${resp.status}: ${errText}` }
    return
  }

  yield* parseSSEStream(resp, chunk => {
    if (chunk === '[DONE]') return null
    try {
      const data = JSON.parse(chunk)
      return data.choices?.[0]?.delta?.content ?? null
    } catch { return null }
  })
}

async function* streamFastGPT(
  endpoint: AgentEndpoint,
  systemPrompt: string,
  userPrompt: string,
): AsyncGenerator<StreamEvent> {
  // FastGPT 兼容 OpenAI Chat Completion 格式
  yield* streamOpenAI(endpoint, systemPrompt, userPrompt)
}

async function* streamDify(
  endpoint: AgentEndpoint,
  systemPrompt: string,
  userPrompt: string,
): AsyncGenerator<StreamEvent> {
  const url = `${endpoint.baseUrl.replace(/\/$/, '')}/v1/chat-messages`
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${endpoint.appKey ?? endpoint.apiKey}`,
    },
    body: JSON.stringify({
      inputs: { system_prompt: systemPrompt },
      query: userPrompt,
      response_mode: 'streaming',
      user: 'emotion-app',
    }),
    signal: AbortSignal.timeout(endpoint.timeoutMs ?? 120_000),
  })

  if (!resp.ok) {
    const errText = await resp.text()
    yield { type: 'error', message: `HTTP ${resp.status}: ${errText}` }
    return
  }

  yield* parseSSEStream(resp, chunk => {
    try {
      const data = JSON.parse(chunk)
      if (data.event === 'message') return data.answer ?? null
      if (data.event === 'message_end') return null
      return null
    } catch { return null }
  })
}

// ─────────────────────────────────────────────
// SSE 通用解析器
// ─────────────────────────────────────────────

async function* parseSSEStream(
  resp: Response,
  extractor: (chunk: string) => string | null,
): AsyncGenerator<StreamEvent> {
  const reader = resp.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const parts = buffer.split('\n')
      buffer = parts.pop() ?? ''

      for (const line of parts) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const raw = trimmed.slice(5).trim()
        const text = extractor(raw)
        if (text) {
          full += text
          yield { type: 'delta', text }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  yield { type: 'done', fullText: full }
}

// ─────────────────────────────────────────────
// 公开 API：createAgentRunner
// ─────────────────────────────────────────────

export interface AgentRunner {
  /** 流式生成，逐 token 返回 */
  stream(): AsyncGenerator<StreamEvent>
  /** 非流式，等待完整结果 */
  result(): Promise<string>
}

export function createAgentRunner(
  endpoint: AgentEndpoint,
  systemPrompt: string,
  payload: AnalysisPayload,
): AgentRunner {
  const userPrompt = buildUserPrompt(payload)

  function stream(): AsyncGenerator<StreamEvent> {
    switch (endpoint.platform) {
      case 'openai':   return streamOpenAI(endpoint, systemPrompt, userPrompt)
      case 'fastgpt':  return streamFastGPT(endpoint, systemPrompt, userPrompt)
      case 'dify':     return streamDify(endpoint, systemPrompt, userPrompt)
    }
  }

  async function result(): Promise<string> {
    let full = ''
    for await (const event of stream()) {
      if (event.type === 'done') { full = event.fullText; break }
      if (event.type === 'error') throw new Error(event.message)
    }
    return full
  }

  return { stream, result }
}
