<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  Bot, ChevronDown, ChevronUp, Play, Square, Settings, X,
  Tag, Loader2, AlertCircle, CheckCircle2, FileText
} from 'lucide-vue-next'
import { createAgentRunner, type AnalysisPayload, type AnalysisReport } from '../lib/agentApi'
import { SUPERVISION_AGENTS, getEnabledAgents, overrideEndpoint, type SupervisionAgent } from '../lib/agentConfig'

const props = defineProps<{
  payload: AnalysisPayload
}>()

const emit = defineEmits<{
  (e: 'report-ready', report: AnalysisReport): void
}>()

// ── 状态 ──
const selectedAgentId = ref(getEnabledAgents()[0]?.id ?? '')
const agents = computed(() => getEnabledAgents())
const selectedAgent = computed<SupervisionAgent | undefined>(
  () => agents.value.find(a => a.id === selectedAgentId.value)
)

const status = ref<'idle' | 'running' | 'done' | 'error'>('idle')
const streamText = ref('')
const errorMsg = ref('')
const showAgentDetail = ref(false)
const showSettings = ref(false)
const abortController = ref<AbortController | null>(null)

// ── 用户自定义 API 配置 ──
const customApiKey  = ref('')
const customBaseUrl = ref('')
const customModel   = ref('')

function applyCustomSettings() {
  if (!selectedAgent.value) return
  const partial: Record<string, string> = {}
  if (customApiKey.value.trim())  partial.apiKey  = customApiKey.value.trim()
  if (customBaseUrl.value.trim()) partial.baseUrl = customBaseUrl.value.trim()
  if (customModel.value.trim())   partial.model   = customModel.value.trim()
  if (Object.keys(partial).length) overrideEndpoint(selectedAgent.value.id, partial)
  showSettings.value = false
}

// ── 加载设置到输入框 ──
watch(selectedAgentId, () => {
  const ep = selectedAgent.value?.endpoint
  if (!ep) return
  customApiKey.value  = ep.apiKey  === (import.meta.env.VITE_OPENAI_API_KEY ?? '') ? '' : ep.apiKey
  customBaseUrl.value = ''
  customModel.value   = ''
})

// ── 开始分析 ──
async function startAnalysis() {
  const agent = selectedAgent.value
  if (!agent || status.value === 'running') return

  status.value = 'running'
  streamText.value = ''
  errorMsg.value = ''

  const ctrl = new AbortController()
  abortController.value = ctrl

  try {
    const runner = createAgentRunner(agent.endpoint, agent.systemPrompt, props.payload)
    for await (const event of runner.stream()) {
      if (ctrl.signal.aborted) break
      if (event.type === 'delta') {
        streamText.value += event.text
      } else if (event.type === 'done') {
        streamText.value = event.fullText
        status.value = 'done'

        const report: AnalysisReport = {
          agentId:   agent.id,
          agentName: agent.name,
          blockName: props.payload.blockName,
          markdown:  event.fullText,
          createdAt: new Date().toISOString(),
        }
        emit('report-ready', report)
      } else if (event.type === 'error') {
        throw new Error(event.message)
      }
    }
    if (status.value === 'running') status.value = 'idle' // 被中止
  } catch (err: any) {
    if (!ctrl.signal.aborted) {
      status.value = 'error'
      errorMsg.value = err?.message ?? '分析失败，请检查 API 配置'
    } else {
      status.value = 'idle'
    }
  }
}

function stopAnalysis() {
  abortController.value?.abort()
  status.value = 'idle'
}
</script>

<template>
  <div class="flex flex-col h-full bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
    <!-- 标题栏 -->
    <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
      <div class="flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center">
          <Bot class="w-4 h-4 text-violet-600" />
        </div>
        <div>
          <h3 class="text-sm font-semibold text-gray-800">AI 督导分析</h3>
          <p class="text-xs text-gray-400">{{ payload.blockName }}</p>
        </div>
      </div>
      <button
        class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        @click="showSettings = !showSettings"
      >
        <Settings class="w-4 h-4" />
      </button>
    </div>

    <!-- API 设置面板 -->
    <Transition name="slide-down">
      <div v-if="showSettings" class="border-b border-gray-100 px-5 py-4 bg-gray-50 flex-shrink-0">
        <p class="text-xs font-medium text-gray-600 mb-3">覆盖 API 配置（留空则使用环境变量默认值）</p>
        <div class="space-y-2">
          <input v-model="customBaseUrl" type="text" placeholder="Base URL（如 https://api.openai.com/v1）"
            class="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-400" />
          <input v-model="customApiKey"  type="password" placeholder="API Key"
            class="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-400" />
          <input v-model="customModel"   type="text" placeholder="模型名（如 gpt-4o、deepseek-chat）"
            class="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-400" />
        </div>
        <div class="flex gap-2 mt-3">
          <button class="flex-1 py-2 text-xs bg-violet-500 text-white rounded-lg hover:bg-violet-600 transition-colors" @click="applyCustomSettings">应用</button>
          <button class="flex-1 py-2 text-xs bg-white border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 transition-colors" @click="showSettings = false">关闭</button>
        </div>
      </div>
    </Transition>

    <!-- Agent 选择区 -->
    <div class="px-5 py-4 border-b border-gray-100 flex-shrink-0 space-y-3">
      <p class="text-xs font-medium text-gray-500">选择督导 Agent</p>
      <div class="grid grid-cols-1 gap-2">
        <button
          v-for="agent in agents"
          :key="agent.id"
          class="flex items-start gap-3 px-3 py-3 rounded-xl border-2 transition-all text-left"
          :class="selectedAgentId === agent.id
            ? 'border-violet-400 bg-violet-50'
            : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'"
          @click="selectedAgentId = agent.id; showAgentDetail = false"
        >
          <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
            :style="{ backgroundColor: agent.color + '20' }">
            <Bot class="w-4 h-4" :style="{ color: agent.color }" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-gray-800">{{ agent.name }}</span>
              <div v-if="selectedAgentId === agent.id" class="w-4 h-4 rounded-full bg-violet-500 flex items-center justify-center flex-shrink-0">
                <svg class="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="currentColor"><path d="M10 3L5 8.5 2 5.5"/></svg>
              </div>
            </div>
            <p class="text-xs text-gray-400 mt-0.5 line-clamp-1">{{ agent.tagline }}</p>
            <div class="flex flex-wrap gap-1 mt-1.5">
              <span v-for="tag in agent.tags.slice(0,3)" :key="tag"
                class="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                :style="{ backgroundColor: agent.color + '15', color: agent.color }">
                {{ tag }}
              </span>
            </div>
          </div>
        </button>
      </div>

      <!-- Agent 详情折叠 -->
      <div v-if="selectedAgent">
        <button class="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors" @click="showAgentDetail = !showAgentDetail">
          <component :is="showAgentDetail ? ChevronUp : ChevronDown" class="w-3.5 h-3.5" />
          {{ showAgentDetail ? '收起' : '查看 Agent 说明' }}
        </button>
        <Transition name="slide-down">
          <div v-if="showAgentDetail" class="mt-2 text-xs text-gray-500 bg-gray-50 rounded-xl p-3 leading-relaxed">
            {{ selectedAgent.description }}
          </div>
        </Transition>
      </div>
    </div>

    <!-- 数据摘要 -->
    <div class="px-5 py-3 border-b border-gray-100 flex items-center gap-4 flex-shrink-0 text-xs text-gray-400">
      <span class="flex items-center gap-1">
        <FileText class="w-3.5 h-3.5" />
        {{ payload.transcript.length }} 段对话
      </span>
      <span class="flex items-center gap-1">
        <Tag class="w-3.5 h-3.5" />
        {{ payload.tables.reduce((s,t) => s + t.rows.length, 0) }} 条标注
      </span>
    </div>

    <!-- 流式输出区 -->
    <div class="flex-1 overflow-y-auto px-5 py-4 min-h-0">
      <!-- 空态 -->
      <div v-if="status === 'idle' && !streamText" class="h-full flex flex-col items-center justify-center text-center py-8">
        <div class="w-12 h-12 rounded-2xl bg-violet-50 flex items-center justify-center mb-3">
          <Bot class="w-6 h-6 text-violet-300" />
        </div>
        <p class="text-sm text-gray-400">选择 Agent 后点击「开始分析」</p>
        <p class="text-xs text-gray-300 mt-1">分析结果将以督导报告形式呈现</p>
      </div>

      <!-- 加载中 -->
      <div v-else-if="status === 'running' && !streamText" class="h-full flex flex-col items-center justify-center">
        <Loader2 class="w-8 h-8 text-violet-400 animate-spin mb-3" />
        <p class="text-sm text-gray-500">正在生成督导报告…</p>
      </div>

      <!-- 错误 -->
      <div v-else-if="status === 'error'" class="flex items-start gap-3 p-4 bg-red-50 rounded-xl">
        <AlertCircle class="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
        <div>
          <p class="text-sm font-medium text-red-600">分析失败</p>
          <p class="text-xs text-red-400 mt-1 break-all">{{ errorMsg }}</p>
          <p class="text-xs text-gray-400 mt-2">请检查 API Key 和网络连接，或在设置中修改配置</p>
        </div>
      </div>

      <!-- 流式文本 -->
      <div v-else-if="streamText" class="space-y-2">
        <div v-if="status === 'done'" class="flex items-center gap-2 text-xs text-emerald-600 mb-3">
          <CheckCircle2 class="w-3.5 h-3.5" />报告生成完成
        </div>
        <div v-else class="flex items-center gap-2 text-xs text-violet-500 mb-3">
          <Loader2 class="w-3.5 h-3.5 animate-spin" />正在生成…
        </div>
        <!-- Markdown 渲染：使用 white-space:pre-wrap 简单渲染，不引入额外依赖 -->
        <div class="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap font-mono bg-gray-50 rounded-xl p-3">{{ streamText }}</div>
      </div>
    </div>

    <!-- 底部操作 -->
    <div class="flex-shrink-0 px-5 py-4 border-t border-gray-100">
      <button
        v-if="status !== 'running'"
        class="w-full py-2.5 text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2"
        :class="selectedAgent
          ? 'bg-violet-500 text-white hover:bg-violet-600 shadow-sm shadow-violet-200'
          : 'bg-gray-100 text-gray-300 cursor-not-allowed'"
        :disabled="!selectedAgent"
        @click="startAnalysis"
      >
        <Play class="w-4 h-4" />
        开始分析
      </button>
      <button
        v-else
        class="w-full py-2.5 text-sm font-medium rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-all flex items-center justify-center gap-2"
        @click="stopAnalysis"
      >
        <Square class="w-4 h-4" />
        停止生成
      </button>
    </div>
  </div>
</template>

<style scoped>
.slide-down-enter-active, .slide-down-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}
.slide-down-enter-from, .slide-down-leave-to {
  opacity: 0;
  max-height: 0;
}
.slide-down-enter-to, .slide-down-leave-from {
  opacity: 1;
  max-height: 600px;
}
</style>
