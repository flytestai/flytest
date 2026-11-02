# 工作台布局回归

## 当前深蓝青绿界面

`npm run test:workbench:completion` 验证 Web/APP/测试资产页内导航、系统表单、权限键盘操作、有数据的知识库详情/上传/创建、Trace 详情与滚动隔离、深色知识面板；默认 1440 / 1024 / 390 / 320px，输出到 `playwright-screenshots/completion-interactions/`。

`npm run test:workbench:navigation` 验证四个主模块直接导航、手机导航自动收起、桌面折叠导航、当前标签自动滚动，以及只有单项 APP 权限时的标签可见范围。

`npm run test:workbench` 检查质量工作台、用例详情审核和接口工作区，默认覆盖 1920 / 1440 / 1280 / 1024 / 768 / 390 / 320px。通过 `UI_WIDTHS` 可选择宽度。验证实际请求载荷、审核状态、执行环境切换与 AI 草稿人工确认；截图和报告在 `playwright-screenshots/navy-workbench/`。

`npm run test:workbench:state` 验证高风险缺陷详情跳转、取消离开保留未保存配置、执行错误不显示旧结果、深色主题与折叠导航。两个脚本均使用隔离接口，不写业务数据库。

`test:dashboard` 现覆盖执行趋势、高风险缺陷、我的待办、运行状态、缺陷风险、审核分布、Token 和运营八个区块。历史 A2 脚本文件名继续保留；旧密度脚本的表格起点阈值适用于此前布局，新设计的页面标题与模块标签使用当前工作区检查。

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

- `npm run test:workspace:forms`：使用真实工具目录和 APP 步骤定义，检查 51 个工具、16 类编辑弹窗、27 类步骤配置及编排交互；默认 1440 / 390 / 320px。需 Python，可通过 `PYTHON` 指定可执行文件。`UI_WIDTHS` 选择宽度，`UI_TOOLS` 指定单项工具复查，`UI_SCOPE=builder` 仅复查 27 类 APP 步骤和编排交互。
- `npm run test:asset-details`：有数据的需求详情、专项报告、用例详情和编辑；默认 1440 / 1024 / 390 / 320px。
- `npm run test:request-editor`：真实请求编辑弹窗中的 9 个配置页签及 8 种请求体模式，覆盖四种宽度。

运行前统一设置 `UI_BASE_URL`。完整浏览器检查建议在构建完成后的 `npm run preview -- --port 5176` 上运行，避免边修改源码边采集造成热更新重载。新增脚本不会启动业务数据库或真实设备。

运行 `npm run test:quality` 验证通过率/覆盖率阈值、缺失统计、真实柱图颜色和深色主题。通过率原始值必须等于 100% 才为绿色；覆盖率 ≥80% 为绿色。该逻辑由 `src/utils/qualityStatus.ts` 统一管理，显示取一位小数但不将部分通过四舍五入成 100%。

首页支持可选 `automation_coverage: { rate, covered?, total? }` 数据；现有后端未提供时显示“暂无覆盖率数据”，不使用不同类型资产数量推算覆盖率。专项检查通过浏览器接口夹具验证该字段存在和不存在的场景，不变更业务数据。

导航展开宽度为 216px、折叠为 64px。手机使用临时抽屉，不覆盖桌面偏好。业务目录由 `WorkspaceDirectoryLayout.vue` 统一管理：仅资源页保留目录；环境、执行器、公共数据等页面使用全宽内容；执行记录与报告通过顶部目录筛选。目录在 ≥1440px 默认展开，1024–1439px 默认收起，窄于 1024px 使用抽屉，不再堆叠到正文上方。用户展开/收起偏好按工作区保存。详情与编辑使用完整内容区，目录可临时打开。

`npm run test:workspace:directories` 使用浏览器接口夹具覆盖目录的出现条件、布局边界、节点菜单、键盘操作、筛选保留、Tab 标题切换、深色抽屉、焦点回归、慢速加载、缺陷编辑、个人中心、对话历史及 APP 编排面板；默认 1440 / 1280 / 1024 / 768 / 390 / 320px。使用 `UI_WIDTHS` 可缩小宽度范围，`UI_CHECKS` 可通过检查名称的正则表达式选择场景。结果位于 `playwright-screenshots/contextual-workspaces/`。测试不会修改业务数据库。

## 首页下半部分专项检查

`npm run test:workbench:refined` 检查精修后的单一主标题、手机双列指标与全部模块导航、知识库起步操作、加载状态，以及两种执行趋势视角的红绿柱图。覆盖 1440 / 1024 / 390 / 320px，使用隔离接口，不写入业务数据库。

`npm run test:workbench:scrollbars` 在 1440 / 390px、深浅两种主题下检查工作台、APP、知识库及权限页的透明滚动条，并验证横向、纵向滚轮滚动仍可使用，共 16 个场景。仅改变轨道/滑块绘制，不禁用滚动、不改变滚动容器尺寸。

`npm run test:workspace:density` 检查紧凑工作区在 1440 / 1024 / 390 / 320px 的表格起始位置、控件边界、用例筛选状态和导入导出入口，结果位于 `playwright-screenshots/density/`。设置 `UI_POPULATED=1` 可使用 30 条模拟环境数据检查长列表；`UI_WIDTHS` 可选择宽度。筛选条件位于用例页“筛选”面板，按钮显示已启用数量。

`npm run test:dashboard` 覆盖执行趋势、高风险缺陷、我的待办、自动化运行状态、缺陷风险、审核分布、Token 与运营八个区块。检查 1440/1024/390/320px、有数据/零数据、大数字/长用户名和深色主题，共 10 个场景，并验证日/周/月分组的鼠标与键盘操作。

截图及报告默认保存到 `playwright-screenshots/dashboard-insights/`，每一行及手机端每张卡片都单独截图，避免只检查首页首屏。可使用同样的 `PLAYWRIGHT_MODULE`、`UI_BROWSER_CHANNEL`、`UI_BASE_URL` 和 `UI_OUTPUT_DIR` 配置。

## FeiCe 登录、注册和品牌资源

`npm run test:auth` 检查 1440、1920、1024、768、390、320px 及手机横屏两种页面，共 14 个布局场景；另验证密码可见性、登录错误提示、注册校验/成功状态、账号记忆和已保存的深色主题。接口在浏览器内隔离模拟，不会向业务库注册用户。结果保存到 `playwright-screenshots/auth/`。

品牌几何源为 `scripts/generate-brand-assets.cjs`：生成三片青绿飞翼、自定义轮廓字标和深浅色组合 SVG，不依赖系统字体。`npm run brand:export` 先生成 SVG，再导出兼容 PNG（需配置可用的 Playwright 和浏览器）。`feice-mark.svg` 用于独立图标，`feice-wordmark.svg` 用于导航字标，`feice-logo.svg` / `feice-logo-light.svg` 用于完整组合。旧图片路径保持可用；应用通过 `assetUrl.ts` 使用 SVG 和资源版本号。
