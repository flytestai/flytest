const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const { installFixtures } = require("./verify-workspace-layout.cjs");
const assert = require("node:assert/strict");
const base = process.env.UI_BASE_URL || "http://127.0.0.1:5175";
async function run() {
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.UI_BROWSER_CHANNEL || "msedge",
  });
  try {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        reducedMotion: "reduce",
      });
      await installFixtures(context);
      const page = await context.newPage();
      let errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(base + "/dashboard");
      await page.locator(".content .dashboard-view").waitFor();
      for (const [label, url] of [
        ["测试资产", "/testcases"],
        ["接口自动化", "/api-automation"],
        ["Web 自动化", "/ui-automation"],
        ["APP 自动化", "/app-automation"],
      ]) {
        if (width < 768)
          await page
            .getByRole("button", { name: "打开导航", exact: true })
            .click();
        const item = page
          .locator(".sider .arco-menu-item")
          .filter({ has: page.locator(`.menu-link[title="${label}"]`) });
        assert.equal(await item.count(), 1);
        await item.click();
        await page.waitForURL((u) => u.pathname === url);
        await page.waitForFunction(
          () => !document.querySelector(".main-layout.mobile-nav-open"),
        );
        assert((await item.getAttribute("class")).includes("selected"));
        assert.equal(
          await page
            .locator(
              `.sider .arco-menu-inline-header .menu-title-text[title="${label}"]`,
            )
            .count(),
          0,
        );
        console.log("PASS", width, label, "direct module entry");
      }
      const nav = page.getByRole("navigation", { name: "APP 自动化模块导航" });
      await nav.getByRole("link", { name: "环境设置", exact: true }).click();
      await page.waitForFunction(() => {
        const nav = document.querySelector(".fc-module-tabs"),
          item = nav?.querySelector('[aria-current="page"]');
        if (!item) return false;
        const a = nav.getBoundingClientRect(),
          b = item.getBoundingClientRect();
        return b.left >= a.left - 1 && b.right <= a.right + 1;
      });
      if (width === 1440) {
        await page
          .getByRole("button", { name: "收起导航", exact: true })
          .first()
          .click();
        await page.locator(".main-layout.layout-collapsed").waitFor();
        await page
          .locator(".sider .arco-menu-item")
          .filter({ has: page.locator('.menu-link[title="Web 自动化"]') })
          .click();
        await page.waitForURL((u) => u.pathname === "/ui-automation");
      }
      assert.deepEqual(errors, []);
      await context.close();
    }
    const context = await browser.newContext();
    await installFixtures(context);
    await context.addInitScript(() => {
      const user = JSON.parse(sessionStorage.getItem("auth-user"));
      user.is_staff = false;
      user.is_superuser = false;
      sessionStorage.setItem("auth-user", JSON.stringify(user));
      sessionStorage.setItem(
        "auth-userPermissions",
        JSON.stringify(["app_automation.view_appautomationdevice"]),
      );
      localStorage.removeItem("selected_project_id");
    });
    await context.route(/\/api\/projects\/(?:\?.*)?$/, (r) =>
      r.fulfill({
        json: { success: true, status: "success", code: 200, data: [] },
      }),
    );
    const page = await context.newPage();
    await page.goto(base + "/app-automation?tab=devices");
    const nav = page.getByRole("navigation", { name: "APP 自动化模块导航" });
    await nav.getByRole("link", { name: "设备管理", exact: true }).waitFor();
    assert.equal(
      await nav.getByRole("link").count(),
      1,
      "module links preserve individual permissions",
    );
    console.log("PASS restricted APP navigation");
    await context.close();
  } finally {
    await browser.close();
  }
}
run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
