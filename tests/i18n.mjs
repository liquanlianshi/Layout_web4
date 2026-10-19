#!/usr/bin/env node
// =============================================================
// tests/i18n.mjs — 双语字典结构、占位符与使用一致性
// =============================================================
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
const failures = [];
const ok = (c, label) => { c ? pass++ : (fail++, failures.push(label)); };
const group = (n) => console.log(`\n✓ ${n}`);

// ---------- 载入字典 ----------
const sandbox = {
  window: {},
  document: { documentElement: { setAttribute() {}, lang: "" }, querySelectorAll() { return []; }, getElementById() { return null; } },
  console,
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, "assets", "js", "i18n.js"), "utf8"), sandbox);
const I18N = sandbox.window.I18N;
const zh = I18N.DICT.zh, en = I18N.DICT.en;

group("01 字典完整性 / dictionary");
ok(!!I18N, "I18N 已挂载");
ok(Object.keys(zh).length > 150, `中文字典 ${Object.keys(zh).length} 条`);
const zk = new Set(Object.keys(zh)), ek = new Set(Object.keys(en));
for (const k of zk) ok(ek.has(k), `英文缺少 ${k}`);
for (const k of ek) ok(zk.has(k), `中文缺少 ${k}`);
for (const [lang, dict] of [["zh", zh], ["en", en]]) {
  for (const [k, v] of Object.entries(dict)) {
    ok(typeof v === "string" && v.trim().length > 0, `${lang}.${k} 非空`);
    ok(k === k.trim(), `${lang}.${k} 无首尾空格`);
  }
}

group("02 占位符 / placeholders");
const ph = (s) => Array.from(s.matchAll(/\{([a-zA-Z0-9_]+)\}/g), m => m[1]).sort().join(",");
for (const k of zk) {
  ok(ph(zh[k]) === ph(en[k]), `${k} 占位符一致 (${ph(zh[k])} vs ${ph(en[k])})`);
}
ok(ph(zh["search.resultCount"]) === "n", "search.resultCount 有 {n}");
ok(ph(zh["reader.minutes"]) === "n", "reader.minutes 有 {n}");

group("03 调用点 / call sites");
const app = fs.readFileSync(path.join(ROOT, "assets", "js", "app.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const used = new Set();
for (const m of app.matchAll(/\bT\("([^"]+)"/g)) used.add(m[1]);
for (const m of html.matchAll(/data-i18n(?:-title|-aria|-html)?="([^"]+)"/g)) used.add(m[1]);
for (const k of used) ok(zk.has(k), `调用点键存在：${k}`);
for (let i = 1; i <= 3; i++) {
  for (const suffix of ["title", "desc"]) ok(zk.has(`home.how.${i}.${suffix}`), `home.how.${i}.${suffix}`);
}
for (let i = 1; i <= 4; i++) ok(zk.has(`about.p${i}.title`), `about.p${i}.title`);
for (let i = 1; i <= 4; i++) ok(zk.has(`home.refactor.${i}`), `home.refactor.${i}`);

group("04 t() 行为 / runtime");
I18N.setLang("zh");
ok(I18N.t("nav.map") === "知识地图", "t() 中文");
ok(I18N.t("search.resultCount", { n: 3 }) === "3 个结果", "t() 占位符替换");
I18N.setLang("en");
ok(I18N.t("nav.map") === "Knowledge map", "t() 英文");
ok(I18N.t("reader.minutes", { n: 9 }) === "9 min", "t() 英文占位符");
ok(I18N.L("中文", "English") === "English", "L() 英文");
ok(I18N.t("__missing__") === "__missing__", "缺失键回退为键名");
I18N.setLang("zh");
ok(I18N.L("中文", "English") === "中文", "L() 中文");
ok(I18N.lang === "zh", "lang getter");

group("05 静态页文案 / static html");
for (const key of ["nav.map", "nav.lab", "nav.about", "nav.searchPlaceholder", "common.paper", "common.ink", "common.resetProgress"]) {
  ok(html.includes(`data-i18n="${key}"`), `index.html 使用 ${key}`);
}
ok(!/<html[^>]+lang="[^"]*"\s+data-lang="en"/.test(html), "默认语言为中文");

console.log(`\n${fail ? "✗" : "✓"} 合计 / total: ${pass} 通过 passed, ${fail} 失败 failed (${(pass / (pass + fail) * 100).toFixed(2)}%)`);
if (fail) {
  console.error("\n失败项：\n - " + failures.join("\n - "));
  process.exit(1);
}
