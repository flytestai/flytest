const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { installFixtures } = require('./verify-workspace-layout.cjs');
const base = process.env.UI_BASE_URL || 'http://127.0.0.1:5176';

(async () => {
  const browser = await chromium.launch({headless:true, channel:process.env.UI_BROWSER_CHANNEL || 'msedge'});
  const checks = [];
  try {
    for (const width of [1440,390]) {
      const context = await browser.newContext({viewport:{width,height:900}});
      await installFixtures(context);
      const page = await context.newPage();
      for (const route of ['/dashboard','/app-automation','/knowledge-management','/permissions']) {
        await page.goto(base+route);
        await page.locator('.main-layout .content').waitFor();
        for (const theme of ['light','black']) {
          await page.evaluate(theme => {
            document.documentElement.dataset.theme = theme;
            if(theme==='black') document.body.setAttribute('arco-theme','dark'); else document.body.removeAttribute('arco-theme');
          }, theme);
          const colors = await page.locator('.main-layout .content').evaluate(el => ({
            colors:getComputedStyle(el).scrollbarColor,
            thumb:getComputedStyle(el,'::-webkit-scrollbar-thumb').backgroundColor,
            track:getComputedStyle(el,'::-webkit-scrollbar-track').backgroundColor,
          }));
          assert.equal(colors.colors,'rgba(0, 0, 0, 0) rgba(0, 0, 0, 0)');
          assert.equal(colors.thumb,'rgba(0, 0, 0, 0)');
          assert.equal(colors.track,'rgba(0, 0, 0, 0)');
          await page.evaluate(() => {
            const probe=document.createElement('div');probe.id='scroll-probe';probe.tabIndex=0;
            probe.style.cssText='position:fixed;left:20px;top:200px;width:160px;height:160px;overflow:scroll;z-index:99999;background:white';
            probe.innerHTML='<div style="width:800px;height:800px">Scroll verification</div>';document.body.append(probe);
          });
          const probe=page.locator('#scroll-probe');await probe.hover();await page.mouse.wheel(100,100);
          await page.waitForFunction(()=>{const el=document.querySelector('#scroll-probe');return el.scrollTop>0&&el.scrollLeft>0});
          await probe.focus();await page.keyboard.press('ArrowDown');
          await probe.evaluate(el=>el.remove());
          checks.push({width,route,theme,passed:true});
        }
      }
      await context.close();
    }
    const output=path.resolve(__dirname,'../playwright-screenshots/transparent-scrollbars');fs.mkdirSync(output,{recursive:true});
    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(checks,null,2));
    console.log(`${checks.length}/${checks.length} transparent scrollbar and bidirectional wheel checks passed`);
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});
