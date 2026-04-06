<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { X, Users, UserCheck, ArrowRight } from 'lucide-vue-next'
import { extractSpeakers, type SpeakerMapping } from '../utils/extractSpeakers'
import type { ContentBlock } from '../types/block'

const props = defineProps<{
  visible: boolean
  block: ContentBlock | null
  blockLines: string[]   // 该块对应的文本行
}>()

const emit = defineEmits<{
  close: []
  confirm: [mappings: SpeakerMapping[], block: ContentBlock]
}>()

const speakers = ref<string[]>([])
const counselors = ref<string[]>([])   // 选中的咨询师
const visitors = ref<string[]>([])     // 选中的来访者

watch(() => props.visible, (v) => {
  if (v && props.blockLines.length) {
    speakers.value = extractSpeakers(props.blockLines)
    counselors.value = []
    visitors.value = []
  }
})

// 某个发言人是否已被另一侧选中
function isCounselorDisabled(name: string) {
  return visitors.value.includes(name)
}
function isVisitorDisabled(name: string) {
  return counselors.value.includes(name)
}

function toggleCounselor(name: string) {
  if (isCounselorDisabled(name)) return
  const idx = counselors.value.indexOf(name)
  if (idx === -1) counselors.value.push(name)
  else counselors.value.splice(idx, 1)
}

function toggleVisitor(name: string) {
  if (isVisitorDisabled(name)) return
  const idx = visitors.value.indexOf(name)
  if (idx === -1) visitors.value.push(name)
  else visitors.value.splice(idx, 1)
}

const canConfirm = computed(() =>
  counselors.value.length > 0 || visitors.value.length > 0
)

function handleConfirm() {
  if (!props.block) return
  const mappings: SpeakerMapping[] = [
    ...counselors.value.map(s => ({ speaker: s, role: 'counselor' as const })),
    ...visitors.value.map(s => ({ speaker: s, role: 'visitor' as const })),
  ]
  emit('confirm', mappings, props.block)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="visible"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        @click.self="$emit('close')"
      >
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-slide-up">
          <!-- 头部 -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h3 class="text-base font-semibold text-gray-800">角色映射</h3>
              <p class="text-xs text-gray-400 mt-0.5" v-if="block">
                块：{{ block.name }} · 共提取到 {{ speakers.length }} 位发言人
              </p>
            </div>
            <button
              class="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              @click="$emit('close')"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <!-- 无发言人提示 -->
          <div v-if="speakers.length === 0" class="px-6 py-10 text-center text-gray-400">
            <Users class="w-10 h-10 mx-auto mb-3 text-gray-200" />
            <p class="text-sm">未在该块中检测到发言人</p>
            <p class="text-xs mt-1 text-gray-300">需要"发言人名↵时间戳"格式</p>
          </div>

          <!-- 两列映射区 -->
          <div v-else class="px-6 py-5">
            <div class="grid grid-cols-2 gap-4">
              <!-- 咨询师列 -->
              <div>
                <div class="flex items-center gap-2 mb-3">
                  <div class="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center">
                    <UserCheck class="w-3.5 h-3.5 text-violet-500" />
                  </div>
                  <span class="text-sm font-medium text-gray-700">咨询师</span>
                  <span class="text-xs text-gray-400">({{ counselors.length }} 人)</span>
                </div>
                <div class="space-y-2">
                  <label
                    v-for="name in speakers"
                    :key="'c-' + name"
                    class="flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition-all select-none"
                    :class="[
                      counselors.includes(name)
                        ? 'border-violet-300 bg-violet-50'
                        : isCounselorDisabled(name)
                          ? 'border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed'
                          : 'border-gray-200 hover:border-violet-200 hover:bg-violet-50/50'
                    ]"
                    @click="toggleCounselor(name)"
                  >
                    <div
                      class="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors"
                      :class="counselors.includes(name) ? 'border-violet-500 bg-violet-500' : 'border-gray-300'"
                    >
                      <svg v-if="counselors.includes(name)" class="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8">
                        <path d="M1 4l3 3 5-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </div>
                    <span class="text-sm text-gray-700 truncate">{{ name }}</span>
                  </label>
                </div>
              </div>

              <!-- 来访者列 -->
              <div>
                <div class="flex items-center gap-2 mb-3">
                  <div class="w-6 h-6 rounded-full bg-sky-100 flex items-center justify-center">
                    <Users class="w-3.5 h-3.5 text-sky-500" />
                  </div>
                  <span class="text-sm font-medium text-gray-700">来访者</span>
                  <span class="text-xs text-gray-400">({{ visitors.length }} 人)</span>
                </div>
                <div class="space-y-2">
                  <label
                    v-for="name in speakers"
                    :key="'v-' + name"
                    class="flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition-all select-none"
                    :class="[
                      visitors.includes(name)
                        ? 'border-sky-300 bg-sky-50'
                        : isVisitorDisabled(name)
                          ? 'border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed'
                          : 'border-gray-200 hover:border-sky-200 hover:bg-sky-50/50'
                    ]"
                    @click="toggleVisitor(name)"
                  >
                    <div
                      class="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors"
                      :class="visitors.includes(name) ? 'border-sky-500 bg-sky-500' : 'border-gray-300'"
                    >
                      <svg v-if="visitors.includes(name)" class="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8">
                        <path d="M1 4l3 3 5-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </div>
                    <span class="text-sm text-gray-700 truncate">{{ name }}</span>
                  </label>
                </div>
              </div>
            </div>

            <!-- 未分配提示 -->
            <div
              v-if="speakers.some(s => !counselors.includes(s) && !visitors.includes(s))"
              class="mt-3 text-xs text-amber-500 bg-amber-50 rounded-lg px-3 py-2"
            >
              还有 {{ speakers.filter(s => !counselors.includes(s) && !visitors.includes(s)).length }} 位发言人未分配角色，未分配者将保留原名
            </div>
          </div>

          <!-- 底部操作 -->
          <div class="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
            <button
              class="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              @click="$emit('close')"
            >
              取消
            </button>
            <button
              class="flex items-center gap-2 px-5 py-2 text-sm text-white bg-indigo-500 hover:bg-indigo-600 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-medium"
              :disabled="!canConfirm"
              @click="handleConfirm"
            >
              生成映射视图
              <ArrowRight class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.animate-slide-up { animation: slideUp 0.25s ease-out; }
@keyframes slideUp {
  from { opacity: 0; transform: translateY(16px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0)   scale(1); }
}
</style>
