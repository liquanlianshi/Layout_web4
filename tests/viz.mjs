#!/usr/bin/env node
// =============================================================
// tests/viz.mjs — 27 节交互图 + 地图 + 实验室的浏览器自检
// 需要 Playwright Chromium；可用 PLAYWRIGHT_BROWSERS_PATH 指定目录。
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
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", e => errors.push("PAGEERROR " + e.message));
page.on("console", m => { if (m.type() === "error") errors.push("CONSOLE " + m.text()); });

async function go(hash) {
  await page.goto(URL + hash, { waitUntil: "load" });
  await page.waitForTimeout(280);
}
async function waitWidget() {
  await page.waitForFunction(() => {
    const w = document.querySelector(".widget-mount");
    return w && w.childElementCount > 0 && w.querySelector("svg, canvas, table, button");
  }, { timeout: 5000 });
}

// ---------- 1. 首页 ----------
group("01 首页 / home");
await go("#/");
await page.waitForTimeout(800);
ok((await page.title()).includes("可视化导论"), "首页标题");
ok(await page.locator(".chapter-card").count() === 5, "5 张章节卡");
ok(await page.locator(".hero__stat").count() === 5, "5 个统计项");
ok((await page.locator(".hero__stat").last().innerText()).includes("2"), "双语统计");
ok(await page.locator(".plate__cell").count() >= 5, "图版 5 格");
const homeOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
ok(homeOverflow <= 1, `首页无横向溢出 (${homeOverflow}px)`);

// ---------- 2. 27 节 ----------
group("02 27 节 / sections");
const ids = ["1.1","1.2","1.3","1.4","1.5","2.1","2.2","2.3","2.4","3.1","3.2","3.3","3.4","3.5","3.6","3.7","3.8","4.1","4.2","4.3","4.4","4.5","5.1","5.2","5.3","5.4","5.5"];
let totalSvg = 0, totalWidgets = 0, totalControls = 0;
for (const id of ids) {
  await go("#/read/" + id);
  await waitWidget();
  const h1 = (await page.locator(".sec-head h1").innerText()).trim();
  ok(h1.length > 0, `${id} 标题`);
  ok((await page.locator(".quick__point").count()) === 3, `${id} 三个要点`);
  const proseLen = (await page.locator(".prose").innerText()).length;
  ok(proseLen > 200, `${id} 正文长度 (${proseLen})`);
  const widgetKids = await page.locator(".widget-mount > *").count();
  ok(widgetKids > 0, `${id} 交互图挂载`);
  totalWidgets++;
  const svgs = await page.locator(".widget-mount svg").count();
  totalSvg += svgs;
  for (let i = 0; i < svgs; i++) {
    const info = await page.locator(".widget-mount svg").nth(i).evaluate(el => ({
      children: el.childElementCount,
      box: el.getBoundingClientRect().width,
      vb: el.getAttribute("viewBox"),
    }));
    ok(info.children > 0, `${id} svg#${i} 有内容`);
    ok(info.box > 20, `${id} svg#${i} 可见宽度`);
    ok(!info.vb || /^0 0 [\d.]+ [\d.]+$/.test(info.vb), `${id} svg#${i} viewBox 合法`);
  }
  const bad = await page.locator(".widget-mount").evaluate(root => {
    const out = [];
    root.querySelectorAll("*").forEach(el => {
      for (const a of el.attributes) {
        if (/NaN|undefined|Infinity/.test(a.value)) out.push(`${el.tagName}[${a.name}=${a.value}]`);
      }
    });
    return out.slice(0, 5);
  });
  ok(bad.length === 0, `${id} 无 NaN/undefined 属性 ${bad.join(", ")}`);
  const controls = await page.locator(".widget-mount input, .widget-mount select, .widget-mount button, .widget-mount [role=button]").count();
  totalControls += controls;
  ok(controls > 0, `${id} 有可操作控件`);
  const tocLinks = await page.locator(".rail__toc a").count();
  ok(tocLinks > 0, `${id} 页内目录`);
  const quizOpts = await page.locator(".quiz__opt").count();
  ok(quizOpts >= 3, `${id} 自测选项 ${quizOpts}`);
  const pager = await page.locator(".pager__link").count();
  ok(pager === 2, `${id} 上下页`);
}

// ---------- 3. 交互行为 ----------
group("03 交互行为 / interactions");
await go("#/read/1.5");
await waitWidget();
const cnt = async () => (await page.locator(".join__counts").innerText()).replace(/\s+/g, " ");
ok((await cnt()).includes("enter 0"), "Data-Join 初始 enter 0");
await page.getByRole("button", { name: /添加一条/ }).click();
await page.waitForTimeout(120);
ok((await cnt()).includes("enter 1"), "添加后 enter 1");
await page.getByRole("button", { name: /打乱顺序/ }).click();
await page.waitForTimeout(120);
ok((await cnt()).includes("update 6"), "打乱后 update 6");
await page.locator(".widget-mount .switch").first().click();
await page.waitForTimeout(120);
ok((await cnt()).includes("key: index"), "关闭 key 后按索引绑定");

await go("#/read/2.3");
await waitWidget();
const treeKids = await page.locator(".widget-mount svg").first().evaluate(el => el.childElementCount);
ok(treeKids > 0, "树布局 SVG 已绘制");
await page.locator(".widget-mount .switch").click();
await page.waitForTimeout(160);
ok(await page.locator(".widget-mount .switch__input").isChecked(), "朴素布局开关");
await page.locator(".widget-mount .switch").click();

await go("#/read/3.2");
await waitWidget();
await page.locator(".widget-mount select").first().selectOption("div");
await page.locator(".widget-mount select").nth(1).selectOption("rdbu");
await page.waitForTimeout(180);
ok((await page.locator(".rec-card__name").innerText()).includes("一致"), "colormap 发散匹配");
await page.locator(".widget-mount select").first().selectOption("qual");
await page.waitForTimeout(120);
ok((await page.locator(".rec-card__name").innerText()).length > 2, "colormap 定性切换");

await go("#/read/3.6");
await waitWidget();
ok(await page.locator(".quiz-card").count() === 4, "四张对错卡");
await page.locator(".quiz-card").nth(3).click();
await page.waitForTimeout(150);
ok((await page.locator(".quiz-verdict").innerText()).includes("答对了"), "Wong 8 判定为对");
ok(await page.locator(".quiz-card.is-correct").count() === 1, "只有一张标为正确");

await go("#/read/4.5");
await waitWidget();
ok(await page.locator(".widget-mount canvas").count() === 1, "等值线 canvas");
const before = await page.locator(".readout").last().innerText();
await page.locator(".widget-mount input[type=range]").evaluate(el => { el.value = "0.7"; el.dispatchEvent(new Event("input", { bubbles: true })); });
await page.waitForTimeout(220);
const after = await page.locator(".readout").last().innerText();
ok(before !== after, "阈值改变后统计更新");
ok(after.includes("0.70"), "阈值读数更新");
const segs = Number((after.match(/线段\s*(\d+)/) || [])[1]);
ok(segs > 0, "等值线段数 > 0");

await go("#/read/5.3");
await waitWidget();
ok(await page.locator(".widget-mount .cal-cell").count() === 366, "日历 366 格");
await page.locator(".widget-mount .switch").click();
await page.waitForTimeout(120);
ok(await page.locator(".widget-mount .switch__input").isChecked() === false, "月份分隔线可关闭");

await go("#/read/1.1");
await waitWidget();
await page.locator(".quiz__opt").nth(1).click();
await page.waitForTimeout(120);
ok(!(await page.locator(".quiz__why").isHidden()), "自测答案解释展开");
ok((await page.locator(".quiz__verdict").innerText()).includes("答对"), "自测判定");

// ---------- 4. 地图 ----------
group("04 知识地图 / map");
await go("#/map");
await page.waitForTimeout(500);
ok(await page.locator(".mapnode--chapter").count() === 5, "5 个章节点");
ok(await page.locator(".mapnode--section").count() === 27, "27 个节节点");
await page.locator(".mapnode--section").nth(2).click();
await page.waitForTimeout(200);
ok((await page.locator(".map-aside").innerText()).length > 20, "节点摘要");
ok((await page.locator(".map-aside .btn").getAttribute("href")).startsWith("#/read/"), "打开本节链接");
await page.getByRole("button", { name: /列表视图/ }).click();
await page.waitForTimeout(300);
ok(await page.locator(".maplist__item").count() === 27, "列表视图 27 节");

// ---------- 5. 实验室 ----------
group("05 实验室 / lab");
await go("#/lab/color");
await page.waitForTimeout(500);
ok(await page.locator(".lab-subtab").count() === 7, "色彩实验室 7 个子页");
for (let i = 0; i < 7; i++) {
  await page.locator(".lab-subtab").nth(i).click();
  await page.waitForTimeout(220);
  const nodes = await page.locator(".lab-subpanel svg, .lab-subpanel canvas, .lab-subpanel table, .lab-subpanel .swatches, .lab-subpanel .quiz-grid").count();
  ok(nodes > 0, `色彩子页 ${i} 有内容`);
}
await go("#/lab/channel");
await page.waitForTimeout(400);
ok(await page.locator(".viz").count() === 2, "通道实验室 2 张卡");
ok(await page.locator(".matrix button.cell").count() === 40, "矩阵 4 × 10");
await go("#/lab/time");
await page.waitForTimeout(500);
ok(await page.locator(".viz").count() === 4, "时间实验室 4 张卡");
ok(await page.locator(".widget-mount .cal-cell").count() === 366, "实验室日历 366 格");

// ---------- 6. 溢出与错误 ----------
group("06 溢出与错误 / overflow");
const views = [
  ["#/", 1440, 1000], ["#/read/1.3", 1440, 1000], ["#/read/4.5", 1280, 900],
  ["#/read/5.3", 1024, 800], ["#/read/1.5", 900, 800], ["#/read/1.3", 390, 844],
  ["#/map", 390, 844], ["#/lab", 390, 844],
];
for (const [hash, w, h] of views) {
  await page.setViewportSize({ width: w, height: h });
  await go(hash);
  await page.waitForTimeout(450);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(over <= 1, `${hash} @ ${w}px 无横向溢出 (${over})`);
}
ok(errors.length === 0, `无控制台错误 ${errors.slice(0, 3).join(" | ")}`);

console.log(`\n交互图 ${totalWidgets} 节 · SVG ${totalSvg} 个 · 控件 ${totalControls} 个`);
console.log(`${fail ? "✗" : "✓"} 合计 / total: ${pass} 通过 passed, ${fail} 失败 failed (${(pass / (pass + fail) * 100).toFixed(2)}%)`);
if (fail) {
  console.error("\n失败项：\n - " + failures.join("\n - "));
  await browser.close();
  process.exit(1);
}
await browser.close();
