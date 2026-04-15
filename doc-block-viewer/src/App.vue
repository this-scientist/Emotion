<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { FileUp, FileText, LogOut } from 'lucide-vue-next'
import AuthView from './components/AuthView.vue'
import FileUploader from './components/FileUploader.vue'
import DocPreview from './components/DocPreview.vue'
import BlockEditor from './components/BlockEditor.vue'
import ScrollMarker from './components/ScrollMarker.vue'
import BlockPanel from './components/BlockPanel.vue'
import MappingDialog from './components/MappingDialog.vue'
import MappingView from './components/MappingView.vue'
import { useBlockManager } from './composables/useBlockManager'
import { parseDocument } from './services/docParser'
import { loadFromStorage } from './utils/storage'
import { authService } from './services/auth'
import type { ContentBlock } from './types/block'
import type { SpeakerMapping } from './utils/extractSpeakers'
import type { Database } from './lib/supabase'

type Profile = Database['public']['Tables']['profiles']['Row']

const {
  documentLoaded,
  blocks,
  content,
  fileName,
  totalLines,
  setDocument,
  createBlock,
  updateBlock,
  deleteBlock,
  clearSelection,
} = useBlockManager()

const docPreviewRef = ref<InstanceType<typeof DocPreview> | null>(null)
const currentUser = ref<Profile | null>(null)

// ── 分块编辑弹窗 ──
const showBlockEditor = ref(false)
const pendingBlock = ref<ContentBlock | null>(null)
const pendingStartLine = ref(0)
const pendingEndLine = ref(0)
const pendingColor = ref('#54A0FF')

// ── 映射弹窗 ──
const showMappingDialog = ref(false)
const mappingBlock = ref<ContentBlock | null>(null)
const mappingBlockLines = computed<string[]>(() => {
  if (!mappingBlock.value) return []
  return content.value.slice(mappingBlock.value.startLine, mappingBlock.value.endLine + 1)
})

// ── 映射结果页 ──
const showMappingView = ref(false)
const mappingResult = ref<{ block: ContentBlock; mappings: SpeakerMapping[] } | null>(null)
const mappingViewLines = computed<string[]>(() => {
  if (!mappingResult.value) return []
  const b = mappingResult.value.block
  return content.value.slice(b.startLine, b.endLine + 1)
})

onMounted(() => {
  // Listen for auth state changes
  const { data: { subscription } } = authService.onAuthStateChange((user) => {
    currentUser.value = user
  })

  // Load saved state
  const savedState = loadFromStorage()
  if (savedState && savedState.content.length > 0) {
    setDocument(savedState)
  }
})

async function handleFileSelected(file: File) {
  try {
    const result = await parseDocument(file)
    setDocument({
      fileName: result.fileName,
      content: result.content,
      blocks: [],
      totalLines: result.content.length,
    })
  } catch (error) {
    alert(error instanceof Error ? error.message : '文件解析失败')
  }
}

function handleCreateBlock(startLine: number, endLine: number, color: string) {
  pendingBlock.value = null
  pendingStartLine.value = startLine
  pendingEndLine.value = endLine
  pendingColor.value = color
  showBlockEditor.value = true
}

function handleEditBlock(block: ContentBlock) {
  pendingBlock.value = block
  pendingStartLine.value = block.startLine
  pendingEndLine.value = block.endLine
  pendingColor.value = block.color
  showBlockEditor.value = true
}

function handleSaveBlock(name: string, color: string) {
  if (pendingBlock.value) {
    updateBlock(pendingBlock.value.id, { name, color })
  } else {
    createBlock(name, pendingStartLine.value, pendingEndLine.value, color)
  }
  showBlockEditor.value = false
  clearSelection()
}

function handleDeleteBlock(id: string) {
  deleteBlock(id)
}

function handleScrollToLine(lineIndex: number) {
  docPreviewRef.value?.scrollToLine(lineIndex)
}

const showResetConfirm = ref(false)
function handleReset() { showResetConfirm.value = true }
function confirmReset() {
  setDocument({ fileName: '', content: [], blocks: [], totalLines: 0 })
  showResetConfirm.value = false
}

// 打开映射弹窗
function handleMapping(block: ContentBlock) {
  mappingBlock.value = block
  showMappingDialog.value = true
}

// 映射确认 → 跳转到结果页
function handleMappingConfirm(mappings: SpeakerMapping[], block: ContentBlock) {
  mappingResult.value = { block, mappings }
  showMappingDialog.value = false
  showMappingView.value = true
}

// 登出
async function handleLogout() {
  await authService.signOut()
  currentUser.value = null
}
</script>

<template>
  <!-- Auth View -->
  <AuthView v-if="!currentUser" @authenticated="(user) => currentUser = user" />

  <!-- Main App -->
  <div v-else class="h-screen flex flex-col bg-gray-50">
    <!-- 重新上传确认弹窗 -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showResetConfirm" class="fixed inset-0 z-[500] flex items-center justify-center bg-black/40" @click.self="showResetConfirm=false">
          <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 class="text-base font-semibold text-gray-800 mb-2">重新上传文件</h3>
            <p class="text-sm text-gray-500 mb-6">确定要重新上传吗？当前的分块数据将被清除，此操作不可恢复。</p>
            <div class="flex justify-end gap-3">
              <button class="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-xl transition-colors" @click="showResetConfirm=false">取消</button>
              <button class="px-5 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors" @click="confirmReset">确认重置</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
    <!-- 映射结果页（全屏覆盖） -->
    <Transition name="page-slide">
      <MappingView
        v-if="showMappingView && mappingResult"
        :block="mappingResult.block"
        :block-lines="mappingViewLines"
        :mappings="mappingResult.mappings"
        @back="showMappingView = false"
      />
    </Transition>

    <!-- 主页面 -->
    <template v-if="!showMappingView">
      <!-- Header -->
      <header class="flex-shrink-0 h-14 bg-white border-b border-gray-100 flex items-center justify-between px-6 shadow-sm">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
            <FileText class="w-4 h-4 text-white" />
          </div>
          <h1 class="text-base font-semibold text-gray-800">文档分块预览</h1>
        </div>

        <div class="flex items-center gap-4">
          <div v-if="currentUser" class="flex items-center gap-3">
            <span class="text-sm text-gray-600">{{ currentUser.display_name || currentUser.username }}</span>
            <button
              class="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
              @click="handleLogout"
            >
              <LogOut class="w-4 h-4" />
              退出
            </button>
          </div>
          <span v-if="documentLoaded" class="text-sm text-gray-400 max-w-xs truncate">{{ fileName }}</span>
          <button
            v-if="documentLoaded"
            class="flex items-center gap-1.5 px-3 py-1.5 text-sm text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
            @click="handleReset"
          >
            <FileUp class="w-4 h-4" />
            重新上传
          </button>
        </div>
      </header>

      <!-- Main -->
      <main class="flex-1 flex overflow-hidden">
        <template v-if="!documentLoaded">
          <div class="flex-1 flex items-center justify-center">
            <FileUploader @file-selected="handleFileSelected" />
          </div>
        </template>

        <template v-else>
          <div class="flex-1 flex overflow-hidden">
            <div class="flex-1 overflow-hidden">
              <DocPreview
                ref="docPreviewRef"
                @create-block="handleCreateBlock"
              />
            </div>
            <ScrollMarker
              :blocks="blocks"
              :total-lines="totalLines"
              @scroll-to="handleScrollToLine"
            />
          </div>

          <div class="w-72 flex-shrink-0 border-l border-gray-100">
            <BlockPanel
              :blocks="blocks"
              :total-lines="totalLines"
              @edit="handleEditBlock"
              @delete="handleDeleteBlock"
              @scroll-to="handleScrollToLine"
              @mapping="handleMapping"
            />
          </div>
        </template>
      </main>

      <!-- 分块命名弹窗 -->
      <BlockEditor
        :visible="showBlockEditor"
        :block="pendingBlock"
        :start-line="pendingStartLine"
        :end-line="pendingEndLine"
        :initial-color="pendingColor"
        @close="showBlockEditor = false; clearSelection()"
        @save="handleSaveBlock"
      />

      <!-- 映射弹窗 -->
      <MappingDialog
        :visible="showMappingDialog"
        :block="mappingBlock"
        :block-lines="mappingBlockLines"
        @close="showMappingDialog = false"
        @confirm="handleMappingConfirm"
      />
    </template>
  </div>
</template>

<style>
.page-slide-enter-active,
.page-slide-leave-active {
  transition: all 0.3s ease;
}
.page-slide-enter-from {
  opacity: 0;
  transform: translateX(40px);
}
.page-slide-leave-to {
  opacity: 0;
  transform: translateX(40px);
}
</style>
