# Notifications Structure

`notifications` 目录承接 APP 自动化通知日志页的页面壳、任务上下文提示、筛选区、统计卡、日志表格和详情弹窗。

## Entry

- `index.ts`
  统一导出页面需要的组件、composable 和共享类型。
- `useAppAutomationNotifications.ts`
  页面级 orchestration，负责通知日志加载、任务上下文、筛选分页、重试和路由跳转。

## Shared Models

- `notificationViewModels.ts`
  通知页的 filters、pagination、parsed content、statistics 和组件 props。
- `notificationEventModels.ts`
  Header、TaskContext、Filter、Table、Detail 这组组件的共享 emits。

## Components

- `NotificationsHeaderBar.vue`
  页头和刷新动作。
- `NotificationsTaskContextAlert.vue`
  当前任务上下文提示。
- `NotificationsFilterCard.vue`
  通知日志筛选区域。
- `NotificationsStatsGrid.vue`
  通知统计卡片。
- `NotificationsTableCard.vue`
  通知日志表格和分页。
- `NotificationDetailDialog.vue`
  单条通知详情、解析内容和重试动作。

## Editing Rules

- 页面入口优先从 `./notifications` barrel 引组件和 composable。
- 新增通知页视图模型优先落到 `notificationViewModels.ts`。
- 新增组件 emits 优先落到 `notificationEventModels.ts`。
- `useAppAutomationNotifications.ts` 继续保持 orchestration 角色，不把筛选/重试/路由逻辑重新塞回页面入口。

## Verification

- 前端构建：`npm run build`
- 后端回归：`pytest -q`
