<template>
  <AuthShell registration>
    <p class="feice-auth-card-kicker">加入 FeiCe 飞测</p>
    <h2 id="auth-title">创建账号</h2>
    <p class="feice-auth-card-description">填写以下信息，开始团队测试协作。</p>
    <form class="feice-auth-form" @submit.prevent="handleSubmit">
      <div class="feice-auth-field">
        <label for="realName">姓名</label>
        <div class="feice-auth-input-wrap"><icon-user class="feice-auth-input-icon" aria-hidden="true" /><input id="realName" v-model.trim="formState.realName" class="feice-auth-input" type="text" required maxlength="20" autocomplete="name" placeholder="请输入姓名（仅支持中文）" /></div>
        <p class="feice-auth-tip">2–20 位中文姓名，请与团队使用的姓名保持一致。</p>
      </div>
      <div class="feice-auth-field">
        <label for="phoneNumber">手机号</label>
        <div class="feice-auth-input-wrap"><icon-mobile class="feice-auth-input-icon" aria-hidden="true" /><input id="phoneNumber" v-model.trim="formState.phoneNumber" class="feice-auth-input" type="tel" required inputmode="numeric" maxlength="11" autocomplete="tel" placeholder="请输入手机号" /></div>
      </div>
      <div class="feice-auth-field">
        <label for="password">密码</label>
        <div class="feice-auth-input-wrap">
          <icon-lock class="feice-auth-input-icon" aria-hidden="true" /><input id="password" v-model="formState.password" class="feice-auth-input" :type="showPassword ? 'text' : 'password'" required autocomplete="new-password" placeholder="请输入密码" />
          <button class="feice-auth-eye" type="button" :aria-label="showPassword ? '隐藏密码' : '显示密码'" :aria-pressed="showPassword" aria-controls="password" @click="togglePasswordVisibility"><icon-eye-invisible v-if="showPassword" /><icon-eye v-else /></button>
        </div>
      </div>
      <div class="feice-auth-field">
        <label for="confirmPassword">确认密码</label>
        <div class="feice-auth-input-wrap">
          <icon-check-circle class="feice-auth-input-icon" aria-hidden="true" /><input id="confirmPassword" v-model="formState.confirmPassword" class="feice-auth-input" :type="showConfirmPassword ? 'text' : 'password'" required autocomplete="new-password" placeholder="请再次输入密码" />
          <button class="feice-auth-eye" type="button" :aria-label="showConfirmPassword ? '隐藏确认密码' : '显示确认密码'" :aria-pressed="showConfirmPassword" aria-controls="confirmPassword" @click="toggleConfirmPasswordVisibility"><icon-eye-invisible v-if="showConfirmPassword" /><icon-eye v-else /></button>
        </div>
      </div>
      <p v-if="registerError" class="feice-auth-error" role="alert"><icon-exclamation-circle aria-hidden="true" />{{ registerError }}</p>
      <div v-if="registerSuccess.username" class="feice-auth-success" role="status"><strong>注册成功，欢迎加入 FeiCe</strong><p>系统用户名：<code>{{ registerSuccess.username }}</code></p><p>管理员审核通过后，可使用系统用户名或手机号登录。</p></div>
      <p class="feice-auth-tip">提交注册后，需经管理员审核方可使用工作台。</p>
      <button class="feice-auth-submit" type="submit" :disabled="isLoading" :aria-busy="isLoading"><span>{{ isLoading ? '正在注册…' : '注册' }}</span><icon-arrow-right v-if="!isLoading" aria-hidden="true" /></button>
      <p class="feice-auth-switch">已有账号？<router-link to="/login">返回登录 <span aria-hidden="true">↗</span></router-link></p>
    </form>
  </AuthShell>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { Message } from '@arco-design/web-vue';
import { useAuthStore } from '@/store/authStore';
import AuthShell from '@/components/auth/AuthShell.vue';
import { IconArrowRight, IconCheckCircle, IconExclamationCircle, IconEye, IconEyeInvisible, IconLock, IconMobile, IconUser } from '@arco-design/web-vue/es/icon';

const CHINA_MOBILE_REGEX = /^1[3-9]\d{9}$/;
const CHINESE_REAL_NAME_REGEX = /^[\u4e00-\u9fff·]{2,20}$/;

const authStore = useAuthStore();

const formState = reactive({
  realName: '',
  phoneNumber: '',
  password: '',
  confirmPassword: '',
});

const showPassword = ref(false);
const showConfirmPassword = ref(false);
const registerSuccess = reactive({
  username: '',
});

const isLoading = computed(() => authStore.getIsLoading);
const registerError = computed(() => authStore.getRegisterError);

const togglePasswordVisibility = () => {
  showPassword.value = !showPassword.value;
};

const toggleConfirmPasswordVisibility = () => {
  showConfirmPassword.value = !showConfirmPassword.value;
};

const validateForm = () => {
  if (!formState.realName || !formState.phoneNumber || !formState.password || !formState.confirmPassword) {
    Message.warning('请填写所有必填项');
    return false;
  }

  if (!CHINESE_REAL_NAME_REGEX.test(formState.realName)) {
    Message.warning('姓名仅支持2到20位中文');
    return false;
  }

  if (!CHINA_MOBILE_REGEX.test(formState.phoneNumber)) {
    Message.warning('请填写真实的手机号');
    return false;
  }

  if (formState.password !== formState.confirmPassword) {
    Message.warning('两次输入的密码不一致');
    return false;
  }

  return true;
};

const handleSubmit = async () => {
  if (!validateForm()) {
    return;
  }

  try {
    registerSuccess.username = '';
    const result = await authStore.register(formState.realName, formState.phoneNumber, formState.password);
    if (result.success && result.data) {
      registerSuccess.username = result.data.username || '';
      Message.success(`注册成功，系统用户名：${registerSuccess.username}`);
      formState.realName = '';
      formState.phoneNumber = '';
      formState.password = '';
      formState.confirmPassword = '';
    }
  } catch (error) {
    console.error('Exception during authStore.register call:', error);
    Message.error('注册过程中发生意外错误');
  }
};
</script>
