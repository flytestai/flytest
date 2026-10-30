# FeiCe A2 Frontend Implementation Plan

**Goal:** 将全部现有前端路由、业务工作区与公共控件迁移到用户确认的 A2 明亮方案。

**Architecture:** 保留 Vue/Arco 和现有业务数据流，在公共 token、控件及工作区层统一视觉语言；登录和首页采用已确认的实际页面结构。业务颜色使用单一工具函数，禁止按指标类别赋色或四舍五入后判断状态。

**Tech Stack:** Vue 3、TypeScript、Arco Design Vue、Pinia、Vite、Playwright。

## Todo

- [x] 阅读路由、主题、公共布局和现有验证脚本。
- [x] 统一 `src/workspace-theme.css` 与 `src/styles/a2-workspace.css`，覆盖表单、表格、页签、树、弹层、编辑器和业务卡片。
- [x] 新建 `src/utils/qualityStatus.ts` 并将首页、API/Web/APP 的通过率接入严格阈值。
- [x] 调整 `src/components/auth/AuthShell.vue`，保留登录注册表单、校验和接口。
- [x] 重构 `src/views/DashboardView.vue` 与 `src/components/dashboard/DashboardInsights.vue`，落实紧凑指标、趋势、待办、风险和矩阵。
- [x] 检查所有 46 个主要业务入口、动态详情页面及登录注册，修复窄屏溢出与控件层级。
- [x] 运行类型检查与生产构建、全入口多尺寸布局检查及关键交互回归，保存截图与结果。

## Design contract

- 品牌/操作蓝 `#0066FF`，通过绿 `#008000`，风险红 `#E00000`。
- 画布 `#F0F5FD`，白色表面；模块圆角 16px，控件 8px，登录表面 20px。
- 执行通过率仅原始值 100% 为绿；其余有效值为红。缺少统计显示“—”，不伪造为 0%。
- 待处理缺陷为红。自动化覆盖率低于 80% 为红，≥80% 为绿。
- 当前项目统计接口没有覆盖率字段：前端接受可选覆盖率数据，未提供时明确显示“暂无覆盖率数据”；不将独立资产数量相加伪造成覆盖率。
- 趋势图绿/红并排，使用共同的真实数量刻度。
- 手机端导航为抽屉；业务表格在自身范围滚动；复杂编辑器保持操作可达。
- 保留深色主题、权限控制、业务接口、真实表单反馈与原有工作流。

## Verification

在 `FlyTest_Vue` 启动 `npm run dev -- --host 127.0.0.1 --port 5175 --strictPort`。
运行 `npm run build`；为现有脚本设置 `UI_BASE_URL=http://127.0.0.1:5175`、可用的 `PLAYWRIGHT_MODULE` 和 `UI_BROWSER_CHANNEL=msedge`。
布局检查覆盖 1440、1024、390px，核心页面补充 1920、1366、820、320px。弹层与通过率边界使用隔离接口夹具检查，不写入业务库。

本轮不进行 git 提交或推送。
