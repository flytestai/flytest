const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { installFixtures } = require('./verify-workspace-layout.cjs');
const baseUrl = process.env.UI_BASE_URL || 'http://127.0.0.1:5175';
const output = process.env.UI_OUTPUT_DIR || path.resolve(__dirname, '../playwright-screenshots/auth');
const sizes = [[1440, 900], [1920, 1080], [1024, 768], [768, 1024], [390, 844], [320, 740], [844, 390]];

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(process.env.UI_BROWSER_CHANNEL ? { channel: process.env.UI_BROWSER_CHANNEL } : {}) });
  const report = [];
  try {
    for (const [width, height] of sizes) {
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
      await installFixtures(context, { authenticated: false });
      await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
      await context.route('**/api/token/', route => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ status: 'error', code: 401, message: '用户名或密码错误', data: null }) }));
      let registration;
      await context.route('**/api/accounts/register/', route => {
        registration = route.request().postDataJSON();
        return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ status: 'success', code: 201, data: { username: 'feice-review', real_name: '测试用户', approval_status: 'pending' } }) });
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      for (const route of ['login', 'register']) {
        await page.goto(`${baseUrl}/${route}`, { waitUntil: 'domcontentloaded' });
        await page.locator('.feice-auth-form').waitFor({ state: 'visible' });
        await page.evaluate(() => document.fonts.ready);
        await page.locator('.feice-auth img').evaluateAll(images => Promise.all(images.map(img => img.decode().catch(() => {}))));
        const state = await page.locator('.feice-auth').evaluate(root => {
          const overflow = [...root.querySelectorAll('input, button, a, h1, h2, p, .feice-auth-card')].filter(el => {
            const r = el.getBoundingClientRect(); return r.width && r.height && (r.left < -1 || r.right > innerWidth + 1);
          }).map(el => el.className);
          return { overflow, documentWidth: document.documentElement.scrollWidth, background: getComputedStyle(root).backgroundColor, buttonColor: getComputedStyle(root.querySelector('.feice-auth-submit')).backgroundColor, fontMatchesWorkspace: getComputedStyle(root).fontFamily === getComputedStyle(document.body).fontFamily, logo: root.querySelector('.feice-auth-brand img').getAttribute('src'), imageErrors: [...root.querySelectorAll('img')].filter(img => !img.complete || !img.naturalWidth).length };
        });
        assert.deepEqual(state.overflow, [], `${route} ${width}: no clipped controls or copy`);
        assert(state.documentWidth <= width, 'No page horizontal overflow');
        assert.equal(state.background, 'rgb(245, 247, 251)');
        assert.equal(state.buttonColor, 'rgb(53, 99, 233)');
        assert(state.fontMatchesWorkspace, 'Authentication and workspace must share the same font');
        assert(state.logo.includes('feice-logo.svg'));
        assert.equal(state.imageErrors, 0);
        assert.deepEqual(errors, []);
        await page.screenshot({ path: path.join(output, `${route}-${width}x${height}.png`), fullPage: true, animations: 'disabled' });
        report.push({ route, width, height, passed: true, ...state });
        console.log(`PASS ${route} ${width}x${height}`);

        if (route === 'login' && [1440, 390].includes(width)) {
          await page.getByLabel('用户名 / 手机号', { exact: true }).fill('review-user');
          await page.getByLabel('密码', { exact: true }).fill('wrong-password');
          await page.getByRole('button', { name: '显示密码', exact: true }).click();
          assert.equal(await page.locator('#login-password').getAttribute('type'), 'text');
          await page.getByRole('button', { name: '隐藏密码', exact: true }).click();
          assert.equal(await page.locator('#login-password').getAttribute('type'), 'password');
          await page.getByRole('button', { name: '登录', exact: true }).click();
          await page.getByRole('alert').filter({ hasText: '用户名或密码错误' }).waitFor();
          assert.equal(await page.getByRole('button', { name: '登录', exact: true }).isEnabled(), true);
          await page.screenshot({ path: path.join(output, `login-error-${width}.png`), fullPage: true });
          await page.getByRole('link', { name: /立即注册/ }).click();
          await page.waitForURL('**/register');
          await page.getByRole('link', { name: /返回登录/ }).click();
          await page.waitForURL('**/login');
        }
        if (route === 'register' && width === 1440) {
          await page.getByLabel('姓名', { exact: true }).fill('测试用户');
          await page.getByLabel('手机号', { exact: true }).fill('13800138000');
          await page.getByLabel('密码', { exact: true }).fill('FeiceTest2026!');
          await page.getByLabel('确认密码', { exact: true }).fill('different');
          await page.getByRole('button', { name: '注册', exact: true }).click();
          await page.getByText('两次输入的密码不一致', { exact: true }).waitFor();
          assert.equal(registration, undefined);
          await page.getByLabel('确认密码', { exact: true }).fill('FeiceTest2026!');
          await page.getByRole('button', { name: '显示确认密码', exact: true }).click();
          assert.equal(await page.locator('#confirmPassword').getAttribute('type'), 'text');
          await page.getByRole('button', { name: '注册', exact: true }).click();
          await page.getByRole('status').filter({ hasText: '注册成功' }).waitFor();
          assert(registration);
          await page.screenshot({ path: path.join(output, 'register-success-1440.png'), fullPage: true });
        }
      }
      if (width === 1440) {
        await page.addInitScript(() => { localStorage.setItem('rememberedUsername', 'remembered-user'); localStorage.setItem('flytest-theme-mode', 'black'); });
        await page.goto(`${baseUrl}/login`);
        assert.equal(await page.getByLabel('用户名 / 手机号', { exact: true }).inputValue(), 'remembered-user');
        assert.equal(await page.getByLabel('记住我', { exact: true }).isChecked(), true);
        assert.equal(await page.locator('.feice-auth').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(17, 24, 35)');
        assert.equal(await page.locator('.feice-auth-logo-dark').isVisible(), true);
        console.log('PASS remembered username and saved dark theme');
      }
      await context.close();
    }
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    console.log(`${report.length}/${sizes.length * 2} auth layout scenarios passed; login errors, password visibility, registration and account memory passed`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
