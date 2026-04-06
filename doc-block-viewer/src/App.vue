<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { FileUp, FileText } from 'lucide-vue-next'
import FileUploader from './components/FileUploader.vue'
import DocPreview from './components/DocPreview.vue'
import BlockEditor from './components/BlockEditor.vue'
import ScrollMarker from './components/ScrollMarker.vue'
import BlockPanel from './components/BlockPanel.vue'
import MappingDialog from './components/MappingDialog.vue'
import MappingView from './components/MappingView.vue'
import AuthPage from './components/AuthPage.vue'
import FileManager from './components/FileManager.vue'
import { useBlockManager } from './composables/useBlockManager'
import { parseDocument } from './services/docParser'
import { loadFromStorage } from './utils/storage'
import type { ContentBlock } from './types/block'
import type { SpeakerMapping } from './utils/extractSpeakers'
import { supabase } from './lib/supabase'
import type { UserFile } from './lib/supabase'

// ── 认证/页面路由 ──
// 'auth' | 'files' | 'editor'
const appView = ref<'loading' | 'auth' | 'files' | 'editor'>('loading')

onMounted(async () => {
  const { data: { session } } = await supabase.auth.getSession()
  appView.value = session ? 'files' : 'auth'

  supabase.auth.onAuthStateChange((_event, session) => {
    if (!session) {
      appView.value = 'auth'
    }
  })

  // 如果 localStorage 有数据，不主动恢复（由用户从文件管理进入）
})

function handleAuthSuccess() {
  appView.value = 'files'
}

function handleLogout() {
  appView.value = 'auth'
  // 清理编辑器状态
  setDocument({ fileName: '', content: [], blocks: [], totalLines: 0 })
  showMappingView.value = false
}

// 从文件管理器打开已有文件
async function handleOpenFile(file: UserFile) {
  if (file.file_content) {
    try {
      const lines = file.file_content.split('\n')
      setDocument({
        fileName: file.original_name || file.file_name,
        content: lines,
        blocks: (file.blocks_data as ContentBlock[]) || [],
        totalLines: lines.length,
      })
      appView.value = 'editor'
    } catch {
      alert('文件加载失败')
    }
  } else {
    alert('该文件暂无内容缓存，请重新上传')
  }
}

// 从文件管理器点击「上传文件」
function handleNewFile() {
  appView.value = 'editor'
}

// ── 编辑器状态 ──
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

const showBlockEditor = ref(false)
const pendingBlock = ref<ContentBlock | null>(null)
const pendingStartLine = ref(0)
const pendingEndLine = ref(0)
const pendingColor = ref('#54A0FF')

const showMappingDialog = ref(false)
const mappingBlock = ref<ContentBlock | null>(null)
const mappingBlockLines = computed<string[]>(() => {
  if (!mappingBlock.value) return []
  return content.value.slice(mappingBlock.value.startLine, mappingBlock.value.endLine + 1)
})

const showMappingView = ref(false)
const mappingResult = ref<{ block: ContentBlock; mappings: SpeakerMapping[] } | null>(null)
const mappingViewLines = computed<string[]>(() => {
  if (!mappingResult.value) return []
  const b = mappingResult.value.block
  return content.value.slice(b.startLine, b.endLine + 1)
})

const showResetConfirm = ref(false)
function handleReset() { showResetConfirm.value = true }
function confirmReset() {
  setDocument({ fileName: '', content: [], blocks: [], totalLines: 0 })
  showResetConfirm.value = false
}

async function handleFileSelected(file: File) {
  try {
    const result = await parseDocument(file)
    setDocument({
      fileName: result.fileName,
      content: result.content,
      blocks: [],
      totalLines: result.content.length,
    })

    // 保存文件到 Supabase
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('user_files').insert({
        user_id: user.id,
        file_name: result.fileName,
        original_name: result.fileName,
        file_content: result.content.join('\n'),
        file_meta: { totalLines: result.content.length },
      })
    }
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

function handleMapping(block: ContentBlock) {
  mappingBlock.value = block
  showMappingDialog.value = true
}

function handleMappingConfirm(mappings: SpeakerMapping[], block: ContentBlock) {
  mappingResult.value = { block, mappings }
  showMappingDialog.value = false
  showMappingView.value = true
}
</script>

<template>
  <!-- 加载中 -->
  <div v-if="appView === 'loading'" class="h-screen flex items-center justify-center bg-gray-50">
    <div class="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
  </div>

  <!-- 登录/注册 -->
  <AuthPage v-else-if="appView === 'auth'" @auth-success="handleAuthSuccess" />

  <!-- 文件管理 -->
  <FileManager
    v-else-if="appView === 'files'"
    @logout="handleLogout"
    @open-file="handleOpenFile"
    @new-file="handleNewFile"
  />

  <!-- 编辑器主界面 -->
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
          <!-- 返回文件管理 -->
          <button
            class="flex items-center gap-1.5 text-sm text-gray-400 hover:text-indigo-500 transition-colors mr-1"
            @click="appView = 'files'"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <div class="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
            <FileText class="w-4 h-4 text-white" />
          </div>
          <h1 class="text-base font-semibold text-gray-800">文档分块预览</h1>
        </div>

        <div v-if="documentLoaded" class="flex items-center gap-4">
          <span class="text-sm text-gray-400 max-w-xs truncate">{{ fileName }}</span>
          <button
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

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
