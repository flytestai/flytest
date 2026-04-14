# Packages Structure

`packages` 目录承接 APP 自动化应用包页的页面壳、筛选区、统计卡、应用包表格和编辑弹窗。

## Entry

- `index.ts`
  统一导出页面需要的组件、composable 和共享类型。
- `useAppAutomationPackages.ts`
  页面级 orchestration，负责应用包加载、筛选分页、创建/编辑和删除。

## Shared Models

- `packageViewModels.ts`
  应用包页的表单、统计、分页和组件 props。
- `packageEventModels.ts`
  Header、Filter、Table、Editor 这组组件的共享 emits。

## Components

- `PackagesHeaderBar.vue`
  页头和新增/刷新动作。
- `PackagesFilterCard.vue`
  应用包筛选区域。
- `PackagesStatsGrid.vue`
  应用包统计卡片。
- `PackagesTableCard.vue`
  应用包列表和分页。
- `PackageEditorDialog.vue`
  新建/编辑应用包弹窗。

## Editing Rules

- 页面入口优先从 `./packages` barrel 引组件和 composable。
- 新增应用包页视图模型优先落到 `packageViewModels.ts`。
- 新增组件 emits 优先落到 `packageEventModels.ts`。
- `useAppAutomationPackages.ts` 继续保持 orchestration 角色，不把筛选/分页/表单逻辑重新塞回页面入口。

## Verification

- 前端构建：`npm run build`
- 后端回归：`pytest -q`
