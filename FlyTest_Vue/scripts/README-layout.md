# 工作台布局回归

脚本使用 Playwright 和独立浏览器上下文，通过拦截本地 `/api/` 请求提供布局夹具。它们不登录真实账号，也不向业务服务写入数据。

需要可用的 Playwright 包和浏览器。若运行环境已提供 Playwright，可通过 `PLAYWRIGHT_MODULE` 指定包的绝对路径，无须修改生产依赖。`UI_BROWSER_CHANNEL=msedge` 可使用已安装的 Edge；省略时使用 Playwright Chromium。

先启动前端（默认检查地址为 `http://127.0.0.1:5174`）：

```powershell
npm run dev -- --port 5174
```

在另一个终端运行：

```powershell
$env:UI_BROWSER_CHANNEL = "msedge"
npm run test:layout
$env:UI_WIDTH = "390"
npm run test:layout
Remove-Item Env:UI_WIDTH
npm run test:layout:interactions
```

可选环境变量：

| 变量 | 用途 |
| --- | --- |
| `UI_BASE_URL` | 指定开发或生产预览服务地址 |
| `UI_WIDTH` | 截图视口宽度，默认 1440 |
| `UI_ROUTES` | 用逗号分隔要检查的路由（可包含 query） |
| `UI_PUBLIC=1` | 不注入登录状态，用于 `/login,/register` |
| `UI_OUTPUT_DIR` | 指定报告和截图输出目录 |
| `PLAYWRIGHT_MODULE` | 环境提供的 Playwright 包路径 |

默认检查 46 个主要页面/自动化页签入口，输出页面错误、可见内容溢出、应用尺寸和截图。表格内部横向滚动及 Arco 隐藏页签不算页面溢出。交互脚本检查折叠记忆、响应式导航、焦点恢复、目录拖拽与键盘调整、主题切换、账户菜单，以及手机登录表单、密码可见性和注册导航。

结果默认保存到 `FlyTest_Vue/playwright-screenshots/layout/`，受仓库现有忽略规则管理。夹具主要覆盖布局与空数据状态，不能替代真实后端、权限组合、AI 执行及复杂编辑流程的业务验收。

## A2 明亮工作台

全局 token 和基础控件在 `src/styles/a2-workspace.css`，布局基础在 `src/workspace-theme.css`。登录注册共用 `components/auth/auth-shell.css`。卡片 16px、控件 8px、登录表面 20px，主要操作蓝 `#0066FF`、通过绿 `#008000`、风险红 `#E00000`。

业务页面和 Teleport 弹层的显式样式契约位于 `src/styles/a2-components.css`，页头使用 `WorkspacePageHeader.vue`。表单通过容器查询根据实际可用宽度换列，不能只按显示器分辨率判断。

补齐检查：

- `npm run test:workspace:forms`：使用真实工具目录和 APP 步骤定义，检查 51 个工具、16 类编辑弹窗、27 类步骤配置及编排交互；默认 1440 / 390 / 320px。需 Python，可通过 `PYTHON` 指定可执行文件。`UI_WIDTHS` 选择宽度，`UI_TOOLS` 指定单项工具复查。
- `npm run test:asset-details`：有数据的需求详情、专项报告、用例详情和编辑；默认 1440 / 1024 / 390 / 320px。
- `npm run test:request-editor`：真实请求编辑弹窗中的 9 个配置页签及 8 种请求体模式，覆盖四种宽度。

运行前统一设置 `UI_BASE_URL`。完整浏览器检查建议在构建完成后的 `npm run preview -- --port 5176` 上运行，避免边修改源码边采集造成热更新重载。新增脚本不会启动业务数据库或真实设备。

运行 `npm run test:quality` 验证通过率/覆盖率阈值、缺失统计、真实柱图颜色和深色主题。通过率原始值必须等于 100% 才为绿色；覆盖率 ≥80% 为绿色。该逻辑由 `src/utils/qualityStatus.ts` 统一管理，显示取一位小数但不将部分通过四舍五入成 100%。

首页支持可选 `automation_coverage: { rate, covered?, total? }` 数据；现有后端未提供时显示“暂无覆盖率数据”，不使用不同类型资产数量推算覆盖率。专项检查通过浏览器接口夹具验证该字段存在和不存在的场景，不变更业务数据。

导航展开宽度为 216px、折叠为 64px。手机使用临时抽屉，不覆盖桌面偏好。自动化目录与内容区在桌面共用完整工作面，小屏分区堆叠，表格横向滚动限制在自身范围。

## 首页下半部分专项检查

`npm run test:dashboard` 覆盖待处理事项、缺陷风险、自动化矩阵、审核分布、Token、趋势与运营七个区块。检查 1440/1024/390/320px、有数据/零数据、大数字/长用户名和深色主题，共 10 个场景，并验证日/周/月分组的鼠标与键盘操作。

截图及报告默认保存到 `playwright-screenshots/dashboard-insights/`，每一行及手机端每张卡片都单独截图，避免只检查首页首屏。可使用同样的 `PLAYWRIGHT_MODULE`、`UI_BROWSER_CHANNEL`、`UI_BASE_URL` 和 `UI_OUTPUT_DIR` 配置。

## FeiCe 登录、注册和品牌资源

`npm run test:auth` 检查 1440、1920、1024、768、390、320px 及手机横屏两种页面，共 14 个布局场景；另验证密码可见性、登录错误提示、注册校验/成功状态、账号记忆和已保存的深色主题。接口在浏览器内隔离模拟，不会向业务库注册用户。结果保存到 `playwright-screenshots/auth/`。

品牌源文件为 `public/feice-mark.svg`、`feice-logo.svg`、`feice-logo-light.svg`。`npm run brand:export` 用同一组矢量文件导出兼容 PNG（需配置可用的 Playwright 和浏览器）。保留旧图片路径以兼容外部引用，实际内容均为 FeiCe 标识；应用通过 `assetUrl.ts` 使用 SVG 和资源版本号。
