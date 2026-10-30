<template>
  <div class="feice-auth" :class="{ 'feice-auth--register': registration }">
    <div class="feice-auth-atmosphere" aria-hidden="true"></div>
    <header class="feice-auth-header">
      <router-link to="/login" aria-label="FeiCe 飞测首页" class="feice-auth-brand">
        <img class="feice-auth-logo-light" :src="brandFullLogoUrl" alt="FeiCe 飞测" width="210" height="45" />
        <img class="feice-auth-logo-dark" :src="brandFullLogoLoginWhiteUrl" alt="FeiCe 飞测" width="210" height="45" />
      </router-link>
      <span class="feice-auth-header-note"><icon-apps aria-hidden="true" />测试管理与自动化协作</span>
    </header>

    <div class="feice-auth-stage">
      <main class="feice-auth-main">
        <section class="feice-auth-story" aria-labelledby="feice-story-title">
          <span class="feice-auth-product-label">FEICE / QUALITY WORKSPACE</span>
          <h1 id="feice-story-title">让质量清晰可见，<br />让交付可靠可控。</h1>
          <p class="feice-auth-description">连接测试资产与执行反馈，<br />把团队的每一次协作落到实处。</p>
          <div class="feice-auth-workflow" aria-label="测试流程：需求分析、用例设计、自动执行、质量反馈">
            <header><span><icon-branch />全流程测试协作</span><span>WORKFLOW</span></header>
            <div class="feice-auth-workflow-steps"><div v-for="(label, index) in ['需求分析', '用例设计', '自动执行', '质量反馈']" :key="label"><span>0{{ index + 1 }}</span><strong>{{ label }}</strong></div></div>
          </div>
          <div class="feice-auth-capabilities"><span>API 自动化</span><span>Web 自动化</span><span>APP 自动化</span></div>
        </section>
        <section class="feice-auth-card" aria-labelledby="auth-title"><slot /></section>
      </main>
    </div>

    <footer class="feice-auth-footer">
      <span>© {{ new Date().getFullYear() }} FeiCe 飞测 · AI 智能测试平台</span>
      <span>开发与维护：魏振 <a href="mailto:66674094@qq.com">66674094@qq.com</a></span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { IconApps, IconBranch } from '@arco-design/web-vue/es/icon'
import { brandFullLogoUrl, brandFullLogoLoginWhiteUrl } from '@/utils/assetUrl'
defineProps<{ registration?: boolean }>()
</script>

<style src="./auth-shell.css"></style>
