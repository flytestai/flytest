const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const { installFixtures } = require("./verify-workspace-layout.cjs");
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const base = process.env.UI_BASE_URL || "http://127.0.0.1:5175",
  output =
    process.env.UI_OUTPUT_DIR ||
    path.resolve(
      __dirname,
      "../playwright-screenshots/completion-interactions",
    );
const knowledge = {
  id: "kb-1",
  name: "支付与回归测试知识库",
  description: "支付、退款与重复回调的测试经验和验证规范。",
  project: 1,
  project_name: "产品质量中心",
  creator: 1,
  creator_name: "测试管理员",
  is_active: true,
  chunk_size: 1000,
  chunk_overlap: 200,
  document_count: 1,
  chunk_count: 12,
  created_at: "2026-11-02T08:00:00Z",
  updated_at: "2026-11-02T08:00:00Z",
};
async function fixtures(context) {
  await installFixtures(context);
  const fulfill = (route, data) =>
    route.fulfill({
      json: { success: true, status: "success", code: 200, data },
    });
  await context.route(
    /\/api\/ui-automation\/execution-records\/91\/(?:\?.*)?$/,
    (r) =>
      fulfill(r, {
        id: 91,
        status: 2,
        test_case_name: "支付页面回归轨迹",
        trace_path: "isolated-fixture",
      }),
  );
  await context.route(
    /\/api\/ui-automation\/execution-records\/91\/trace\/(?:\?.*)?$/,
    (r) =>
      fulfill(r, {
        title: "支付回归",
        start_time: 0,
        end_time: 1000,
        duration: 1000,
        page_url: "https://example.test",
        actions: [
          {
            action_id: "a1",
            type: "goto",
            url: "https://example.test",
            start_time: 0,
            end_time: 100,
            duration: 100,
            page_id: "page-1",
          },
        ],
        network_requests: [],
        console_messages: [],
        snapshots: [],
        summary: {
          total_actions: 1,
          total_requests: 0,
          total_console: 0,
          total_snapshots: 0,
          duration_ms: 1000,
          network: { total: 0, by_type: {}, by_status: {}, total_size: 0 },
          metadata: {},
        },
      }),
  );
  await context.route(/\/api\/knowledge\/knowledge-bases\/(?:\?.*)?$/, (r) =>
    fulfill(r, [knowledge]),
  );
  await context.route(/\/api\/knowledge\/documents\/(?:\?.*)?$/, (r) =>
    fulfill(r, [
      {
        id: "doc-1",
        knowledge_base: "kb-1",
        title: "支付结果一致性与重复回调验证规范",
        document_type: "md",
        status: "completed",
        chunk_count: 12,
        uploader: 1,
        uploader_name: "测试管理员",
        uploaded_at: "2026-11-02T08:00:00Z",
      },
    ]),
  );
  await context.route(/\/api\/knowledge\/global-config\//, (r) =>
    fulfill(r, {
      embedding_service: "ollama",
      model_name: "test-embedding",
      chunk_size: 1000,
      chunk_overlap: 200,
      reranker_service: "none",
    }),
  );
  await context.route(/\/api\/accounts\/users\/(?:\?.*)?$/, (r) =>
    fulfill(r, [
      {
        id: 7,
        username: "quality-owner",
        real_name: "测试负责人",
        email: "owner@example.test",
        is_active: true,
        approval_status: "approved",
        groups: [],
      },
    ]),
  );
}
async function bounds(page) {
  const clipped = await page.evaluate(() =>
    [
      ...document.querySelectorAll(
        ".content button,.content input,.content textarea,.arco-modal button,.arco-modal input",
      ),
    ]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return (
          r.width > 0 &&
          r.height > 0 &&
          !el.closest(
            ".arco-table,.fc-module-tabs,.arco-tabs-content-item:not(.arco-tabs-content-item-active)",
          ) &&
          (r.left < -2 || r.right > innerWidth + 2)
        );
      })
      .map((el) => el.outerHTML.slice(0, 140)),
  );
  assert.deepEqual(clipped, [], "controls remain inside viewport");
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "document remains inside viewport",
  );
}
async function run() {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.UI_BROWSER_CHANNEL || "msedge",
  });
  const report = [];
  try {
    for (const width of (process.env.UI_WIDTHS || "1440,1024,390,320")
      .split(",")
      .map(Number)) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        reducedMotion: "reduce",
      });
      await fixtures(context);
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      let errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      async function check(name, fn) {
        if (process.env.UI_CHECKS && !new RegExp(process.env.UI_CHECKS).test(name)) return;
        errors = [];
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
      await check("web-navigation", async () => {
        await page.goto(base + "/ui-automation");
        const nav = page.getByRole("navigation", {
          name: "Web 自动化模块导航",
        });
        await nav.getByRole("link").first().waitFor();
        assert.equal(await nav.getByRole("link").count(), 9);
        await nav.getByRole("link", { name: "执行器", exact: true }).click();
        await page.waitForURL("**/ui-automation?tab=actuators");
        assert.equal(
          await nav
            .getByRole("link", { name: "执行器", exact: true })
            .getAttribute("aria-current"),
          "page",
        );
        await page.screenshot({
          path: path.join(output, "web-" + width + ".png"),
        });
      });
      await check("app-navigation-density", async () => {
        await page.goto(base + "/app-automation");
        const nav = page.getByRole("navigation", {
          name: "APP 自动化模块导航",
        });
        await nav.getByRole("link").first().waitFor();
        assert.equal(await nav.getByRole("link").count(), 12);
        await page.locator(".app-automation-shell .stat-card").last().waitFor();
        const aiColors = await page.locator('.app-automation-shell .fc-ai-action:not(.arco-btn-disabled)').evaluateAll(nodes => [...new Set(nodes.map(node => getComputedStyle(node).color))]);
        assert.deepEqual(aiColors,['rgb(124, 92, 226)'],'AI actions, including primary buttons, use the purple semantic color');
        const aiBackgrounds = await page.locator('.app-automation-shell .fc-ai-action:not(.arco-btn-disabled)').evaluateAll(nodes => nodes.map(node => ({text:node.textContent.trim(), background:getComputedStyle(node).backgroundColor, image:getComputedStyle(node).backgroundImage})));
        assert(aiBackgrounds.every(button => button.background === 'rgb(241, 237, 252)' && button.image === 'none'), JSON.stringify(aiBackgrounds));
        if (width >= 1440) {
          const y = await page
            .locator(".app-automation-shell .stat-card")
            .evaluateAll((nodes) =>
              nodes.map((n) => Math.round(n.getBoundingClientRect().top)),
            );
          assert.equal(new Set(y).size, 1, "six metrics use one desktop row");
        }
        await page.screenshot({
          path: path.join(output, "app-" + width + ".png"),
        });
        await nav.getByRole("link", { name: "环境设置", exact: true }).click();
        await page
          .locator('.content').getByRole("heading", { name: "环境设置", exact: true })
          .waitFor();
        await page.screenshot({
          path: path.join(output, "app-settings-" + width + ".png"),
        });
      });
      await check("asset-navigation", async () => {
        await page.goto(base + "/test-bugs");
        const nav = page.getByRole("navigation", { name: "测试资产模块导航" });
        await nav.getByRole("link").first().waitFor();
        assert.equal(await nav.getByRole("link").count(), 5);
        await nav.getByRole("link", { name: "用例模板", exact: true }).click();
        await page.waitForURL("**/testcase-templates");
        assert.equal(
          await nav
            .getByRole("link", { name: "用例模板", exact: true })
            .getAttribute("aria-current"),
          "page",
        );
      });
      await check("admin-dialogs", async () => {
        for (const [url, title, action] of [
          ["/users", "用户管理", "添加用户"],
          ["/organizations", "组织管理", "添加组织"],
          ["/api-keys", "API 凭据", "创建Key"],
        ]) {
          await page.goto(base + url);
          await page
            .locator(".content")
            .getByRole("heading", { name: title, exact: true })
            .waitFor();
          await page
            .locator(".content")
            .getByRole("button", { name: action, exact: true })
            .click();
          const modal = page.locator(".arco-modal:visible");
          await modal.waitFor();
          await bounds(page);
          await page.screenshot({
            path: path.join(output, url.slice(1) + "-" + width + ".png"),
          });
          await modal.locator(".arco-modal-close-btn").click();
        }
      });
      await check("permissions-keyboard", async () => {
        await page.goto(base + "/permissions");
        const entity = page
          .locator(".entity-item")
          .filter({ hasText: "测试负责人" });
        await entity.waitFor();
        await entity.focus();
        await page.keyboard.press("Enter");
        assert.equal(await entity.getAttribute("aria-pressed"), "true");
        await page.locator(".permission-details").waitFor();
        await page.screenshot({
          path: path.join(output, "permissions-" + width + ".png"),
        });
      });
      await check("knowledge-detail-upload", async () => {
        await page.goto(base + "/knowledge-management");
        const filters = page.locator(".knowledge-base-list .list-header");
        await page
          .getByRole("button", { name: knowledge.name, exact: true })
          .waitFor();
        if (width >= 1024)
          assert(
            (await filters.boundingBox()).height < 70,
            "filters use a single compact row",
          );
        await page
          .getByRole("button", { name: knowledge.name, exact: true })
          .click();
        await page
          .getByRole("heading", { name: knowledge.name, exact: true })
          .waitFor();
        await page
          .getByText("支付结果一致性与重复回调验证规范", { exact: true })
          .waitFor();
        await page.screenshot({
          path: path.join(output, "knowledge-detail-" + width + ".png"),
        });
        await page
          .getByRole("button", { name: "上传文档", exact: true })
          .click();
        await page.locator(".arco-modal:visible").waitFor();
        await bounds(page);
        await page.locator(".arco-modal:visible .arco-modal-close-btn").click();
        await page
          .getByRole("button", { name: "返回知识库列表", exact: true })
          .click();
        await page
          .getByRole("button", { name: "新建知识库", exact: true })
          .click();
        await page.locator(".arco-modal:visible").waitFor();
        await bounds(page);
        await page.locator(".arco-modal:visible .arco-modal-close-btn").click();
      });
      await check("trace-and-scroll-isolation", async () => {
        await page.goto(base + "/ui-automation?tab=execution-records");
        await page.goto(base + "/ui-automation/trace/91");
        const action = page.locator(".trace-viewer .action-item").first();
        await action.waitFor();
        await action.focus();
        await page.keyboard.press("Enter");
        assert.equal(await action.getAttribute("aria-pressed"), "true");
        await bounds(page);
        await page.screenshot({
          path: path.join(output, "trace-" + width + ".png"),
        });
        await page
          .getByRole("button", { name: "返回上一页", exact: true })
          .click();
        await page.waitForURL("**/ui-automation?tab=execution-records");
        await page.goto(base + "/projects");
        await page.locator(".content").waitFor();
        assert.equal(
          await page
            .locator(".content")
            .evaluate((n) => getComputedStyle(n).overflow),
          "auto",
          "Trace styles do not disable scrolling on another route",
        );
      });
      await check("dark-surfaces", async () => {
        await page.goto(base + "/knowledge-management");
        await page.locator(".theme-switch-button").click();
        await page.waitForFunction(
          () => document.documentElement.dataset.theme === "black",
        );
        assert.notEqual(
          await page
            .locator(".knowledge-base-list")
            .evaluate((n) => getComputedStyle(n).backgroundColor),
          "rgb(255, 255, 255)",
        );
        await page
          .getByRole("button", { name: knowledge.name, exact: true })
          .click();
        assert.notEqual(
          await page
            .locator(".info-section")
            .first()
            .evaluate((n) => getComputedStyle(n).backgroundColor),
          "rgb(255, 255, 255)",
        );
        await page.screenshot({
          path: path.join(output, "knowledge-dark-" + width + ".png"),
        });
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
  const failed = report.filter((r) => !r.passed);
  console.log(
    `${report.length - failed.length}/${report.length} completion checks passed`,
  );
  if (failed.length) process.exitCode = 1;
}
run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
