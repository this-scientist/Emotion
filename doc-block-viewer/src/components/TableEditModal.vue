<script setup lang="ts">
/**
 * TableEditModal.vue
 * 全屏弹窗：左侧逐行填写（含意图/技术多选面板），右侧实时预览表格
 */
import { ref, computed, watch } from 'vue'
import { X, Plus, Trash2, Check, Eye, MessageSquare } from 'lucide-vue-next'
import { INTENTS, TECHS, intentLabel, techLabel, type IntentItem, type TechItem } from '../data/tableData'
import type { TableRowData } from './TableEditor.vue'
import type { FormattedLine } from '../utils/extractSpeakers'

const props = defineProps<{
  visible: boolean
  initialRows?: TableRowData[]
  contextLines?: FormattedLine[]
}>()

const emit = defineEmits<{
  close: []
  save: [rows: TableRowData[]]
}>()

// ── 行数据 ──
function createEmptyRow(): TableRowData {
  return {
    id: `row-${Date.now()}-${Math.random()}`,
    intents: [], techs: [],
    scoreC: '', scoreV: '', reaction: '', betterIntervention: '',
  }
}

const rows = ref<TableRowData[]>([createEmptyRow()])
const activeRowIdx = ref(0)

watch(() => props.visible, (v) => {
  if (v) {
    rows.value = props.initialRows?.length
      ? props.initialRows.map(r => ({ ...r, intents: [...r.intents], techs: [...r.techs] }))
      : [createEmptyRow()]
    activeRowIdx.value = 0
    activePanel.value = 'intent'
  }
})

const activeRow = computed(() => rows.value[activeRowIdx.value])

function addRow() {
  rows.value.push(createEmptyRow())
  activeRowIdx.value = rows.value.length - 1
}

function removeRow(idx: number) {
  if (rows.value.length === 1) return
  rows.value.splice(idx, 1)
  if (activeRowIdx.value >= rows.value.length) activeRowIdx.value = rows.value.length - 1
}

function selectRow(idx: number) {
  activeRowIdx.value = idx
  activePanel.value = 'intent'
}

// ── 左侧面板切换 ──
type Panel = 'intent' | 'tech' | 'other'
const activePanel = ref<Panel>('intent')

// ── 意图操作 ──
function toggleIntent(item: IntentItem) {
  const row = activeRow.value
  const idx = row.intents.findIndex(i => i.id === item.id)
  if (idx === -1) row.intents.push(item)
  else row.intents.splice(idx, 1)
}
function hasIntent(item: IntentItem) {
  return activeRow.value.intents.some(i => i.id === item.id)
}

// ── 技术操作 ──
function toggleTech(item: TechItem) {
  const row = activeRow.value
  const idx = row.techs.findIndex(t => t.subId === item.subId)
  if (idx === -1) row.techs.push(item)
  else row.techs.splice(idx, 1)
}
function hasTech(item: TechItem) {
  return activeRow.value.techs.some(t => t.subId === item.subId)
}

// ── 保存 ──
function handleSave() {
  emit('save', rows.value.map(r => ({ ...r })))
}

// 评分选项
const SCORES = ['1', '2', '3', '4', '5']

function getRoleStyle(role: 'counselor' | 'visitor') {
  return role === 'counselor'
    ? { bg: 'bg-violet-50', border: 'border-l-4 border-violet-400', label: 'text-violet-700 bg-violet-100' }
    : { bg: 'bg-sky-50',    border: 'border-l-4 border-sky-400',    label: 'text-sky-700 bg-sky-100' }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="visible"
        class="fixed inset-0 z-[200] flex flex-col bg-gray-50"
      >
        <!-- ── 顶栏 ── -->
        <div class="flex-shrink-0 h-14 bg-white border-b border-gray-100 flex items-center justify-between px-6 shadow-sm">
          <div class="flex items-center gap-3">
            <div class="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center">
              <Eye class="w-4 h-4 text-white" />
            </div>
            <h2 class="text-base font-semibold text-gray-800">编辑分析表格</h2>
            <span class="text-xs text-gray-400">· 共 {{ rows.length }} 行</span>
          </div>
          <div class="flex items-center gap-2">
            <button
              class="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
              @click="$emit('close')"
            >取消</button>
            <button
              class="px-5 py-2 text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl transition-colors"
              @click="handleSave"
            >保存表格</button>
            <button
              class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              @click="$emit('close')"
            ><X class="w-5 h-5" /></button>
          </div>
        </div>

        <!-- ── 主体：左侧编辑 + 右侧预览 ── -->
        <div class="flex-1 flex overflow-hidden">

          <!-- ════ 左侧：行列表 + 编辑面板 ════ -->
          <div class="w-[420px] flex-shrink-0 flex flex-col border-r border-gray-200 bg-white">

            <!-- 行选择器 -->
            <div class="flex-shrink-0 border-b border-gray-100 px-4 py-3">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-semibold text-gray-500">数据行</span>
                <button
                  class="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-2 py-1 rounded-lg transition-colors"
                  @click="addRow"
                >
                  <Plus class="w-3.5 h-3.5" />添加行
                </button>
              </div>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="(row, idx) in rows"
                  :key="row.id"
                  class="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl border transition-all"
                  :class="activeRowIdx === idx
                    ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-emerald-300'"
                  @click="selectRow(idx)"
                >
                  第 {{ idx + 1 }} 行
                  <span
                    v-if="row.intents.length || row.techs.length"
                    class="w-1.5 h-1.5 rounded-full"
                    :class="activeRowIdx === idx ? 'bg-white' : 'bg-emerald-400'"
                  />
                </button>
                <!-- 删除当前行 -->
                <button
                  v-if="rows.length > 1"
                  class="px-2 py-1.5 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl border border-gray-200 hover:border-red-200 transition-colors"
                  :title="`删除第 ${activeRowIdx + 1} 行`"
                  @click="removeRow(activeRowIdx)"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <!-- 面板标签 -->
            <div class="flex-shrink-0 flex border-b border-gray-100">
              <button
                v-for="(label, key) in { intent: '助人者意图', tech: '助人技术', other: '其他字段' }"
                :key="key"
                class="flex-1 py-2.5 text-xs font-medium transition-colors"
                :class="activePanel === key
                  ? 'text-emerald-600 border-b-2 border-emerald-500 bg-emerald-50/50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'"
                @click="activePanel = key as Panel"
              >{{ label }}</button>
            </div>

            <!-- ── 面板内容 ── -->
            <div class="flex-1 overflow-y-auto" v-if="activeRow">

              <!-- 助人者意图 -->
              <div v-if="activePanel === 'intent'" class="p-4">
                <p class="text-xs text-gray-400 mb-3">点击选择（可多选），已选显示在右侧表格中</p>
                <!-- 已选 -->
                <div v-if="activeRow.intents.length" class="flex flex-wrap gap-1.5 mb-4 p-3 bg-violet-50 rounded-xl border border-violet-100">
                  <span
                    v-for="item in activeRow.intents" :key="item.id"
                    class="inline-flex items-center gap-1 text-xs bg-violet-100 text-violet-700 rounded-lg px-2 py-1"
                  >
                    {{ item.id }}.{{ item.name }}
                    <button class="hover:text-red-500 transition-colors" @click="toggleIntent(item)">
                      <X class="w-3 h-3" />
                    </button>
                  </span>
                </div>
                <!-- 列表 -->
                <div class="space-y-1">
                  <div
                    v-for="item in INTENTS" :key="item.id"
                    class="flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all"
                    :class="hasIntent(item)
                      ? 'border-violet-300 bg-violet-50'
                      : 'border-gray-100 hover:border-violet-200 hover:bg-violet-50/40'"
                    @click="toggleIntent(item)"
                  >
                    <div
                      class="mt-0.5 w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-colors"
                      :class="hasIntent(item) ? 'border-violet-500 bg-violet-500' : 'border-gray-300'"
                    >
                      <Check v-if="hasIntent(item)" class="w-3 h-3 text-white" />
                    </div>
                    <div>
                      <div class="text-sm font-medium text-gray-700">{{ item.id }}. {{ item.name }}</div>
                      <div class="text-xs text-gray-400 mt-0.5 leading-snug">{{ item.meaning }}</div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 助人技术 -->
              <div v-else-if="activePanel === 'tech'" class="p-4">
                <p class="text-xs text-gray-400 mb-3">点击选择（可多选），细分类型以括号标注</p>
                <!-- 已选 -->
                <div v-if="activeRow.techs.length" class="flex flex-wrap gap-1.5 mb-4 p-3 bg-sky-50 rounded-xl border border-sky-100">
                  <span
                    v-for="item in activeRow.techs" :key="item.subId"
                    class="inline-flex items-center gap-1 text-xs bg-sky-100 text-sky-700 rounded-lg px-2 py-1"
                  >
                    {{ item.subId }} {{ item.name }}<span v-if="item.subType!=='-'">（{{ item.subType }}）</span>
                    <button class="hover:text-red-500 transition-colors" @click="toggleTech(item)">
                      <X class="w-3 h-3" />
                    </button>
                  </span>
                </div>
                <!-- 列表 -->
                <div class="space-y-1">
                  <div
                    v-for="item in TECHS" :key="item.subId"
                    class="flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all"
                    :class="hasTech(item)
                      ? 'border-sky-300 bg-sky-50'
                      : 'border-gray-100 hover:border-sky-200 hover:bg-sky-50/40'"
                    @click="toggleTech(item)"
                  >
                    <div
                      class="mt-0.5 w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-colors"
                      :class="hasTech(item) ? 'border-sky-500 bg-sky-500' : 'border-gray-300'"
                    >
                      <Check v-if="hasTech(item)" class="w-3 h-3 text-white" />
                    </div>
                    <div>
                      <div class="text-sm font-medium text-gray-700">
                        <span class="font-bold text-sky-700">{{ item.subId }}</span>
                        {{ item.name }}
                        <span v-if="item.subType!=='-'" class="text-gray-400 font-normal text-xs"> · {{ item.subType }}</span>
                      </div>
                      <div class="text-xs text-gray-400 mt-0.5 leading-snug">{{ item.meaning }}</div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 其他字段 -->
              <div v-else-if="activePanel === 'other'" class="p-4 space-y-5">
                <!-- 有效性评分 -->
                <div>
                  <label class="block text-xs font-semibold text-gray-600 mb-2">有效性 5 点评分</label>
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <div class="text-xs text-gray-400 mb-1.5">咨询师</div>
                      <div class="flex gap-2">
                        <button
                          v-for="s in SCORES" :key="'c'+s"
                          class="w-9 h-9 rounded-xl border-2 text-sm font-bold transition-all"
                          :class="activeRow.scoreC === s
                            ? 'border-violet-500 bg-violet-500 text-white shadow-sm'
                            : 'border-gray-200 text-gray-500 hover:border-violet-300'"
                          @click="activeRow.scoreC = activeRow.scoreC === s ? '' : s"
                        >{{ s }}</button>
                      </div>
                    </div>
                    <div>
                      <div class="text-xs text-gray-400 mb-1.5">来访者</div>
                      <div class="flex gap-2">
                        <button
                          v-for="s in SCORES" :key="'v'+s"
                          class="w-9 h-9 rounded-xl border-2 text-sm font-bold transition-all"
                          :class="activeRow.scoreV === s
                            ? 'border-sky-500 bg-sky-500 text-white shadow-sm'
                            : 'border-gray-200 text-gray-500 hover:border-sky-300'"
                          @click="activeRow.scoreV = activeRow.scoreV === s ? '' : s"
                        >{{ s }}</button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 当事人反应 -->
                <div>
                  <label class="block text-xs font-semibold text-gray-600 mb-1.5">当事人反应</label>
                  <textarea
                    v-model="activeRow.reaction"
                    rows="3"
                    class="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 resize-none transition-all"
                    placeholder="填写当事人反应..."
                  />
                </div>

                <!-- 更好的干预 -->
                <div>
                  <label class="block text-xs font-semibold text-gray-600 mb-1.5">更好的干预（如有）</label>
                  <textarea
                    v-model="activeRow.betterIntervention"
                    rows="4"
                    class="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 resize-none transition-all"
                    placeholder="如果有更好的干预方式，请填写..."
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- ════ 右侧：原文对话 + 表格预览 ════ -->
          <div class="flex-1 flex flex-col overflow-hidden bg-gray-50">

            <!-- 上方：原文对话 -->
            <div class="flex-1 overflow-auto p-5 border-b border-gray-200">
              <div class="flex items-center gap-2 mb-3">
                <MessageSquare class="w-4 h-4 text-indigo-400" />
                <h3 class="text-sm font-semibold text-gray-600">原文对话</h3>
                <span class="text-xs text-gray-400">· 用于辅助填写表格</span>
              </div>
              <div v-if="contextLines && contextLines.length > 0" class="space-y-2">
                <template v-for="(line, lIdx) in contextLines" :key="lIdx">
                  <div
                    v-if="line.type === 'speech'"
                    class="rounded-xl px-4 py-3 text-sm"
                    :class="[getRoleStyle((line as any).role).bg, getRoleStyle((line as any).role).border]"
                  >
                    <div class="flex items-center gap-2 mb-1.5">
                      <span class="font-bold px-2 py-0.5 rounded-full text-xs" :class="getRoleStyle((line as any).role).label">
                        {{ (line as any).roleLabel }}
                      </span>
                      <span class="text-xs text-gray-400">{{ (line as any).timestamp }}</span>
                    </div>
                    <div class="text-gray-800 leading-relaxed">{{ (line as any).content }}</div>
                  </div>
                  <div v-else-if="line.type === 'plain'" class="px-3 py-1.5 text-xs text-gray-400 italic">
                    {{ (line as any).text }}
                  </div>
                </template>
              </div>
              <div v-else class="flex items-center justify-center h-24 text-sm text-gray-300">
                暂无上下文对话
              </div>
            </div>

            <!-- 下方：表格预览 -->
            <div class="flex-1 overflow-auto p-5">
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-sm font-semibold text-gray-600">表格预览</h3>
                <span class="text-xs text-gray-400">实时同步，保存后写入正文</span>
              </div>
              <div class="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <div class="overflow-x-auto">
                  <table class="w-full border-collapse text-sm" style="min-width: 680px">
                    <thead>
                      <tr class="bg-blue-50">
                        <th rowspan="2" class="border border-gray-300 px-3 py-2 text-center font-bold text-xs w-28 align-middle">助人者意图</th>
                        <th rowspan="2" class="border border-gray-300 px-3 py-2 text-center font-bold text-xs w-28 align-middle">助人技术</th>
                        <th colspan="2" class="border border-gray-300 px-3 py-2 text-center font-bold text-xs">有效性 5 点评分</th>
                        <th rowspan="2" class="border border-gray-300 px-3 py-2 text-center font-bold text-xs w-24 align-middle">当事人反应</th>
                        <th rowspan="2" class="border border-gray-300 px-3 py-2 text-center font-bold text-xs align-middle">更好的干预（如有）</th>
                      </tr>
                      <tr class="bg-blue-50">
                        <th class="border border-gray-300 px-3 py-1.5 text-center font-bold text-xs w-16">咨询师</th>
                        <th class="border border-gray-300 px-3 py-1.5 text-center font-bold text-xs w-16">来访者</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="(row, idx) in rows"
                        :key="row.id"
                        class="transition-colors cursor-pointer"
                        :class="activeRowIdx === idx ? 'bg-emerald-50 ring-2 ring-inset ring-emerald-300' : 'hover:bg-gray-50'"
                        @click="selectRow(idx)"
                      >
                        <td class="border border-gray-200 px-2 py-2 align-top text-xs">
                          <div v-if="row.intents.length" class="space-y-0.5">
                            <div v-for="i in row.intents" :key="i.id" class="text-violet-700">{{ i.id }}.{{ i.name }}</div>
                          </div>
                          <span v-else class="text-gray-300 italic">未选</span>
                        </td>
                        <td class="border border-gray-200 px-2 py-2 align-top text-xs">
                          <div v-if="row.techs.length" class="space-y-0.5">
                            <div v-for="t in row.techs" :key="t.subId" class="text-sky-700">{{ t.subId }} {{ t.name }}</div>
                          </div>
                          <span v-else class="text-gray-300 italic">未选</span>
                        </td>
                        <td class="border border-gray-200 px-2 py-2 text-center align-middle text-sm font-bold">
                          <span :class="row.scoreC ? 'text-violet-600' : 'text-gray-200'">{{ row.scoreC || '-' }}</span>
                        </td>
                        <td class="border border-gray-200 px-2 py-2 text-center align-middle text-sm font-bold">
                          <span :class="row.scoreV ? 'text-sky-600' : 'text-gray-200'">{{ row.scoreV || '-' }}</span>
                        </td>
                        <td class="border border-gray-200 px-2 py-2 align-top text-xs text-gray-600 whitespace-pre-wrap max-w-[120px]">
                          {{ row.reaction || '' }}
                        </td>
                        <td class="border border-gray-200 px-2 py-2 align-top text-xs text-gray-600 whitespace-pre-wrap">
                          {{ row.betterIntervention || '' }}
                        </td>
                      </tr>
                      <tr v-if="rows.length === 0">
                        <td colspan="6" class="py-8 text-center text-gray-300 text-sm">请添加数据行</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <p class="mt-3 text-xs text-gray-400 text-center">点击表格行可切换正在编辑的行</p>
            </div>

          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-fade-enter-active, .modal-fade-leave-active {
  transition: opacity 0.2s ease;
}
.modal-fade-enter-from, .modal-fade-leave-to {
  opacity: 0;
}
</style>
