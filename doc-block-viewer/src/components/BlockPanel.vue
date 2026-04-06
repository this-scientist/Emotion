<script setup lang="ts">
import { computed } from 'vue'
import { Edit2, Trash2, Layers, GitMerge } from 'lucide-vue-next'
import type { ContentBlock } from '../types/block'

const props = defineProps<{
  blocks: ContentBlock[]
  totalLines: number
}>()

const emit = defineEmits<{
  edit: [block: ContentBlock]
  delete: [id: string]
  scrollTo: [lineIndex: number]
  mapping: [block: ContentBlock]
}>()

const sortedBlocks = computed(() =>
  [...props.blocks].sort((a, b) => a.startLine - b.startLine)
)

function getLineRange(block: ContentBlock): string {
  const start = block.startLine + 1
  const end = block.endLine + 1
  return start === end ? `第 ${start} 行` : `第 ${start} – ${end} 行`
}

function getLineCount(block: ContentBlock): number {
  return block.endLine - block.startLine + 1
}

function handleDelete(id: string) {
  if (confirm('确定要删除这个分块吗？')) {
    emit('delete', id)
  }
}
</script>

<template>
  <div class="h-full flex flex-col bg-white">
    <!-- 头部 -->
    <div class="px-4 py-4 border-b border-gray-100">
      <div class="flex items-center gap-2 mb-0.5">
        <Layers class="w-4 h-4 text-indigo-400" />
        <h3 class="text-sm font-semibold text-gray-700">分块列表</h3>
      </div>
      <p class="text-xs text-gray-400 pl-6">
        {{ blocks.length }} 个分块 · 共 {{ totalLines }} 行
      </p>
    </div>

    <!-- 列表 -->
    <div class="flex-1 overflow-auto">
      <!-- 空状态 -->
      <div v-if="blocks.length === 0" class="p-6 text-center">
        <div class="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-50 flex items-center justify-center">
          <Layers class="w-6 h-6 text-gray-300" />
        </div>
        <p class="text-sm text-gray-400 mb-1">暂无分块</p>
        <p class="text-xs text-gray-300 leading-relaxed">
          点击行左侧圆圈选择<br/>起始行与结束行
        </p>
      </div>

      <!-- 分块列表 -->
      <div v-else class="p-3 space-y-2">
        <div
          v-for="block in sortedBlocks"
          :key="block.id"
          class="group relative rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all cursor-pointer overflow-hidden"
          @click="$emit('scrollTo', block.startLine)"
        >
          <!-- 左侧彩色条 -->
          <div
            class="absolute left-0 top-0 bottom-0 w-1"
            :style="{ backgroundColor: block.color }"
          />

          <div class="pl-4 pr-2 py-3">
            <div class="flex items-start justify-between gap-2">
              <!-- 块名 + 颜色点 -->
              <div class="flex items-center gap-2 min-w-0">
                <div
                  class="w-3 h-3 rounded-sm flex-shrink-0 shadow-sm"
                  :style="{ backgroundColor: block.color }"
                />
                <span class="text-sm font-medium text-gray-700 truncate">{{ block.name }}</span>
              </div>

              <!-- 操作按钮（hover 时显示） -->
              <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button
                  class="p-1.5 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                  title="映射角色"
                  @click.stop="$emit('mapping', block)"
                >
                  <GitMerge class="w-3.5 h-3.5" />
                </button>
                <button
                  class="p-1.5 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
                  title="编辑"
                  @click.stop="$emit('edit', block)"
                >
                  <Edit2 class="w-3.5 h-3.5" />
                </button>
                <button
                  class="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="删除"
                  @click.stop="handleDelete(block.id)"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <!-- 行范围 + 行数 -->
            <div class="mt-1.5 flex items-center gap-2 pl-5">
              <span class="text-xs text-gray-400">{{ getLineRange(block) }}</span>
              <span
                class="text-xs px-1.5 py-0.5 rounded-full font-medium"
                :style="{ backgroundColor: block.color + '22', color: block.color }"
              >
                {{ getLineCount(block) }} 行
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部使用提示 -->
    <div class="border-t border-gray-50 px-4 py-3">
      <p class="text-xs text-gray-300 text-center leading-relaxed">
        点击块名可跳转至该块起始位置
      </p>
    </div>
  </div>
</template>
