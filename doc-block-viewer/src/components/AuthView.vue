<template>
  <div class="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-gray-800 mb-2">Emotion</h1>
        <p class="text-gray-600">心理咨询逐字稿分析工具</p>
      </div>

      <div v-if="loading" class="flex justify-center items-center py-8">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>

      <div v-else>
        <div class="flex mb-6">
          <button
            @click="mode = 'signin'"
            :class="[
              'flex-1 py-2 text-center font-medium transition-colors',
              mode === 'signin' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'
            ]"
          >
            登录
          </button>
          <button
            @click="mode = 'signup'"
            :class="[
              'flex-1 py-2 text-center font-medium transition-colors',
              mode === 'signup' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'
            ]"
          >
            注册
          </button>
        </div>

        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div v-if="mode === 'signup'">
            <label class="block text-sm font-medium text-gray-700 mb-1">用户名</label>
            <input
              v-model="form.username"
              type="text"
              required
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="请输入用户名"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
            <input
              v-model="form.email"
              type="email"
              required
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="请输入邮箱"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">密码</label>
            <input
              v-model="form.password"
              type="password"
              required
              minlength="6"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="请输入密码（至少6位）"
            />
          </div>

          <div v-if="error" class="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
            {{ error }}
          </div>

          <button
            type="submit"
            :disabled="submitting"
            class="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ submitting ? '处理中...' : mode === 'signin' ? '登录' : '注册' }}
          </button>
        </form>

        <div class="mt-6 pt-6 border-t border-gray-200">
          <p class="text-sm text-gray-600 text-center">
            <span class="text-xs">数据将安全存储在云端</span>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { authService } from '../services/auth'

const emit = defineEmits(['authenticated'])

const mode = ref<'signin' | 'signup'>('signin')
const loading = ref(true)
const submitting = ref(false)
const error = ref('')

const form = ref({
  email: '',
  password: '',
  username: '',
})

// Check if user is already logged in
const checkAuth = async () => {
  try {
    const user = await authService.getCurrentUser()
    if (user) {
      emit('authenticated', user)
    }
  } catch (err) {
    console.error('Auth check failed:', err)
  } finally {
    loading.value = false
  }
}

const handleSubmit = async () => {
  error.value = ''
  submitting.value = true

  try {
    if (mode.value === 'signin') {
      const result = await authService.signIn(form.value.email, form.value.password)
      if (result.success && result.user) {
        emit('authenticated', result.user)
      } else {
        error.value = result.error || '登录失败'
      }
    } else {
      const result = await authService.signUp(form.value.email, form.value.password, form.value.username)
      if (result.success && result.user) {
        emit('authenticated', result.user)
      } else {
        error.value = result.error || '注册失败'
      }
    }
  } catch (err: any) {
    error.value = err.message || '操作失败'
  } finally {
    submitting.value = false
  }
}

checkAuth()
</script>
