<script setup lang="ts">
import { ref } from 'vue'
import { FileText, Mail, Lock, User, Eye, EyeOff, Loader2 } from 'lucide-vue-next'
import { supabase } from '../lib/supabase'

const emit = defineEmits<{ (e: 'auth-success'): void }>()

const mode = ref<'login' | 'register'>('login')
const email = ref('')
const password = ref('')
const displayName = ref('')
const showPassword = ref(false)
const loading = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

function switchMode(m: 'login' | 'register') {
  mode.value = m
  errorMsg.value = ''
  successMsg.value = ''
  email.value = ''
  password.value = ''
  displayName.value = ''
}

async function handleSubmit() {
  errorMsg.value = ''
  successMsg.value = ''

  if (!email.value.trim() || !password.value) {
    errorMsg.value = '请输入邮箱和密码'
    return
  }
  if (password.value.length < 6) {
    errorMsg.value = '密码长度至少 6 位'
    return
  }

  loading.value = true
  try {
    if (mode.value === 'register') {
      const { error } = await supabase.auth.signUp({
        email: email.value.trim(),
        password: password.value,
        options: {
          data: { display_name: displayName.value.trim() || email.value.split('@')[0] }
        }
      })
      if (error) throw error
      successMsg.value = '注册成功！请检查邮箱完成验证，或直接登录。'
      setTimeout(() => switchMode('login'), 2500)
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.value.trim(),
        password: password.value,
      })
      if (error) throw error
      emit('auth-success')
    }
  } catch (err: any) {
    const msg = err?.message || '操作失败，请重试'
    if (msg.includes('Invalid login credentials')) {
      errorMsg.value = '邮箱或密码错误'
    } else if (msg.includes('User already registered')) {
      errorMsg.value = '该邮箱已被注册，请直接登录'
    } else if (msg.includes('Email not confirmed')) {
      errorMsg.value = '邮箱尚未验证，请检查收件箱'
    } else {
      errorMsg.value = msg
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <!-- Logo -->
      <div class="text-center mb-8">
        <div class="inline-flex w-14 h-14 rounded-2xl bg-indigo-500 items-center justify-center shadow-lg mb-4">
          <FileText class="w-7 h-7 text-white" />
        </div>
        <h1 class="text-2xl font-bold text-gray-900">Emotion</h1>
        <p class="text-sm text-gray-500 mt-1">文档分块 · 智能整理</p>
      </div>

      <!-- Card -->
      <div class="bg-white rounded-3xl shadow-xl shadow-gray-100/80 p-8">
        <!-- Tab -->
        <div class="flex rounded-xl bg-gray-100 p-1 mb-6">
          <button
            class="flex-1 py-2 text-sm font-medium rounded-lg transition-all"
            :class="mode === 'login' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'"
            @click="switchMode('login')"
          >登录</button>
          <button
            class="flex-1 py-2 text-sm font-medium rounded-lg transition-all"
            :class="mode === 'register' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'"
            @click="switchMode('register')"
          >注册</button>
        </div>

        <form @submit.prevent="handleSubmit" class="space-y-4">
          <!-- 昵称（仅注册） -->
          <Transition name="slide-down">
            <div v-if="mode === 'register'" class="relative">
              <User class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                v-model="displayName"
                type="text"
                placeholder="昵称（可选）"
                class="w-full pl-10 pr-4 py-3 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all"
              />
            </div>
          </Transition>

          <!-- 邮箱 -->
          <div class="relative">
            <Mail class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              v-model="email"
              type="email"
              placeholder="邮箱地址"
              autocomplete="email"
              class="w-full pl-10 pr-4 py-3 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all"
            />
          </div>

          <!-- 密码 -->
          <div class="relative">
            <Lock class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="密码（至少 6 位）"
              autocomplete="current-password"
              class="w-full pl-10 pr-10 py-3 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all"
            />
            <button
              type="button"
              class="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              @click="showPassword = !showPassword"
            >
              <Eye v-if="!showPassword" class="w-4 h-4" />
              <EyeOff v-else class="w-4 h-4" />
            </button>
          </div>

          <!-- 错误/成功提示 -->
          <Transition name="fade">
            <div v-if="errorMsg" class="flex items-center gap-2 px-3.5 py-2.5 bg-red-50 border border-red-100 rounded-xl">
              <span class="text-xs text-red-600">{{ errorMsg }}</span>
            </div>
          </Transition>
          <Transition name="fade">
            <div v-if="successMsg" class="flex items-center gap-2 px-3.5 py-2.5 bg-green-50 border border-green-100 rounded-xl">
              <span class="text-xs text-green-600">{{ successMsg }}</span>
            </div>
          </Transition>

          <!-- 提交按钮 -->
          <button
            type="submit"
            :disabled="loading"
            class="w-full py-3 text-sm font-semibold text-white bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 disabled:cursor-not-allowed rounded-xl transition-all shadow-sm shadow-indigo-200 flex items-center justify-center gap-2"
          >
            <Loader2 v-if="loading" class="w-4 h-4 animate-spin" />
            {{ mode === 'login' ? '登录' : '创建账号' }}
          </button>
        </form>
      </div>

      <p class="text-center text-xs text-gray-400 mt-6">
        登录即代表你同意我们的服务条款与隐私政策
      </p>
    </div>
  </div>
</template>

<style scoped>
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.25s ease;
  overflow: hidden;
}
.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  max-height: 0;
  margin-bottom: 0;
}
.slide-down-enter-to,
.slide-down-leave-from {
  opacity: 1;
  max-height: 80px;
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
