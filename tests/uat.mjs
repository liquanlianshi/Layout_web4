#!/usr/bin/env node
// =============================================================
// tests/uat.mjs — 用户视角验收：只用可见文字与真实点击
// =============================================================
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const URL = pathToFileURL(path.join(ROOT, "index.html")).href;
let pass = 0, fail = 0;
const failures = [];
const ok = (c, label) => { c ? pass++ : (fail++, failures.push(label)); };
const group = (n) => console.log(`\n✓ ${n}`);

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", e => errors.push(e.message));
page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
const go = async (hash, wait = 500) => { await page.goto(URL + hash, { waitUntil: "load" }); await page.waitForTimeout(wait); };
const text = async (sel) => (await page.locator(sel).innerText()).replace(/\s+/g, " ").trim();

// 1. 新用户：首页 → 第三章
group("01 新用户路径 / new visitor");
await go("#/", 1300);
ok((await text(".hero__eyebrow")).includes("VISUALIZATION"), "首屏眉标");
ok(await page.getByRole("link", { name: /从头开始/ }).isVisible(), "从头开始按钮");
ok(await page.locator(".chapter-card").count() === 5, "五张章节卡");
await page.locator(".chapter-card").nth(2).getByRole("link", { name: "03 色彩专题" }).count().catch(() => 0);
await page.locator('.chapter-card__sec[href="#/read/3.1"]').first().click();
await page.waitForTimeout(450);
ok((await text(".sec-head h1")) === "颜色模型基础", "进入 3.1");
ok(await page.locator(".widget-mount").count() === 1, "交互图出现");

// 2. 色彩交互：CVD 模拟
group("02 色彩实验 / color lab");
const swatchColors = () => page.locator(".widget-mount .swatch").evaluateAll(els => els.map(el => getComputedStyle(el).backgroundColor).join("|"));
const before = await swatchColors();
await page.locator(".widget-mount .ctl__seg").filter({ hasText: "绿色盲" }).getByRole("button", { name: "绿色盲" }).click();
await page.waitForTimeout(300);
const after = await swatchColors();
ok(before !== after, "色觉模拟改变色板");
ok((await text(".readout")).includes("最小色差"), "色差读数");
const chartSvg = await page.locator(".widget-mount .viz-chart svg").count();
ok(chartSvg > 0, "示例图重绘");

// 3. 自测：选错 → 看解释 → 重做
group("03 自测 / self-check");
await go("#/read/1.1", 700);
await page.locator(".quiz__opt").nth(0).click();
await page.waitForTimeout(200);
ok((await text(".quiz__verdict")).includes("再想想"), "选错提示");
ok(!(await page.locator(".quiz__why").isHidden()), "解释展开");
await page.getByRole("button", { name: /重做/ }).click();
await page.waitForTimeout(200);
ok(await page.locator(".quiz__why").isHidden(), "重做后收起解释");
await page.locator(".quiz__opt").nth(1).click();
await page.waitForTimeout(200);
ok((await text(".quiz__verdict")).includes("答对了"), "选对提示");

// 4. 代码复制
group("04 代码复制 / copy");
const copyBtn = page.locator(".codeblock__copy").first();
await copyBtn.click();
await page.waitForTimeout(300);
ok((await page.locator(".toast").count()) > 0 || (await copyBtn.innerText()).includes("复制"), "复制按钮有反馈");

// 5. 标记完成 → 侧栏跳转
group("05 进度与导航 / progress");
await page.locator(".rail__donebtn").click();
await page.waitForTimeout(200);
ok((await page.locator("#sideDone").innerText()) === "1", "完成数 +1");
await page.locator('#sideNav .navlink[href="#/read/5.5"]').click();
await page.waitForTimeout(450);
ok((await text(".sec-head h1")).includes("Storyline"), "侧栏跳到 5.5");
ok((await text(".crumbs")).includes("5.5"), "面包屑更新");

// 6. 搜索
group("06 搜索 / search");
await page.click("#btnSearch");
await page.waitForTimeout(200);
await page.fill("#paletteInput", "Marching Squares");
await page.waitForTimeout(300);
ok(await page.locator(".palette__item").count() >= 1, "Marching Squares 有结果");
await page.locator(".palette__item").first().click();
await page.waitForTimeout(400);
ok((await text(".sec-head h1")).includes("等值线"), "搜索跳到等值线");

// 7. 地图
group("07 地图 / map");
await page.locator('.topnav__link[href="#/map"]').click();
await page.waitForTimeout(500);
ok(await page.locator(".mapnode--chapter").count() === 5, "地图五章");
await page.locator(".mapnode--section").nth(8).click();
await page.waitForTimeout(250);
ok((await text(".map-aside")).length > 20, "节点侧栏");
await page.getByRole("button", { name: /列表视图/ }).click();
await page.waitForTimeout(300);
ok(await page.locator(".maplist__ch").count() === 5, "列表五章");

// 8. 实验室
group("08 实验室 / lab");
await page.locator('.topnav__link[href="#/lab"]').click();
await page.waitForTimeout(600);
ok((await text(".lab-head h1")) === "可视化实验室", "实验室标题");
await page.locator(".lab-subtab").nth(5).click();
await page.waitForTimeout(300);
ok(await page.locator(".quiz-card").count() === 4, "对错案例 4 张");
await page.locator(".quiz-card").nth(3).click();
await page.waitForTimeout(250);
ok((await text(".quiz-verdict")).includes("答对"), "用户选出正确答案");
await page.locator(".lab-tab").nth(2).click();
await page.waitForTimeout(600);
ok((await text(".lab-panel__head h2")) === "时间实验室", "时间实验室");
ok(await page.locator(".widget-mount .cal-cell").count() === 366, "日历 366 格");

// 9. 主题 / 语言
group("09 主题与语言 / theme & language");
await page.locator("#themeSeg").getByRole("button", { name: "墨夜" }).click();
await page.waitForTimeout(300);
ok((await page.getAttribute("html", "data-theme")) === "ink", "墨夜主题");
await page.locator("#langSeg").getByRole("button", { name: "EN" }).click();
await page.waitForTimeout(400);
ok((await text(".lab-head h1")) === "Visualization lab", "英文实验室");
ok((await text(".lab-tab.is-on")).toLowerCase().includes("time"), "英文标签");
await page.locator("#langSeg").getByRole("button", { name: "中" }).click();
await page.waitForTimeout(300);
await page.locator("#themeSeg").getByRole("button", { name: "纸面" }).click();
await page.waitForTimeout(300);

// 10. 无障碍
group("10 无障碍 / accessibility");
const noLabel = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll("button").forEach(b => {
    const name = (b.getAttribute("aria-label") || b.textContent || b.title || "").trim();
    if (!name) out.push(b.outerHTML.slice(0, 80));
  });
  return out;
});
ok(noLabel.length === 0, `所有按钮有可读名称 (${noLabel.length})`);
const noAlt = await page.evaluate(() => Array.from(document.images).filter(i => !i.hasAttribute("alt")).length);
ok(noAlt === 0, "图片都有 alt");
const skip = await page.locator(".skip-link").count();
ok(skip === 1, "跳转正文链接");
ok((await page.getAttribute("html", "lang")).startsWith("zh"), "lang 属性");
ok(await page.locator("h1").count() === 1, "每页一个 h1");

// 11. 移动端
group("11 移动端 / mobile");
await page.setViewportSize({ width: 390, height: 844 });
await go("#/read/1.3", 600);
await page.click("#btnMenu");
await page.waitForTimeout(400);
ok(await page.locator("#mTheme").isVisible(), "移动端主题开关");
ok(await page.locator("#mLang").isVisible(), "移动端语言开关");
await page.click("#mTheme");
await page.waitForTimeout(350);
ok((await page.getAttribute("html", "data-theme")) === "ink", "移动端切换墨夜");
await page.click("#mTheme");
await page.waitForTimeout(300);
await page.click("#btnCloseSide");
await page.waitForTimeout(300);
const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
ok(over <= 1, `移动端无溢出 (${over})`);
ok(await page.locator(".reader__rail .rail__donebtn").isVisible(), "移动端完成按钮可见");

// 12. 错误
ok(errors.length === 0, `无控制台错误 (${errors.slice(0, 3).join(" | ")})`);

console.log(`\n${fail ? "✗" : "✓"} 合计 / total: ${pass} 通过 passed, ${fail} 失败 failed (${(pass / (pass + fail) * 100).toFixed(2)}%)`);
if (fail) {
  console.error("\n失败项：\n - " + failures.join("\n - "));
  await browser.close();
  process.exit(1);
}
await browser.close();
