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

## AI 对话参考图布局

`npm run test:chat:reference` 覆盖 1440、1024、390、320px，手机视口高度为 844px。检查欢迎页、快捷草稿、中文输入法与 Shift+Enter、历史搜索/切换、新对话、工具审批设置、发送和回复、未配置模型保留草稿；桌面另验证过滤后的批量选择/取消删除及图片预览/移除。使用隔离模型和聊天接口，不调用外部模型或删除真实历史。可配置 `UI_BASE_URL`、`UI_WIDTHS`、`UI_OUTPUT_DIR` 和 `PLAYWRIGHT_MODULE`，默认开发地址为 `http://127.0.0.1:5175`，输出位于 `playwright-screenshots/chat-reference/`。

## 需求管理参考图布局

`npm run test:requirements` 覆盖 1440、1024、390、320px 下的统计卡片、空状态、三组页签、键盘导航、筛选/重置、新建评审配置和列表错误恢复；桌面额外验证状态/类型/上传者组合筛选、内容上传失败保留输入及成功提交，共 13 项。使用隔离接口夹具，不向业务库写入需求文档。支持 `UI_BASE_URL`、`UI_WIDTHS`、`UI_OUTPUT_DIR`、`PLAYWRIGHT_MODULE` 和 `UI_BROWSER_CHANNEL`，默认开发地址为 `http://127.0.0.1:5175`，截图与报告位于 `playwright-screenshots/requirements-reference/`。

## 测试资产参考图布局

`npm run test:assets:reference` 覆盖测试用例、测试套件、缺陷管理、用例模板和执行报告在 1440、1024、390、320px 的 20 个页面场景，并检查用例详情、执行状态筛选请求、套件/模板新建弹窗、模板搜索重置和报告范围选择。另有 100%、接近 100%、无数据三种通过率及统计失败重试，共 24 项。使用浏览器隔离夹具，不写入业务数据库。通过率只有 100% 为绿色，部分通过为红色，无数据为中性占位。

支持 `PLAYWRIGHT_MODULE`、`UI_BROWSER_CHANNEL`、`UI_BASE_URL`、`UI_WIDTHS`，默认地址为 `http://127.0.0.1:5175`；截图和验收报告写入 `playwright-screenshots/asset-reference/`。后端执行状态筛选可运行 `python manage.py test testcases.tests.test_execution_filter`，使用不访问数据库的 SQL 参数检查和非法状态校验。

## 接口自动化参考图布局

`npm run test:api:reference` 验证接口目录、测试用例、环境配置、执行记录和测试报告在 1440、1024、390、320px 下的 20 个页面场景。覆盖请求保存/执行、首屏密度、用例新建/就绪状态、详情抽屉、环境变量显隐与保存时保留原值、完整执行日志、报告趋势和真实摘要来源。另检查 100%、99.9%、无数据三种通过率及报告失败重试，共 24 项。所有写入与执行均使用隔离接口夹具，不修改业务库或调用外部测试接口和模型。

支持 `PLAYWRIGHT_MODULE`、`UI_BROWSER_CHANNEL`、`UI_BASE_URL`、`UI_WIDTHS`、`UI_OUTPUT_DIR`；默认开发地址 `http://127.0.0.1:5175`，截图及报告输出至 `playwright-screenshots/api-reference/`。

## FeiCe 登录、注册和品牌资源

`npm run test:auth` 检查 1440、1920、1024、768、390、320px 及手机横屏两种页面，共 14 个布局场景；另验证密码可见性、登录错误提示、注册校验/成功状态、账号记忆和已保存的深色主题。接口在浏览器内隔离模拟，不会向业务库注册用户。结果保存到 `playwright-screenshots/auth/`。

品牌几何源为 `scripts/generate-brand-assets.cjs`：生成三片青绿飞翼、自定义轮廓字标和深浅色组合 SVG，不依赖系统字体。`npm run brand:export` 先生成 SVG，再导出兼容 PNG（需配置可用的 Playwright 和浏览器）。`feice-mark.svg` 用于独立图标，`feice-wordmark.svg` 用于导航字标，`feice-logo.svg` / `feice-logo-light.svg` 用于完整组合。旧图片路径保持可用；应用通过 `assetUrl.ts` 使用 SVG 和资源版本号。


## Web 自动化参考图回归

`npm run test:web:reference` 使用隔离接口数据，覆盖九个页签在 1672 / 1280 / 390 / 320 像素下的指标、详情打开关闭、页面元素加载、敏感变量隐藏与主动显示、控件边界以及运行时错误。额外覆盖连续切换页签后缩屏的浮层隔离，以及手机端嵌套元素抽屉。通过 `UI_BASE_URL` 指定开发或生产预览地址；输出保存于忽略的 `playwright-screenshots/web-reference`。

Web 统计中明确区分列表总数与当前页数据，执行器展示上报连接与任务接收状态。AI 配置检查和建议来自真实能力接口；保留快速调试、日志、截图、Trace 和原有编辑入口。


## APP 自动化概览参考图

`npm run test:app:overview` 覆盖 1672 / 1280 / 390 / 320 像素布局、7 / 30 天趋势切换、严格通过率颜色、空数据、失败重试。指标、设备环图与待办均使用隔离接口数据。通过 `UI_BASE_URL` 指向生产预览。截图与报告位于忽略的 `playwright-screenshots/app-overview-reference`。

新版统计接口提供近 30 天按 UTC 日期聚合与互斥设备状态。前端兼容仍在运行的旧版接口，必要时通过现有设备与执行列表取数，趋势缓存只在手动刷新或执行摘要变化时更新。缺陷明确为当前项目范围，设备为共享资源。

## APP 设备管理参考图

`npm run test:app:devices` 覆盖 1672 / 1280 / 768 / 390 / 320 像素布局、Android/iOS 平台和序列号筛选、共享设备池统计不受筛选影响、未上报遥测、设备执行能力限制、设备预选与用例执行衔接、批量操作部分失败、编辑保存、添加连接输入校验、接口异常与空态。全部写操作在浏览器隔离模拟，不操作业务设备。截图与报告位于忽略的 `playwright-screenshots/app-devices-reference`。

设备平台、系统版本、型号、真机/模拟器和使用率读取后端 `device_specs` 元数据；旧版 Android 服务可使用 `android_version`。不根据旧版统一的 emulator 连接标签猜测真机类型，不把缺失使用率显示为 0%。当前 ADB 服务支持 Android 网络连接、发现与测试，iOS 元数据统一展示，执行需接入对应驱动。

## APP 应用包参考图

`npm run test:app:packages` 覆盖 1672 / 1280 / 768 / 390 / 320 像素布局，平台、包名、文件格式筛选，安装能力说明、APK 安装结果、下载文件名、批量导出、上传失败后保留表单且不重复创建记录，以及旧服务降级、错误和空态。真实写入全部在浏览器隔离模拟，截图与报告位于 `playwright-screenshots/app-packages-reference`。

文件接口由 APP 服务 `app/package_assets.py` 提供，正常更新并重新加载服务后可用。旧进程未加载时页面显示文件服务未就绪，继续支持原有应用信息维护。版本由上传时填写；安装比例是具有当前归档文件成功安装记录的应用数 / 当前项目应用记录总数，不代表在线设备的安装覆盖率。

## APP 元素管理参考图

`npm run test:app:elements` 覆盖 1672 / 1280 / 768 / 390 / 320 像素，验证页面目录、ResourceId/XPath/Text 筛选、完整项目统计、定位表达式编辑、旧图片资源配置、批量部分失败、JSON 导入重试与同名跳过、实际 JSON 导出、AI 模型缺失及候选人工确认、旧数据未知状态和空态。测试中的写入由浏览器隔离模拟，不操作真实业务资产。输出位于 `playwright-screenshots/app-elements-reference`。

页面归属存入 `config.page_name`，控件类型为 `config.ui_type`，复用标记为 `config.reusable`，维护状态为 `config.maintenance_status`。复用率按已标记元素计算，未知信息保留未标记状态；新增页面在首个元素保存后出现在目录中。导入上限为 5 MB / 2000 项，覆盖旧记录须通过显式编辑完成，跨项目图片仍受服务端资源权限约束。

AI 截图使用 Django `POST /lg/element-recognition/`，上传为 multipart `screenshot`、`project_id`、`page_name`。仅调用用户可用的视觉模型，不绑定工具；输出为像素坐标候选，不猜测 ResourceId 或 XPath，不自动写入元素。采用后仍需编辑确认，启用保存才变为已审核。模型 token 使用记入现有用量体系。模型未配置时提供配置入口及原有设备截图框选方式。

## APP 场景编排参考图

`npm run test:app:scenes` 使用隔离接口验证场景目录、按应用分组、流程分支、节点键盘选中、步骤/属性面板、缩放、保存重开、标签保留及保存失败后的草稿保护，并检查 1672 / 1280 / 768 / 390 / 320 像素布局。通过 `UI_BASE_URL` 指向生产预览；报告位于 `playwright-screenshots/app-scenes-reference`。

场景仍使用现有测试用例 `ui_flow.steps` 保存，不增加虚构发布、引用、版本字段。统计中的通过率按各场景最近一次明确通过/失败结果计算，只有全部通过时为绿色。设置抽屉维护应用包、说明、超时、重试、变量及模型状态；AI 生成和调试继续使用现有服务能力。

## APP 测试用例参考图

`npm run test:app:cases` 验证 1672 / 1280 / 768 / 390 / 320 像素下的分组目录、优先级/执行结果/套件筛选、分页和项目全量指标，编辑失败后保留表单、标签及扩展数据保留、JSON 下载、导入预览与同名跳过、当前项目绑定、执行设备选择、错误重试、空态及 AI 场景生成入口。测试写入全部由隔离接口承接，不操作真实用例或设备。

分组和优先级存于原有 `ui_flow.feice_meta.group` / `priority`，场景编排保存时保留这些扩展信息。旧数据显示“未分组/未设置”。当前后端无禁用和更新人字段，因此使用“空流程/更新时间”；可执行表示具有流程步骤，实际执行仍需可用设备。套件来自真实 `suite_cases` 关联。分组在首条用例保存后出现。AI 入口打开已有场景生成对话框，生成后可继续编辑并保存为用例。

JSON 导入限 5 MB / 500 条，保留步骤、变量、标签和扩展字段，不接受文件中的项目归属；应用包仅匹配当前项目中的有效编号。`py -3.11 -m unittest tests.test_case_workspace` 在 APP 服务的临时数据库中验证分组、优先级、扩展键和标签的持久化。

## APP 测试套件参考图

`npm run test:app:suites` 覆盖 1672 / 1280 / 768 / 390 / 320 像素，验证业务分组、应用/结果筛选、项目全量统计、保存失败保留编辑、分组和策略保存、多设备执行参数、失败时保留设备选择、AI 建议采用后再保存，以及旧服务降级和空态。页面复用用例工作区样式，详情、历史、报告与执行证据沿用原入口。

APP 服务新增 `app/suite_workspace.py`：`GET /test-suites/capabilities/` 声明元数据与并行能力；元数据按项目/套件保存在 `data/uploads/suite-metadata` 下，备份数据时需包含该目录。套件原有创建/更新接口接受 `group` 和 `execution_strategy`，旧客户端省略这两个字段时保留原值。`POST /test-suites/{id}/run-parallel/` 接受 2–8 个不同 Android 设备编号，按用例顺序轮流分配队列，每台设备顺序运行，设备之间并行；事务内预留全部设备，任一设备不可用会回滚。手动顺序执行接口保持兼容。

Django 新增 `POST /lg/suite-planning/`，需要套件查看权限与项目访问权限。输入为需求描述及不超过 200 条候选用例的编号、名称、说明、标签；直接调用当前激活模型，不绑定工具、不创建套件。返回结果限制在候选编号范围内，用户采用并保存后才写入。服务未更新或模型未配置时显示能力提示，不填充假建议。

统计说明：可执行套件指所含用例均已配置步骤；通过率按服务返回的已完成套件结果计算，仅全通过为绿色；近 7 天执行为套件内用例执行记录数。后端启用新增能力需重新加载 APP 和 Django 服务；前端兼容仍在运行的旧进程。

后端隔离验证：APP 服务下运行 `py -3.11 -m unittest tests.test_suite_workspace`；Django 下运行 `.venv/Scripts/python.exe manage.py test langgraph_integration.test_suite_planning --noinput`。测试使用临时数据库、模拟执行器或模拟模型，不触碰真实设备。

## APP 执行记录参考图

`npm run test:app:executions` 使用隔离接口验证执行统计互斥、任务/套件/设备/来源/应用/日期筛选、全量指标不随筛选变化、详情保留筛选上下文、日志直达、实际 HTML 报告打开、停止执行确认、关联接口失败降级、重试与空态，以及 1672 / 1280 / 768 / 390 / 320 像素下的列表和弹窗。`npm run test:app:execution-data` 验证状态优先级、七天 UTC 窗口、日期终点、缺失数据、精确任务关联、历史版本和零秒耗时。

每行对应真实的单条用例执行 ID，套件内用例保留套件关联，不根据时间拼接虚构的套件批次。统计为当前项目全部记录，筛选数量独立显示。运行和等待优先，停止不算异常；仅 error/exception 明确状态计为异常，failed 仍为失败，不靠错误文案猜测。趋势使用开始时间（未开始时为创建时间）按 UTC 日分组，分母为明确通过、失败、异常结果，无数据日期不补零，不跨空白日期连线。

任务关联读取明确 task_id 或定时任务最近结果中的 execution_id(s)，缺少历史关联时不猜测。应用版本仅显示执行 package_snapshot/app_version，当前用例应用只用于明确标注的当前关联，缺少历史版本显示未记录。日期筛选按本地自然日包含结束日，下一日零点为排除边界；清空范围恢复全部数据。列表轮询沿用原服务接口，并防止旧项目/旧详情请求覆盖当前选择。本页无需新增后端接口。


## APP 定时任务（2026-11-04）

- npm run test:app:scheduled：隔离项目任务、设备和 AI 数据，验证五种屏幕尺寸、筛选与完整项目统计、启停失败回退、复制暂停草稿、保存失败、AI 采用、详情和删除确认。
- UI_BASE_URL 可切换 5175 开发 / 5176 正式预览，UI_WIDTHS 可缩小回归尺寸；截图与报告位于 playwright-screenshots/app-scheduled-reference/。
- Cron 为 UTC 五段格式；触发结果不代表测试通过。AI 接口 /lg/task-planning/ 需 Django 加载新版代码及有效模型，服务不可用时提供明确提示，不创建模拟计划。
- Django：manage.py test langgraph_integration.test_task_planning，校验权限、输入长度、Cron/间隔边界及只读建议。


## APP 通知日志（2026-11-04）

- npm run test:app:notifications：验证五种屏幕宽度、渠道/事件/结果/日期筛选、项目概览、模拟投递、筛选/所选 CSV 导出、失败追踪、详情、任务关联及加载异常。
- npm run test:app:notification-data：验证明确平台字段识别、事件与投递独立、旧 UTC 时间、本地日界限、模拟统计排除、结构化内容和 CSV 转义。
- UI_BASE_URL 可切换开发或正式预览，UI_WIDTHS 可限制回归宽度；输出位于 playwright-screenshots/app-notifications-reference/。
- 页面复用现有日志接口，不新增实际发送能力。当前本地 APP 服务将部分通知标记为 delivery_status=simulated；真实重发不支持时保留原状态并提示，避免将记录请求当作送达。


## APP 执行报告（2026-11-04）

- npm run test:app:reports：五种宽度下验证真实报告/执行次数、通过率颜色、结果/来源/日期筛选、右侧摘要/移动抽屉、完整 HTML 报告、CSV 导出、套件概览和加载异常。
- npm run test:app:report-data：验证状态优先级、步骤分母、历史版本、终态耗时、趋势统计、本地日界限和 CSV 转义。
- 每条 EX 编号对应一次用例执行，运行中或等待执行不会被合并成虚构的套件报告；概览分布按执行次数、步骤通过率按通过步骤/总步骤分别统计。
- UI_BASE_URL 可切换开发或正式预览，UI_WIDTHS 限制回归尺寸；输出位于 playwright-screenshots/app-reports-reference/。


## APP 环境设置（2026-11-04）

- npm run test:app:settings：验证五种宽度、环境筛选和完整项目统计、克隆维护草稿、失败保存、编辑后健康失效、检测、批量维护、选择导出、导入预览及旧服务降级。
- npm run test:app:environment-data：配置导入字段/体积验证、健康未知状态、导入不沿用健康结果及导出配置字段。
- APP 后端：service_logs/app-venv/Scripts/python.exe -m unittest tests.test_environment_workspace（从 APP 服务目录运行时使用 ../service_logs 路径），验证临时文件注册表与隔离数据库，不连接真实设备或网络。
- 新增 /settings/environments/ 项目级接口，注册表保存在 uploads/environment-profiles/，无需数据库迁移；运行中的服务需加载新版模块后使用。旧服务可继续查看/编辑全局执行器并诊断。
- 连通检测只验证 ADB 设备或目标 TCP 端口，不代表业务接口已鉴权成功；维护配置不停止真实服务。执行仍以任务设备及全局配置为准。
