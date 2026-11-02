<template>
  <div class="feice-auth" :class="{ 'feice-auth--register': registration }">
    <section class="feice-auth-brand-panel" aria-labelledby="feice-story-title">
      <header class="feice-auth-header">
        <router-link
          to="/login"
          aria-label="FeiCe 飞测首页"
          class="feice-auth-brand"
        >
          <img
            class="feice-auth-logo-light"
            :src="brandFullLogoUrl"
            alt="FeiCe 飞测"
            width="180"
            height="46"
          />
          <img
            class="feice-auth-logo-dark"
            :src="brandFullLogoLoginWhiteUrl"
            alt="FeiCe 飞测"
            width="180"
            height="46"
          />
        </router-link>
      </header>

      <section class="feice-auth-story" aria-labelledby="feice-story-title">
        <h1 id="feice-story-title">
          <em>AI</em> 测试管理<br />与自动化协作平台
        </h1>
        <p class="feice-auth-description">连接需求、用例、缺陷与自动化执行</p>
        <img
          :src="flightSceneUrl"
          class="feice-auth-flight"
          alt="飞翼连接需求评审、用例资产和自动化执行"
          width="720"
          height="440"
        />
      </section>
      <div class="feice-auth-capabilities">
        <span>API</span><i>/</i><span>Web</span><i>/</i><span>APP</span>
      </div>
    </section>
    <main class="feice-auth-workspace">
      <div class="feice-auth-language">简体中文</div>
      <div class="feice-auth-stage">
        <section class="feice-auth-card" aria-labelledby="auth-title">
          <slot />
        </section>
        <nav class="feice-auth-help" aria-label="登录帮助">
          <button type="button" @click="helpVisible = true">管理员帮助</button
          ><span>·</span>
          <a
            href="https://github.com/flytestai/flytest/blob/main/README.md"
            target="_blank"
            rel="noopener noreferrer"
            >使用帮助</a
          ><span>·</span>
          <a
            href="https://github.com/flytestai/flytest/tree/main/docs"
            target="_blank"
            rel="noopener noreferrer"
            >项目文档</a
          >
        </nav>
      </div>
      <footer class="feice-auth-footer">
        <span
          >© {{ new Date().getFullYear() }} FeiCe 飞测 · AI 智能测试平台</span
        >
      </footer>
    </main>
    <a-modal
      v-model:visible="helpVisible"
      title="管理员帮助"
      :footer="false"
      class="fc-dialog"
      width="420px"
    >
      <p class="feice-auth-tip">
        忘记密码、账号待审核或无法访问项目时，请联系本系统的部署管理员。管理员可在用户管理中审核账号、重置密码并分配项目权限。
      </p>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import {
  brandFullLogoUrl,
  brandFullLogoLoginWhiteUrl,
  getPublicAssetUrl,
} from "@/utils/assetUrl";

const helpVisible = ref(false);
const flightSceneUrl = getPublicAssetUrl("feice-flight-scene.svg");
defineProps<{ registration?: boolean }>();
</script>

<style src="./auth-workspace.css"></style>
