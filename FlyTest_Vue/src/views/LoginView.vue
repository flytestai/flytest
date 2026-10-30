<template>
  <AuthShell>
    <p class="feice-auth-card-kicker">欢迎使用 FeiCe 飞测</p>
    <h2 id="auth-title">欢迎回来</h2>
    <p class="feice-auth-card-description">登录账号，进入你的测试工作台。</p>

    <form class="feice-auth-form" @submit.prevent="handleLogin">
      <div class="feice-auth-field">
        <label for="login-username">用户名 / 手机号</label>
        <div class="feice-auth-input-wrap">
          <icon-user class="feice-auth-input-icon" aria-hidden="true" />
          <input id="login-username" v-model.trim="username" class="feice-auth-input" type="text" required autocomplete="username" placeholder="请输入系统用户名或手机号" />
        </div>
      </div>
      <div class="feice-auth-field">
        <label for="login-password">密码</label>
        <div class="feice-auth-input-wrap">
          <icon-lock class="feice-auth-input-icon" aria-hidden="true" />
          <input id="login-password" v-model="password" class="feice-auth-input" :type="showPassword ? 'text' : 'password'" required autocomplete="current-password" placeholder="请输入密码" />
          <button class="feice-auth-eye" type="button" :aria-label="showPassword ? '隐藏密码' : '显示密码'" :aria-pressed="showPassword" aria-controls="login-password" @click="showPassword = !showPassword"><icon-eye-invisible v-if="showPassword" /><icon-eye v-else /></button>
        </div>
      </div>
      <div class="feice-auth-options">
        <label class="feice-auth-remember"><input v-model="rememberMe" type="checkbox" />记住我</label>
        <span class="feice-auth-options-note">用户名或手机号均可登录</span>
      </div>
      <p v-if="errorMessage" class="feice-auth-error" role="alert"><icon-exclamation-circle aria-hidden="true" />{{ errorMessage }}</p>
      <button class="feice-auth-submit" type="submit" :disabled="isLoading" :aria-busy="isLoading"><span>{{ isLoading ? '正在登录…' : '登录' }}</span><icon-arrow-right v-if="!isLoading" aria-hidden="true" /></button>
      <p class="feice-auth-switch">还没有账号？<router-link to="/register">立即注册 <span aria-hidden="true">↗</span></router-link></p>
    </form>
  </AuthShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import { IconArrowRight, IconExclamationCircle, IconEye, IconEyeInvisible, IconLock, IconUser } from '@arco-design/web-vue/es/icon'
import { useRouter } from 'vue-router'
import AuthShell from '@/components/auth/AuthShell.vue'
import { useAuthStore } from '@/store/authStore'

const username = ref('')
const password = ref('')
const rememberMe = ref(false)
const showPassword = ref(false)
const router = useRouter()
const authStore = useAuthStore()
const isLoading = computed(() => authStore.getIsLoading)
const errorMessage = computed(() => authStore.getLoginError)

const handleLogin = async () => {
  if (!username.value || !password.value || isLoading.value) return
  const success = await authStore.login(username.value, password.value, rememberMe.value)
  if (success) {
    if (rememberMe.value) localStorage.setItem('rememberedUsername', username.value)
    else localStorage.removeItem('rememberedUsername')
    Message.success('登录成功')
    await router.push({ name: 'Dashboard' })
  }
}

onMounted(() => {
  const saved = localStorage.getItem('rememberedUsername')
  if (saved) { username.value = saved; rememberMe.value = true }
})
</script>
