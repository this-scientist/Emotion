<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  ArrowLeft, Download, Table2, Trash2,
  Pencil, Check, X, CheckSquare, Square, Pen,
  Plus, ChevronDown, ChevronUp, MessageSquare, Bot, FileText,
} from 'lucide-vue-next'
import { applyMapping, type SpeakerMapping, type FormattedLine } from '../utils/extractSpeakers'
import { exportMixedDocx, downloadBlob, type DocItem } from '../utils/exportDocx'
import type { ContentBlock } from '../types/block'
import type { TableRowData } from './TableEditor.vue'
import { INTENTS, TECHS, type IntentItem, type TechItem, intentLabel, techLabel } from '../data/tableData'
import AnalysisPanel from './AnalysisPanel.vue'
import ReportViewer from './ReportViewer.vue'
import type { AnalysisPayload, AnalysisReport } from '../lib/agentApi'

const props = defineProps<{
  block: ContentBlock
  blockLines: string[]
  mappings: SpeakerMapping[]
}>()
const emit = defineEmits<{ back: [] }>()

// ── 可编辑段落 ──
const baseLines = computed<FormattedLine[]>(() =>
  applyMapping(props.blockLines, props.mappings)
)
interface EditableLine {
  id: string
  data: FormattedLine
  editing: boolean
  editContent: string
}
const lines = ref<EditableLine[]>([])
watch(baseLines, (val) => {
  lines.value = val.map((l, i) => ({
    id: `line-${i}`,
    data: l,
    editing: false,
    editContent: l.type === 'speech' ? l.content : (l as any).text ?? '',
  }))
}, { immediate: true })

// ── 多选 ──
const selectedIds = ref<Set<string>>(new Set())
const isSelectMode = ref(false)
function toggleSelectMode() {
  isSelectMode.value = !isSelectMode.value
  if (!isSelectMode.value) selectedIds.value = new Set()
}
function toggleSelect(id: string) {
  if (selectedIds.value.has(id)) selectedIds.value.delete(id)
  else selectedIds.value.add(id)
  selectedIds.value = new Set(selectedIds.value)
}
function selectAll() {
  selectedIds.value = selectedIds.value.size === lines.value.length
    ? new Set()
    : new Set(lines.value.map(l => l.id))
}
const allSelected = computed(() => lines.value.length > 0 && selectedIds.value.size === lines.value.length)
const hasSelected = computed(() => selectedIds.value.size > 0)

// ── 删除确认 ──
const showDeleteConfirm = ref(false)
function requestDelete() { if (hasSelected.value) showDeleteConfirm.value = true }
function confirmDelete() {
  const toDelIds = new Set(selectedIds.value)
  const toDelIdxs = new Set<number>()
  lines.value.forEach((l, i) => { if (toDelIds.has(l.id)) toDelIdxs.add(i) })
  const newTables = new Map<number, EmbeddedTable[]>()
  let offset = 0
  for (let i = 0; i < lines.value.length; i++) {
    if (toDelIdxs.has(i)) { offset++; continue }
    const tbls = embeddedTables.value.get(i)
    if (tbls) newTables.set(i - offset, tbls)
  }
  embeddedTables.value = newTables
  lines.value = lines.value.filter(l => !toDelIds.has(l.id))
  selectedIds.value = new Set()
  showDeleteConfirm.value = false
  isSelectMode.value = false
}

// ── 行编辑 ──
function startEdit(line: EditableLine) {
  lines.value.forEach(l => { if (l.id !== line.id) cancelEdit(l) })
  line.editing = true
  line.editContent = line.data.type === 'speech' ? line.data.content : (line.data as any).text ?? ''
}
function saveEdit(line: EditableLine) {
  if (line.data.type === 'speech') line.data = { ...line.data, content: line.editContent }
  else if (line.data.type === 'plain') line.data = { ...line.data, text: line.editContent }
  line.editing = false
}
function cancelEdit(line: EditableLine) { line.editing = false }

// ── 嵌入表格 ──
interface EmbeddedTable { id: string; rows: TableRowData[] }
const embeddedTables = ref<Map<number, EmbeddedTable[]>>(new Map())

// ── 内联编辑状态 ──
// key: `new-${lineIdx}` 或 `${lineIdx}-${tableId}`
const inlineEditKey = ref<string | null>(null)
const inlineRows = ref<TableRowData[]>([])
const inlineActiveRowIdx = ref(0)
const inlineActivePanel = ref<'intent' | 'tech' | 'other'>('intent')
const inlineContextExpanded = ref(true)
const inlineContextLines = ref<FormattedLine[]>([])

function createEmptyRow(): TableRowData {
  return { id: `row-${Date.now()}-${Math.random()}`, intents: [], techs: [], scoreC: '', scoreV: '', reaction: '', betterIntervention: '' }
}

function getAllTableLineIndices(): number[] {
  const indices = new Set<number>()
  embeddedTables.value.forEach((_, idx) => indices.add(idx))
  return Array.from(indices).sort((a, b) => a - b)
}

function computeContextLines(currentIdx: number): FormattedLine[] {
  const tableIndices = getAllTableLineIndices()
  const prevTableIdx = tableIndices.filter(idx => idx < currentIdx).pop()
  const startIdx = prevTableIdx !== undefined ? prevTableIdx + 1 : 0
  return lines.value.slice(startIdx, currentIdx + 1).map(l => l.data)
}

function openNewTable(lineIdx: number) {
  const key = `new-${lineIdx}`
  if (inlineEditKey.value === key) { inlineEditKey.value = null; return }
  inlineEditKey.value = key
  inlineRows.value = [createEmptyRow()]
  inlineActiveRowIdx.value = 0
  inlineActivePanel.value = 'intent'
  inlineContextLines.value = computeContextLines(lineIdx)
  inlineContextExpanded.value = true
}

function openEditTable(lineIdx: number, tableId: string) {
  const key = `${lineIdx}-${tableId}`
  if (inlineEditKey.value === key) { inlineEditKey.value = null; return }
  const tbl = embeddedTables.value.get(lineIdx)?.find(t => t.id === tableId)
  if (!tbl) return
  inlineEditKey.value = key
  inlineRows.value = tbl.rows.map(r => ({ ...r, intents: [...r.intents], techs: [...r.techs] }))
  inlineActiveRowIdx.value = 0
  inlineActivePanel.value = 'intent'
  inlineContextLines.value = computeContextLines(lineIdx)
  inlineContextExpanded.value = true
}

function closeInline() { inlineEditKey.value = null }

function saveInline(lineIdx: number, tableId: string | null) {
  const rows = inlineRows.value.map(r => ({ ...r }))
  if (tableId === null) {
    const list = embeddedTables.value.get(lineIdx) ?? []
    list.push({ id: `tbl-${Date.now()}`, rows })
    embeddedTables.value.set(lineIdx, list)
  } else {
    const tbl = embeddedTables.value.get(lineIdx)?.find(t => t.id === tableId)
    if (tbl) tbl.rows = rows
  }
  embeddedTables.value = new Map(embeddedTables.value)
  inlineEditKey.value = null
}

const inlineActiveRow = computed(() => inlineRows.value[inlineActiveRowIdx.value])

function addInlineRow() {
  inlineRows.value.push(createEmptyRow())
  inlineActiveRowIdx.value = inlineRows.value.length - 1
}
function removeInlineRow(idx: number) {
  if (inlineRows.value.length === 1) return
  inlineRows.value.splice(idx, 1)
  if (inlineActiveRowIdx.value >= inlineRows.value.length)
    inlineActiveRowIdx.value = inlineRows.value.length - 1
}
function selectInlineRow(idx: number) {
  inlineActiveRowIdx.value = idx
  inlineActivePanel.value = 'intent'
}

function toggleIntent(item: IntentItem) {
  const row = inlineActiveRow.value; if (!row) return
  const i = row.intents.findIndex(x => x.id === item.id)
  if (i === -1) row.intents.push(item); else row.intents.splice(i, 1)
}
function hasIntent(item: IntentItem) { return inlineActiveRow.value?.intents.some(i => i.id === item.id) ?? false }
function toggleTech(item: TechItem) {
  const row = inlineActiveRow.value; if (!row) return
  const i = row.techs.findIndex(t => t.subId === item.subId)
  if (i === -1) row.techs.push(item); else row.techs.splice(i, 1)
}
function hasTech(item: TechItem) { return inlineActiveRow.value?.techs.some(t => t.subId === item.subId) ?? false }

function removeTable(lineIdx: number, tableId: string) {
  const list = (embeddedTables.value.get(lineIdx) ?? []).filter(t => t.id !== tableId)
  if (list.length === 0) embeddedTables.value.delete(lineIdx)
  else embeddedTables.value.set(lineIdx, list)
  embeddedTables.value = new Map(embeddedTables.value)
}

// ── 导出 ──
const exporting = ref(false)
async function handleExport() {
  exporting.value = true
  try {
    const items: DocItem[] = []
    for (let i = 0; i < lines.value.length; i++) {
      items.push({ type: 'text', line: lines.value[i].data })
      for (const tbl of (embeddedTables.value.get(i) ?? [])) items.push({ type: 'table', rows: tbl.rows })
    }
    const blob = await exportMixedDocx(items, props.block.name)
    downloadBlob(blob, `${props.block.name}-映射文档.docx`)
  } finally { exporting.value = false }
}

const tableCount = computed(() => { let n = 0; embeddedTables.value.forEach(l => { n += l.length }); return n })

// ── AI 督导 ──
const showAnalysisPanel = ref(false)
const showReportViewer  = ref(false)
const reports = ref<AnalysisReport[]>([])

/** 将当前视图数据组装成 AnalysisPayload */
const analysisPayload = computed<AnalysisPayload>(() => {
  const transcript = lines.value.map(l => ({
    role: l.data.type === 'speech' ? l.data.role : ('plain' as const),
    content: l.data.type === 'speech' ? l.data.content : (l.data as any).text ?? '',
  }))

  const tables = Array.from(embeddedTables.value.entries()).map(([lineIdx, tbls]) => ({
    afterLineIndex: lineIdx,
    rows: tbls.flatMap(t => t.rows.map(r => ({
      intents: r.intents.map(i => intentLabel(i)),
      techs:   r.techs.map(t => techLabel(t)),
      scoreC:  r.scoreC,
      scoreV:  r.scoreV,
      reaction: r.reaction,
      betterIntervention: r.betterIntervention,
    })))
  }))

  return {
    blockName: props.block.name,
    transcript,
    tables,
  }
})

function handleReportReady(report: AnalysisReport) {
  reports.value.push(report)
  showAnalysisPanel.value = false
  showReportViewer.value  = true
}

function getRoleStyle(role: 'counselor' | 'visitor') {
  return role === 'counselor'
    ? { bg: 'bg-violet-50', border: 'border-l-4 border-violet-400', label: 'text-violet-700 bg-violet-100' }
    : { bg: 'bg-sky-50',    border: 'border-l-4 border-sky-400',    label: 'text-sky-700 bg-sky-100' }
}

const SCORES = ['1', '2', '3', '4', '5']
</script>

<template>
  <div class="h-screen flex flex-col bg-gray-50">

    <!-- ── 删除确认弹窗 ── -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showDeleteConfirm" class="fixed inset-0 z-[300] flex items-center justify-center bg-black/40" @click.self="showDeleteConfirm=false">
          <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-slide-up">
            <div class="flex items-center gap-3 mb-3">
              <div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 class="w-5 h-5 text-red-500" />
              </div>
              <h3 class="text-base font-semibold text-gray-800">确认删除</h3>
            </div>
            <p class="text-sm text-gray-500 mb-6 pl-[52px]">
              将删除已选中的 <span class="font-semibold text-red-500">{{ selectedIds.size }}</span> 段内容，此操作不可恢复。
            </p>
            <div class="flex justify-end gap-3">
              <button class="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-xl transition-colors" @click="showDeleteConfirm=false">取消</button>
              <button class="px-5 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors" @click="confirmDelete">确认删除</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ── 顶栏 ── -->
    <header class="flex-shrink-0 bg-white border-b border-gray-100 px-5 h-14 flex items-center justify-between shadow-sm z-10 gap-3">
      <div class="flex items-center gap-3 min-w-0">
        <button class="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0" @click="$emit('back')">
          <ArrowLeft class="w-4 h-4" />返回
        </button>
        <div class="w-px h-5 bg-gray-200 flex-shrink-0" />
        <div class="w-3 h-3 rounded-sm flex-shrink-0" :style="{ backgroundColor: block.color }" />
        <h1 class="text-base font-semibold text-gray-800 truncate">{{ block.name }} · 映射视图</h1>
        <span v-if="tableCount > 0" class="text-xs bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full font-medium flex-shrink-0">{{ tableCount }} 个表格</span>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <button
          class="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-xl transition-all font-medium border"
          :class="isSelectMode ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'"
          @click="toggleSelectMode"
        ><CheckSquare class="w-4 h-4" />{{ isSelectMode ? '退出多选' : '多选' }}</button>
        <template v-if="isSelectMode">
          <button
            class="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-xl border transition-colors"
            :class="allSelected ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'"
            @click="selectAll"
          ><component :is="allSelected ? CheckSquare : Square" class="w-4 h-4" />{{ allSelected ? '取消全选' : '全选' }}</button>
          <button
            class="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-xl font-medium transition-all"
            :class="hasSelected ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-gray-100 text-gray-300 cursor-not-allowed'"
            :disabled="!hasSelected" @click="requestDelete"
          ><Trash2 class="w-4 h-4" />删除所选<span v-if="hasSelected">({{ selectedIds.size }})</span></button>
        </template>
        <button
          class="flex items-center gap-2 px-4 py-2 text-sm rounded-xl font-medium transition-all border"
          :class="showAnalysisPanel ? 'bg-violet-100 text-violet-700 border-violet-200' : 'bg-white text-violet-600 border-violet-200 hover:bg-violet-50'"
          @click="showAnalysisPanel = !showAnalysisPanel"
        ><Bot class="w-4 h-4" />AI 督导</button>
        <button
          v-if="reports.length"
          class="flex items-center gap-2 px-4 py-2 text-sm rounded-xl font-medium transition-all bg-white border border-violet-200 text-violet-500 hover:bg-violet-50"
          @click="showReportViewer = true"
        ><FileText class="w-4 h-4" />查看报告 <span class="bg-violet-100 text-violet-600 text-[10px] px-1.5 py-0.5 rounded-full">{{ reports.length }}</span></button>
        <button
          class="flex items-center gap-2 px-4 py-2 text-sm rounded-xl font-medium transition-all"
          :class="exporting ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-indigo-500 text-white hover:bg-indigo-600'"
          :disabled="exporting" @click="handleExport"
        ><Download class="w-4 h-4" />{{ exporting ? '导出中…' : '导出为 Word' }}</button>
      </div>
    </header>

    <!-- ── 主内容 ── -->
    <div class="flex-1 flex overflow-hidden min-h-0">
      <main class="flex-1 overflow-auto">
      <div class="max-w-4xl mx-auto px-6 py-5">

        <!-- 提示栏 -->
        <div class="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400 bg-white rounded-xl px-4 py-2.5 border border-gray-100 shadow-sm">
          <span class="flex items-center gap-1"><Table2 class="w-3.5 h-3.5 text-emerald-400" />悬停段落右侧 → 插入表格</span>
          <span class="text-gray-200">|</span>
          <span class="flex items-center gap-1"><Pencil class="w-3.5 h-3.5 text-indigo-400" />悬停右侧 → 编辑文本</span>
          <span class="text-gray-200">|</span>
          <span class="flex items-center gap-1"><CheckSquare class="w-3.5 h-3.5 text-amber-400" />多选后可批量删除</span>
        </div>

        <!-- 内容流 -->
        <div class="space-y-1.5">
          <template v-for="(line, idx) in lines" :key="line.id">

            <!-- 文本行 -->
            <div class="group relative flex items-start gap-2">
              <div v-if="isSelectMode" class="flex-shrink-0 pt-3 pl-1 cursor-pointer" @click="toggleSelect(line.id)">
                <div class="w-5 h-5 rounded border-2 flex items-center justify-center transition-all"
                  :class="selectedIds.has(line.id) ? 'border-amber-500 bg-amber-500' : 'border-gray-300 bg-white hover:border-amber-400'">
                  <Check v-if="selectedIds.has(line.id)" class="w-3 h-3 text-white" />
                </div>
              </div>
              <div class="flex-1 min-w-0 rounded-xl transition-all"
                :class="[isSelectMode && selectedIds.has(line.id) ? 'ring-2 ring-amber-300' : '', isSelectMode ? 'cursor-pointer' : '']"
                @click="isSelectMode ? toggleSelect(line.id) : undefined">
                <!-- 编辑态 -->
                <div v-if="line.editing" class="rounded-xl border-2 border-indigo-300 bg-white overflow-hidden shadow-sm">
                  <div class="px-3 py-2 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
                    <span class="text-xs font-medium text-indigo-600 flex items-center gap-1.5"><Pencil class="w-3 h-3" />编辑内容</span>
                    <div class="flex items-center gap-1">
                      <button class="flex items-center gap-1 px-2.5 py-1 text-xs bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors" @click.stop="saveEdit(line)"><Check class="w-3 h-3" />保存</button>
                      <button class="flex items-center gap-1 px-2.5 py-1 text-xs bg-white text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors" @click.stop="cancelEdit(line)"><X class="w-3 h-3" />取消</button>
                    </div>
                  </div>
                  <textarea v-model="line.editContent" class="w-full px-4 py-3 text-sm text-gray-800 outline-none resize-none min-h-[80px] font-mono leading-relaxed"
                    @keydown.escape.stop="cancelEdit(line)" @keydown.ctrl.enter.stop="saveEdit(line)" autofocus />
                  <div class="px-4 py-1.5 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">Ctrl+Enter 保存 · Esc 取消</div>
                </div>
                <!-- 普通行 -->
                <div v-else-if="line.data.type === 'plain'" class="px-4 py-2 rounded-xl text-sm text-gray-500 italic hover:bg-gray-100 transition-colors">{{ (line.data as any).text }}</div>
                <!-- 发言行 -->
                <div v-else-if="line.data.type === 'speech'" class="rounded-xl px-4 py-3 hover:shadow-sm transition-shadow"
                  :class="[getRoleStyle((line.data as any).role).bg, getRoleStyle((line.data as any).role).border]">
                  <div class="flex items-center gap-2 mb-1.5">
                    <span class="text-xs font-bold px-2 py-0.5 rounded-full" :class="getRoleStyle((line.data as any).role).label">{{ (line.data as any).roleLabel }}</span>
                    <span class="text-xs text-gray-400">{{ (line.data as any).timestamp }}</span>
                  </div>
                  <div class="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                    <span class="font-bold">{{ (line.data as any).roleLabel }}：</span>{{ (line.data as any).content }}
                  </div>
                </div>
              </div>
              <!-- 右侧按钮 -->
              <div v-if="!isSelectMode && !line.editing" class="flex-shrink-0 pt-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button class="flex items-center gap-1 px-2.5 py-1.5 text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors whitespace-nowrap" @click.stop="startEdit(line)">
                  <Pencil class="w-3.5 h-3.5" />编辑
                </button>
                <button
                  class="flex items-center gap-1 px-2.5 py-1.5 text-xs whitespace-nowrap rounded-lg border transition-colors"
                  :class="inlineEditKey === `new-${idx}` ? 'text-emerald-700 bg-emerald-100 border-emerald-300' : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'"
                  @click.stop="openNewTable(idx)">
                  <Table2 class="w-3.5 h-3.5" />插入表格
                </button>
              </div>
            </div>

            <!-- ── 内联新增表格编辑区 ── -->
            <Transition name="inline-expand">
              <div v-if="inlineEditKey === `new-${idx}`" class="my-2 rounded-2xl border-2 border-emerald-300 bg-white shadow-lg overflow-hidden">
                <!-- 编辑器头部 -->
                <div class="flex items-center justify-between px-4 py-3 bg-emerald-50 border-b border-emerald-200">
                  <div class="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                    <Table2 class="w-4 h-4" />新建分析表格
                    <span class="text-xs font-normal text-emerald-500">· {{ inlineRows.length }} 行</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <button class="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg transition-colors" @click="closeInline">取消</button>
                    <button class="px-4 py-1.5 text-xs font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors" @click="saveInline(idx, null)">保存表格</button>
                    <button class="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg" @click="closeInline"><X class="w-4 h-4" /></button>
                  </div>
                </div>

                <!-- 编辑器主体：左右布局 -->
                <div class="flex" style="min-height:480px">

                  <!-- 左侧：上下文 + 填写区 -->
                  <div class="w-[400px] flex-shrink-0 flex flex-col border-r border-gray-100">

                    <!-- 上下文对话 -->
                    <div v-if="inlineContextLines.length > 0" class="flex-shrink-0 border-b border-gray-100">
                      <button class="w-full px-4 py-2 flex items-center justify-between text-xs font-semibold text-gray-500 hover:bg-gray-50" @click="inlineContextExpanded = !inlineContextExpanded">
                        <span class="flex items-center gap-1.5"><MessageSquare class="w-3.5 h-3.5 text-indigo-400" />对话上下文 <span class="font-normal text-gray-400">({{ inlineContextLines.length }} 条)</span></span>
                        <component :is="inlineContextExpanded ? ChevronUp : ChevronDown" class="w-3.5 h-3.5 text-gray-400" />
                      </button>
                      <div v-if="inlineContextExpanded" class="max-h-44 overflow-y-auto px-3 py-2 space-y-1.5 bg-gray-50/60">
                        <template v-for="(cl, ci) in inlineContextLines" :key="ci">
                          <div v-if="cl.type === 'speech'" class="rounded-lg px-3 py-2 text-xs"
                            :class="[getRoleStyle((cl as any).role).bg, 'border-l-2 ' + ((cl as any).role === 'counselor' ? 'border-violet-300' : 'border-sky-300')]">
                            <div class="flex items-center gap-1.5 mb-0.5">
                              <span class="font-bold text-[10px] px-1.5 py-0.5 rounded" :class="getRoleStyle((cl as any).role).label">{{ (cl as any).roleLabel }}</span>
                              <span class="text-[10px] text-gray-400">{{ (cl as any).timestamp }}</span>
                            </div>
                            <div class="text-gray-700">{{ (cl as any).content }}</div>
                          </div>
                          <div v-else-if="cl.type === 'plain'" class="px-2 py-1 text-xs text-gray-400 italic">{{ (cl as any).text }}</div>
                        </template>
                      </div>
                    </div>

                    <!-- 行选择器 -->
                    <div class="flex-shrink-0 border-b border-gray-100 px-4 py-2.5">
                      <div class="flex items-center justify-between mb-2">
                        <span class="text-xs font-semibold text-gray-500">数据行</span>
                        <button class="flex items-center gap-1 text-xs text-emerald-600 hover:bg-emerald-50 px-2 py-1 rounded-lg" @click="addInlineRow">
                          <Plus class="w-3 h-3" />添加行
                        </button>
                      </div>
                      <div class="flex flex-wrap gap-1.5">
                        <button v-for="(row, ri) in inlineRows" :key="row.id"
                          class="flex items-center gap-1 px-3 py-1 text-xs rounded-xl border transition-all"
                          :class="inlineActiveRowIdx === ri ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-emerald-300'"
                          @click="selectInlineRow(ri)">
                          第 {{ ri + 1 }} 行
                          <span v-if="row.intents.length || row.techs.length" class="w-1.5 h-1.5 rounded-full" :class="inlineActiveRowIdx === ri ? 'bg-white' : 'bg-emerald-400'" />
                        </button>
                        <button v-if="inlineRows.length > 1" class="px-2 py-1 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl border border-gray-200 transition-colors"
                          @click="removeInlineRow(inlineActiveRowIdx)"><Trash2 class="w-3 h-3" /></button>
                      </div>
                    </div>

                    <!-- 面板 Tab -->
                    <div class="flex-shrink-0 flex border-b border-gray-100">
                      <button v-for="(label, key) in { intent: '助人者意图', tech: '助人技术', other: '其他字段' }" :key="key"
                        class="flex-1 py-2 text-xs font-medium transition-colors"
                        :class="inlineActivePanel === key ? 'text-emerald-600 border-b-2 border-emerald-500 bg-emerald-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'"
                        @click="inlineActivePanel = key as any">{{ label }}</button>
                    </div>

                    <!-- 面板内容 -->
                    <div class="flex-1 overflow-y-auto" v-if="inlineActiveRow">

                      <!-- 意图 -->
                      <div v-if="inlineActivePanel === 'intent'" class="p-3">
                        <p class="text-xs text-gray-400 mb-2">点击选择（可多选）</p>
                        <div v-if="inlineActiveRow.intents.length" class="flex flex-wrap gap-1 mb-3 p-2 bg-violet-50 rounded-xl border border-violet-100">
                          <span v-for="item in inlineActiveRow.intents" :key="item.id" class="inline-flex items-center gap-1 text-xs bg-violet-100 text-violet-700 rounded-lg px-2 py-0.5">
                            {{ item.id }}.{{ item.name }}<button class="hover:text-red-500" @click="toggleIntent(item)"><X class="w-2.5 h-2.5" /></button>
                          </span>
                        </div>
                        <div class="space-y-1">
                          <div v-for="item in INTENTS" :key="item.id"
                            class="flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer transition-all"
                            :class="hasIntent(item) ? 'border-violet-300 bg-violet-50' : 'border-gray-100 hover:border-violet-200 hover:bg-violet-50/40'"
                            @click="toggleIntent(item)">
                            <div class="mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors"
                              :class="hasIntent(item) ? 'border-violet-500 bg-violet-500' : 'border-gray-300'">
                              <Check v-if="hasIntent(item)" class="w-2.5 h-2.5 text-white" />
                            </div>
                            <div>
                              <div class="text-xs font-medium text-gray-700">{{ item.id }}. {{ item.name }}</div>
                              <div class="text-[10px] text-gray-400 leading-snug">{{ item.meaning }}</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <!-- 技术 -->
                      <div v-else-if="inlineActivePanel === 'tech'" class="p-3">
                        <p class="text-xs text-gray-400 mb-2">点击选择（可多选）</p>
                        <div v-if="inlineActiveRow.techs.length" class="flex flex-wrap gap-1 mb-3 p-2 bg-sky-50 rounded-xl border border-sky-100">
                          <span v-for="item in inlineActiveRow.techs" :key="item.subId" class="inline-flex items-center gap-1 text-xs bg-sky-100 text-sky-700 rounded-lg px-2 py-0.5">
                            {{ item.subId }} {{ item.name }}<button class="hover:text-red-500" @click="toggleTech(item)"><X class="w-2.5 h-2.5" /></button>
                          </span>
                        </div>
                        <div class="space-y-1">
                          <div v-for="item in TECHS" :key="item.subId"
                            class="flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer transition-all"
                            :class="hasTech(item) ? 'border-sky-300 bg-sky-50' : 'border-gray-100 hover:border-sky-200 hover:bg-sky-50/40'"
                            @click="toggleTech(item)">
                            <div class="mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors"
                              :class="hasTech(item) ? 'border-sky-500 bg-sky-500' : 'border-gray-300'">
                              <Check v-if="hasTech(item)" class="w-2.5 h-2.5 text-white" />
                            </div>
                            <div>
                              <div class="text-xs font-medium text-gray-700"><span class="font-bold text-sky-700">{{ item.subId }}</span> {{ item.name }}<span v-if="item.subType!=='-'" class="text-gray-400 font-normal"> · {{ item.subType }}</span></div>
                              <div class="text-[10px] text-gray-400 leading-snug">{{ item.meaning }}</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <!-- 其他字段 -->
                      <div v-else-if="inlineActivePanel === 'other'" class="p-3 space-y-4">
                        <div>
                          <label class="block text-xs font-semibold text-gray-600 mb-2">有效性 5 点评分</label>
                          <div class="grid grid-cols-2 gap-3">
                            <div>
                              <div class="text-xs text-gray-400 mb-1.5">咨询师</div>
                              <div class="flex gap-1.5">
                                <button v-for="s in SCORES" :key="'c'+s"
                                  class="w-8 h-8 rounded-xl border-2 text-sm font-bold transition-all"
                                  :class="inlineActiveRow.scoreC === s ? 'border-violet-500 bg-violet-500 text-white' : 'border-gray-200 text-gray-500 hover:border-violet-300'"
                                  @click="inlineActiveRow.scoreC = inlineActiveRow.scoreC === s ? '' : s">{{ s }}</button>
                              </div>
                            </div>
                            <div>
                              <div class="text-xs text-gray-400 mb-1.5">来访者</div>
                              <div class="flex gap-1.5">
                                <button v-for="s in SCORES" :key="'v'+s"
                                  class="w-8 h-8 rounded-xl border-2 text-sm font-bold transition-all"
                                  :class="inlineActiveRow.scoreV === s ? 'border-sky-500 bg-sky-500 text-white' : 'border-gray-200 text-gray-500 hover:border-sky-300'"
                                  @click="inlineActiveRow.scoreV = inlineActiveRow.scoreV === s ? '' : s">{{ s }}</button>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div>
                          <label class="block text-xs font-semibold text-gray-600 mb-1.5">当事人反应</label>
                          <textarea v-model="inlineActiveRow.reaction" rows="3" class="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl outline-none focus:border-indigo-300 resize-none" placeholder="填写当事人反应..." />
                        </div>
                        <div>
                          <label class="block text-xs font-semibold text-gray-600 mb-1.5">更好的干预（如有）</label>
                          <textarea v-model="inlineActiveRow.betterIntervention" rows="3" class="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl outline-none focus:border-indigo-300 resize-none" placeholder="如果有更好的干预方式，请填写..." />
                        </div>
                      </div>

                    </div>
                  </div>

                  <!-- 右侧：表格预览 -->
                  <div class="flex-1 overflow-auto p-4 bg-gray-50/50">
                    <div class="text-xs font-semibold text-gray-500 mb-3">表格预览（实时同步）</div>
                    <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                      <div class="overflow-x-auto">
                        <table class="w-full border-collapse text-xs" style="min-width:480px">
                          <thead>
                            <tr class="bg-blue-50">
                              <th rowspan="2" class="border border-gray-300 px-2 py-1.5 text-center font-bold w-24 align-middle">助人者意图</th>
                              <th rowspan="2" class="border border-gray-300 px-2 py-1.5 text-center font-bold w-24 align-middle">助人技术</th>
                              <th colspan="2" class="border border-gray-300 px-2 py-1.5 text-center font-bold">有效性评分</th>
                              <th rowspan="2" class="border border-gray-300 px-2 py-1.5 text-center font-bold w-20 align-middle">当事人反应</th>
                              <th rowspan="2" class="border border-gray-300 px-2 py-1.5 text-center font-bold align-middle">更好的干预</th>
                            </tr>
                            <tr class="bg-blue-50">
                              <th class="border border-gray-300 px-2 py-1 text-center font-bold w-10">咨</th>
                              <th class="border border-gray-300 px-2 py-1 text-center font-bold w-10">访</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr v-for="(row, ri) in inlineRows" :key="row.id" class="cursor-pointer transition-colors"
                              :class="inlineActiveRowIdx === ri ? 'bg-emerald-50 ring-2 ring-inset ring-emerald-300' : 'hover:bg-gray-50'"
                              @click="selectInlineRow(ri)">
                              <td class="border border-gray-200 px-2 py-1.5 align-top">
                                <div v-if="row.intents.length" class="space-y-0.5">
                                  <div v-for="i in row.intents" :key="i.id" class="text-violet-700">{{ i.id }}.{{ i.name }}</div>
                                </div>
                                <span v-else class="text-gray-300 italic">未选</span>
                              </td>
                              <td class="border border-gray-200 px-2 py-1.5 align-top">
                                <div v-if="row.techs.length" class="space-y-0.5">
                                  <div v-for="t in row.techs" :key="t.subId" class="text-sky-700">{{ t.subId }} {{ t.name }}</div>
                                </div>
                                <span v-else class="text-gray-300 italic">未选</span>
                              </td>
                              <td class="border border-gray-200 px-2 py-1.5 text-center font-bold"><span :class="row.scoreC ? 'text-violet-600' : 'text-gray-200'">{{ row.scoreC || '-' }}</span></td>
                              <td class="border border-gray-200 px-2 py-1.5 text-center font-bold"><span :class="row.scoreV ? 'text-sky-600' : 'text-gray-200'">{{ row.scoreV || '-' }}</span></td>
                              <td class="border border-gray-200 px-2 py-1.5 align-top text-gray-600 whitespace-pre-wrap">{{ row.reaction }}</td>
                              <td class="border border-gray-200 px-2 py-1.5 align-top text-gray-600 whitespace-pre-wrap">{{ row.betterIntervention }}</td>
                            </tr>
                            <tr v-if="inlineRows.length === 0">
                              <td colspan="6" class="py-6 text-center text-gray-300">请添加数据行</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <p class="mt-2 text-[10px] text-gray-400 text-center">点击行可切换编辑</p>
                  </div>

                </div>
              </div>
            </Transition>

            <!-- 嵌入表格预览卡片 -->
            <template v-if="embeddedTables.get(idx)?.length">
              <div v-for="tbl in embeddedTables.get(idx)" :key="tbl.id"
                class="my-2 rounded-2xl border border-emerald-200 overflow-hidden shadow-sm bg-white">
                <!-- 卡片顶栏 -->
                <div class="flex items-center justify-between px-4 py-2.5 bg-emerald-50 border-b border-emerald-100">
                  <div class="flex items-center gap-2 text-sm font-medium text-emerald-700">
                    <Table2 class="w-4 h-4" />分析表格
                    <span class="text-xs text-emerald-500 font-normal">· {{ tbl.rows.length }} 行数据</span>
                  </div>
                  <div class="flex items-center gap-1">
                    <button class="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
                      :class="inlineEditKey === `${idx}-${tbl.id}` ? 'text-emerald-700 bg-emerald-200' : 'text-emerald-700 hover:bg-emerald-100'"
                      @click="openEditTable(idx, tbl.id)">
                      <Pen class="w-3.5 h-3.5" />{{ inlineEditKey === `${idx}-${tbl.id}` ? '收起' : '编辑' }}
                    </button>
                    <button class="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" @click="removeTable(idx, tbl.id)">
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <!-- 内联编辑区（编辑已有表格，复用同一套 UI） -->
                <Transition name="inline-expand">
                  <div v-if="inlineEditKey === `${idx}-${tbl.id}`" class="border-b border-emerald-100">
                    <!-- 保存/取消栏 -->
                    <div class="flex items-center justify-end gap-2 px-4 py-2 bg-emerald-50/50 border-b border-emerald-100">
                      <button class="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg" @click="closeInline">取消</button>
                      <button class="px-4 py-1.5 text-xs font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg" @click="saveInline(idx, tbl.id)">保存</button>
                    </div>
                    <!-- 编辑主体 -->
                    <div class="flex" style="min-height:480px">
                      <!-- 左侧 -->
                      <div class="w-[400px] flex-shrink-0 flex flex-col border-r border-gray-100">
                        <!-- 上下文 -->
                        <div v-if="inlineContextLines.length > 0" class="flex-shrink-0 border-b border-gray-100">
                          <button class="w-full px-4 py-2 flex items-center justify-between text-xs font-semibold text-gray-500 hover:bg-gray-50" @click="inlineContextExpanded = !inlineContextExpanded">
                            <span class="flex items-center gap-1.5"><MessageSquare class="w-3.5 h-3.5 text-indigo-400" />对话上下文 <span class="font-normal text-gray-400">({{ inlineContextLines.length }} 条)</span></span>
                            <component :is="inlineContextExpanded ? ChevronUp : ChevronDown" class="w-3.5 h-3.5 text-gray-400" />
                          </button>
                          <div v-if="inlineContextExpanded" class="max-h-44 overflow-y-auto px-3 py-2 space-y-1.5 bg-gray-50/60">
                            <template v-for="(cl, ci) in inlineContextLines" :key="ci">
                              <div v-if="cl.type === 'speech'" class="rounded-lg px-3 py-2 text-xs"
                                :class="[getRoleStyle((cl as any).role).bg, 'border-l-2 ' + ((cl as any).role === 'counselor' ? 'border-violet-300' : 'border-sky-300')]">
                                <div class="flex items-center gap-1.5 mb-0.5">
                                  <span class="font-bold text-[10px] px-1.5 py-0.5 rounded" :class="getRoleStyle((cl as any).role).label">{{ (cl as any).roleLabel }}</span>
                                  <span class="text-[10px] text-gray-400">{{ (cl as any).timestamp }}</span>
                                </div>
                                <div class="text-gray-700">{{ (cl as any).content }}</div>
                              </div>
                              <div v-else-if="cl.type === 'plain'" class="px-2 py-1 text-xs text-gray-400 italic">{{ (cl as any).text }}</div>
                            </template>
                          </div>
                        </div>
                        <!-- 行选择器 -->
                        <div class="flex-shrink-0 border-b border-gray-100 px-4 py-2.5">
                          <div class="flex items-center justify-between mb-2">
                            <span class="text-xs font-semibold text-gray-500">数据行</span>
                            <button class="flex items-center gap-1 text-xs text-emerald-600 hover:bg-emerald-50 px-2 py-1 rounded-lg" @click="addInlineRow"><Plus class="w-3 h-3" />添加行</button>
                          </div>
                          <div class="flex flex-wrap gap-1.5">
                            <button v-for="(row, ri) in inlineRows" :key="row.id"
                              class="flex items-center gap-1 px-3 py-1 text-xs rounded-xl border transition-all"
                              :class="inlineActiveRowIdx === ri ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-emerald-300'"
                              @click="selectInlineRow(ri)">
                              第 {{ ri + 1 }} 行
                              <span v-if="row.intents.length || row.techs.length" class="w-1.5 h-1.5 rounded-full" :class="inlineActiveRowIdx === ri ? 'bg-white' : 'bg-emerald-400'" />
                            </button>
                            <button v-if="inlineRows.length > 1" class="px-2 py-1 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl border border-gray-200 transition-colors" @click="removeInlineRow(inlineActiveRowIdx)"><Trash2 class="w-3 h-3" /></button>
                          </div>
                        </div>
                        <!-- Tab -->
                        <div class="flex-shrink-0 flex border-b border-gray-100">
                          <button v-for="(label, key) in { intent: '助人者意图', tech: '助人技术', other: '其他字段' }" :key="key"
                            class="flex-1 py-2 text-xs font-medium transition-colors"
                            :class="inlineActivePanel === key ? 'text-emerald-600 border-b-2 border-emerald-500 bg-emerald-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'"
                            @click="inlineActivePanel = key as any">{{ label }}</button>
                        </div>
                        <!-- 面板内容 -->
                        <div class="flex-1 overflow-y-auto" v-if="inlineActiveRow">
                          <div v-if="inlineActivePanel === 'intent'" class="p-3">
                            <div v-if="inlineActiveRow.intents.length" class="flex flex-wrap gap-1 mb-3 p-2 bg-violet-50 rounded-xl border border-violet-100">
                              <span v-for="item in inlineActiveRow.intents" :key="item.id" class="inline-flex items-center gap-1 text-xs bg-violet-100 text-violet-700 rounded-lg px-2 py-0.5">
                                {{ item.id }}.{{ item.name }}<button class="hover:text-red-500" @click="toggleIntent(item)"><X class="w-2.5 h-2.5" /></button>
                              </span>
                            </div>
                            <div class="space-y-1">
                              <div v-for="item in INTENTS" :key="item.id" class="flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer transition-all"
                                :class="hasIntent(item) ? 'border-violet-300 bg-violet-50' : 'border-gray-100 hover:border-violet-200 hover:bg-violet-50/40'"
                                @click="toggleIntent(item)">
                                <div class="mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center" :class="hasIntent(item) ? 'border-violet-500 bg-violet-500' : 'border-gray-300'">
                                  <Check v-if="hasIntent(item)" class="w-2.5 h-2.5 text-white" />
                                </div>
                                <div><div class="text-xs font-medium text-gray-700">{{ item.id }}. {{ item.name }}</div><div class="text-[10px] text-gray-400">{{ item.meaning }}</div></div>
                              </div>
                            </div>
                          </div>
                          <div v-else-if="inlineActivePanel === 'tech'" class="p-3">
                            <div v-if="inlineActiveRow.techs.length" class="flex flex-wrap gap-1 mb-3 p-2 bg-sky-50 rounded-xl border border-sky-100">
                              <span v-for="item in inlineActiveRow.techs" :key="item.subId" class="inline-flex items-center gap-1 text-xs bg-sky-100 text-sky-700 rounded-lg px-2 py-0.5">
                                {{ item.subId }} {{ item.name }}<button class="hover:text-red-500" @click="toggleTech(item)"><X class="w-2.5 h-2.5" /></button>
                              </span>
                            </div>
                            <div class="space-y-1">
                              <div v-for="item in TECHS" :key="item.subId" class="flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer transition-all"
                                :class="hasTech(item) ? 'border-sky-300 bg-sky-50' : 'border-gray-100 hover:border-sky-200 hover:bg-sky-50/40'"
                                @click="toggleTech(item)">
                                <div class="mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center" :class="hasTech(item) ? 'border-sky-500 bg-sky-500' : 'border-gray-300'">
                                  <Check v-if="hasTech(item)" class="w-2.5 h-2.5 text-white" />
                                </div>
                                <div><div class="text-xs font-medium text-gray-700"><span class="font-bold text-sky-700">{{ item.subId }}</span> {{ item.name }}</div><div class="text-[10px] text-gray-400">{{ item.meaning }}</div></div>
                              </div>
                            </div>
                          </div>
                          <div v-else-if="inlineActivePanel === 'other'" class="p-3 space-y-4">
                            <div>
                              <label class="block text-xs font-semibold text-gray-600 mb-2">有效性 5 点评分</label>
                              <div class="grid grid-cols-2 gap-3">
                                <div><div class="text-xs text-gray-400 mb-1.5">咨询师</div><div class="flex gap-1.5">
                                  <button v-for="s in SCORES" :key="'c'+s" class="w-8 h-8 rounded-xl border-2 text-sm font-bold transition-all"
                                    :class="inlineActiveRow.scoreC === s ? 'border-violet-500 bg-violet-500 text-white' : 'border-gray-200 text-gray-500 hover:border-violet-300'"
                                    @click="inlineActiveRow.scoreC = inlineActiveRow.scoreC === s ? '' : s">{{ s }}</button>
                                </div></div>
                                <div><div class="text-xs text-gray-400 mb-1.5">来访者</div><div class="flex gap-1.5">
                                  <button v-for="s in SCORES" :key="'v'+s" class="w-8 h-8 rounded-xl border-2 text-sm font-bold transition-all"
                                    :class="inlineActiveRow.scoreV === s ? 'border-sky-500 bg-sky-500 text-white' : 'border-gray-200 text-gray-500 hover:border-sky-300'"
                                    @click="inlineActiveRow.scoreV = inlineActiveRow.scoreV === s ? '' : s">{{ s }}</button>
                                </div></div>
                              </div>
                            </div>
                            <div><label class="block text-xs font-semibold text-gray-600 mb-1.5">当事人反应</label>
                              <textarea v-model="inlineActiveRow.reaction" rows="3" class="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl outline-none focus:border-indigo-300 resize-none" placeholder="填写当事人反应..." /></div>
                            <div><label class="block text-xs font-semibold text-gray-600 mb-1.5">更好的干预（如有）</label>
                              <textarea v-model="inlineActiveRow.betterIntervention" rows="3" class="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl outline-none focus:border-indigo-300 resize-none" placeholder="如果有更好的干预方式，请填写..." /></div>
                          </div>
                        </div>
                      </div>
                      <!-- 右侧预览 -->
                      <div class="flex-1 overflow-auto p-4 bg-gray-50/50">
                        <div class="text-xs font-semibold text-gray-500 mb-3">表格预览</div>
                        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                          <div class="overflow-x-auto">
                            <table class="w-full border-collapse text-xs" style="min-width:480px">
                              <thead>
                                <tr class="bg-blue-50">
                                  <th rowspan="2" class="border border-gray-300 px-2 py-1.5 text-center font-bold w-24 align-middle">助人者意图</th>
                                  <th rowspan="2" class="border border-gray-300 px-2 py-1.5 text-center font-bold w-24 align-middle">助人技术</th>
                                  <th colspan="2" class="border border-gray-300 px-2 py-1.5 text-center font-bold">有效性评分</th>
                                  <th rowspan="2" class="border border-gray-300 px-2 py-1.5 text-center font-bold w-20 align-middle">当事人反应</th>
                                  <th rowspan="2" class="border border-gray-300 px-2 py-1.5 text-center font-bold align-middle">更好的干预</th>
                                </tr>
                                <tr class="bg-blue-50">
                                  <th class="border border-gray-300 px-2 py-1 text-center font-bold w-10">咨</th>
                                  <th class="border border-gray-300 px-2 py-1 text-center font-bold w-10">访</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr v-for="(row, ri) in inlineRows" :key="row.id" class="cursor-pointer transition-colors"
                                  :class="inlineActiveRowIdx === ri ? 'bg-emerald-50 ring-2 ring-inset ring-emerald-300' : 'hover:bg-gray-50'"
                                  @click="selectInlineRow(ri)">
                                  <td class="border border-gray-200 px-2 py-1.5 align-top">
                                    <div v-if="row.intents.length" class="space-y-0.5"><div v-for="i in row.intents" :key="i.id" class="text-violet-700">{{ i.id }}.{{ i.name }}</div></div>
                                    <span v-else class="text-gray-300 italic">未选</span>
                                  </td>
                                  <td class="border border-gray-200 px-2 py-1.5 align-top">
                                    <div v-if="row.techs.length" class="space-y-0.5"><div v-for="t in row.techs" :key="t.subId" class="text-sky-700">{{ t.subId }} {{ t.name }}</div></div>
                                    <span v-else class="text-gray-300 italic">未选</span>
                                  </td>
                                  <td class="border border-gray-200 px-2 py-1.5 text-center font-bold"><span :class="row.scoreC ? 'text-violet-600' : 'text-gray-200'">{{ row.scoreC || '-' }}</span></td>
                                  <td class="border border-gray-200 px-2 py-1.5 text-center font-bold"><span :class="row.scoreV ? 'text-sky-600' : 'text-gray-200'">{{ row.scoreV || '-' }}</span></td>
                                  <td class="border border-gray-200 px-2 py-1.5 align-top text-gray-600 whitespace-pre-wrap">{{ row.reaction }}</td>
                                  <td class="border border-gray-200 px-2 py-1.5 align-top text-gray-600 whitespace-pre-wrap">{{ row.betterIntervention }}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Transition>

                <!-- 只读预览 -->
                <div class="overflow-x-auto px-4 py-3">
                  <table class="w-full border-collapse text-xs" style="min-width:560px">
                    <thead>
                      <tr class="bg-blue-50">
                        <th rowspan="2" class="border border-gray-300 px-2 py-1.5 text-center font-bold w-28 align-middle">助人者意图</th>
                        <th rowspan="2" class="border border-gray-300 px-2 py-1.5 text-center font-bold w-28 align-middle">助人技术</th>
                        <th colspan="2" class="border border-gray-300 px-2 py-1.5 text-center font-bold">有效性 5 点评分</th>
                        <th rowspan="2" class="border border-gray-300 px-2 py-1.5 text-center font-bold w-20 align-middle">当事人反应</th>
                        <th rowspan="2" class="border border-gray-300 px-2 py-1.5 text-center font-bold align-middle">更好的干预（如有）</th>
                      </tr>
                      <tr class="bg-blue-50">
                        <th class="border border-gray-300 px-2 py-1 text-center font-bold w-14">咨询师</th>
                        <th class="border border-gray-300 px-2 py-1 text-center font-bold w-14">来访者</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="row in tbl.rows" :key="row.id" class="hover:bg-gray-50">
                        <td class="border border-gray-200 px-2 py-1.5 align-top text-violet-700">{{ row.intents.map(i => `${i.id}.${i.name}`).join('、') || '—' }}</td>
                        <td class="border border-gray-200 px-2 py-1.5 align-top text-sky-700">{{ row.techs.map(t => `${t.subId} ${t.name}`).join('、') || '—' }}</td>
                        <td class="border border-gray-200 px-2 py-1.5 text-center font-bold text-violet-600">{{ row.scoreC || '-' }}</td>
                        <td class="border border-gray-200 px-2 py-1.5 text-center font-bold text-sky-600">{{ row.scoreV || '-' }}</td>
                        <td class="border border-gray-200 px-2 py-1.5 align-top text-gray-600 whitespace-pre-wrap">{{ row.reaction }}</td>
                        <td class="border border-gray-200 px-2 py-1.5 align-top text-gray-600 whitespace-pre-wrap">{{ row.betterIntervention }}</td>
                      </tr>
                      <tr v-if="tbl.rows.length === 0"><td colspan="6" class="py-4 text-center text-gray-300">暂无数据</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </template>

          </template>
          <div v-if="lines.length === 0" class="text-center py-20 text-gray-400"><p>暂无内容</p></div>
        </div>
      </div>
    </main>

      <!-- ── 右侧 AI 督导面板 ── -->
      <Transition name="panel-slide">
        <div v-if="showAnalysisPanel" class="w-96 flex-shrink-0 border-l border-gray-100 overflow-hidden">
          <AnalysisPanel
            :payload="analysisPayload"
            class="h-full"
            @report-ready="handleReportReady"
          />
        </div>
      </Transition>
    </div>

    <!-- ── 报告预览弹窗 ── -->
    <ReportViewer
      :reports="reports"
      :visible="showReportViewer"
      @close="showReportViewer = false"
    />
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.animate-slide-up { animation: slideUp 0.22s ease-out; }
@keyframes slideUp {
  from { opacity: 0; transform: translateY(12px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
.inline-expand-enter-active { transition: all 0.25s ease; overflow: hidden; }
.inline-expand-leave-active { transition: all 0.2s ease; overflow: hidden; }
.inline-expand-enter-from, .inline-expand-leave-to { opacity: 0; max-height: 0 !important; }
.inline-expand-enter-to, .inline-expand-leave-from { opacity: 1; max-height: 2000px; }
.panel-slide-enter-active, .panel-slide-leave-active { transition: all 0.28s ease; overflow: hidden; }
.panel-slide-enter-from, .panel-slide-leave-to { opacity: 0; width: 0; min-width: 0; }
.panel-slide-enter-to, .panel-slide-leave-from { opacity: 1; width: 24rem; }
</style>
