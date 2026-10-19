#!/usr/bin/env node
// =============================================================
// tests/content.mjs — 内容、结构与离线完整性审计（纯 Node）
// =============================================================
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
const failures = [];
function ok(cond, label) {
  if (cond) { pass++; }
  else { fail++; failures.push(label); }
}
function eq(a, b, label) { ok(a === b, `${label} (${JSON.stringify(a)} ≠ ${JSON.stringify(b)})`); }
function group(name) { console.log(`\n✓ ${name}`); }

const ctx = { window: {}, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, "data", "course.js"), "utf8"), ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, "data", "datasets.js"), "utf8"), ctx);
const C = ctx.window.COURSE;
const D = ctx.window.DATA;

// ---------- 1. 课程结构 ----------
group("01 课程结构 / structure");
eq(C.chapters.length, 5, "5 章");
const ids = C.chapters.flatMap(c => c.sections);
eq(ids.length, 27, "27 节");
eq(new Set(ids).size, 27, "小节 id 唯一");
eq(Object.keys(C.sections).length, 27, "SECTIONS 27 条");
for (const ch of C.chapters) {
  ok(ch.id && ch.num && ch.color && ch.sections.length > 0, `章 ${ch.id} 元数据完整`);
  for (const sid of ch.sections) ok(sid.startsWith(ch.num + "."), `${sid} 归属第 ${ch.num} 章`);
}
eq(C.stats.chapters, 5, "stats.chapters");
eq(C.stats.sections, 27, "stats.sections");
eq(C.stats.widgets, 20, "stats.widgets = 20 种图");
for (const lang of ["zh", "en"]) {
  for (const ch of C.chapters) {
    ok(ch[lang]?.title && ch[lang]?.blurb && ch[lang]?.lead, `${ch.id}.${lang} 章文案完整`);
  }
}

// ---------- 2. 每节内容 ----------
group("02 每节内容 / sections");
const leftovers = ["./index.html", "img/0", "📷", "[object Object]", "配套 Demo", "Companion Demo", "**", "| ---"];
for (const id of ids) {
  const s = C.sections[id];
  ok(s.demo, `${id} 有交互组件`);
  ok(s.minutes > 0, `${id} 有建议时长`);
  ok(Array.isArray(s.related), `${id} related 是数组`);
  for (const r of s.related) ok(!!C.sections[r], `${id} related ${r} 存在`);
  for (const lang of ["zh", "en"]) {
    const lo = s[lang];
    ok(lo, `${id}.${lang} 存在`);
    if (!lo) continue;
    ok(lo.title.length > 0, `${id}.${lang} 标题`);
    ok(lo.subtitle.length > 8, `${id}.${lang} 副标题`);
    ok(lo.bigIdea.length > 10, `${id}.${lang} 一句话`);
    eq(lo.points.length, 3, `${id}.${lang} 三个要点`);
    ok(lo.points.every(p => p.length > 8), `${id}.${lang} 要点非空`);
    ok(lo.html.length > 400, `${id}.${lang} 正文长度`);
    ok(lo.chars > 120, `${id}.${lang} 正文字符数`);
    ok(lo.toc.length > 0, `${id}.${lang} 页内目录`);
    ok(lo.quiz && lo.quiz.q && lo.quiz.options.length >= 3, `${id}.${lang} 自测题`);
    ok(lo.quiz && lo.quiz.answer >= 0 && lo.quiz.answer < lo.quiz.options.length, `${id}.${lang} 答案索引`);
    ok(lo.quiz && lo.quiz.why.length > 5, `${id}.${lang} 答案解释`);
    ok(!/<h[1-2][ >]/.test(lo.html), `${id}.${lang} 无越级标题`);
    for (const b of leftovers) ok(!lo.html.includes(b), `${id}.${lang} 无残留 ${b}`);
    const code = (lo.html.match(/class="codeblock"/g) || []).length;
    ok(code > 0, `${id}.${lang} 至少一个代码块`);
    const tables = (lo.html.match(/<table>/g) || []).length;
    for (const m of lo.html.matchAll(/<table>[\s\S]*?<\/table>/g)) {
      ok(m[0].includes("<thead>") && m[0].includes("<tbody>"), `${id}.${lang} 表格有 thead/tbody`);
    }
    ok(!/NaN|Infinity/.test(lo.html.replace(/<code[\s\S]*?<\/code>/g, "")), `${id}.${lang} 正文无 NaN/Infinity`);
  }
}

// ---------- 3. 交互组件 ----------
group("03 交互组件 / widgets");
const vizDir = path.join(ROOT, "assets", "js", "viz");
const registered = new Set();
const vizFiles = fs.readdirSync(vizDir).filter(f => f.endsWith(".js"));
for (const f of vizFiles) {
  const src = fs.readFileSync(path.join(vizDir, f), "utf8");
  for (const m of src.matchAll(/registerWidget\("([a-z]+)"/g)) registered.add(m[1]);
}
ok(registered.size >= 20, `注册了 ${registered.size} 个组件`);
for (const id of ids) {
  const base = C.sections[id].demo.split(":")[0];
  ok(registered.has(base), `${id} 的组件 ${base} 已注册`);
}
for (const key of ["color", "datagen", "datajoin", "tree", "marching", "calendar", "storyline", "chartchooser"]) {
  ok(registered.has(key), `关键组件 ${key}`);
}
eq(C.stats.codeBlocks, 90, "代码块总数 90（中英各 45）");
eq(C.stats.tables, 54, "表格总数 54（中英各 27）");

// ---------- 4. 数据集 ----------
group("04 数据集 / datasets");
eq(D.newstudent.length, 80, "新生数据 80 行");
eq(D.crime.length, 50, "犯罪数据 50 州");
eq(D.weather.length, 366, "2024 天气 366 天");
eq(Object.keys(D.frenchNames.names).length, 3, "法国人名 3 条序列");
eq(D.storyline.characters.length, 5, "Storyline 5 个角色");
ok(D.newstudent.every(d => typeof d.age === "number"), "年龄已转 number");
ok(D.crime.every(d => typeof d.population === "number"), "人口已转 number");
ok(D.weather.every(d => typeof d.temp === "number" && typeof d.rain === "number"), "天气数值化");
for (const s of Object.values(D.frenchNames.names)) eq(s.length, 121, "人名序列 121 年");
const ageCount = D.newstudent.reduce((m, d) => (m[d.age] = (m[d.age] || 0) + 1, m), {});
eq(ageCount[17], 31, "17 岁 31 人");
eq(ageCount[18], 49, "18 岁 49 人");

// ---------- 5. 站点文件与离线 ----------
group("05 站点文件 / offline");
const must = ["index.html", "data/course.js", "data/datasets.js", "assets/vendor/d3.min.js", "assets/js/app.js", "assets/js/ui.js", "assets/js/i18n.js"];
for (const f of must) ok(fs.existsSync(path.join(ROOT, f)), `存在 ${f}`);
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
for (const m of html.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+)"/g)) {
  const u = m[1];
  ok(!/^https?:/i.test(u), `本地资源 ${u}`);
  if (!/^data:/i.test(u)) ok(fs.existsSync(path.join(ROOT, u)), `资源存在 ${u}`);
}
ok(!/<script[^>]+src="https?:/i.test(html), "无外部脚本");
ok(!/<link[^>]+href="https?:/i.test(html), "无外部样式");
ok(!/\.(mp4|webm|mov|avi)"/i.test(html), "站点不引用视频");
ok(!/google-analytics|gtag\(|umami|plausible/i.test(html), "无跟踪脚本");
const media = ["mp4", "webm", "mov", "avi", "mkv"];
function walk(dir) {
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (["node_modules", ".git", ".pw-browsers", ".npm-cache", "docs", "shots"].includes(f)) continue;
      out.push(...walk(p));
    } else out.push(p);
  }
  return out;
}
const siteFiles = walk(ROOT);
for (const f of siteFiles) {
  ok(!media.includes(path.extname(f).slice(1).toLowerCase()), `站点无视频文件 ${path.relative(ROOT, f)}`);
}
ok(siteFiles.some(f => f.endsWith("d3.min.js")), "D3 已本地化");
ok(siteFiles.some(f => f.includes("prism-javascript.min.js")), "Prism 已本地化");

// ---------- 6. 页面可达性 ----------
group("06 页面可达性 / routes");
const app = fs.readFileSync(path.join(ROOT, "assets", "js", "app.js"), "utf8");
for (const name of ["renderHome", "renderReader", "renderMap", "renderLab", "renderAbout", "openPalette", "buildQuiz"]) {
  ok(app.includes(`function ${name}`), `app.js 含 ${name}`);
}
for (const file of ["index.html", "assets/css/tokens.css", "assets/css/layout.css", "assets/css/components.css", "assets/css/viz.css"]) {
  ok(fs.existsSync(path.join(ROOT, file)), `存在 ${file}`);
}
const css = ["tokens", "layout", "components", "viz"].map(n => fs.readFileSync(path.join(ROOT, "assets", "css", `${n}.css`), "utf8")).join("\n");
ok(css.includes('data-theme="ink"'), "深色主题变量");
ok(css.includes("@media (max-width: 900px)"), "移动端断点");
ok(css.includes("prefers-reduced-motion"), "减少动效");
ok(css.includes(":focus-visible"), "焦点可见");
ok(!/url\(\s*["']?https?:/.test(css), "CSS 无外链资源");

// ---------- 汇总 ----------
console.log(`\n${fail ? "✗" : "✓"} 合计 / total: ${pass} 通过 passed, ${fail} 失败 failed (${(pass / (pass + fail) * 100).toFixed(2)}%)`);
if (fail) {
  console.error("\n失败项：\n - " + failures.join("\n - "));
  process.exit(1);
}
