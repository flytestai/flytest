# Executions Structure

`executions` 目录承接 APP 自动化执行记录页的页面壳、筛选区、统计卡、表格和执行详情弹窗。

## Entry

- `index.ts`
  统一导出页面需要的组件、composable 和共享类型。
- `useAppAutomationExecutions.ts`
  页面级 orchestration，负责数据加载、轮询、路由同步、执行停止和详情查看。

## Shared Models

- `executionViewModels.ts`
  执行页的 filters、pagination、status meta、artifact、statistics 和组件 props。
- `executionEventModels.ts`
  Header、Filter、Table、Detail 这组组件的共享 emits。

## Components

- `ExecutionsHeaderBar.vue`
  页头和刷新动作。
- `ExecutionsFilterCard.vue`
  执行记录筛选区域。
- `ExecutionsStatsGrid.vue`
  执行统计卡片。
- `ExecutionsTableCard.vue`
  执行列表和分页。
- `ExecutionsDetailDialog.vue`
  执行详情、日志和执行证据。

## Editing Rules

- 页面入口优先从 `./executions` barrel 引组件和 composable。
- 新增执行页视图模型优先落到 `executionViewModels.ts`。
- 新增组件 emits 优先落到 `executionEventModels.ts`。
- `useAppAutomationExecutions.ts` 继续保持 orchestration 角色，不把筛选/轮询/路由逻辑重新塞回页面入口。

## Verification

- 前端构建：`npm run build`
- 后端回归：`pytest -q`
