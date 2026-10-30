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
          <span class="feice-auth-product-label">FeiCe 飞测 · AI 智能测试平台</span>
          <h1 id="feice-story-title">测试更高效，<br /><em>交付更从容。</em></h1>
          <p class="feice-auth-description">连接需求、用例、知识与自动化，<br />让团队在同一个工作台里高效协作。</p>
          <div class="feice-auth-features">
            <div><span class="feice-auth-feature-icon"><icon-file /></span><div><h3>测试资产统一管理</h3><p>需求、用例、缺陷与执行结果，一处协作</p></div></div>
            <div><span class="feice-auth-feature-icon"><icon-thunderbolt /></span><div><h3>AI 辅助生成与分析</h3><p>用例生成与知识检索，让测试准备更高效</p></div></div>
            <div><span class="feice-auth-feature-icon"><icon-apps /></span><div><h3>多端自动化协同</h3><p>覆盖 API、Web 与 APP 测试流程</p></div></div>
          </div>
          <div class="feice-auth-workflow" aria-label="测试流程：需求、用例、执行、报告"><span>需求</span><icon-arrow-right /><span>用例</span><icon-arrow-right /><span>执行</span><icon-arrow-right /><span>报告</span></div>
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
import { IconApps, IconArrowRight, IconFile, IconThunderbolt } from '@arco-design/web-vue/es/icon'
import { brandFullLogoUrl, brandFullLogoLoginWhiteUrl } from '@/utils/assetUrl'
defineProps<{ registration?: boolean }>()
</script>

<style>
.feice-auth {
  position: relative; isolation: isolate; display: flex; flex-direction: column; min-height: 100vh; min-height: 100dvh;
  padding: 24px clamp(24px, 5vw, 80px) 20px; box-sizing: border-box; overflow: hidden;
  color: var(--theme-text); font-family: var(--theme-display-font); color-scheme: light;
  background: radial-gradient(ellipse at 12% 12%, rgba(var(--theme-accent-rgb), .06), transparent 55%), var(--theme-bg);
}
.feice-auth *, .feice-auth *::before, .feice-auth *::after { box-sizing: border-box; }
.feice-auth-atmosphere { position: absolute; inset: 0; z-index: -1; pointer-events: none; background-image: linear-gradient(rgba(var(--theme-accent-rgb), .02) 1px, transparent 1px), linear-gradient(90deg, rgba(var(--theme-accent-rgb), .02) 1px, transparent 1px); background-size: 56px 56px; mask-image: linear-gradient(#0008, transparent 88%); }
.feice-auth-header, .feice-auth-footer { display: flex; align-items: center; justify-content: space-between; gap: 24px; width: 100%; max-width: 1120px; margin-inline: auto; }
.feice-auth-header { min-height: 56px; flex: none; }
.feice-auth-brand { display: block; flex: none; }
.feice-auth-brand img { display: block; width: 210px; height: 45px; }
.feice-auth-brand .feice-auth-logo-dark { display: none; }
.feice-auth-header-note { display: flex; align-items: center; gap: 9px; color: var(--theme-text-tertiary); font-size: 12px; }
.feice-auth-header-note svg { width: 17px; height: 17px; color: var(--theme-accent); }
.feice-auth-stage { display: grid; align-items: center; flex: 1; width: 100%; padding-block: 48px; }
.feice-auth-main { display: grid; grid-template-columns: minmax(0, 1.04fr) minmax(0, 1fr); align-items: stretch; width: 100%; max-width: 1020px; margin: 0 auto; overflow: hidden; border: 1px solid var(--theme-border); border-radius: 12px; background: var(--theme-surface); box-shadow: var(--theme-card-shadow-strong); }
.feice-auth-story { display: flex; flex-direction: column; justify-content: center; min-width: 0; padding: 42px; background: linear-gradient(145deg, var(--theme-accent-soft), var(--theme-surface-soft) 72%); }
.feice-auth-product-label { align-self: flex-start; padding: 5px 9px; border: 1px solid rgba(var(--theme-accent-rgb), .13); border-radius: 5px; color: var(--theme-accent); background: var(--theme-surface); font-size: 10px; font-weight: 500; }
.feice-auth-story h1 { margin: 22px 0 15px; color: var(--theme-text); font-family: inherit; font-size: 32px; font-weight: 650; line-height: 1.55; letter-spacing: -.8px; }
.feice-auth-story h1 em { color: var(--theme-accent); font-style: normal; }
.feice-auth-description { margin: 0; color: var(--theme-text-secondary); font-size: 12px; line-height: 1.9; text-wrap: pretty; }
.feice-auth-features { display: grid; gap: 21px; margin-top: 34px; }
.feice-auth-features > div { display: flex; align-items: flex-start; gap: 12px; min-width: 0; }
.feice-auth-feature-icon { display: grid; place-items: center; flex: none; width: 34px; height: 34px; border: 1px solid rgba(var(--theme-accent-rgb), .12); border-radius: 8px; color: var(--theme-accent); background: var(--theme-surface); font-size: 17px; }
.feice-auth-features h3 { margin: 0 0 4px; color: var(--theme-text); font-size: 12px; font-weight: 600; }
.feice-auth-features p { margin: 0; color: var(--theme-text-tertiary); font-size: 10px; line-height: 1.7; }
.feice-auth-workflow { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 33px; padding-top: 19px; border-top: 1px solid var(--theme-border); color: var(--theme-text-secondary); font-size: 10px; }
.feice-auth-workflow svg { width: 12px; color: var(--theme-text-tertiary); }
.feice-auth-card { align-self: stretch; display: flex; flex-direction: column; justify-content: center; min-width: 0; padding: 42px 44px; border-left: 1px solid var(--theme-border); background: var(--theme-surface); }
.feice-auth-card-kicker { margin: 0 0 13px; color: var(--theme-accent); font-size: 11px; font-weight: 500; }
.feice-auth-card h2 { margin: 0; color: var(--theme-text); font-size: 25px; font-weight: 650; letter-spacing: -.5px; }
.feice-auth-card-description { margin: 8px 0 28px; color: var(--theme-text-tertiary); font-size: 12px; line-height: 1.8; }
.feice-auth-form { display: flex; flex-direction: column; gap: 20px; }
.feice-auth-field { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.feice-auth-field > label { color: var(--theme-text-secondary); font-size: 12px; }
.feice-auth-input-wrap { position: relative; display: flex; align-items: center; }
.feice-auth-input-icon { position: absolute; left: 13px; width: 16px; height: 16px; color: var(--theme-text-tertiary); pointer-events: none; }
.feice-auth-input { display: block; width: 100%; min-width: 0; height: 44px; padding: 0 40px 0 38px; border: 1px solid var(--theme-input-border); border-radius: 7px; outline: none; background: var(--theme-input-bg); color: var(--theme-text); font-family: inherit; font-size: 12px; transition: border-color .15s, box-shadow .15s; }
.feice-auth-input::placeholder { color: var(--theme-text-tertiary); }
.feice-auth-input:hover { border-color: var(--theme-accent-hover); }
.feice-auth-input:focus { border-color: var(--theme-accent); box-shadow: 0 0 0 3px rgba(var(--theme-accent-rgb), .08); }
.feice-auth-input:autofill { -webkit-text-fill-color: var(--theme-text); box-shadow: 0 0 0 1000px var(--theme-input-bg) inset; }
.feice-auth-eye { position: absolute; right: 4px; display: grid; place-items: center; width: 36px; height: 36px; padding: 10px; border: 0; border-radius: 5px; background: transparent; color: var(--theme-text-tertiary); cursor: pointer; }
.feice-auth-eye svg { width: 16px; height: 16px; }
.feice-auth-eye:hover { background: var(--theme-accent-soft); color: var(--theme-accent); }
.feice-auth-options { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-top: -2px; }
.feice-auth-remember { display: inline-flex; align-items: center; gap: 8px; color: var(--theme-text-secondary); font-size: 11px; cursor: pointer; }
.feice-auth-remember input { width: 14px; height: 14px; margin: 0; accent-color: var(--theme-accent); cursor: pointer; }
.feice-auth-options-note { color: var(--theme-text-tertiary); font-size: 10px; }
.feice-auth-submit { display: flex; justify-content: center; align-items: center; gap: 10px; width: 100%; min-height: 44px; margin-top: 3px; padding: 10px 16px; border: 1px solid #3563e9; border-radius: 7px; background: #3563e9; color: #fff; font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer; transition: background-color .15s; }
.feice-auth-submit svg { width: 16px; height: 16px; }
.feice-auth-submit:hover:not(:disabled) { background: #4875f4; border-color: #4875f4; }
.feice-auth-submit:disabled { cursor: wait; opacity: .6; }
.feice-auth :is(a, button, input[type='checkbox']):focus-visible { outline: 2px solid var(--theme-accent); outline-offset: 3px; }
.feice-auth-switch { display: flex; justify-content: center; gap: 7px; margin: 3px 0 0; padding-top: 22px; border-top: 1px solid var(--theme-border); color: var(--theme-text-tertiary); font-size: 11px; }
.feice-auth a { color: var(--theme-accent); text-decoration: none; }
.feice-auth a:hover { color: var(--theme-accent-hover); }
.feice-auth-error { display: flex; align-items: flex-start; gap: 8px; margin: 0; padding: 10px 12px; border: 1px solid rgb(212 73 84 / 20%); border-radius: 7px; background: rgb(212 73 84 / 5%); color: var(--theme-danger); font-size: 12px; line-height: 1.7; }
.feice-auth-error svg { width: 16px; height: 16px; margin-top: 2px; flex: none; }
.feice-auth-tip { margin: 0; color: var(--theme-text-tertiary); font-size: 10px; line-height: 1.7; }
.feice-auth-success { display: grid; gap: 8px; padding: 13px; border: 1px solid rgb(22 131 102 / 20%); border-radius: 7px; background: rgb(22 131 102 / 5%); color: var(--theme-text-secondary); font-size: 12px; }
.feice-auth-success strong { color: var(--theme-success); }
.feice-auth-success p { margin: 0; line-height: 1.8; overflow-wrap: anywhere; }
.feice-auth-success code { color: var(--theme-text); font-weight: 600; }
.feice-auth-footer { flex: none; min-height: 36px; padding-top: 18px; border-top: 1px solid var(--theme-border); color: var(--theme-text-tertiary); font-size: 10px; line-height: 1.8; }
.feice-auth-footer a { margin-left: 8px; color: var(--theme-text-secondary); }
.feice-auth--register .feice-auth-card { padding-block: 32px; }
.feice-auth--register .feice-auth-form { gap: 15px; }
.feice-auth--register .feice-auth-card-description { margin-bottom: 23px; }
:root[data-theme='black'] .feice-auth { color-scheme: dark; }
:root[data-theme='black'] .feice-auth-brand .feice-auth-logo-light { display: none; }
:root[data-theme='black'] .feice-auth-brand .feice-auth-logo-dark { display: block; }
@media (max-width: 1100px) { .feice-auth { padding-inline: 32px; } .feice-auth-story { padding: 34px; } .feice-auth-card { padding-inline: 36px; } .feice-auth-story h1 { font-size: 29px; } }
@media (max-width: 800px) {
  .feice-auth { padding: 20px 24px 18px; }
  .feice-auth-header-note { font-size: 10px; }
  .feice-auth-brand img { width: 188px; height: 40px; }
  .feice-auth-stage { padding-block: 34px; }
  .feice-auth-main { grid-template-columns: minmax(0, 1fr); max-width: 440px; }
  .feice-auth-story { display: none; }
  .feice-auth-card { padding: 34px; border-left: 0; }
  .feice-auth-card h2 { font-size: 24px; }
  .feice-auth-footer { flex-direction: column; justify-content: center; gap: 4px; text-align: center; }
}
@media (max-width: 420px) {
  .feice-auth { padding-inline: 16px; }
  .feice-auth-header-note { max-width: 100px; line-height: 1.7; text-align: right; gap: 5px; }
  .feice-auth-header-note svg { flex: none; width: 14px; }
  .feice-auth-brand img { width: 164px; height: 35px; }
  .feice-auth-card { padding: 30px 24px; }
  .feice-auth-options-note { display: none; }
}
@media (prefers-reduced-motion: reduce) { .feice-auth *, .feice-auth *::before, .feice-auth *::after { animation: none !important; transition: none !important; } }
</style>
