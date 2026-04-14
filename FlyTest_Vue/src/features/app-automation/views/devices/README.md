# Devices Structure

`devices` 目录承接 APP 自动化设备页的页面壳、设备筛选、统计卡、设备表格和相关弹窗。

## Entry

- `index.ts`
  统一导出页面需要的组件、composable 和共享类型。
- `useAppAutomationDevices.ts`
  页面级 orchestration，负责设备加载、自动刷新、连接/锁定/重连/截图等动作。

## Shared Models

- `deviceViewModels.ts`
  设备页的 filters、连接表单、编辑表单、统计卡和组件 props。
- `deviceEventModels.ts`
  Header、Filter、Table、Connect、Edit 这组组件的共享 emits。

## Components

- `DevicesHeaderBar.vue`
  页头、自动刷新开关和发现设备动作。
- `DevicesFilterCard.vue`
  设备筛选区域。
- `DevicesStatsGrid.vue`
  设备统计卡片。
- `DevicesTableCard.vue`
  设备列表和行内动作。
- `DeviceConnectDialog.vue`
  远程设备连接弹窗。
- `DeviceEditDialog.vue`
  设备编辑弹窗。
- `DeviceDetailDialog.vue`
  设备详情弹窗。
- `DeviceScreenshotDialog.vue`
  设备截图预览弹窗。

## Editing Rules

- 页面入口优先从 `./devices` barrel 引组件和 composable。
- 新增设备页视图模型优先落到 `deviceViewModels.ts`。
- 新增组件 emits 优先落到 `deviceEventModels.ts`。
- `useAppAutomationDevices.ts` 继续保持 orchestration 角色，不把自动刷新和设备动作重新塞回页面入口。

## Verification

- 前端构建：`npm run build`
- 后端回归：`pytest -q`
