<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  FolderOpen, Folder as FolderIcon, FilePlus, FolderPlus, LogOut, ChevronRight,
  Home, Pencil, Trash2, X, Check, FileText, Clock, MoreHorizontal, ArrowLeft
} from 'lucide-vue-next'
import { supabase } from '../lib/supabase'
import type { Folder, UserFile } from '../lib/supabase'

const emit = defineEmits<{
  (e: 'logout'): void
  (e: 'open-file', file: UserFile): void
  (e: 'new-file'): void
  (e: 'clear-error'): void
}>()

const props = defineProps<{
  openFileError?: string
}>()

// ── 状态 ──
const loading = ref(true)
const folders = ref<Folder[]>([])
const files = ref<UserFile[]>([])
const currentFolderId = ref<string | null>(null)
const folderPath = ref<Array<{ id: string | null; name: string }>>([{ id: null, name: '全部文件' }])
const userEmail = ref('')
const userDisplayName = ref('')

// ── 弹窗/编辑状态 ──
const showNewFolder = ref(false)
const newFolderName = ref('')
const newFolderColor = ref('#6366F1')
const creatingFolder = ref(false)

const renamingId = ref<string | null>(null)
const renameVal = ref('')

const deleteTarget = ref<{ type: 'folder' | 'file'; id: string; name: string } | null>(null)
const deletingId = ref<string | null>(null)

const openMenuId = ref<string | null>(null)

// ── 颜色选项 ──
const folderColors = [
  '#6366F1','#8B5CF6','#EC4899','#EF4444','#F59E0B',
  '#10B981','#06B6D4','#3B82F6','#84CC16','#F97316'
]

// ── 计算：当前目录下的文件夹和文件 ──
const currentFolders = computed(() =>
  folders.value.filter(f => f.parent_id === currentFolderId.value)
)
const currentFiles = computed(() =>
  files.value.filter(f => f.folder_id === currentFolderId.value)
)
const isEmpty = computed(() => currentFolders.value.length === 0 && currentFiles.value.length === 0)

// ── 初始化 ──
onMounted(async () => {
  // 首先检查用户是否已登录
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    loading.value = false
    return
  }
  
  await fetchUserInfo()
  await fetchData()
})

async function fetchUserInfo() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  userEmail.value = user.email || ''
  const { data } = await supabase.from('profiles').select('display_name').eq('id', user.id).single()
  userDisplayName.value = data?.display_name || user.email?.split('@')[0] || '用户'
}

async function fetchData() {
  loading.value = true
  
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { 
      console.log('用户未登录，跳过数据加载')
      loading.value = false
      return 
    }

    const [foldersRes, filesRes] = await Promise.all([
      supabase.from('folders').select('*').eq('user_id', user.id).order('name'),
      supabase.from('user_files').select('id,user_id,folder_id,file_name,original_name,file_meta,created_at,updated_at').eq('user_id', user.id).order('updated_at', { ascending: false })
    ])

    if (foldersRes.error) {
      console.error('加载文件夹失败:', foldersRes.error)
    }
    if (filesRes.error) {
      console.error('加载文件失败:', filesRes.error)
    }

    if (foldersRes.data) folders.value = foldersRes.data
    if (filesRes.data) files.value = filesRes.data as UserFile[]
  } catch (error) {
    console.error('加载数据时出错:', error)
  } finally {
    loading.value = false
  }
}

// ── 导航 ──
function enterFolder(folder: Folder) {
  currentFolderId.value = folder.id
  folderPath.value.push({ id: folder.id, name: folder.name })
  openMenuId.value = null
}

function navigateTo(idx: number) {
  const item = folderPath.value[idx]
  currentFolderId.value = item.id
  folderPath.value = folderPath.value.slice(0, idx + 1)
}

// ── 新建文件夹 ──
async function createFolder() {
  if (!newFolderName.value.trim()) return
  creatingFolder.value = true
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) { creatingFolder.value = false; return }

  const { data, error } = await supabase.from('folders').insert({
    user_id: user.id,
    parent_id: currentFolderId.value,
    name: newFolderName.value.trim(),
    color: newFolderColor.value,
  }).select().single()

  if (!error && data) {
    folders.value.push(data as Folder)
  }
  newFolderName.value = ''
  showNewFolder.value = false
  creatingFolder.value = false
}

// ── 重命名文件夹 ──
function startRename(folder: Folder) {
  renamingId.value = folder.id
  renameVal.value = folder.name
  openMenuId.value = null
}

async function confirmRename(folder: Folder) {
  if (!renameVal.value.trim()) { renamingId.value = null; return }
  const { error } = await supabase.from('folders').update({ name: renameVal.value.trim() }).eq('id', folder.id)
  if (!error) {
    const idx = folders.value.findIndex(f => f.id === folder.id)
    if (idx !== -1) folders.value[idx].name = renameVal.value.trim()
  }
  renamingId.value = null
}

// ── 删除 ──
function askDelete(type: 'folder' | 'file', id: string, name: string) {
  deleteTarget.value = { type, id, name }
  openMenuId.value = null
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  const { type, id } = deleteTarget.value
  deletingId.value = id

  if (type === 'folder') {
    await supabase.from('folders').delete().eq('id', id)
    folders.value = folders.value.filter(f => f.id !== id)
  } else {
    await supabase.from('user_files').delete().eq('id', id)
    files.value = files.value.filter(f => f.id !== id)
  }
  deletingId.value = null
  deleteTarget.value = null
}

// ── 移动文件到文件夹 ──
const movingFileId = ref<string | null>(null)
const showMovePanel = ref(false)
const moveTargetFolderId = ref<string | null>(undefined as any)

function startMoveFile(file: UserFile) {
  movingFileId.value = file.id
  showMovePanel.value = true
  openMenuId.value = null
}

async function confirmMove(targetFolderId: string | null) {
  if (!movingFileId.value) return
  const { error } = await supabase.from('user_files').update({ folder_id: targetFolderId }).eq('id', movingFileId.value)
  if (!error) {
    const idx = files.value.findIndex(f => f.id === movingFileId.value)
    if (idx !== -1) files.value[idx].folder_id = targetFolderId
  }
  movingFileId.value = null
  showMovePanel.value = false
}

// ── 登出 ──
async function handleLogout() {
  await supabase.auth.signOut()
  emit('logout')
}

// ── 工具函数 ──
function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = (now.getTime() - d.getTime()) / 1000
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} 天前`
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex flex-col">
    <!-- Header -->
    <header class="flex-shrink-0 h-14 bg-white border-b border-gray-100 flex items-center justify-between px-6 shadow-sm">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
          <FileText class="w-4 h-4 text-white" />
        </div>
        <h1 class="text-base font-semibold text-gray-800">Emotion</h1>
      </div>

      <div class="flex items-center gap-3">
        <div class="text-right hidden sm:block">
          <p class="text-sm font-medium text-gray-700">{{ userDisplayName }}</p>
          <p class="text-xs text-gray-400">{{ userEmail }}</p>
        </div>
        <button
          class="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
          @click="handleLogout"
        >
          <LogOut class="w-4 h-4" />
          <span class="hidden sm:inline">退出</span>
        </button>
      </div>
    </header>

    <!-- 内联错误提示（替代 alert） -->
    <Transition name="fade">
      <div v-if="openFileError" class="flex items-center justify-between gap-3 px-6 py-3 bg-red-50 border-b border-red-100">
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4 text-red-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p class="text-sm text-red-600">{{ openFileError }}</p>
        </div>
        <button class="text-red-400 hover:text-red-600 flex-shrink-0" @click="emit('clear-error')">
          <X class="w-4 h-4" />
        </button>
      </div>
    </Transition>

    <!-- Main -->
    <main class="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6">
      <!-- 面包屑 + 操作栏 -->
      <div class="flex items-center justify-between mb-5">
        <!-- 面包屑 -->
        <div class="flex items-center gap-1 text-sm">
          <button
            v-for="(crumb, idx) in folderPath"
            :key="idx"
            class="flex items-center gap-1"
            @click="navigateTo(idx)"
          >
            <Home v-if="idx === 0" class="w-3.5 h-3.5 text-gray-400" />
            <span
              class="transition-colors"
              :class="idx === folderPath.length - 1 ? 'text-gray-800 font-medium' : 'text-gray-400 hover:text-indigo-500 cursor-pointer'"
            >{{ idx === 0 ? '全部文件' : crumb.name }}</span>
            <ChevronRight v-if="idx < folderPath.length - 1" class="w-3.5 h-3.5 text-gray-300" />
          </button>
        </div>

        <!-- 操作按钮 -->
        <div class="flex items-center gap-2">
          <button
            class="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 hover:border-indigo-300 hover:text-indigo-600 rounded-xl transition-all"
            @click="showNewFolder = true"
          >
            <FolderPlus class="w-4 h-4" />
            新建文件夹
          </button>
          <button
            class="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 rounded-xl transition-all shadow-sm"
            @click="emit('new-file')"
          >
            <FilePlus class="w-4 h-4" />
            上传文件
          </button>
        </div>
      </div>

      <!-- 内容区 -->
      <div v-if="loading" class="flex items-center justify-center py-20">
        <div class="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      </div>

      <template v-else>
        <!-- 空状态 -->
        <div v-if="isEmpty" class="flex flex-col items-center justify-center py-20 text-center">
          <div class="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <FolderOpen class="w-8 h-8 text-gray-300" />
          </div>
          <p class="text-gray-500 font-medium mb-1">这里还什么都没有</p>
          <p class="text-sm text-gray-400 mb-6">上传文档或新建文件夹来开始整理</p>
          <button
            class="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 rounded-xl transition-all shadow-sm"
            @click="emit('new-file')"
          >
            <FilePlus class="w-4 h-4" />
            上传第一个文件
          </button>
        </div>

        <div v-else class="space-y-6">
          <!-- 文件夹区 -->
          <div v-if="currentFolders.length">
            <h2 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">文件夹</h2>
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              <div
                v-for="folder in currentFolders"
                :key="folder.id"
                class="group relative bg-white rounded-2xl border border-gray-100 p-4 hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer select-none"
                @click="enterFolder(folder)"
              >
                <!-- 图标 -->
                <div class="w-10 h-10 rounded-xl flex items-center justify-center mb-3" :style="{ backgroundColor: folder.color + '20' }">
                  <FolderIcon class="w-5 h-5" :style="{ color: folder.color }" />
                </div>

                <!-- 重命名输入 -->
                <div v-if="renamingId === folder.id" @click.stop>
                  <input
                    v-model="renameVal"
                    class="w-full text-sm border border-indigo-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    autofocus
                    @keyup.enter="confirmRename(folder)"
                    @keyup.esc="renamingId = null"
                  />
                  <div class="flex gap-1 mt-1">
                    <button class="flex-1 py-1 text-xs bg-indigo-500 text-white rounded-lg" @click.stop="confirmRename(folder)">确认</button>
                    <button class="flex-1 py-1 text-xs bg-gray-100 text-gray-500 rounded-lg" @click.stop="renamingId = null">取消</button>
                  </div>
                </div>
                <p v-else class="text-sm font-medium text-gray-700 truncate">{{ folder.name }}</p>

                <!-- 更多菜单 -->
                <button
                  class="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-all"
                  @click.stop="openMenuId = openMenuId === folder.id ? null : folder.id"
                >
                  <MoreHorizontal class="w-4 h-4" />
                </button>

                <!-- 下拉菜单 -->
                <Transition name="fade">
                  <div
                    v-if="openMenuId === folder.id"
                    class="absolute top-9 right-2 bg-white border border-gray-100 rounded-xl shadow-lg py-1 z-10 min-w-[120px]"
                    @click.stop
                  >
                    <button class="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50" @click="startRename(folder)">
                      <Pencil class="w-3.5 h-3.5" /> 重命名
                    </button>
                    <button class="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50" @click="askDelete('folder', folder.id, folder.name)">
                      <Trash2 class="w-3.5 h-3.5" /> 删除
                    </button>
                  </div>
                </Transition>
              </div>
            </div>
          </div>

          <!-- 文件区 -->
          <div v-if="currentFiles.length">
            <h2 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">文件</h2>
            <div class="space-y-2">
              <div
                v-for="file in currentFiles"
                :key="file.id"
                class="group flex items-center gap-4 bg-white rounded-2xl border border-gray-100 px-4 py-3.5 hover:border-indigo-200 hover:shadow-sm transition-all cursor-pointer"
                @click="emit('open-file', file)"
              >
                <div class="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                  <FileText class="w-4 h-4 text-indigo-400" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-gray-800 truncate">{{ file.original_name || file.file_name }}</p>
                  <div class="flex items-center gap-3 mt-0.5">
                    <span class="flex items-center gap-1 text-xs text-gray-400">
                      <Clock class="w-3 h-3" />
                      {{ formatDate(file.updated_at) }}
                    </span>
                  </div>
                </div>
                <!-- 文件更多菜单 -->
                <div class="relative">
                  <button
                    class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-all"
                    @click.stop="openMenuId = openMenuId === file.id ? null : file.id"
                  >
                    <MoreHorizontal class="w-4 h-4" />
                  </button>
                  <Transition name="fade">
                    <div
                      v-if="openMenuId === file.id"
                      class="absolute top-9 right-0 bg-white border border-gray-100 rounded-xl shadow-lg py-1 z-10 min-w-[130px]"
                      @click.stop
                    >
                      <button class="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50" @click="startMoveFile(file)">
                        <FolderOpen class="w-3.5 h-3.5" /> 移动到文件夹
                      </button>
                      <button class="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50" @click="askDelete('file', file.id, file.original_name || file.file_name)">
                        <Trash2 class="w-3.5 h-3.5" /> 删除
                      </button>
                    </div>
                  </Transition>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </main>

    <!-- 新建文件夹弹窗 -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showNewFolder" class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" @click.self="showNewFolder = false">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-base font-semibold text-gray-800">新建文件夹</h3>
              <button class="text-gray-400 hover:text-gray-600" @click="showNewFolder = false">
                <X class="w-5 h-5" />
              </button>
            </div>
            <input
              v-model="newFolderName"
              type="text"
              placeholder="文件夹名称"
              autofocus
              class="w-full px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent mb-4"
              @keyup.enter="createFolder"
            />
            <!-- 颜色选择 -->
            <p class="text-xs text-gray-400 mb-2">颜色</p>
            <div class="flex flex-wrap gap-2 mb-5">
              <button
                v-for="c in folderColors"
                :key="c"
                class="w-7 h-7 rounded-full transition-transform hover:scale-110 flex items-center justify-center"
                :style="{ backgroundColor: c }"
                :class="newFolderColor === c ? 'ring-2 ring-offset-1 ring-gray-400' : ''"
                @click="newFolderColor = c"
              >
                <Check v-if="newFolderColor === c" class="w-3.5 h-3.5 text-white" />
              </button>
            </div>
            <div class="flex gap-2">
              <button class="flex-1 py-2.5 text-sm text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors" @click="showNewFolder = false">取消</button>
              <button
                class="flex-1 py-2.5 text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 rounded-xl transition-colors disabled:opacity-60"
                :disabled="!newFolderName.trim() || creatingFolder"
                @click="createFolder"
              >创建</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 删除确认弹窗 -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="deleteTarget" class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" @click.self="deleteTarget = null">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 class="text-base font-semibold text-gray-800 mb-2">确认删除</h3>
            <p class="text-sm text-gray-500 mb-6">
              确定删除{{ deleteTarget.type === 'folder' ? '文件夹' : '文件' }}
              <span class="font-medium text-gray-700">「{{ deleteTarget.name }}」</span>吗？
              {{ deleteTarget.type === 'folder' ? '文件夹内的文件不会被删除。' : '此操作不可恢复。' }}
            </p>
            <div class="flex gap-2">
              <button class="flex-1 py-2.5 text-sm text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl" @click="deleteTarget = null">取消</button>
              <button
                class="flex-1 py-2.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl disabled:opacity-60"
                :disabled="!!deletingId"
                @click="confirmDelete"
              >删除</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 移动文件弹窗 -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showMovePanel" class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" @click.self="showMovePanel = false; movingFileId = null">
          <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-base font-semibold text-gray-800">移动到文件夹</h3>
              <button class="text-gray-400 hover:text-gray-600" @click="showMovePanel = false; movingFileId = null">
                <X class="w-5 h-5" />
              </button>
            </div>
            <div class="space-y-1 max-h-64 overflow-y-auto mb-4">
              <button
                class="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-colors"
                @click="confirmMove(null)"
              >
                <Home class="w-4 h-4 text-gray-400" />
                根目录（不在任何文件夹）
              </button>
              <button
                v-for="folder in folders"
                :key="folder.id"
                class="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-colors"
                @click="confirmMove(folder.id)"
              >
                <FolderIcon class="w-4 h-4" :style="{ color: folder.color }" />
                {{ folder.name }}
              </button>
            </div>
            <button class="w-full py-2 text-sm text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors" @click="showMovePanel = false; movingFileId = null">取消</button>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 全局点击关闭菜单 -->
    <div v-if="openMenuId" class="fixed inset-0 z-[5]" @click="openMenuId = null" />
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
