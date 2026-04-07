<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { FileUp, FileText } from 'lucide-vue-next'
import AuthPage from './components/AuthPage.vue'
import BlockEditor from './components/BlockEditor.vue'
import BlockPanel from './components/BlockPanel.vue'
import DocPreview from './components/DocPreview.vue'
import FileManager from './components/FileManager.vue'
import FileUploader from './components/FileUploader.vue'
import MappingDialog from './components/MappingDialog.vue'
import MappingView from './components/MappingView.vue'
import ScrollMarker from './components/ScrollMarker.vue'
import { useBlockManager } from './composables/useBlockManager'
import { supabase } from './lib/supabase'
import type { UserFile } from './lib/supabase'
import { parseDocument } from './services/docParser'
import {
  findBlockMappings,
  toDocState,
  upsertBlockMappings,
} from './services/secureFileMapper'
import {
  createSecureFile,
  getSecureFile,
  saveSecureBlocks,
  saveSecureMappings,
} from './services/secureFilesApi'
import type { ContentBlock, DocState } from './types/block'
import type { BlockMappings } from './types/secureFiles'
import type { SpeakerMapping } from './utils/extractSpeakers'

const appView = ref<'loading' | 'auth' | 'files' | 'editor'>('loading')
const openFileError = ref('')
const blockMappings = ref<BlockMappings[]>([])

const {
  documentLoaded,
  fileId,
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
const activeBlockMappings = computed<SpeakerMapping[]>(() => {
  if (!mappingBlock.value) return []
  return findBlockMappings(blockMappings.value, mappingBlock.value.id)
})

const showMappingView = ref(false)
const mappingResult = ref<{ block: ContentBlock; mappings: SpeakerMapping[] } | null>(null)
const mappingViewLines = computed<string[]>(() => {
  if (!mappingResult.value) return []
  const block = mappingResult.value.block
  return content.value.slice(block.startLine, block.endLine + 1)
})

const showResetConfirm = ref(false)

function emptyDocumentState(): DocState {
  return {
    fileId: null,
    fileName: '',
    content: [],
    blocks: [],
    totalLines: 0,
  }
}

function resetEditorState() {
  setDocument(emptyDocumentState())
  blockMappings.value = []
  showMappingDialog.value = false
  showMappingView.value = false
  mappingBlock.value = null
  mappingResult.value = null
}

onMounted(async () => {
  const { data: { session } } = await supabase.auth.getSession()
  appView.value = session ? 'files' : 'auth'

  supabase.auth.onAuthStateChange((_event, session) => {
    if (!session) {
      resetEditorState()
      appView.value = 'auth'
    }
  })
})

function handleAuthSuccess() {
  appView.value = 'files'
}

function handleLogout() {
  resetEditorState()
  appView.value = 'auth'
}

async function handleOpenFile(file: UserFile) {
  openFileError.value = ''

  try {
    const secureFile = await getSecureFile(file.id)
    setDocument(toDocState(secureFile))
    blockMappings.value = secureFile.mappings ?? []
    showMappingView.value = false
    mappingResult.value = null
    appView.value = 'editor'
  } catch {
    openFileError.value = '文件加载失败，请重新打开'
  }
}

function handleNewFile() {
  resetEditorState()
  appView.value = 'editor'
}

function handleReset() {
  showResetConfirm.value = true
}

function confirmReset() {
  resetEditorState()
  showResetConfirm.value = false
}

async function persistBlocks() {
  if (!fileId.value) return
  await saveSecureBlocks(fileId.value, blocks.value)
}

async function persistMappings(nextMappings: BlockMappings[]) {
  if (!fileId.value) return
  await saveSecureMappings(fileId.value, nextMappings)
}

async function handleFileSelected(file: File) {
  try {
    const result = await parseDocument(file)
    const created = await createSecureFile({
      fileName: result.fileName,
      originalName: result.fileName,
      content: result.content,
    })

    setDocument({
      fileId: created.id,
      fileName: result.fileName,
      content: result.content,
      blocks: [],
      totalLines: result.content.length,
    })
    blockMappings.value = []
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

async function handleSaveBlock(name: string, color: string) {
  if (pendingBlock.value) {
    updateBlock(pendingBlock.value.id, { name, color })
  } else {
    createBlock(name, pendingStartLine.value, pendingEndLine.value, color)
  }

  try {
    await persistBlocks()
  } catch (error) {
    alert(error instanceof Error ? error.message : '分块保存失败')
  }

  showBlockEditor.value = false
  clearSelection()
}

async function handleDeleteBlock(id: string) {
  deleteBlock(id)

  const nextMappings = blockMappings.value.filter((item) => item.blockId !== id)
  blockMappings.value = nextMappings

  try {
    await Promise.all([
      persistBlocks(),
      persistMappings(nextMappings),
    ])
  } catch (error) {
    alert(error instanceof Error ? error.message : '分块删除失败')
  }
}

function handleScrollToLine(lineIndex: number) {
  docPreviewRef.value?.scrollToLine(lineIndex)
}

function handleMapping(block: ContentBlock) {
  mappingBlock.value = block
  showMappingDialog.value = true
}

async function handleMappingConfirm(mappings: SpeakerMapping[], block: ContentBlock) {
  const nextMappings = upsertBlockMappings(blockMappings.value, block.id, mappings)
  blockMappings.value = nextMappings
  mappingResult.value = { block, mappings }
  showMappingDialog.value = false
  showMappingView.value = true

  try {
    await persistMappings(nextMappings)
  } catch (error) {
    alert(error instanceof Error ? error.message : '角色映射保存失败')
  }
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
    :open-file-error="openFileError"
    @logout="handleLogout"
    @open-file="handleOpenFile"
    @new-file="handleNewFile"
    @clear-error="openFileError = ''"
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
        :existing-mappings="activeBlockMappings"
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
