<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import type { ContentBlock } from '../types/block'

const props = defineProps<{
  blocks: ContentBlock[]
  totalLines: number
  scrollTop?: number          // 当前文档滚动位置（可选，用于显示视口指示器）
  viewportHeight?: number     // 当前视口高度（可选）
  docScrollHeight?: number    // 文档总滚动高度（可选）
}>()

const emit = defineEmits<{
  scrollTo: [lineIndex: number]
}>()

const markerRef = ref<HTMLDivElement | null>(null)
const containerHeight = ref(300)
const hoveredBlock = ref<string | null>(null)

function updateHeight() {
  if (markerRef.value) {
    containerHeight.value = markerRef.value.clientHeight || 300
  }
}

onMounted(() => {
  updateHeight()
  window.addEventListener('resize', updateHeight)
})
onUnmounted(() => {
  window.removeEventListener('resize', updateHeight)
})
watch(() => props.blocks, updateHeight, { flush: 'post' })

// 计算每个块在滚动条上的位置
function getBlockPos(block: ContentBlock) {
  const total = Math.max(props.totalLines, 1)
  const h = containerHeight.value
  const top = (block.startLine / total) * h
  const bottom = ((block.endLine + 1) / total) * h
  return {
    top,
    height: Math.max(bottom - top, 4),
  }
}

const sortedBlocks = computed(() =>
  [...props.blocks].sort((a, b) => a.startLine - b.startLine)
)

function handleClick(block: ContentBlock) {
  emit('scrollTo', block.startLine)
}

// 视口指示器位置
const viewportIndicator = computed(() => {
  if (!props.docScrollHeight || !props.viewportHeight || !props.scrollTop) return null
  const ratio = containerHeight.value / props.docScrollHeight
  return {
    top: props.scrollTop * ratio,
    height: Math.max(props.viewportHeight * ratio, 20),
  }
})
</script>

<template>
  <div class="flex h-full flex-shrink-0">
    <!-- 左侧色条轨道 -->
    <div
      ref="markerRef"
      class="relative w-5 h-full bg-gray-100/80 border-l border-gray-200 overflow-hidden"
    >
      <!-- 视口指示器（半透明白块）-->
      <div
        v-if="viewportIndicator"
        class="absolute left-0 right-0 bg-white/60 border-y border-gray-300 pointer-events-none z-10"
        :style="{ top: viewportIndicator.top + 'px', height: viewportIndicator.height + 'px' }"
      />

      <!-- 每个块的色条 -->
      <div
        v-for="block in sortedBlocks"
        :key="block.id"
        class="absolute left-0 right-0 cursor-pointer transition-all duration-150"
        :class="hoveredBlock === block.id ? 'opacity-100' : 'opacity-80'"
        :style="{
          top: getBlockPos(block).top + 'px',
          height: getBlockPos(block).height + 'px',
          backgroundColor: block.color,
        }"
        @mouseenter="hoveredBlock = block.id"
        @mouseleave="hoveredBlock = null"
        @click="handleClick(block)"
      >
        <!-- 顶部亮线（起始标志） -->
        <div
          class="absolute top-0 left-0 right-0 h-0.5 bg-white/60"
        />
      </div>

      <!-- 空状态提示 -->
      <div
        v-if="blocks.length === 0"
        class="absolute inset-0 flex items-center justify-center"
      >
        <div class="w-px h-full bg-gray-300" />
      </div>
    </div>

    <!-- 右侧 Tooltip 区域（hover 时展示块名） -->
    <div class="relative w-0 overflow-visible pointer-events-none">
      <Transition name="tip-fade">
        <div
          v-if="hoveredBlock"
          class="absolute z-50 pointer-events-none"
          :style="{
            top: sortedBlocks.find(b => b.id === hoveredBlock)
              ? getBlockPos(sortedBlocks.find(b => b.id === hoveredBlock)!).top + 'px'
              : '0px',
            left: '6px',
          }"
        >
          <div
            v-for="block in sortedBlocks.filter(b => b.id === hoveredBlock)"
            :key="block.id"
            class="flex items-center gap-1.5 bg-gray-800/90 text-white text-xs rounded-md px-2.5 py-1.5 shadow-lg whitespace-nowrap"
          >
            <span
              class="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
              :style="{ backgroundColor: block.color }"
            />
            <span>{{ block.name }}</span>
            <span class="text-gray-400">{{ block.startLine + 1 }}-{{ block.endLine + 1 }}</span>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.tip-fade-enter-active,
.tip-fade-leave-active {
  transition: opacity 0.15s ease;
}
.tip-fade-enter-from,
.tip-fade-leave-to {
  opacity: 0;
}
</style>
