# FeiCe 工作台布局优化 Implementation Plan

**Goal:** 在 main 分支现有功能基础上，统一专业清爽的浅色工作台，改善导航、信息层级、内容空间和响应式布局。

**Architecture:** 保留 Vue Router、权限判断和业务组件。用单一工作台样式入口替换两层 QDesk 覆盖，通过导航 composable 管理桌面折叠、移动抽屉和键盘焦点。普通页面与全高工作区分别管理滚动，避免编辑器和表格被挤压。

**Tech Stack:** Vue 3、TypeScript、VueUse、Arco Design Vue、Vite。

## 设计选择
- 采用浅色导航、白色工具栏、灰白内容画布及克制的蓝色强调。相比继续叠加旧主题，更容易维护；相比更换组件库，业务影响更小。
- 桌面侧栏 232px，可折叠；平板自动收窄；手机使用可关闭的覆盖导航，包含 Escape 和焦点管理。
- 页面标题、项目选择与账号操作明确分区；运行任务提示独立成行，避免挤占标题。
- 统一列表工具栏、筛选、卡片、表格及弹窗；保留危险操作、禁用态和黑色主题的语义。
- 工作台压缩装饰性区域，突出指标与待办。测试用例/API/UI 等分栏页面在窄屏纵向排列，AI 对话保持输入区可达。

## 实施与验证
1. 修改 `FlyTest_Vue/src/layouts/MainLayout.vue`；新增 `src/composables/useWorkspaceNavigation.ts`，统一导航状态。
2. 新增 `src/workspace-theme.css`，替换 `src/main.ts` 中 QDesk 样式导入；清理主布局自身重复样式，保留业务行为。
3. 对工作台、登录注册、测试管理、需求/知识、API/UI/APP 自动化、系统管理和 AI 页面逐类验证布局。
4. 使用 `npm run build` 验证类型与生产打包；使用本地浏览器与隔离的接口夹具检查桌面/平板/手机、导航交互和横向溢出。
5. 保存截图和验证结论；接口夹具仅用于布局验证，不代表后端联调通过。

## 文档依据
- https://arco.design/vue/component/layout
- https://arco.design/vue/component/grid
- https://vuejs.org/guide/reusability/composables.html
