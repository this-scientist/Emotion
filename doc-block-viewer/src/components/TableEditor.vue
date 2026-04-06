<script setup lang="ts">
import { ref, reactive } from 'vue'
import { Plus, Trash2, ChevronDown, X } from 'lucide-vue-next'
import { INTENTS, TECHS, intentLabel, techLabel, type IntentItem, type TechItem } from '../data/tableData'

// ── 行数据类型（导出给父组件用）──
export interface TableRowData {
  id: string
  intents: IntentItem[]
  techs: TechItem[]
  scoreC: string
  scoreV: string
  reaction: string
  betterIntervention: string
}

const rows = ref<TableRowData[]>([createEmptyRow()])

function createEmptyRow(): TableRowData {
  return {
    id: `row-${Date.now()}-${Math.random()}`,
    intents: [],
    techs: [],
    scoreC: '',
    scoreV: '',
    reaction: '',
    betterIntervention: '',
  }
}

function addRow() {
  rows.value.push(createEmptyRow())
}

function removeRow(id: string) {
  if (rows.value.length === 1) return
  rows.value = rows.value.filter(r => r.id !== id)
}

// ── 意图选择弹窗 ──
const intentPopRow = ref<string | null>(null)   // 当前打开意图弹窗的行id
const techPopRow   = ref<string | null>(null)   // 当前打开技术弹窗的行id

function toggleIntentPop(rowId: string) {
  intentPopRow.value = intentPopRow.value === rowId ? null : rowId
  techPopRow.value = null
}
function toggleTechPop(rowId: string) {
  techPopRow.value = techPopRow.value === rowId ? null : rowId
  intentPopRow.value = null
}

function toggleIntent(row: TableRowData, item: IntentItem) {
  const idx = row.intents.findIndex(i => i.id === item.id)
  if (idx === -1) row.intents.push(item)
  else row.intents.splice(idx, 1)
}

function toggleTech(row: TableRowData, item: TechItem) {
  const idx = row.techs.findIndex(t => t.subId === item.subId)
  if (idx === -1) row.techs.push(item)
  else row.techs.splice(idx, 1)
}

function hasIntent(row: TableRowData, item: IntentItem) {
  return row.intents.some(i => i.id === item.id)
}
function hasTech(row: TableRowData, item: TechItem) {
  return row.techs.some(t => t.subId === item.subId)
}

// 关闭弹窗（点外部）
function closePops() {
  intentPopRow.value = null
  techPopRow.value = null
}

// 暴露 rows 给父组件获取数据
defineExpose({ rows })
</script>

<template>
  <div class="w-full overflow-auto" @click.self="closePops">
    <!-- 表格容器 -->
    <table class="w-full border-collapse text-sm" style="min-width: 860px">
      <!-- ── 表头 ── -->
      <thead>
        <tr class="bg-blue-50">
          <th rowspan="2" class="border border-gray-400 px-2 py-2 text-center font-bold w-32 align-middle text-xs">助人者意图</th>
          <th rowspan="2" class="border border-gray-400 px-2 py-2 text-center font-bold w-32 align-middle text-xs">助人技术</th>
          <th colspan="2" class="border border-gray-400 px-2 py-2 text-center font-bold text-xs">有效性 5 点评分</th>
          <th rowspan="2" class="border border-gray-400 px-2 py-2 text-center font-bold w-24 align-middle text-xs">当事人反应</th>
          <th rowspan="2" class="border border-gray-400 px-2 py-2 text-center font-bold align-middle text-xs">更好的干预（如有）</th>
          <th rowspan="2" class="border border-gray-300 px-1 py-1 w-8 bg-gray-50"></th>
        </tr>
        <tr class="bg-blue-50">
          <th class="border border-gray-400 px-2 py-1 text-center font-bold w-20 text-xs">咨询师</th>
          <th class="border border-gray-400 px-2 py-1 text-center font-bold w-20 text-xs">来访者</th>
        </tr>
      </thead>

      <!-- ── 数据行 ── -->
      <tbody>
        <tr v-for="row in rows" :key="row.id" class="hover:bg-gray-50 transition-colors">

          <!-- 助人者意图 -->
          <td class="border border-gray-300 px-1 py-1 align-top relative">
            <!-- 已选标签 -->
            <div class="flex flex-wrap gap-1 mb-1 min-h-[24px]">
              <span
                v-for="item in row.intents"
                :key="item.id"
                class="inline-flex items-center gap-0.5 text-xs bg-violet-100 text-violet-700 rounded px-1.5 py-0.5"
              >
                {{ item.id }}.{{ item.name }}
                <button class="hover:text-red-500" @click.stop="toggleIntent(row, item)">
                  <X class="w-2.5 h-2.5" />
                </button>
              </span>
            </div>
            <!-- 触发按钮 -->
            <button
              class="flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-500 transition-colors"
              @click.stop="toggleIntentPop(row.id)"
            >
              <ChevronDown class="w-3 h-3" />
              选择意图
            </button>

            <!-- 意图下拉弹窗 -->
            <div
              v-if="intentPopRow === row.id"
              class="absolute z-50 top-full left-0 mt-1 w-72 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden"
              @click.stop
            >
              <div class="px-3 py-2 border-b border-gray-100 text-xs font-semibold text-gray-500">选择助人者意图（可多选）</div>
              <div class="max-h-64 overflow-y-auto">
                <label
                  v-for="item in INTENTS"
                  :key="item.id"
                  class="flex items-start gap-2.5 px-3 py-2 hover:bg-indigo-50 cursor-pointer transition-colors"
                  :class="hasIntent(row, item) ? 'bg-violet-50' : ''"
                  @click="toggleIntent(row, item)"
                >
                  <div
                    class="mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors"
                    :class="hasIntent(row, item) ? 'border-violet-500 bg-violet-500' : 'border-gray-300'"
                  >
                    <svg v-if="hasIntent(row, item)" class="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8">
                      <path d="M1 4l3 3 5-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <div class="min-w-0">
                    <div class="text-sm font-medium text-gray-700">{{ item.id }}. {{ item.name }}</div>
                    <div class="text-xs text-gray-400 mt-0.5 leading-snug">{{ item.meaning }}</div>
                  </div>
                </label>
              </div>
              <div class="px-3 py-2 border-t border-gray-100 flex justify-end">
                <button class="text-xs text-indigo-500 hover:text-indigo-700" @click.stop="intentPopRow = null">完成</button>
              </div>
            </div>
          </td>

          <!-- 助人技术 -->
          <td class="border border-gray-300 px-1 py-1 align-top relative">
            <div class="flex flex-wrap gap-1 mb-1 min-h-[24px]">
              <span
                v-for="item in row.techs"
                :key="item.subId"
                class="inline-flex items-center gap-0.5 text-xs bg-sky-100 text-sky-700 rounded px-1.5 py-0.5"
              >
                {{ item.subId }} {{ item.name }}
                <button class="hover:text-red-500" @click.stop="toggleTech(row, item)">
                  <X class="w-2.5 h-2.5" />
                </button>
              </span>
            </div>
            <button
              class="flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-500 transition-colors"
              @click.stop="toggleTechPop(row.id)"
            >
              <ChevronDown class="w-3 h-3" />
              选择技术
            </button>

            <!-- 技术下拉弹窗 -->
            <div
              v-if="techPopRow === row.id"
              class="absolute z-50 top-full left-0 mt-1 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden"
              @click.stop
            >
              <div class="px-3 py-2 border-b border-gray-100 text-xs font-semibold text-gray-500">选择助人技术（可多选）</div>
              <div class="max-h-72 overflow-y-auto">
                <label
                  v-for="item in TECHS"
                  :key="item.subId"
                  class="flex items-start gap-2.5 px-3 py-2 hover:bg-sky-50 cursor-pointer transition-colors"
                  :class="hasTech(row, item) ? 'bg-sky-50' : ''"
                  @click="toggleTech(row, item)"
                >
                  <div
                    class="mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors"
                    :class="hasTech(row, item) ? 'border-sky-500 bg-sky-500' : 'border-gray-300'"
                  >
                    <svg v-if="hasTech(row, item)" class="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8">
                      <path d="M1 4l3 3 5-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <div class="min-w-0">
                    <div class="text-sm font-medium text-gray-700">
                      <span class="font-bold">{{ item.subId }}</span>
                      {{ item.name }}
                      <span v-if="item.subType !== '-'" class="text-gray-400 font-normal">（{{ item.subType }}）</span>
                    </div>
                    <div class="text-xs text-gray-400 mt-0.5 leading-snug">{{ item.meaning }}</div>
                  </div>
                </label>
              </div>
              <div class="px-3 py-2 border-t border-gray-100 flex justify-end">
                <button class="text-xs text-sky-500 hover:text-sky-700" @click.stop="techPopRow = null">完成</button>
              </div>
            </div>
          </td>

          <!-- 有效性-咨询师 -->
          <td class="border border-gray-300 px-1 py-1 align-middle">
            <input
              v-model="row.scoreC"
              type="text"
              class="w-full text-center text-sm outline-none bg-transparent border-b border-transparent focus:border-indigo-300 transition-colors"
              placeholder="1-5"
            />
          </td>

          <!-- 有效性-来访者 -->
          <td class="border border-gray-300 px-1 py-1 align-middle">
            <input
              v-model="row.scoreV"
              type="text"
              class="w-full text-center text-sm outline-none bg-transparent border-b border-transparent focus:border-indigo-300 transition-colors"
              placeholder="1-5"
            />
          </td>

          <!-- 当事人反应 -->
          <td class="border border-gray-300 px-1 py-1 align-top">
            <textarea
              v-model="row.reaction"
              rows="2"
              class="w-full text-sm outline-none bg-transparent resize-none"
              placeholder="填写..."
            />
          </td>

          <!-- 更好的干预 -->
          <td class="border border-gray-300 px-1 py-1 align-top">
            <textarea
              v-model="row.betterIntervention"
              rows="2"
              class="w-full text-sm outline-none bg-transparent resize-none"
              placeholder="填写..."
            />
          </td>

          <!-- 删除行 -->
          <td class="border border-gray-200 px-1 py-1 align-middle text-center bg-gray-50">
            <button
              class="p-1 text-gray-300 hover:text-red-400 transition-colors rounded"
              :disabled="rows.length === 1"
              @click="removeRow(row.id)"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- 添加行按钮 -->
    <button
      class="mt-3 flex items-center gap-2 px-4 py-2 text-sm text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-xl transition-colors border border-dashed border-indigo-200"
      @click="addRow"
    >
      <Plus class="w-4 h-4" />
      添加一行
    </button>
  </div>
</template>
