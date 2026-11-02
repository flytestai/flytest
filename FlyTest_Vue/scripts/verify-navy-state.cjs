const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const { installNavyFixtures } = require("./verify-navy-workbench.cjs");
const assert = require("node:assert/strict");
const base = process.env.UI_BASE_URL || "http://127.0.0.1:5175";
(async () => {
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.UI_BROWSER_CHANNEL || "msedge",
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    });
    const state = await installNavyFixtures(context);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base + "/test-bugs?suite=11&bug=301");
    await page.getByText("支付回调状态异常", { exact: true }).first().waitFor();
    await page.getByRole("button", { name: "返回", exact: true }).waitFor();
    console.log("PASS high-risk defect opens its detail");
    await page.goto(base + "/api-automation");
    await page
      .locator(".fc-workspace-directory")
      .getByText("创建订单", { exact: true })
      .click();
    const editor = page.locator(".fc-request-workbench");
    await editor
      .locator(".fc-request-target .arco-input-wrapper input")
      .fill("/unsaved");
    await page
      .locator(".fc-workspace-directory")
      .getByText("订单查询", { exact: true })
      .click();
    await page.getByRole("button", { name: "继续编辑", exact: true }).click();
    assert.equal(
      await editor
        .locator(".fc-request-target .arco-input-wrapper input")
        .inputValue(),
      "/unsaved",
    );
    assert.equal(state.saved.length, 0);
    console.log("PASS canceled navigation preserves unsaved request");
    await page
      .locator(".fc-workspace-directory")
      .getByText("订单查询", { exact: true })
      .click();
    await page.getByRole("button", { name: "离开", exact: true }).click();
    await page.waitForFunction(
      () =>
        document.querySelector(".fc-request-target .arco-input-wrapper input")
          ?.value === "/api/orders/1",
    );
    await context.route(
      /\/api\/api-automation\/requests\/22\/execute\//,
      (route) =>
        route.fulfill({ status: 500, json: { message: "执行服务暂不可用" } }),
    );
    await editor.getByRole("button", { name: "执行测试", exact: true }).click();
    await editor.locator(".arco-alert-error").waitFor();
    assert.equal(await editor.locator(".fc-request-result-grid").count(), 0);
    console.log(
      "PASS execution error does not show stale or fabricated result",
    );
    await page.locator(".theme-switch-button").click();
    assert.equal(
      await page.locator("html").getAttribute("data-theme"),
      "black",
    );
    assert.equal(
      await page
        .locator(".sider")
        .evaluate((node) => getComputedStyle(node).backgroundColor),
      "rgb(17, 30, 48)",
    );
    await page
      .getByRole("button", { name: "收起导航", exact: true })
      .first()
      .click();
    await page.locator(".main-layout.layout-collapsed").waitFor();
    console.log("PASS dark theme and collapsed navigation");
    assert.deepEqual(errors, []);
    await context.close();
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
