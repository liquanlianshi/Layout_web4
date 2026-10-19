#!/usr/bin/env node
// =============================================================
// tests/e2e.mjs — 真实 Chromium 端到端：路由、搜索、进度、主题、响应式
// 用法：node tests/e2e.mjs [--shots]
// =============================================================
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const URL = pathToFileURL(path.join(ROOT, "index.html")).href;
const SHOTS = process.argv.includes("--shots");
const SHOT_DIR = path.join(ROOT, "shots");
if (SHOTS) fs.mkdirSync(SHOT_DIR, { recursive: true });

let pass = 0, fail = 0;
const failures = [];
const ok = (c, label) => { c ? pass++ : (fail++, failures.push(label)); };
const group = (n) => console.log(`\n✓ ${n}`);

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
const requests = [];
page.on("pageerror", e => errors.push("PAGEERROR " + e.message));
page.on("console", m => { if (m.type() === "error") errors.push("CONSOLE " + m.text()); });
page.on("request", r => requests.push(r.url()));

async function goto(hash, wait = 350) {
  await page.goto(URL + hash, { waitUntil: "load" });
  await page.waitForTimeout(wait);
}
async function shot(name, full = false) {
  if (SHOTS) await page.screenshot({ path: path.join(SHOT_DIR, name), fullPage: full });
}
const text = async (sel) => (await page.locator(sel).innerText()).replace(/\s+/g, " ").trim();

// ---------- 1. 首屏 ----------
group("01 首屏 / first paint");
await goto("#/", 1400);
ok((await page.title()).includes("可视化导论"), "标题");
ok(await page.locator(".chapter-card").count() === 5, "5 章");
ok(await page.locator(".plate__cell").count() === 5, "图版五格");
ok((await page.locator(".hero__stat").nth(2).innerText()).includes("20"), "20 种交互图");
ok((await page.locator(".hero__stat").nth(3).innerText()).includes("236"), "236 分钟");
ok(await page.locator(".progress-card").count() === 1, "进度卡");
ok((await page.locator(".progress-card__num").innerText()).includes("0 / 27"), "初始 0/27");
ok(await page.locator("#boot").count() === 0, "载入遮罩已移除");
await shot("shot-01-home.png");

// ---------- 2. 开始学习 ----------
group("02 阅读器 / reader");
await page.getByRole("link", { name: /从头开始/ }).click();
await page.waitForTimeout(400);
ok((await page.evaluate(() => location.hash)) === "#/read/1.1", "从头开始 → 1.1");
ok((await text(".sec-head h1")) === "数据生成", "1.1 标题");
ok(await page.locator(".quick__point").count() === 3, "三个要点");
ok(await page.locator(".widget-mount > *").count() > 0, "1.1 交互图");
ok(await page.locator(".quiz__opt").count() === 3, "自测三选项");
ok(await page.locator(".pager__link").count() === 2, "上下页");
ok(await page.locator(".rail__toc a").count() > 3, "页内目录");
ok(await page.locator("#sideNav .navlink").count() === 27, "侧栏 27 节");
await shot("shot-02-reader.png");

// 标记完成
await page.locator(".rail__donebtn").click();
await page.waitForTimeout(180);
ok(await page.locator(".rail__donebtn.is-done").count() === 1, "标记完成样式");
ok((await page.locator("#sideDone").innerText()) === "1", "侧栏完成数 1");
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(700);
ok((await page.locator("#sideDone").innerText()) === "1", "刷新后进度保留");
ok((await page.locator(".rail__donebtn.is-done").count()) === 1, "刷新后按钮仍为完成");
await shot("shot-03-section-done.png");

// 下一节
await page.locator(".pager__link--next").click();
await page.waitForTimeout(350);
ok((await page.evaluate(() => location.hash)) === "#/read/1.2", "下一节 → 1.2");
ok((await text(".sec-head h1")) === "数据定义", "1.2 标题");

// 跳到实验
await page.locator('[data-scroll="demo"]').click();
await page.waitForTimeout(500);
const demoBox = await page.locator("#demo").boundingBox();
ok(demoBox && demoBox.y < 500, "跳到实验滚动到视口");
await shot("shot-04-widget.png");

// 键盘
await page.keyboard.press("ArrowRight");
await page.waitForTimeout(300);
ok((await page.evaluate(() => location.hash)) === "#/read/1.3", "→ 下一节");
await page.keyboard.press("ArrowLeft");
await page.waitForTimeout(300);
ok((await page.evaluate(() => location.hash)) === "#/read/1.2", "← 上一节");

// ---------- 3. 搜索 ----------
group("03 搜索 / search");
await page.keyboard.press("Meta+k");
await page.waitForTimeout(250);
ok(await page.locator("#palette").isVisible(), "⌘K 打开搜索");
await page.fill("#paletteInput", "rollup");
await page.waitForTimeout(250);
ok(await page.locator(".palette__item").count() >= 2, "rollup 至少 2 个结果");
ok((await text("#paletteHint")).includes("结果"), "结果计数");
await shot("shot-05-search.png");
await page.locator(".palette__item").first().click();
await page.waitForTimeout(400);
ok(!(await page.locator("#palette").isVisible()), "选中后关闭");
ok(/^#\/read\//.test(await page.evaluate(() => location.hash)), "跳转到小节");

// 无结果
await page.keyboard.press("Meta+k");
await page.fill("#paletteInput", "zzzz-not-found");
await page.waitForTimeout(200);
ok((await text(".palette__empty")).includes("没有找到"), "无结果提示");
await page.keyboard.press("Escape");
await page.waitForTimeout(150);
ok(!(await page.locator("#palette").isVisible()), "Esc 关闭搜索");

// ---------- 4. 主题 ----------
group("04 主题 / theme");
await goto("#/read/1.3");
ok((await page.getAttribute("html", "data-theme")) === "paper", "默认纸面");
await page.click('#themeSeg [data-theme-val="ink"]');
await page.waitForTimeout(350);
ok((await page.getAttribute("html", "data-theme")) === "ink", "切换到墨夜");
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(700);
ok((await page.getAttribute("html", "data-theme")) === "ink", "刷新后主题保留");
await shot("shot-06-dark.png");
await page.click('#themeSeg [data-theme-val="paper"]');
await page.waitForTimeout(300);

// ---------- 5. 语言 ----------
group("05 语言 / language");
await goto("#/read/3.1");
const zhTitle = await text(".sec-head h1");
await page.click('#langSeg [data-lang-val="en"]');
await page.waitForTimeout(400);
ok((await page.getAttribute("html", "data-lang")) === "en", "切换到英文");
const enTitle = await text(".sec-head h1");
ok(enTitle !== zhTitle && /Color/i.test(enTitle), `英文标题 (${enTitle})`);
ok((await text(".quick__label")).toLowerCase() === "in one sentence", "英文速览标签");
ok((await page.locator("#sideNav .navgroup__title").first().innerText()).length > 0, "英文侧栏");
await shot("shot-07-english.png");
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(700);
ok((await page.getAttribute("html", "data-lang")) === "en", "刷新后语言保留");
await page.click('#langSeg [data-lang-val="zh"]');
await page.waitForTimeout(300);
ok((await page.getAttribute("html", "data-lang")) === "zh", "切回中文");

// ---------- 6. 地图 ----------
group("06 知识地图 / map");
await goto("#/map");
ok(await page.locator(".mapnode--chapter").count() === 5, "5 章节点");
ok(await page.locator(".mapnode--section").count() === 27, "27 节节点");
await shot("shot-08-map.png");
await page.locator(".mapnode--section").nth(0).click();
await page.waitForTimeout(250);
ok((await text(".map-aside h2")).length > 0, "节点详情");
ok((await page.locator(".map-aside .btn").getAttribute("href")).startsWith("#/read/"), "详情 CTA");
await page.getByRole("button", { name: /只看未完成/ }).click();
await page.waitForTimeout(300);
ok(await page.locator(".mapnode--section").count() === 27, "筛选后仍 27 节");
await page.getByRole("button", { name: /列表视图/ }).click();
await page.waitForTimeout(300);
ok(await page.locator(".maplist__item").count() === 27, "列表 27 节");
await page.getByRole("button", { name: /图谱视图/ }).click();
await page.waitForTimeout(300);

// ---------- 7. 实验室 ----------
group("07 实验室 / lab");
await goto("#/lab/color", 600);
ok(await page.locator(".lab-subtab").count() === 7, "7 个色彩子页");
await page.locator(".lab-subtab").nth(1).click();
await page.waitForTimeout(300);
ok((await text(".lab-subtab.is-on")) === "colormap", "colormap 子页");
await shot("shot-09-lab-color.png");
await goto("#/lab/channel", 600);
ok(await page.locator(".matrix button.cell").count() === 40, "通道矩阵 40 格");
await shot("shot-10-lab-channel.png");
await goto("#/lab/time", 650);
ok(await page.locator(".viz").count() === 4, "时间实验室 4 图");
await shot("shot-11-lab-time.png");

// ---------- 8. 重构说明 ----------
group("08 重构说明 / about");
await goto("#/about", 500);
ok((await text(".about h1")) === "重构说明", "标题");
ok((await page.locator(".compare tr").count()) >= 8, "对照表");
ok((await page.locator(".about pre").innerText()).includes("npm test"), "验证命令");
ok((await page.locator('.about a[href*="Layout_web4"]').count()) === 1, "部署链接");
await shot("shot-12-about.png", true);

// ---------- 9. 响应式 ----------
group("09 响应式 / responsive");
const sizes = [[1920, 1080], [1440, 1000], [1280, 900], [1024, 800], [900, 800], [768, 900], [390, 844]];
for (const [w, h] of sizes) {
  await page.setViewportSize({ width: w, height: h });
  for (const hash of ["#/", "#/read/1.3", "#/map", "#/lab"]) {
    await goto(hash, 350);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok(over <= 1, `${w}px ${hash} 无溢出 (${over})`);
  }
}
// 移动端抽屉
await page.setViewportSize({ width: 390, height: 844 });
await goto("#/read/1.3", 500);
ok(await page.locator("#btnMenu").isVisible(), "移动端菜单按钮");
await page.click("#btnMenu");
await page.waitForTimeout(300);
ok(await page.evaluate(() => document.body.classList.contains("side-open")), "目录抽屉打开");
await shot("shot-13-mobile.png");
await page.click("#btnCloseSide");
await page.waitForTimeout(300);
ok(!(await page.evaluate(() => document.body.classList.contains("side-open"))), "目录抽屉关闭");
// 移动端也能标记完成（rail 在正文后）
await page.setViewportSize({ width: 1024, height: 900 });
await goto("#/read/1.3", 500);
ok(await page.locator(".reader__rail .rail__donebtn").isVisible(), "平板可见完成按钮");

// ---------- 10. 离线与错误 ----------
group("10 离线与错误 / offline");
const external = requests.filter(u => !/^(file|data|blob):/.test(u));
ok(external.length === 0, `无外部请求 (${external.slice(0, 3).join(", ")})`);
ok(errors.length === 0, `无控制台错误 (${errors.slice(0, 3).join(" | ")})`);

// ---------- 11. 进度重置 ----------
group("11 进度重置 / reset");
await page.setViewportSize({ width: 1440, height: 1000 });
await goto("#/read/1.1", 500);
page.once("dialog", d => d.accept());
await page.click("#btnResetProgress");
await page.waitForTimeout(350);
ok((await page.locator("#sideDone").innerText()) === "0", "重置后完成数 0");

console.log(`\n${fail ? "✗" : "✓"} 合计 / total: ${pass} 通过 passed, ${fail} 失败 failed (${(pass / (pass + fail) * 100).toFixed(2)}%)`);
if (SHOTS) console.log(`截图输出：${path.relative(ROOT, SHOT_DIR)}/（13 张）`);
if (fail) {
  console.error("\n失败项：\n - " + failures.join("\n - "));
  await browser.close();
  process.exit(1);
}
await browser.close();
