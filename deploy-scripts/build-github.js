#!/usr/bin/env node

// GitHub Pages 构建脚本
// 设置环境变量后执行标准构建

process.env.DEPLOY_TYPE = 'github';

const { execSync } = require('child_process');

console.log('🏗️  开始构建 GitHub Pages...');
console.log('📁 base路径: /FlyTest/');

try {
  // 执行VitePress构建
  // 使用 npx 确保使用本地安装的 vitepress
  execSync('npx vitepress build docs', { stdio: 'inherit' });
  console.log('✅ GitHub Pages 构建完成！');
  console.log('📂 构建输出目录: docs/.vitepress/dist');
} catch (error) {
  console.error('❌ 构建失败:', error.message);
  process.exit(1);
}