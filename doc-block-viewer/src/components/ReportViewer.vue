<script setup lang="ts">
import { ref, computed } from 'vue'
import { Download, X, FileText, Clock, Bot, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import type { AnalysisReport } from '../lib/agentApi'

const props = defineProps<{
  reports: AnalysisReport[]
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const currentIdx = ref(0)
const currentReport = computed(() => props.reports[currentIdx.value])

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', {
    month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Markdown → 简单 HTML 渲染 ──
function mdToHtml(md: string): string {
  return md
    // 标题
    .replace(/^### (.+)$/gm, '<h3 class="text-sm font-semibold text-gray-700 mt-5 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2 class="text-base font-bold text-gray-800 mt-6 mb-2 pb-1 border-b border-gray-100">$2</h2>')
    .replace(/^# (.+)$/gm,   '<h1 class="text-lg font-bold text-gray-900 mt-2 mb-4">$1</h1>')
    // 表格（Markdown GFM 表格）
    .replace(/(\|.+\|\n?)+/g, (match) => {
      const rows = match.trim().split('\n').filter(r => r.trim() && !r.match(/^\|[-: |]+\|$/))
      const html = rows.map((row, i) => {
        const cells = row.split('|').filter((_, ci) => ci > 0 && ci < row.split('|').length - 1)
        const tag = i === 0 ? 'th' : 'td'
        const cellClass = i === 0
          ? 'px-3 py-2 text-xs font-semibold text-gray-600 bg-gray-50 border border-gray-200'
          : 'px-3 py-2 text-xs text-gray-700 border border-gray-200'
        return `<tr>${cells.map(c => `<${tag} class="${cellClass}">${c.trim()}</${tag}>`).join('')}</tr>`
      }).join('')
      return `<div class="overflow-x-auto my-3"><table class="w-full border-collapse text-left rounded-lg overflow-hidden">${html}</table></div>`
    })
    // 引用块
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-violet-300 pl-3 my-2 text-xs text-gray-500 italic">$1</blockquote>')
    // 粗体
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-gray-800">$1</strong>')
    // 无序列表
    .replace(/^[-*] (.+)$/gm, '<li class="text-sm text-gray-700 ml-4 list-disc mt-1">$1</li>')
    // 有序列表
    .replace(/^\d+\. (.+)$/gm, '<li class="text-sm text-gray-700 ml-4 list-decimal mt-1">$1</li>')
    // 空行
    .replace(/\n\n/g, '<div class="h-2"></div>')
    .replace(/\n/g, '<br/>')
}

// ── 下载 Markdown ──
function downloadMarkdown() {
  if (!currentReport.value) return
  const blob = new Blob([currentReport.value.markdown], { type: 'text/markdown;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `督导报告-${currentReport.value.blockName}-${currentReport.value.agentName}.md`
  a.click()
  URL.revokeObjectURL(a.href)
}

// ── 下载 Word（调用已有的 exportDocx 工具） ──
async function downloadWord() {
  if (!currentReport.value) return
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx')

  const lines = currentReport.value.markdown.split('\n')
  const children: any[] = []

  for (const line of lines) {
    if (line.startsWith('# ')) {
      children.push(new Paragraph({ text: line.slice(2), heading: HeadingLevel.HEADING_1 }))
    } else if (line.startsWith('## ')) {
      children.push(new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_2 }))
    } else if (line.startsWith('### ')) {
      children.push(new Paragraph({ text: line.slice(4), heading: HeadingLevel.HEADING_3 }))
    } else if (line.trim()) {
      children.push(new Paragraph({
        children: [new TextRun({ text: line.replace(/\*\*(.+?)\*\*/g, '$1'), size: 22 })]
      }))
    } else {
      children.push(new Paragraph({ text: '' }))
    }
  }

  const doc = new Document({
    sections: [{
      properties: {},
      children,
    }]
  })

  const blob = await Packer.toBlob(doc)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `督导报告-${currentReport.value.blockName}-${currentReport.value.agentName}.docx`
  a.click()
  URL.revokeObjectURL(a.href)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="visible && reports.length" class="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4" @click.self="emit('close')">
        <div class="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">

          <!-- 顶栏 -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
                <FileText class="w-4 h-4 text-violet-600" />
              </div>
              <div>
                <h2 class="text-base font-semibold text-gray-800">督导分析报告</h2>
                <p class="text-xs text-gray-400">{{ currentReport?.blockName }}</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <!-- 多份报告切换 -->
              <div v-if="reports.length > 1" class="flex items-center gap-1">
                <button class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-30 transition-colors"
                  :disabled="currentIdx === 0" @click="currentIdx--">
                  <ChevronLeft class="w-4 h-4" />
                </button>
                <span class="text-xs text-gray-400 px-1">{{ currentIdx + 1 }} / {{ reports.length }}</span>
                <button class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-30 transition-colors"
                  :disabled="currentIdx === reports.length - 1" @click="currentIdx++">
                  <ChevronRight class="w-4 h-4" />
                </button>
              </div>
              <button class="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors" @click="downloadMarkdown">
                <Download class="w-3.5 h-3.5" /> .md
              </button>
              <button class="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-violet-500 hover:bg-violet-600 rounded-lg transition-colors" @click="downloadWord">
                <Download class="w-3.5 h-3.5" /> Word
              </button>
              <button class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition-colors" @click="emit('close')">
                <X class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- Agent 信息栏 -->
          <div v-if="currentReport" class="flex items-center gap-3 px-6 py-2.5 bg-violet-50 border-b border-violet-100 flex-shrink-0">
            <Bot class="w-3.5 h-3.5 text-violet-500" />
            <span class="text-xs font-medium text-violet-700">{{ currentReport.agentName }}</span>
            <span class="text-violet-200">|</span>
            <Clock class="w-3 h-3 text-violet-400" />
            <span class="text-xs text-violet-500">{{ formatDate(currentReport.createdAt) }}</span>
          </div>

          <!-- 报告内容 -->
          <div class="flex-1 overflow-y-auto px-8 py-6">
            <div
              v-if="currentReport"
              class="prose-sm max-w-none"
              v-html="mdToHtml(currentReport.markdown)"
            />
          </div>

          <!-- 底栏：多报告 tab -->
          <div v-if="reports.length > 1" class="flex-shrink-0 border-t border-gray-100 px-6 py-3 flex items-center gap-2 overflow-x-auto">
            <button
              v-for="(r, i) in reports"
              :key="r.agentId + r.createdAt"
              class="flex-shrink-0 px-3 py-1.5 text-xs rounded-lg transition-all"
              :class="i === currentIdx
                ? 'bg-violet-100 text-violet-700 font-medium'
                : 'bg-gray-50 text-gray-500 hover:bg-gray-100'"
              @click="currentIdx = i"
            >
              {{ r.agentName }}
            </button>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
