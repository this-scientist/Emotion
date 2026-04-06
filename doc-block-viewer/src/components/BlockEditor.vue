<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { ContentBlock } from '../types/block'

const PRESET_COLORS = [
  '#FF6B6B', '#FF9F43', '#FECA57', '#48DBFB',
  '#1DD1A1', '#54A0FF', '#A29BFE', '#FD79A8',
  '#FDCB6E', '#6C5CE7', '#00CEC9', '#E17055',
  '#74B9FF', '#55EFC4', '#DFE6E9', '#B2BEC3',
]

const props = defineProps<{
  visible: boolean
  block?: ContentBlock | null
  startLine: number
  endLine: number
  initialColor?: string
}>()

const emit = defineEmits<{
  close: []
  save: [name: string, color: string]
}>()

const blockName = ref('')
const selectedColor = ref(PRESET_COLORS[0])

const title = computed(() => (props.block ? '编辑分块' : '创建分块'))
const lineRange = computed(() => {
  const start = props.startLine + 1
  const end = props.endLine + 1
  return start === end ? `第 ${start} 行` : `第 ${start} - ${end} 行`
})

watch(() => props.visible, (visible) => {
  if (visible) {
    blockName.value = props.block?.name || ''
    selectedColor.value = props.block?.color || props.initialColor || PRESET_COLORS[0]
  }
})

function handleSave() {
  if (blockName.value.trim()) {
    emit('save', blockName.value.trim(), selectedColor.value)
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') handleSave()
  else if (e.key === 'Escape') emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="visible"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        @click.self="$emit('close')"
        @keydown="handleKeydown"
      >
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-slide-up">
          <h3 class="text-lg font-semibold text-gray-800 mb-5">{{ title }}</h3>

          <!-- 行范围 -->
          <div class="mb-4 flex items-center gap-2">
            <div
              class="w-3 h-3 rounded-sm flex-shrink-0"
              :style="{ backgroundColor: selectedColor }"
            />
            <span class="text-sm text-gray-500">{{ lineRange }}</span>
          </div>

          <!-- 分块名称 -->
          <div class="mb-5">
            <label class="block text-sm font-medium text-gray-600 mb-1.5">
              分块名称 <span class="text-red-400">*</span>
            </label>
            <input
              v-model="blockName"
              type="text"
              class="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none transition-all text-sm"
              placeholder="请输入分块名称"
              autofocus
            />
          </div>

          <!-- 颜色选择 -->
          <div class="mb-6">
            <label class="block text-sm font-medium text-gray-600 mb-2">块颜色</label>
            <div class="grid grid-cols-8 gap-1.5">
              <button
                v-for="color in PRESET_COLORS"
                :key="color"
                class="w-8 h-8 rounded-lg transition-all"
                :class="selectedColor === color ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : 'hover:scale-105'"
                :style="{ backgroundColor: color }"
                @click="selectedColor = color"
              />
            </div>
          </div>

          <div class="flex justify-end gap-3">
            <button
              class="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              @click="$emit('close')"
            >
              取消
            </button>
            <button
              class="px-6 py-2 text-sm text-white rounded-xl hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed font-medium"
              :style="{ backgroundColor: selectedColor }"
              :disabled="!blockName.trim()"
              @click="handleSave"
            >
              保存分块
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.animate-slide-up {
  animation: slideUp 0.25s ease-out;
}
@keyframes slideUp {
  from { opacity: 0; transform: translateY(16px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0)   scale(1); }
}
</style>
