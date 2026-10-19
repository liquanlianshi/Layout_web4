#!/usr/bin/env node
// =============================================================
// tools/build.mjs — 把 Markdown 讲义编译成 data/course.js
//  · 中英双语各自渲染
//  · 自动加标题锚点、代码块工具条、表格容器、提示框
//  · 生成目录、搜索索引、统计与完整性检查
// =============================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { marked, Renderer } from "marked";
import { CHAPTERS, SECTIONS } from "../content/meta.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MD = path.join(ROOT, "content", "md");
const OUT = path.join(ROOT, "data", "course.js");
const LANGS = ["zh", "en"];

const WIDGETS = new Set([
  "datagen", "dikw", "scales", "arrayops", "datajoin", "pipeline", "rollup",
  "tree", "events", "color", "widelong", "spaces", "curves", "slope",
  "marching", "timeattrs", "line", "calendar", "spiral", "storyline",
]);

const errors = [];
const warnings = [];
const stats = { sections: 0, code: 0, tables: 0, widgets: 0, widgetSet: new Set(), chars: { zh: 0, en: 0 } };

// ---------- 文本工具 ----------
const escapeHtml = (s) => s
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

const stripTags = (s) => s
  .replace(/<code[^>]*>/g, "")
  .replace(/<\/code>/g, "")
  .replace(/<[^>]+>/g, "")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&amp;/g, "&").replace(/&quot;/g, '"')
  .replace(/\s+/g, " ")
  .trim();

const LANG_LABEL = { js: "JavaScript", javascript: "JavaScript", html: "HTML", css: "CSS", json: "JSON", bash: "Shell", sh: "Shell", text: "Text", md: "Markdown", python: "Python", sql: "SQL" };

// ---------- 清理原始讲义 ----------
function cleanMarkdown(md) {
  let lines = md.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let skipDemo = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 去掉「配套 Demo / Companion Demo」小节（直到下一个 ### 或 ##）
    if (/^###\s+(配套 Demo|Companion Demo)/i.test(line)) {
      skipDemo = true;
      continue;
    }
    if (skipDemo) {
      if (/^#{2,3}\s/.test(line)) skipDemo = false;
      else continue;
    }

    // 去掉原始站点的「三 tab 集成页面」导语
    if (/^>\s*\*\*(本讲义配套|This lecture comes|This lecture is paired)/i.test(line)) continue;
    if (/^>\s*推荐教学用法|^>\s*Recommended teaching (usage|approach)/i.test(line)) continue;

    // 去掉指向旧 demo 的图片占位与链接
    if (/^>\s*.*(📷|img\/\d|Figure \d+ ·|图 \d+ ·)/i.test(line)) continue;
    if (/^\[`\.\/index\.html/.test(line)) continue;

    out.push(line);
  }

  let text = out.join("\n");

  // 去掉文末多余的分隔线与空标题
  text = text.replace(/^---\s*$/gm, "");
  text = text.replace(/^\s*\n{3,}/gm, "\n\n");
  return text.trim();
}

// ---------- 切分小节 ----------
function splitSections(md) {
  const lines = md.split("\n");
  const sections = [];
  let current = null;
  for (const line of lines) {
    const m = line.match(/^##\s+(\d+\.\d+)\s+(.+?)\s*$/);
    if (m) {
      if (current) sections.push(current);
      current = { num: m[1], title: m[2].replace(/[（(].*?[)）]\s*$/, "").trim(), rawTitle: m[2].trim(), lines: [] };
      continue;
    }
    if (/^##\s+/.test(line)) {
      // 非编号 H2：结束当前小节；后续内容（总结/提问）不进入任何小节
      if (current) sections.push(current);
      current = null;
      continue;
    }
    if (current) current.lines.push(line);
  }
  if (current) sections.push(current);
  return sections.map(s => ({ ...s, md: cleanMarkdown(s.lines.join("\n")) }));
}

// ---------- 标题分类 ----------
function classify(text) {
  const t = text.replace(/^[⭐\s]+/, "");
  if (/关键代码|Key Code/i.test(t)) return { kind: "code", label: "代码", labelEn: "Code" };
  if (/你的原案例|Your Original Case/i.test(t)) return { kind: "case", label: "案例", labelEn: "Case" };
  if (/嵌入|Embedded|理论|Theory/i.test(t)) return { kind: "theory", label: "理论", labelEn: "Theory" };
  if (/教学要点|小结|Teaching|Takeaway/i.test(t)) return { kind: "note", label: "小结", labelEn: "Takeaway" };
  if (/为什么|Why/i.test(t)) return { kind: "why", label: "追问", labelEn: "Why" };
  return { kind: "plain", label: "", labelEn: "" };
}

function cleanHeading(inner, kind) {
  let s = inner.replace(/^<span[^>]*>.*?<\/span>/, "");
  s = s.replace(/^⭐\s*/, "");
  if (kind === "code") {
    s = s.replace(/^(关键代码段?|Key Code Segment)\s*[:：]?\s*/i, "");
    s = s.replace(/^关键代码\s*/i, "");
    s = s.replace(/^([①②③④⑤⑥⑦⑧⑨])\s*[:：]\s*/, "$1 ");
  }
  if (kind === "case") {
    s = s.replace(/^(你的原案例|Your Original Case)\s*/i, "");
    s = s.replace(/^[（(]\s*/, "").replace(/\s*[)）]\s*$/, "");
  }
  if (kind === "theory") {
    s = s.replace(/^(嵌入(的)?理论|嵌入陈为教材理论|Embedded Theory|Embedded theory)\s*[:：]?\s*/i, "");
    s = s.replace(/^Embedded (Theory|theory)\s*[:：]?\s*/, "");
  }
  s = s.trim();
  return s;
}

// ---------- Markdown → HTML ----------
function renderMarkdown(md, lang, num) {
  const renderer = new Renderer();
  renderer.code = (code, infostring) => {
    const info = (infostring || "").trim().split(/\s+/)[0].toLowerCase();
    const key = info.replace(/^language-/, "");
    const label = LANG_LABEL[key] || (key ? key.toUpperCase() : "Text");
    const cls = key ? ` class="language-${key}"` : "";
    stats.code++;
    return `<div class="codeblock" data-lang="${key || "text"}">
<div class="codeblock__bar"><span class="codeblock__lang">${escapeHtml(label)}</span><button class="codeblock__copy" type="button" data-copy>${lang === "zh" ? "复制" : "Copy"}</button></div>
<pre class="codeblock__pre"><code${cls}>${escapeHtml(code)}</code></pre>
</div>`;
  };
  renderer.table = (header, body) => {
    stats.tables++;
    return `<div class="table-wrap"><table><thead>${header}</thead><tbody>${body}</tbody></table></div>`;
  };
  renderer.blockquote = (quote) => {
    const text = stripTags(quote);
    let kind = "note";
    if (/易错|坑|注意|Pitfall|Common bug|Common mistake/i.test(text)) kind = "warn";
    else if (/设计|Design|原则|Rule/i.test(text)) kind = "design";
    return `<blockquote class="callout callout--${kind}">${quote}</blockquote>`;
  };

  let html = marked.parse(md, { renderer, mangle: false, headerIds: false, gfm: true, breaks: false });

  // H3：加类型徽标、清洗标题、加锚点
  let hIndex = 0;
  const toc = [];
  html = html.replace(/<h3>(.*?)<\/h3>/gs, (_, inner) => {
    hIndex++;
    const text = stripTags(inner);
    const { kind, label, labelEn } = classify(text);
    const cleaned = cleanHeading(inner, kind);
    let clean = cleaned || stripTags(inner).replace(/^⭐\s*/, "");
    const generic = !cleaned;
    const id = `s-${num.replace(".", "-")}-h${hIndex}`;
    if (kind !== "plain" || clean) toc.push({ id, text: clean, kind });
    const badge = kind === "plain" || generic ? "" : `<span class="blk__badge blk__badge--${kind}">${lang === "zh" ? label : labelEn}</span>`;
    return `<h3 id="${id}" class="blk blk--${kind}">${badge}<span class="blk__text">${clean}</span></h3>`;
  });

  // 去掉空的段落
  html = html.replace(/<p>\s*<\/p>/g, "");
  return { html, toc };
}

// ---------- 主流程 ----------
const course = {
  generated: new Date().toISOString(),
  version: "1.0.0",
  chapters: [],
  sections: {},
  stats: {},
};

for (const ch of CHAPTERS) {
  const chapter = {
    id: ch.id, num: ch.num, color: ch.color, colorDark: ch.colorDark, icon: ch.icon,
    sections: ch.sections, zh: ch.zh, en: ch.en,
  };
  course.chapters.push(chapter);

  for (const lang of LANGS) {
    const file = path.join(MD, `${ch.id}.${lang}.md`);
    if (!fs.existsSync(file)) { errors.push(`缺少讲义文件 ${file}`); continue; }
    const raw = fs.readFileSync(file, "utf8");
    const parsed = splitSections(cleanMarkdown(raw));

    for (const sec of parsed) {
      const meta = SECTIONS[sec.num];
      if (!meta) { errors.push(`${ch.id} ${sec.num} 缺少 meta`); continue; }
      const localized = meta[lang];
      if (!localized) { errors.push(`${sec.num} 缺少 ${lang} 文案`); continue; }

      if (!course.sections[sec.num]) {
        course.sections[sec.num] = {
          id: sec.num, num: sec.num, chapter: ch.id, demo: meta.demo,
          minutes: meta.minutes, related: meta.related || [], zh: {}, en: {},
        };
        stats.sections++;
        if (meta.demo) {
          const base = meta.demo.split(":")[0];
          if (!WIDGETS.has(base)) errors.push(`${sec.num} 未注册的可视化组件: ${base}`);
          else stats.widgetSet.add(base);
        }
      }
      const { html, toc } = renderMarkdown(sec.md, lang, sec.num);
      const text = stripTags(html);
      const chars = text.replace(/\s/g, "").length;
      stats.chars[lang] += chars;
      course.sections[sec.num][lang] = {
        title: sec.title,
        rawTitle: sec.rawTitle,
        short: localized.short,
        subtitle: localized.subtitle,
        bigIdea: localized.bigIdea,
        points: localized.points,
        quiz: localized.quiz,
        html,
        toc,
        text,
        chars,
      };
    }
  }
}

// ---------- 校验 ----------
for (const ch of CHAPTERS) {
  for (const id of ch.sections) {
    const s = course.sections[id];
    if (!s) { errors.push(`章节 ${ch.id} 引用了不存在的 ${id}`); continue; }
    for (const lang of LANGS) {
      if (!s[lang]?.html?.trim()) errors.push(`${id}.${lang} 内容为空`);
      if (!s[lang]?.quiz) warnings.push(`${id}.${lang} 缺少自测`);
    }
  }
}
const expected = CHAPTERS.reduce((n, c) => n + c.sections.length, 0);
if (stats.sections !== expected) errors.push(`小节数 ${stats.sections} ≠ 预期 ${expected}`);

// 每章统计
for (const ch of course.chapters) {
  ch.minutes = ch.sections.reduce((n, id) => n + (course.sections[id]?.minutes || 0), 0);
  ch.chars = ch.sections.reduce((n, id) => n + (course.sections[id]?.zh.chars || 0), 0);
}

course.stats = {
  chapters: CHAPTERS.length,
  sections: stats.sections,
  widgets: stats.widgetSet.size,
  codeBlocks: stats.code,
  tables: stats.tables,
  charsZh: stats.chars.zh,
  charsEn: stats.chars.en,
  minutes: course.chapters.reduce((n, c) => n + c.minutes, 0),
};

// ---------- 数据集 ----------
function parseCSV(text) {
  const rows = text.replace(/^\uFEFF/, "").trim().split(/\r?\n/).map(line => line.split(","));
  const head = rows[0];
  return rows.slice(1).map(cols => Object.fromEntries(head.map((k, i) => [k, cols[i]])));
}
const num = (v) => (v === "" || v == null ? null : Number(v));
const newstudent = parseCSV(fs.readFileSync(path.join(ROOT, "data", "newstudent.csv"), "utf8")).map(d => ({
  id: num(d["序号"]), name: d["姓名"], gender: d["性别"], birthday: d["生日"],
  age: num(d["年龄"]), className: d["班级"], hometown: d["籍贯"], ethnicity: d["民族"],
}));
const crime = parseCSV(fs.readFileSync(path.join(ROOT, "data", "crime.csv"), "utf8")).map(d => {
  const o = { state: d.state };
  for (const k of Object.keys(d)) if (k !== "state") o[k] = num(d[k]);
  return o;
});
const weather = parseCSV(fs.readFileSync(path.join(ROOT, "data", "weather_2024.csv"), "utf8")).map(d => ({
  date: d.date, temp: num(d.temp_max), rain: num(d.rain_mm),
}));
const frenchNames = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "french_names.json"), "utf8"));
const storylineSrc = fs.readFileSync(path.join(ROOT, "data", "storyline.js"), "utf8");
const storyline = {};
new Function("window", storylineSrc)(storyline);

const DATASETS = path.join(ROOT, "data", "datasets.js");
fs.writeFileSync(DATASETS, `/* 由 tools/build.mjs 生成：把数据内嵌为 JS，保证 file:// 双击可用。 */\nwindow.DATA = ${JSON.stringify({
  newstudent, crime, weather, frenchNames, storyline: storyline.STORYLINE_DATA,
})};\n`, "utf8");
console.log(`✓ 数据内嵌 → ${path.relative(ROOT, DATASETS)} (${(fs.statSync(DATASETS).size / 1024).toFixed(0)} KB)`);

// ---------- 输出 ----------
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const payload = JSON.stringify(course).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
fs.writeFileSync(OUT, `/* 由 tools/build.mjs 生成，请勿手改。 */\nwindow.COURSE = ${payload};\n`, "utf8");

console.log(`✓ 构建完成 → ${path.relative(ROOT, OUT)}`);
console.log(`  章 ${course.stats.chapters} · 节 ${course.stats.sections} · 交互图 ${course.stats.widgets} · 代码块 ${course.stats.codeBlocks} · 表格 ${course.stats.tables}`);
console.log(`  中文字符 ${course.stats.charsZh} · 英文 ${course.stats.charsEn} · 建议学时 ${course.stats.minutes} 分钟`);
console.log(`  文件大小 ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
if (warnings.length) console.log(`\n⚠ ${warnings.length} 条提醒\n  - ` + warnings.join("\n  - "));
if (errors.length) {
  console.error(`\n✗ ${errors.length} 个错误\n  - ` + errors.join("\n  - "));
  process.exit(1);
}
