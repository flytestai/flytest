const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const { installFixtures } = require("./verify-workspace-layout.cjs");
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const output =
  process.env.UI_OUTPUT_DIR ||
  path.resolve(__dirname, "../playwright-screenshots/navy-workbench");
const base = process.env.UI_BASE_URL || "http://127.0.0.1:5175";
async function installNavyFixtures(context) {
  await installFixtures(context);
  const state = { saved: [], executed: [], approved: [], jobs: 0, applied: 0 };
  const user = { id: 1, username: "review-user", real_name: "陈晨" };
  const cases = [248, 249, 250].map((id, index) => ({
    id,
    project: 1,
    module_id: 11,
    module_detail: "支付中心",
    name: [
      "重复支付请求幂等校验",
      "支付成功后订单状态更新",
      "退款金额边界校验",
    ][index],
    precondition: "订单已创建，处于待支付状态",
    level: index ? "P1" : "P0",
    test_type: "functional",
    review_status: index ? "approved" : "pending_review",
    execution_status: index ? "passed" : "not_executed",
    steps: [
      {
        id: 1,
        step_number: 1,
        description: "提交首次支付请求",
        expected_result: "支付请求被正确处理",
      },
      {
        id: 2,
        step_number: 2,
        description: "使用相同订单再次支付",
        expected_result: "只产生一笔有效交易，订单状态保持一致",
      },
    ],
    creator: 1,
    creator_detail: user,
    assignee_detail: user,
    notes: "验证支付状态与交易记录保持一致。",
    created_at: "2026-11-02T08:00:00Z",
    updated_at: "2026-11-02T08:00:00Z",
  }));
  const module = {
    id: 11,
    name: "支付中心",
    project: 1,
    parent: null,
    parent_id: null,
    children: [],
    level: 1,
    testcase_count: 3,
    test_case_count: 3,
  };
  const requests = [21, 22].map((id, index) => ({
    id,
    collection: 11,
    collection_name: "支付中心",
    project_id: 1,
    name: index ? "订单查询" : "创建订单",
    method: index ? "GET" : "POST",
    url: index ? "/api/orders/1" : "/api/orders",
    headers: { "Content-Type": "application/json" },
    params: {},
    body_type: "json",
    body: { product_id: "SKU-1001", quantity: 2 },
    assertions: [],
    timeout_ms: 30000,
    order: index,
    created_by: 1,
    created_at: "2026-11-02T08:00:00Z",
    updated_at: "2026-11-02T08:00:00Z",
  }));
  const bug = {
    id: 301,
    project: 1,
    suite: 11,
    suite_name: "支付中心",
    title: "支付回调状态异常",
    severity: "1",
    priority: "1",
    status: "assigned",
    status_display: "待处理",
    bug_type: "functional",
    assigned_to: 1,
    assigned_to_name: "陈晨",
    assigned_to_detail: user,
    creator_detail: user,
    opened_by: 1,
    steps: "提交支付后重复回调",
    expected_result: "订单状态一致",
    actual_result: "订单状态异常",
    attachments: [],
    activities: [],
  };
  const fulfill = (route, data) =>
    route.fulfill({
      json: {
        success: true,
        status: "success",
        code: 200,
        data,
        results: Array.isArray(data) ? data : [],
        count: Array.isArray(data) ? data.length : 0,
      },
    });
  await context.route(/\/api\/projects\/1\/statistics\/(?:\?.*)?$/, (route) =>
    fulfill(route, {
      project: { id: 1, name: "产品质量中心" },
      testcases: {
        total: 1284,
        by_review_status: {
          approved: 1240,
          pending_review: 12,
          needs_optimization: 24,
          optimization_pending_review: 8,
        },
      },
      executions: {
        total_executions: 64,
        case_results: { total: 200, passed: 184, failed: 16 },
      },
      bugs: {
        total: 28,
        open: 23,
        high_severity: 3,
        pending_retest: 4,
        by_status: { assigned: 10, confirmed: 4 },
      },
      api_automation: { requests: 32, test_cases: 60, executions: 120 },
      ui_automation: {
        total_cases: 48,
        total_executions: 36,
        by_status: { success: 32, failed: 4 },
      },
      execution_trend: {
        daily_7d: Array.from({ length: 7 }, (_, index) => ({
          date: "2026-11-" + String(index + 1).padStart(2, "0"),
          execution_count: 20 + index * 3,
          passed: 15 + index * 3,
          failed: 5,
        })),
        summary_30d: { execution_count: 240, passed: 220, failed: 20 },
      },
      automation_coverage: { rate: 79.9 },
    }),
  );
  await context.route(
    /\/api\/projects\/1\/testcase-modules\/(?:tree\/)?(?:\?.*)?$/,
    (route) => fulfill(route, [module]),
  );
  await context.route(/\/api\/projects\/1\/testcases\/(?:\?.*)?$/, (route) =>
    fulfill(route, cases),
  );
  await context.route(
    /\/api\/projects\/1\/testcases\/\d+\/(?:\?.*)?$/,
    (route) => {
      const item = cases.find(
        (item) =>
          item.id ===
          Number(
            route
              .request()
              .url()
              .match(/testcases\/(\d+)/)[1],
          ),
      );
      if (["PATCH", "PUT"].includes(route.request().method())) {
        const payload = route.request().postDataJSON();
        Object.assign(item, payload);
        state.approved.push(payload);
      }
      return fulfill(route, item);
    },
  );
  await context.route(/\/api\/projects\/1\/test-suites\/(?:\?.*)?$/, (route) =>
    fulfill(route, [module]),
  );
  await context.route(
    /\/api\/projects\/1\/test-suites\/\d+\/(?:\?.*)?$/,
    (route) => fulfill(route, module),
  );
  await context.route(/\/api\/projects\/1\/test-bugs\/(?:\?.*)?$/, (route) =>
    fulfill(route, [bug]),
  );
  await context.route(
    /\/api\/projects\/1\/test-bugs\/301\/(?:\?.*)?$/,
    (route) => fulfill(route, bug),
  );
  await context.route(
    /\/api\/api-automation\/collections\/(?:tree\/)?(?:\?.*)?$/,
    (route) => fulfill(route, [{ ...module, order: 0, request_count: 2 }]),
  );
  await context.route(/\/api\/api-automation\/requests\/(?:\?.*)?$/, (route) =>
    fulfill(route, requests),
  );
  await context.route(
    /\/api\/api-automation\/requests\/\d+\/(?:\?.*)?$/,
    (route) => {
      const item = requests.find(
        (item) =>
          item.id ===
          Number(
            route
              .request()
              .url()
              .match(/requests\/(\d+)/)[1],
          ),
      );
      if (route.request().method() === "PATCH") {
        const payload = route.request().postDataJSON();
        Object.assign(item, payload);
        state.saved.push(payload);
      }
      return fulfill(route, item);
    },
  );
  await context.route(
    /\/api\/api-automation\/requests\/\d+\/execute\/(?:\?.*)?$/,
    (route) => {
      state.executed.push(route.request().postDataJSON());
      return fulfill(route, {
        id: 101,
        project: 1,
        request: 21,
        environment: 1,
        environment_name: "测试环境",
        request_name: "创建订单",
        method: "POST",
        url: requests[0].url,
        status: "success",
        passed: true,
        status_code: 201,
        response_time: 73,
        request_snapshot: {},
        response_snapshot: {
          body: { code: 0, message: "success", order_id: "ORDER-1001" },
        },
        assertions_results: [
          { type: "status_code", expected: 201, actual: 201, passed: true },
        ],
        created_at: "2026-11-02T08:00:00Z",
      });
    },
  );
  await context.route(
    /\/api\/api-automation\/environments\/(?:\?.*)?$/,
    (route) =>
      fulfill(route, [
        {
          id: 1,
          name: "测试环境",
          base_url: "https://example.test",
          timeout_ms: 30000,
          is_default: true,
        },
        {
          id: 2,
          name: "回归环境",
          base_url: "https://regression.example.test",
          timeout_ms: 30000,
          is_default: false,
        },
      ]),
  );
  await context.route(
    /\/api\/ui-automation\/actuators\/list_actuators\/(?:\?.*)?$/,
    (route) =>
      fulfill(route, {
        count: 1,
        items: [
          { id: "web-1", name: "Web 执行器", type: "web_ui", is_open: true },
        ],
      }),
  );
  await context.route(/\/api\/app-automation\/devices\/(?:\?.*)?$/, (route) =>
    fulfill(route, [{ id: 1, name: "Android 测试设备", status: "online" }]),
  );
  await context.route(
    /\/api\/api-automation\/case-generation-jobs\/(?:\?.*)?$/,
    (route) => {
      state.jobs++;
      return fulfill(route, {
        id: 81,
        status: "preview_ready",
        result_payload: { ai_used_count: 1, preview_only: true },
        draft_payload: {
          items: [
            {
              request_id: 21,
              drafts: [
                { assertions: [{ type: "status_code", expected: 201 }] },
              ],
            },
          ],
        },
      });
    },
  );
  await context.route(
    /\/api\/api-automation\/case-generation-jobs\/\d+\/apply\/(?:\?.*)?$/,
    (route) => {
      state.applied++;
      return fulfill(route, {});
    },
  );
  return state;
}
async function bounds(page) {
  const result = await page.evaluate(() => ({
    width: innerWidth,
    doc: document.documentElement.scrollWidth,
    clipped: [
      ...document.querySelectorAll(
        ".content button,.content input,.content textarea,.arco-drawer button,.arco-drawer input",
      ),
    ]
      .filter((node) => {
        const r = node.getBoundingClientRect();
        return (
          r.width &&
          r.height &&
          !node.closest(
            ".arco-table,.arco-tabs-content-item:not(.arco-tabs-content-item-active)",
          ) &&
          (r.left < -1 || r.right > innerWidth + 1)
        );
      })
      .map((node) => node.outerHTML.slice(0, 130)),
  }));
  assert(result.doc <= result.width, "document does not overflow");
  assert.deepEqual(result.clipped, [], "controls fit viewport");
}
async function run() {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.UI_BROWSER_CHANNEL || "msedge",
  });
  const report = [];
  try {
    for (const width of (
      process.env.UI_WIDTHS || "1920,1440,1280,1024,768,390,320"
    )
      .split(",")
      .map(Number)) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        reducedMotion: "reduce",
      });
      const state = await installNavyFixtures(context);
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      async function check(name, fn) {
        errors.length = 0;
        try {
          await fn();
          await bounds(page);
          assert.deepEqual(errors, [], "no script errors");
          report.push({ width, name, passed: true });
          console.log("PASS", width, name);
        } catch (error) {
          report.push({ width, name, passed: false, error: error.message });
          console.error("FAIL", width, name, error.message);
          await page
            .screenshot({
              path: path.join(output, "failure-" + width + "-" + name + ".png"),
            })
            .catch(() => {});
        }
      }
      await check("dashboard", async () => {
        await page.goto(base + "/dashboard");
        await page.getByText("支付回调状态异常", { exact: true }).waitFor();
        await page.getByText("1 个执行器在线", { exact: true }).waitFor();
        assert.equal(
          await page
            .locator(".sider")
            .evaluate((node) => getComputedStyle(node).backgroundColor),
          "rgb(17, 30, 48)",
        );
        await page.getByRole("button", { name: "执行量", exact: true }).click();
        await page.locator(".insights-chart-stack").first().waitFor();
        await page.getByRole("button", { name: "通过率", exact: true }).click();
        await page.locator(".fc-rate-chart").waitFor();
        await page.screenshot({
          path: path.join(output, "dashboard-" + width + ".png"),
        });
      });
      await check("case-review", async () => {
        await page.goto(base + "/testcases");
        await page
          .getByRole("button", { name: /重复支付请求幂等校验/ })
          .click();
        const panel = page.locator(".fc-case-review:visible");
        await panel
          .getByRole("heading", { name: "重复支付请求幂等校验", exact: true })
          .waitFor();
        assert.equal(
          await page.locator(".fc-asset-review:visible").count(),
          width >= 1280 ? 1 : 0,
        );
        assert(
          await page
            .getByRole("columnheader", { name: "审核状态", exact: true })
            .count(),
        );
        assert(
          await page
            .getByRole("columnheader", { name: "最近执行", exact: true })
            .count(),
        );
        await page.mouse.move(20, 20);
        await page.screenshot({
          path: path.join(output, "test-assets-" + width + ".png"),
        });
        await panel
          .getByRole("button", { name: "审核通过", exact: true })
          .click();
        await panel
          .getByRole("button", { name: "已审核通过", exact: true })
          .waitFor();
        assert.equal(state.approved.at(-1).review_status, "approved");
        await panel
          .getByRole("button", { name: "关闭用例详情", exact: true })
          .click();
      });
      await check("request-workbench", async () => {
        await page.goto(base + "/api-automation");
        const toggle = page.getByRole("button", {
          name: "接口目录",
          exact: true,
        });
        await toggle.waitFor();
        if ((await toggle.getAttribute("aria-expanded")) === "false")
          await toggle.click();
        await page
          .locator(".fc-workspace-directory:visible")
          .getByText("创建订单", { exact: true })
          .click();
        const editor = page.locator(".fc-request-workbench:visible");
        await editor
          .locator(".fc-request-target .arco-input-wrapper input")
          .waitFor();
        assert(
          !page.url().includes("tab=test-cases"),
          "request opens the inline workbench",
        );
        await editor
          .locator(".fc-request-target .arco-input-wrapper input")
          .fill("/api/orders/verified");
        await page
          .getByRole("button", { name: "返回接口列表", exact: true })
          .click();
        await page
          .getByRole("button", { name: "继续编辑", exact: true })
          .click();
        assert.equal(
          await editor
            .locator(".fc-request-target .arco-input-wrapper input")
            .inputValue(),
          "/api/orders/verified",
        );
        await editor
          .getByRole("button", { name: "执行测试", exact: true })
          .click();
        await editor.getByText("ORDER-1001", { exact: false }).waitFor();
        assert.equal(state.saved.at(-1).url, "/api/orders/verified");
        assert.equal(state.saved.at(-1).assertion_specs.length, 0, "Saving does not invent assertions");
        assert.equal(state.executed.at(-1).environment_id, 1);
        await page.screenshot({
          path: path.join(output, "api-workbench-" + width + ".png"),
        });
        await editor
          .getByRole("button", { name: "AI 生成断言", exact: true })
          .click();
        const modal = page.locator(".arco-modal:visible");
        await modal.getByText("AI 断言草稿", { exact: true }).waitFor();
        await modal
          .getByRole("button", { name: "添加到当前接口", exact: true })
          .click();
        await editor.getByRole("button", { name: "保存", exact: true }).click();
        await page.getByText("接口配置已保存", { exact: true }).waitFor();
        assert.equal(state.saved.at(-1).assertion_specs.length, 1);
        assert.equal(state.saved.at(-1).assertion_specs[0].expected_number, 201);
        assert.equal(
          state.applied,
          0,
          "assertion preview does not create testcases",
        );
        await editor.locator(".fc-request-context .arco-select-view").click();
        await page
          .locator(".arco-select-option:visible")
          .filter({ hasText: "回归环境" })
          .click();
        await editor
          .getByText("执行接口后，在这里查看真实响应与断言结果", {
            exact: true,
          })
          .waitFor();
      });
      await context.close();
    }
  } finally {
    await browser.close();
    fs.writeFileSync(
      path.join(output, "report.json"),
      JSON.stringify(report, null, 2),
    );
  }
  const failed = report.filter((item) => !item.passed);
  console.log(
    report.length -
      failed.length +
      "/" +
      report.length +
      " navy workbench checks passed",
  );
  if (failed.length) process.exitCode = 1;
}
module.exports = { installNavyFixtures };
if (require.main === module)
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
