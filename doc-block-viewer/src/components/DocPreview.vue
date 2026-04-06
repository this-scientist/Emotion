<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { useBlockManager } from '../composables/useBlockManager'

const emit = defineEmits<{
  createBlock: [startLine: number, endLine: number, color: string]
}>()

const {
  content,
  blocks,
  selection,
  isLineSelected,
  isLineInBlock,
  setSelectionStart,
  setSelectionEnd,
  clearSelection,
} = useBlockManager()

const containerRef = ref<HTMLDivElement | null>(null)
const lineRefs = ref<Map<number, HTMLDivElement>>(new Map())

// 颜色选择面板
const showColorPicker = ref(false)
const colorPickerAnchor = ref({ top: 0, left: 0 })
const pendingStart = ref(0)
const pendingEnd = ref(0)

const PRESET_COLORS = [
  '#FF6B6B', '#FF9F43', '#FECA57', '#48DBFB',
  '#1DD1A1', '#54A0FF', '#A29BFE', '#FD79A8',
  '#FDCB6E', '#6C5CE7', '#00CEC9', '#E17055',
  '#74B9FF', '#55EFC4', '#DFE6E9', '#B2BEC3',
]

const selectionDisplay = computed(() => {
  const { startLine, endLine } = selection.value
  if (startLine === null) return null
  if (endLine === null) return `已选第 ${startLine + 1} 行为起始行，再点击一行设为结束行`
  const s = Math.min(startLine, endLine) + 1
  const e = Math.max(startLine, endLine) + 1
  return `已选第 ${s} - ${e} 行，请选择块颜色`
})

// 获取某行所属所有块（可能被多个块覆盖，取最后一个）
function getLineBlock(lineIndex: number) {
  return isLineInBlock(lineIndex)
}

// 行的背景颜色
function getLineBgStyle(lineIndex: number) {
  // 选中范围优先显示
  if (isLineSelected(lineIndex)) {
    const { startLine, endLine } = selection.value
    if (startLine !== null && endLine !== null) {
      // 已选定范围，显示淡灰预览
      return 'rgba(100,120,200,0.12)'
    }
    // 只选了起始行
    return 'rgba(100,120,200,0.10)'
  }
  const block = getLineBlock(lineIndex)
  if (block) {
    return block.color + '28' // 约16%透明度
  }
  return undefined
}

// 圆圈状态
function getCircleState(lineIndex: number): 'selected-start' | 'selected-end' | 'in-range' | 'in-block' | 'none' {
  const { startLine, endLine } = selection.value
  if (startLine !== null && endLine !== null) {
    const s = Math.min(startLine, endLine)
    const e = Math.max(startLine, endLine)
    if (lineIndex === s) return 'selected-start'
    if (lineIndex === e) return 'selected-end'
    if (lineIndex > s && lineIndex < e) return 'in-range'
  } else if (startLine !== null && lineIndex === startLine) {
    return 'selected-start'
  }
  if (getLineBlock(lineIndex)) return 'in-block'
  return 'none'
}

function handleLineClick(lineIndex: number) {
  const { startLine, endLine } = selection.value

  if (startLine === null) {
    // 第一次点击，设置起始行
    setSelectionStart(lineIndex)
  } else if (endLine === null) {
    if (lineIndex === startLine) {
      // 点同一行，取消
      clearSelection()
      return
    }
    // 第二次点击，设置结束行 -> 弹出颜色选择
    setSelectionEnd(lineIndex)
    const s = Math.min(startLine, lineIndex)
    const e = Math.max(startLine, lineIndex)
    pendingStart.value = s
    pendingEnd.value = e
    // 定位颜色面板到结束行元素旁边
    nextTick(() => {
      const lineEl = lineRefs.value.get(lineIndex)
      if (lineEl && containerRef.value) {
        const containerRect = containerRef.value.getBoundingClientRect()
        const lineRect = lineEl.getBoundingClientRect()
        colorPickerAnchor.value = {
          top: lineRect.bottom - containerRect.top + containerRef.value.scrollTop + 4,
          left: 72,
        }
      }
      showColorPicker.value = true
    })
  } else {
    // 已完成选择，重新开始
    clearSelection()
    showColorPicker.value = false
    setSelectionStart(lineIndex)
  }
}

function handleColorSelect(color: string) {
  emit('createBlock', pendingStart.value, pendingEnd.value, color)
  showColorPicker.value = false
  clearSelection()
}

function handleCancelColor() {
  showColorPicker.value = false
  clearSelection()
}

function handleContainerClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.line-row') && !target.closest('.color-picker-panel')) {
    clearSelection()
    showColorPicker.value = false
  }
}

function scrollToLine(lineIndex: number) {
  const lineEl = lineRefs.value.get(lineIndex)
  if (lineEl) {
    lineEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

defineExpose({ scrollToLine })
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- 选择提示栏 -->
    <Transition name="tip-bar">
      <div
        v-if="selectionDisplay"
        class="flex-shrink-0 px-5 py-2 bg-indigo-50 border-b border-indigo-100 text-indigo-700 text-sm font-medium flex items-center gap-2"
      >
        <span class="inline-block w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
        {{ selectionDisplay }}
        <button
          class="ml-auto text-xs text-indigo-400 hover:text-indigo-600 transition-colors"
          @click="handleCancelColor(); clearSelection()"
        >
          取消选择
        </button>
      </div>
    </Transition>

    <!-- 文档内容区域 -->
    <div
      ref="containerRef"
      class="flex-1 overflow-auto bg-white relative"
      @click="handleContainerClick"
    >
      <div class="min-w-max">
        <div
          v-for="(line, index) in content"
          :key="index"
          :ref="(el) => { if (el) lineRefs.set(index, el as HTMLDivElement) }"
          class="line-row flex items-stretch transition-colors duration-100"
          :style="{ backgroundColor: getLineBgStyle(index) }"
        >
          <!-- 时间线区域 -->
          <div
            class="flex-shrink-0 w-14 flex items-center justify-center relative select-none cursor-pointer group"
            @click.stop="handleLineClick(index)"
          >
            <!-- 时间线竖线 -->
            <div class="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-gray-200" />

            <!-- 圆圈 -->
            <div
              class="relative z-10 flex items-center justify-center transition-all duration-200"
              :class="[
                getCircleState(index) === 'selected-start' ? 'scale-110' : '',
                getCircleState(index) === 'selected-end' ? 'scale-110' : '',
              ]"
            >
              <!-- in-block：实心块颜色圆 -->
              <template v-if="getCircleState(index) === 'in-block'">
                <div
                  class="w-3 h-3 rounded-full border-2"
                  :style="{
                    backgroundColor: getLineBlock(index)!.color,
                    borderColor: getLineBlock(index)!.color,
                  }"
                />
              </template>

              <!-- selected-start：实心蓝色大圆 + S标 -->
              <template v-else-if="getCircleState(index) === 'selected-start'">
                <div class="w-5 h-5 rounded-full bg-indigo-500 border-2 border-indigo-400 flex items-center justify-center shadow">
                  <span class="text-white text-[9px] font-bold leading-none">S</span>
                </div>
              </template>

              <!-- selected-end：实心紫色大圆 + E标 -->
              <template v-else-if="getCircleState(index) === 'selected-end'">
                <div class="w-5 h-5 rounded-full bg-violet-500 border-2 border-violet-400 flex items-center justify-center shadow">
                  <span class="text-white text-[9px] font-bold leading-none">E</span>
                </div>
              </template>

              <!-- in-range：小蓝点 -->
              <template v-else-if="getCircleState(index) === 'in-range'">
                <div class="w-2 h-2 rounded-full bg-indigo-300" />
              </template>

              <!-- none：空心圆，hover显示 -->
              <template v-else>
                <div class="w-3 h-3 rounded-full border-2 border-gray-300 bg-white group-hover:border-indigo-400 group-hover:bg-indigo-50 transition-colors" />
              </template>
            </div>
          </div>

          <!-- 行号 -->
          <div class="flex-shrink-0 w-10 py-1 text-right text-xs text-gray-400 select-none pr-2 leading-6">
            {{ index + 1 }}
          </div>

          <!-- 左侧色条（属于某块时显示） -->
          <div
            class="flex-shrink-0 w-1 self-stretch"
            :style="getLineBlock(index) ? { backgroundColor: getLineBlock(index)!.color } : {}"
          />

          <!-- 行内容 -->
          <div class="flex-1 py-1 px-4 text-sm text-text-primary whitespace-pre-wrap font-mono leading-6 min-h-[1.75rem]">
            {{ line || '\u00A0' }}
          </div>
        </div>
      </div>

      <!-- 颜色选择面板（浮动） -->
      <Transition name="color-pop">
        <div
          v-if="showColorPicker"
          class="color-picker-panel absolute z-40 bg-white rounded-xl shadow-2xl border border-gray-100 p-4 w-64"
          :style="{ top: colorPickerAnchor.top + 'px', left: colorPickerAnchor.left + 'px' }"
          @click.stop
        >
          <div class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span>选择块颜色</span>
            <span class="text-xs text-gray-400 font-normal">第 {{ pendingStart + 1 }} - {{ pendingEnd + 1 }} 行</span>
          </div>
          <div class="grid grid-cols-4 gap-2">
            <button
              v-for="color in PRESET_COLORS"
              :key="color"
              class="w-10 h-10 rounded-lg border-2 border-transparent hover:scale-110 hover:border-gray-300 transition-all shadow-sm"
              :style="{ backgroundColor: color }"
              :title="color"
              @click="handleColorSelect(color)"
            />
          </div>
          <button
            class="mt-3 w-full text-xs text-gray-400 hover:text-gray-600 transition-colors"
            @click="handleCancelColor"
          >
            取消
          </button>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.tip-bar-enter-active,
.tip-bar-leave-active {
  transition: all 0.2s ease;
}
.tip-bar-enter-from,
.tip-bar-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.color-pop-enter-active,
.color-pop-leave-active {
  transition: all 0.18s ease;
}
.color-pop-enter-from,
.color-pop-leave-to {
  opacity: 0;
  transform: scale(0.92) translateY(-4px);
}
</style>
