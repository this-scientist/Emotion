<script setup lang="ts">
import { ref } from 'vue'
import { Upload, FileText } from 'lucide-vue-next'

const emit = defineEmits<{
  fileSelected: [file: File]
}>()

const isDragging = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const acceptTypes = '.docx,.txt'

function handleDragOver(e: DragEvent) {
  e.preventDefault()
  isDragging.value = true
}

function handleDragLeave() {
  isDragging.value = false
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
  
  const files = e.dataTransfer?.files
  if (files && files.length > 0) {
    validateAndEmit(files[0])
  }
}

function handleFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  const files = target.files
  if (files && files.length > 0) {
    validateAndEmit(files[0])
  }
}

function validateAndEmit(file: File) {
  const validTypes = ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
  const extension = file.name.split('.').pop()?.toLowerCase()
  
  if (!validTypes.includes(file.type) && extension !== 'txt' && extension !== 'docx') {
    alert('请上传 .docx 或 .txt 格式的文件')
    return
  }
  
  emit('fileSelected', file)
}

function triggerFileInput() {
  fileInput.value?.click()
}
</script>

<template>
  <div
    class="relative w-full h-full flex items-center justify-center p-8"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <div
      class="w-full max-w-xl aspect-video flex flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer"
      :class="[
        isDragging
          ? 'border-primary bg-primary/10 scale-105'
          : 'border-gray-300 hover:border-primary hover:bg-gray-50'
      ]"
      @click="triggerFileInput"
    >
      <div class="mb-4">
        <Upload
          class="w-16 h-16 transition-colors"
          :class="isDragging ? 'text-primary' : 'text-gray-400'"
        />
      </div>
      
      <h3 class="text-xl font-semibold text-text-primary mb-2">
        {{ isDragging ? '松开以上传文件' : '拖拽文件到此处' }}
      </h3>
      
      <p class="text-text-secondary mb-4">
        或点击选择文件
      </p>
      
      <div class="flex items-center gap-2 text-sm text-text-secondary">
        <FileText class="w-4 h-4" />
        <span>支持 .docx, .txt 格式</span>
      </div>
      
      <input
        ref="fileInput"
        type="file"
        :accept="acceptTypes"
        class="hidden"
        @change="handleFileSelect"
      />
    </div>
  </div>
</template>
