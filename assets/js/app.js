// =============================================================
// assets/js/app.js — 路由、渲染、进度、搜索、知识地图
// =============================================================
(function () {
  const COURSE = window.COURSE;
  const DATA = window.DATA;
  const S = COURSE.sections;
  const ORDER = COURSE.chapters.flatMap(c => c.sections);
  const CHAPTER_BY_ID = Object.fromEntries(COURSE.chapters.map(c => [c.id, c]));
  const SEC_CHAPTER = Object.fromEntries(ORDER.map(id => [id, S[id].chapter]));
  const PRELOAD = {};

  const $ = (sel) => document.querySelector(sel);
  const T = (k, v) => I18N.t(k, v);
  const L = (zh, en) => I18N.L(zh, en);
  const view = $("#view");
  const shell = $("#shell");
  const topProgress = $("#topProgress i");

  // ---------- 状态 ----------
  const savedProgress = U.store.get("vis4.progress", { done: [], quiz: {} });
  const state = {
    lang: U.store.get("vis4.lang", "zh") === "en" ? "en" : "zh",
    theme: U.store.get("vis4.theme", "paper") === "ink" ? "ink" : "paper",
    progress: {
      done: Array.isArray(savedProgress.done) ? savedProgress.done.filter(id => S[id]) : [],
      quiz: savedProgress.quiz && typeof savedProgress.quiz === "object" ? savedProgress.quiz : {},
    },
    route: null,
    last: U.store.get("vis4.last", "1.1"),
    collapsed: new Set(U.store.get("vis4.collapsed", [])),
    searchIndex: [],
    searchSel: 0,
    map: { selected: null, filter: "all", view: "graph" },
    toc: null,
    onScroll: null,
  };
  if (!S[state.last]) state.last = ORDER[0];

  function saveProgress() {
    U.store.set("vis4.progress", state.progress);
    U.store.set("vis4.last", state.last);
  }
  function isDone(id) { return state.progress.done.includes(id); }
  function doneCount() { return state.progress.done.filter(id => S[id]).length; }
  function markDone(id, val) {
    const set = new Set(state.progress.done);
    val ? set.add(id) : set.delete(id);
    state.progress.done = Array.from(set);
    saveProgress();
    refreshProgressUI();
  }
  function chapterDone(ch) { return ch.sections.filter(isDone).length; }
  function nextSection() {
    return ORDER.find(id => !isDone(id)) || ORDER[ORDER.length - 1];
  }
  function sectionOf(id) { return S[id] || S[ORDER[0]]; }
  function chapterOf(id) { return CHAPTER_BY_ID[SEC_CHAPTER[id]] || COURSE.chapters[0]; }
  function loc(sec) { return sec[state.lang] || sec.zh; }

  // ---------- 路由 ----------
  function parseRoute() {
    const raw = (location.hash || "#/").replace(/^#\/?/, "");
    const parts = raw.split("/").filter(Boolean);
    if (!parts.length) return { name: "home" };
    if (parts[0] === "read" && parts[1] && S[parts[1]]) return { name: "read", id: parts[1] };
    if (parts[0] === "map") return { name: "map" };
    if (parts[0] === "lab") return { name: "lab", tab: ["color", "channel", "time"].includes(parts[1]) ? parts[1] : "color" };
    if (parts[0] === "about") return { name: "about" };
    if (parts[0] === "read") return { name: "read", id: ORDER[0] };
    return { name: "home" };
  }
  function navigate(path, replace) {
    const hash = "#/" + path.replace(/^#?\/?/, "");
    if (location.hash === hash) { render(); return; }
    if (replace) history.replaceState(null, "", hash);
    else location.hash = hash;
  }

  // ---------- 主题 / 语言 ----------
  function applyTheme() {
    document.documentElement.setAttribute("data-theme", state.theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", state.theme === "ink" ? "#12100d" : "#f6f2e9");
    U.qsa("#themeSeg .seg__btn").forEach(b => b.classList.toggle("is-on", b.dataset.themeVal === state.theme));
  }
  function setTheme(t) {
    if (t === state.theme) return;
    state.theme = t === "ink" ? "ink" : "paper";
    U.store.set("vis4.theme", state.theme);
    applyTheme();
    const y = window.scrollY;
    render({ keepScroll: true, keepSide: true });
    requestAnimationFrame(() => window.scrollTo(0, y));
  }
  function setLang(l) {
    if (l === state.lang) return;
    state.lang = l === "en" ? "en" : "zh";
    U.store.set("vis4.lang", state.lang);
    I18N.setLang(state.lang);
    buildSearchIndex();
    buildSidenav();
    U.qsa("#langSeg .seg__btn").forEach(b => b.classList.toggle("is-on", b.dataset.langVal === state.lang));
    const y = window.scrollY;
    render({ keepScroll: true, keepSide: true });
    requestAnimationFrame(() => window.scrollTo(0, y));
  }

  // ---------- 小工具 ----------
  function chapterCode(ch) { return `CHAPTER ${String(ch.num).padStart(2, "0")}`; }
  function sectionLabel(id) { return `${id} ${loc(sectionOf(id)).short}`; }
  function ring(pct, size = 96, stroke = 7) {
    const r = (size - stroke) / 2, c = 2 * Math.PI * r;
    const offset = c * (1 - U.clamp(pct, 0, 1));
    return U.s("svg", { class: "progress-ring", viewBox: `0 0 ${size} ${size}`, "aria-hidden": "true" },
      U.s("circle", { class: "progress-ring__bg", cx: size / 2, cy: size / 2, r }),
      U.s("circle", { class: "progress-ring__fg", cx: size / 2, cy: size / 2, r, "stroke-dasharray": c, "stroke-dashoffset": offset }),
      U.s("text", { class: "progress-ring__text", x: size / 2, y: size / 2 + 4 }, `${Math.round(pct * 100)}`),
      U.s("text", { class: "progress-ring__sub", x: size / 2, y: size / 2 + 16 }, "%"),
    );
  }
  function scrollToEl(el) {
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 84;
    window.scrollTo({ top: y, behavior: "smooth" });
  }
  function copyLink() {
    U.copy(location.href).then(ok => U.toast(ok ? T("reader.linkCopied") : "复制失败"));
  }

  // ---------- 侧栏 ----------
  function buildSidenav() {
    const nav = $("#sideNav");
    nav.innerHTML = "";
    COURSE.chapters.forEach(ch => {
      const group = U.h("div", { class: "navgroup" + (state.collapsed.has(ch.id) ? " is-closed" : "") });
      const head = U.h("button", { class: "navgroup__head", type: "button", "aria-expanded": String(!state.collapsed.has(ch.id)) },
        U.h("span", { class: "navgroup__num" }, String(ch.num).padStart(2, "0")),
        U.h("span", { class: "navgroup__title" }, loc(ch).title),
        U.h("span", { class: "navgroup__count" }, `${ch.sections.filter(isDone).length}/${ch.sections.length}`),
        U.h("span", { class: "navgroup__chev" }, "▾"),
      );
      head.addEventListener("click", () => {
        group.classList.toggle("is-closed");
        const closed = group.classList.contains("is-closed");
        closed ? state.collapsed.add(ch.id) : state.collapsed.delete(ch.id);
        head.setAttribute("aria-expanded", String(!closed));
        U.store.set("vis4.collapsed", Array.from(state.collapsed));
      });
      const ul = U.h("ul", { class: "navgroup__sections" });
      ch.sections.forEach(id => {
        const sec = S[id];
        ul.appendChild(U.h("li", {},
          U.h("a", { class: "navlink" + (isDone(id) ? " is-done" : ""), href: `#/read/${id}`, "data-nav": id },
            U.h("span", { class: "navlink__num" }, id),
            U.h("span", { class: "navlink__title" }, loc(sec).short),
            U.h("span", { class: "navlink__dot", "aria-hidden": "true" }))));
      });
      group.appendChild(head);
      group.appendChild(ul);
      nav.appendChild(group);
    });
    nav.onclick = (e) => {
      if (e.target.closest("[data-nav]")) closeSide();
    };
    updateSideProgress();
  }

  function updateSideProgress() {
    const done = doneCount(), total = ORDER.length;
    const pct = total ? done / total : 0;
    $("#sideDone").textContent = done;
    $("#sideTotal").textContent = total;
    $("#sideBar").style.width = `${pct * 100}%`;
    U.qsa("#sideNav .navlink").forEach(a => a.classList.toggle("is-done", isDone(a.dataset.nav)));
    U.qsa("#sideNav .navgroup").forEach((g, i) => {
      const ch = COURSE.chapters[i];
      if (!ch) return;
      const c = g.querySelector(".navgroup__count");
      if (c) c.textContent = `${chapterDone(ch)}/${ch.sections.length}`;
    });
  }

  function updateActiveNav() {
    const id = state.route?.name === "read" ? state.route.id : null;
    U.qsa("#sideNav .navlink").forEach(a => a.classList.toggle("is-on", a.dataset.nav === id));
    U.qsa(".topnav__link").forEach(a => a.classList.remove("is-on"));
    if (state.route?.name === "map") U.qsa('.topnav__link[href="#/map"]').forEach(a => a.classList.add("is-on"));
    if (state.route?.name === "lab") U.qsa('.topnav__link[href="#/lab"]').forEach(a => a.classList.add("is-on"));
    if (state.route?.name === "about") U.qsa('.topnav__link[href="#/about"]').forEach(a => a.classList.add("is-on"));
  }

  function closeSide() {
    document.body.classList.remove("side-open");
    const scrim = $("#scrim");
    if (scrim) scrim.hidden = true;
  }
  function openSide() {
    document.body.classList.add("side-open");
    const scrim = $("#scrim");
    if (scrim) scrim.hidden = false;
  }

  // ---------- 面包屑 ----------
  function renderCrumbs() {
    const box = $("#crumbs");
    box.innerHTML = "";
    const add = (label, href) => {
      if (box.children.length) box.appendChild(U.h("span", { class: "crumbs__sep" }, "/"));
      box.appendChild(href ? U.h("a", { href }, label) : U.h("span", { class: "crumbs__now" }, label));
    };
    add(T("nav.home"), "#/");
    const r = state.route;
    if (r.name === "read") {
      const ch = chapterOf(r.id);
      add(`${T("common.chapter")} ${ch.num} · ${loc(ch).title}`, `#/read/${ch.sections[0]}`);
      add(`${r.id} ${loc(sectionOf(r.id)).short}`);
    } else if (r.name === "map") add(T("nav.map"));
    else if (r.name === "lab") add(T("nav.lab"));
    else if (r.name === "about") add(T("nav.about"));
  }

  // ---------- 首页 ----------
  function spark(kind, w = 180, h = 64) {
    const c = U.colors();
    const svg = U.s("svg", { viewBox: `0 0 ${w} ${h}`, width: "100%", role: "img", "aria-hidden": "true" });
    if (kind === "bar") {
      const vals = [26, 38, 31, 48, 42, 55];
      vals.forEach((v, i) => svg.appendChild(U.s("rect", { x: 8 + i * 27, y: h - 8 - v, width: 17, height: v, fill: i === 5 ? c.accent : c.paper4 })));
    } else if (kind === "pipeline") {
      [0, 1, 2, 3].forEach(i => {
        svg.appendChild(U.s("rect", { x: 6 + i * 42, y: 20, width: 30, height: 24, fill: i === 1 ? c.accent : "none", stroke: i === 1 ? c.accent : c.line }));
        if (i < 3) svg.appendChild(U.s("path", { d: `M${38 + i * 42},32 h7 m-3,-2 l3,2 l-3,2`, stroke: c.ink3, fill: "none" }));
      });
    } else if (kind === "color") {
      ["#000000", "#E69F00", "#56B4E9", "#009E73", "#F0E442", "#0072B2", "#D55E00", "#CC79A7"].forEach((col, i) => {
        svg.appendChild(U.s("rect", { x: 8 + i * 20, y: 14, width: 18, height: 36, fill: col }));
      });
    } else if (kind === "scatter") {
      const rnd = d3.randomNormal(0, 1);
      for (let i = 0; i < 26; i++) {
        const x = 14 + Math.abs(rnd()) * 80, y = h - 10 - Math.abs(rnd()) * 36 - x * .12;
        svg.appendChild(U.s("circle", { cx: Math.min(x, w - 10), cy: Math.max(8, Math.min(y, h - 8)), r: 2.4, fill: c.accent, opacity: .7 }));
      }
    } else if (kind === "spiral") {
      const cx = w / 2, cy = h / 2;
      const pts = d3.range(0, 540, 4).map(deg => {
        const th = deg * Math.PI / 180, r = 4 + deg / 40;
        return [cx + r * Math.cos(th), cy + r * Math.sin(th)];
      });
      svg.appendChild(U.s("path", { d: d3.line()(pts), fill: "none", stroke: c.accent, "stroke-width": 1.2 }));
    } else if (kind === "tree") {
      const nodes = [[w / 2, 12], [w / 2 - 40, 34], [w / 2 + 40, 34], [w / 2 - 60, 56], [w / 2 - 20, 56], [w / 2 + 40, 56]];
      nodes.slice(1).forEach(n => svg.appendChild(U.s("line", { x1: w / 2, y1: 12, x2: n[0], y2: n[1], stroke: c.line })));
      nodes.forEach((n, i) => svg.appendChild(U.s("circle", { cx: n[0], cy: n[1], r: i === 0 ? 4 : 2.5, fill: i === 0 ? c.accent : c.ink3 })));
    }
    return svg;
  }

  function renderHome() {
    const done = doneCount(), total = ORDER.length, pct = total ? done / total : 0;
    const next = nextSection();
    const root = U.h("div", { class: "home" });

    const hero = U.h("section", { class: "hero" });
    const heroL = U.h("div", {});
    heroL.appendChild(U.h("div", { class: "hero__eyebrow" }, T("home.eyebrow")));
    heroL.appendChild(U.h("h1", { class: "hero__title", html: L("可视化<br><em>导论</em>", "Visualization<br><em>Rebuilt</em>") }));
    heroL.appendChild(U.h("div", { class: "hero__en" }, T("home.titleEn")));
    heroL.appendChild(U.h("p", { class: "hero__sub" }, T("home.subtitle")));
    const cta = U.h("div", { class: "hero__cta" },
      U.h("a", { class: "btn btn--primary btn--lg", href: `#/read/${done ? next : ORDER[0]}` }, done ? `${T("home.cta.continue")} · ${next}` : T("home.cta.start")),
      U.h("a", { class: "btn btn--lg", href: "#/map" }, T("home.cta.map")),
      U.h("a", { class: "btn btn--ghost btn--lg", href: "#/lab" }, T("home.cta.lab")),
    );
    heroL.appendChild(cta);
    const stats = U.h("div", { class: "hero__stats" });
    [[COURSE.stats.chapters, T("home.stats.chapters")], [COURSE.stats.sections, T("home.stats.sections")], [COURSE.stats.widgets, T("home.stats.widgets")], [COURSE.stats.minutes, T("home.stats.minutes")], [2, T("home.stats.langs")]].forEach(([n, label]) => {
      stats.appendChild(U.h("div", { class: "hero__stat" }, U.h("b", {}, n), U.h("span", {}, label)));
    });
    heroL.appendChild(stats);
    hero.appendChild(heroL);

    const plate = U.h("div", { class: "plate" });
    plate.appendChild(U.h("div", { class: "plate__head" },
      U.h("span", { class: "plate__label" }, "PLATE I · THE COURSE IN FIVE FIGURES"),
      U.h("span", { class: "plate__caption" }, L("五章，五个视觉问题", "Five chapters, five visual questions"))));
    const grid = U.h("div", { class: "plate__grid" });
    const cells = [
      { kind: "bar", ch: 1, label: L("数据", "Data"), wide: false },
      { kind: "pipeline", ch: 2, label: L("流程", "Pipeline"), wide: true },
      { kind: "color", ch: 3, label: L("色彩", "Color"), wide: false },
      { kind: "scatter", ch: 4, label: L("低维", "Low-dim"), wide: false },
      { kind: "spiral", ch: 5, label: L("时序", "Time"), wide: true },
    ];
    cells.forEach(cell => {
      const el = U.h("div", { class: "plate__cell" + (cell.wide ? " plate__cell--wide" : "") });
      el.appendChild(U.h("span", { class: "plate__num" }, `0${cell.ch}`));
      el.appendChild(spark(cell.kind, 180, 64));
      el.appendChild(U.h("div", { style: "display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:8px;color:var(--ink-3);margin-top:2px" },
        U.h("span", {}, cell.label), U.h("a", { href: `#/read/${COURSE.chapters[cell.ch - 1].sections[0]}`, style: "color:inherit" }, "↗")));
      grid.appendChild(el);
    });
    plate.appendChild(grid);
    plate.appendChild(U.h("div", { class: "plate__foot" },
      U.h("span", {}, "5 CHAPTERS · 27 SECTIONS"),
      U.h("span", {}, "REBUILT · 2026")));
    hero.appendChild(plate);
    root.appendChild(hero);

    // 课程结构
    root.appendChild(U.h("div", { class: "section-head" },
      U.h("div", {}, U.h("h2", {}, T("home.chapters.title")), U.h("p", {}, T("home.chapters.lead"))),
      U.h("span", { class: "section-head__num" }, "01 — 05")));

    const cols = U.h("div", { class: "home__cols" });
    const chapters = U.h("div", { class: "chapters" });
    COURSE.chapters.forEach((ch, i) => {
      const cd = chapterDone(ch);
      const card = U.h("article", { class: "chapter-card" + (i === COURSE.chapters.length - 1 ? " chapter-card--full" : "") });
      card.appendChild(U.h("div", { class: "chapter-card__top" },
        U.h("span", { class: "chapter-card__num" }, String(ch.num).padStart(2, "0")),
        U.h("span", { class: "chapter-card__tag" }, `${cd}/${ch.sections.length} · ${ch.minutes} ${T("common.min")}`)));
      card.appendChild(U.h("h3", {}, loc(ch).title));
      card.appendChild(U.h("p", { class: "chapter-card__blurb" }, loc(ch).blurb));
      const secs = U.h("div", { class: "chapter-card__secs" });
      ch.sections.forEach(id => {
        secs.appendChild(U.h("a", { class: "chapter-card__sec" + (isDone(id) ? " is-done" : ""), href: `#/read/${id}`, title: loc(S[id]).short }, `${id} ${loc(S[id]).short}`));
      });
      card.appendChild(secs);
      card.appendChild(U.h("div", { class: "chapter-card__bar" }, U.h("i", { style: `width:${ch.sections.length ? cd / ch.sections.length * 100 : 0}%` })));
      card.appendChild(U.h("div", { class: "chapter-card__meta" },
        U.h("span", {}, loc(ch).short.toUpperCase()),
        U.h("a", { href: `#/read/${ch.sections[0]}`, style: "color:var(--ink-3)" }, `${T("common.start")} →`)));
      chapters.appendChild(card);
    });
    cols.appendChild(chapters);

    const side = U.h("div", { class: "home__side" });
    const pc = U.h("div", { class: "progress-card" });
    pc.appendChild(U.h("div", { class: "progress-card__ring" },
      ring(pct, 96),
      U.h("div", {},
        U.h("div", { class: "progress-card__num" }, done, U.h("span", {}, ` / ${total}`)),
        U.h("div", { class: "progress-card__label" }, T("home.progress.done")))));
    const bars = U.h("div", { class: "chapter-bars" });
    COURSE.chapters.forEach(ch => {
      const cd = chapterDone(ch);
      bars.appendChild(U.h("div", { class: "chapter-bar" },
        U.h("b", {}, String(ch.num).padStart(2, "0")),
        U.h("span", { class: "chapter-bar__track" }, U.h("i", { style: `width:${ch.sections.length ? cd / ch.sections.length * 100 : 0}%` })),
        U.h("em", {}, `${cd}/${ch.sections.length}`)));
    });
    pc.appendChild(bars);
    pc.appendChild(U.h("div", { class: "progress-card__next" },
      U.h("div", { class: "small" }, T("home.progress.next")),
      U.h("a", { href: `#/read/${next}` }, `${next} · ${loc(sectionOf(next)).short}`)));
    side.appendChild(pc);
    side.appendChild(U.h("div", { class: "quote-card" },
      U.h("p", {}, T("home.quote")),
      U.h("span", {}, T("home.quoteBy"))));
    cols.appendChild(side);
    root.appendChild(cols);

    // 使用方式
    root.appendChild(U.h("div", { class: "section-head" }, U.h("div", {}, U.h("h2", {}, T("home.how.title")))));
    const how = U.h("div", { class: "how-grid" });
    [1, 2, 3].forEach(i => how.appendChild(U.h("div", { class: "how-card" },
      U.h("div", { class: "how-card__num" }, `0${i}`),
      U.h("h4", {}, T(`home.how.${i}.title`)),
      U.h("p", {}, T(`home.how.${i}.desc`)))));
    root.appendChild(how);

    // 重构说明
    const band = U.h("section", { class: "refactor-band" });
    band.appendChild(U.h("div", { class: "refactor-band__left" },
      U.h("h3", {}, T("home.refactor.title")),
      U.h("p", {}, T("home.refactor.lead"))));
    const right = U.h("div", { class: "refactor-band__right" });
    const list = U.h("ul", { class: "refactor-list" });
    [1, 2, 3, 4].forEach(i => list.appendChild(U.h("li", {}, U.h("b", {}, `0${i}`), U.h("span", {}, T(`home.refactor.${i}`)))));
    right.appendChild(list);
    right.appendChild(U.h("a", { class: "refactor-band__link", href: "#/about" }, `${T("home.refactor.link")} →`));
    band.appendChild(right);
    root.appendChild(band);

    view.appendChild(root);
  }

  // ---------- 阅读器 ----------
  function renderReader(id) {
    state.last = id;
    U.store.set("vis4.last", id);
    const sec = sectionOf(id), lo = loc(sec), ch = chapterOf(id);
    const codeCount = (lo.html.match(/class="codeblock"/g) || []).length;
    const idx = ORDER.indexOf(id);
    const prev = idx > 0 ? ORDER[idx - 1] : null;
    const next = idx < ORDER.length - 1 ? ORDER[idx + 1] : null;

    const root = U.h("div", { class: "reader" });
    const main = U.h("article", { class: "reader__main", id: "article" });

    const head = U.h("header", { class: "sec-head" });
    head.appendChild(U.h("div", { class: "sec-head__ghost", "aria-hidden": "true" }, String(ch.num).padStart(2, "0")));
    head.appendChild(U.h("div", { class: "sec-head__eyebrow" }, `${chapterCode(ch)} · SECTION ${id}`));
    head.appendChild(U.h("h1", {}, lo.title));
    head.appendChild(U.h("p", { class: "sec-head__sub" }, lo.subtitle));
    head.appendChild(U.h("div", { class: "sec-head__meta" },
      U.h("span", {}, U.h("b", {}, `${sec.minutes}`), ` ${T("common.minutes")}`),
      U.h("span", {}, `${lo.points.length} ${L("个要点", "key points")}`),
      U.h("span", {}, `${codeCount} ${L("个代码块", codeCount === 1 ? "code block" : "code blocks")}`),
      U.h("span", {}, L("1 个交互实验", "1 interactive experiment")),
      U.h("span", { class: "dim" }, `${lo.chars.toLocaleString("en-US")} ${L("字", "chars")}`)));
    const actions = U.h("div", { class: "sec-head__actions" },
      U.h("button", { class: "iconbtn", type: "button", title: T("reader.copyLink"), "aria-label": T("reader.copyLink"), onclick: copyLink }, "⧉"));
    head.appendChild(actions);
    main.appendChild(head);

    // 速览
    const quick = U.h("section", { class: "quick" });
    quick.appendChild(U.h("div", { class: "quick__idea" },
      U.h("div", { class: "quick__label" }, T("reader.bigIdea")),
      U.h("p", {}, lo.bigIdea)));
    const points = U.h("div", { class: "quick__points" });
    lo.points.forEach((p, i) => points.appendChild(U.h("div", { class: "quick__point" },
      U.h("b", {}, `0${i + 1}`), p)));
    quick.appendChild(points);
    quick.appendChild(U.h("div", { class: "quick__demo" },
      U.h("span", {}, T("reader.demoHint")),
      U.h("a", { href: "#", "data-scroll": "demo", onclick: (e) => { e.preventDefault(); scrollToEl(U.qs("#demo")); } }, `${L("跳到实验", "jump to experiment")} ↓`)));
    main.appendChild(quick);

    // 正文
    // 交互（放在讲义之前：先动手，再读原理）
    const fig = U.h("figure", { class: "viz", id: "demo" });
    fig.appendChild(U.h("figcaption", { class: "viz__head" },
      U.h("span", { class: "viz__plate" }, `FIG. ${id}`),
      U.h("span", { class: "viz__title" }, T("reader.demo")),
      U.h("span", { class: "viz__lead" }, T("reader.demoHint"))));
    const wbody = U.h("div", { class: "viz__body" });
    fig.appendChild(wbody);
    main.appendChild(fig);

    const prose = U.h("div", { class: "prose" });
    prose.innerHTML = lo.html;
    main.appendChild(prose);

    // 自测
    main.appendChild(buildQuiz(id, lo.quiz));

    // 上下页
    const pager = U.h("nav", { class: "pager", "aria-label": "pager" });
    pager.appendChild(prev ? U.h("a", { class: "pager__link", href: `#/read/${prev}` },
      U.h("span", { class: "pager__label" }, `← ${T("reader.prev")}`),
      U.h("span", { class: "pager__num" }, prev),
      U.h("span", { class: "pager__title" }, loc(S[prev]).short)) : U.h("span", { class: "pager__link is-off" }, U.h("span", { class: "pager__label" }, T("reader.first"))));
    pager.appendChild(next ? U.h("a", { class: "pager__link pager__link--next", href: `#/read/${next}` },
      U.h("span", { class: "pager__label" }, `${T("reader.next")} →`),
      U.h("span", { class: "pager__num" }, next),
      U.h("span", { class: "pager__title" }, loc(S[next]).short)) : U.h("span", { class: "pager__link pager__link--next is-off" }, U.h("span", { class: "pager__label" }, T("reader.last"))));
    main.appendChild(pager);
    root.appendChild(main);

    // 右侧栏
    const rail = U.h("aside", { class: "reader__rail" });
    const sticky = U.h("div", { class: "rail__sticky" });
    const tocBlock = U.h("div", { class: "rail__block" });
    tocBlock.appendChild(U.h("div", { class: "rail__label" }, T("reader.toc")));
    const toc = U.h("ol", { class: "rail__toc" });
    toc.appendChild(U.h("li", { class: "is-code" }, U.h("a", { href: "#", "data-target": "article", onclick: (e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); } }, L("概览", "Overview"))));
    lo.toc.forEach(h => toc.appendChild(U.h("li", { class: h.kind === "code" ? "is-code" : "" },
      U.h("a", { href: "#", "data-target": h.id, onclick: (e) => { e.preventDefault(); scrollToEl(document.getElementById(h.id)); } }, h.text))));
    tocBlock.appendChild(toc);
    sticky.appendChild(tocBlock);

    const prog = U.h("div", { class: "rail__block rail__progress" });
    prog.appendChild(U.h("div", { class: "rail__label" }, T("reader.progress")));
    const doneBtn = U.h("button", { class: "rail__donebtn" + (isDone(id) ? " is-done" : ""), type: "button", onclick: () => { const v = !isDone(id); markDone(id, v); updateDoneBtn(doneBtn, id); if (v) U.toast(T("reader.done")); } },
      U.h("span", { class: "tick" }, isDone(id) ? "✓" : "○"),
      U.h("span", {}, isDone(id) ? T("reader.markUndone") : T("reader.markDone")));
    prog.appendChild(doneBtn);
    prog.appendChild(U.h("div", { class: "rail__hint" }, T("reader.autoSaved")));
    sticky.appendChild(prog);

    const rel = sec.related.filter(x => S[x]);
    if (rel.length) {
      const rb = U.h("div", { class: "rail__block" });
      rb.appendChild(U.h("div", { class: "rail__label" }, T("reader.related")));
      const rw = U.h("div", { class: "rail__related" });
      rel.forEach(x => rw.appendChild(U.h("a", { class: "chip", href: `#/read/${x}` }, `${x} ${loc(S[x]).short}`)));
      rb.appendChild(rw);
      sticky.appendChild(rb);
    }
    rail.appendChild(sticky);
    root.appendChild(rail);
    view.appendChild(root);

    // 挂载交互图
    CORE.mountWidget(wbody, sec.demo, { lang: state.lang });

    // 代码高亮
    if (window.Prism) {
      try { Prism.highlightAllUnder(view); } catch (e) { console.warn("Prism", e); }
    }

    // TOC 高亮
    setupToc(lo, toc);
  }

  function updateDoneBtn(btn, id) {
    const done = isDone(id);
    btn.classList.toggle("is-done", done);
    btn.querySelector(".tick").textContent = done ? "✓" : "○";
    btn.querySelector("span:last-child").textContent = done ? T("reader.markUndone") : T("reader.markDone");
  }

  function setupToc(lo, tocEl) {
    const links = U.qsa("a[data-target]", tocEl);
    const headings = lo.toc.map(h => document.getElementById(h.id)).filter(Boolean);
    state.onScroll = () => {
      let current = null;
      for (const h of headings) {
        if (h.getBoundingClientRect().top < 130) current = h.id;
        else break;
      }
      links.forEach(a => a.classList.toggle("is-on", a.dataset.target === current));
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      topProgress.style.width = max > 0 ? `${U.clamp(window.scrollY / max, 0, 1) * 100}%` : "0%";
    };
    state.onScroll();
  }

  // ---------- 自测 ----------
  function buildQuiz(id, quiz) {
    const box = U.h("section", { class: "quiz", "aria-label": T("reader.quiz") });
    box.appendChild(U.h("div", { class: "quiz__head" },
      U.h("span", { class: "quiz__title" }, T("reader.quiz")),
      U.h("span", { class: "quiz__count" }, `1 / 1 · ${id}`)));
    const body = U.h("div", { class: "quiz__body" });
    body.appendChild(U.h("div", { class: "quiz__q" }, quiz.q));
    const optBox = U.h("div", { role: "radiogroup" });
    const why = U.h("div", { class: "quiz__why", hidden: true });
    const foot = U.h("div", { class: "quiz__foot" });
    const verdict = U.h("span", { class: "quiz__verdict" });
    const retry = U.h("button", { class: "quiz__retry", type: "button" }, T("reader.quiz.retry"));
    foot.appendChild(verdict); foot.appendChild(retry);
    body.appendChild(optBox); body.appendChild(why); body.appendChild(foot);
    box.appendChild(body);

    const saved = state.progress.quiz[id];
    let chosen = typeof saved === "number" ? saved : (saved && typeof saved.selected === "number" ? saved.selected : null);

    function paint() {
      U.clear(optBox);
      quiz.options.forEach((opt, i) => {
        const answered = chosen != null;
        const cls = "quiz__opt" + (answered && i === quiz.answer ? " is-correct" : "") + (answered && i === chosen && i !== quiz.answer ? " is-wrong" : "");
        const b = U.h("button", { class: cls, type: "button", disabled: answered ? "disabled" : null, role: "radio", "aria-checked": String(chosen === i), onclick: () => { chosen = i; state.progress.quiz[id] = i; saveProgress(); paint(); } },
          U.h("span", { class: "quiz__key" }, String.fromCharCode(65 + i)),
          U.h("span", {}, opt));
        optBox.appendChild(b);
      });
      if (chosen != null) {
        const ok = chosen === quiz.answer;
        verdict.className = "quiz__verdict " + (ok ? "is-ok" : "is-no");
        verdict.textContent = ok ? `✓ ${T("reader.quiz.correct")}` : `✕ ${T("reader.quiz.wrong")} · ${L("正确答案是", "answer is")} ${String.fromCharCode(65 + quiz.answer)}`;
        why.hidden = false;
        U.clear(why);
        why.appendChild(U.h("b", {}, T("reader.quiz.why")));
        why.appendChild(U.h("span", {}, quiz.why));
        retry.hidden = false;
      } else {
        verdict.className = "quiz__verdict";
        verdict.textContent = "";
        why.hidden = true;
        retry.hidden = true;
      }
    }
    retry.addEventListener("click", () => { chosen = null; delete state.progress.quiz[id]; saveProgress(); paint(); });
    paint();
    return box;
  }

  // ---------- 搜索 ----------
  function plain(html) {
    const d = document.createElement("div");
    d.innerHTML = html;
    return (d.textContent || "").replace(/\s+/g, " ").trim();
  }
  function buildSearchIndex() {
    state.searchIndex = ORDER.map(id => {
      const sec = S[id], lo = loc(sec), ch = chapterOf(id);
      return {
        id, title: lo.title, short: lo.short, subtitle: lo.subtitle, bigIdea: lo.bigIdea,
        points: lo.points.join(" "), text: plain(lo.html), chapter: `${ch.num} · ${loc(ch).title}`,
      };
    });
  }
  function scoreItem(item, q) {
    const toks = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!toks.length) return 0;
    const title = item.title.toLowerCase(), short = item.short.toLowerCase(), sub = item.subtitle.toLowerCase(), pts = item.points.toLowerCase(), text = item.text.toLowerCase();
    let total = 0;
    for (const tok of toks) {
      let s = 0;
      if (title === tok) s += 120;
      else if (title.startsWith(tok)) s += 70;
      else if (title.includes(tok)) s += 50;
      if (short.includes(tok)) s += 30;
      if (sub.includes(tok)) s += 22;
      if (pts.includes(tok)) s += 16;
      const count = text.split(tok).length - 1;
      if (count) s += Math.min(20, 3 + count * 2);
      if (!s) return 0;
      total += s;
    }
    return total;
  }
  function excerpt(item, q) {
    const text = item.text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx < 0) return text.slice(0, 90) + "…";
    const start = Math.max(0, idx - 28);
    return (start ? "…" : "") + text.slice(start, start + 100) + "…";
  }
  function highlight(text, q) {
    if (!q) return U.esc(text);
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return U.esc(text);
    return U.esc(text.slice(0, i)) + `<mark class="palette__mark">${U.esc(text.slice(i, i + q.length))}</mark>` + U.esc(text.slice(i + q.length));
  }
  function openPalette() {
    const p = $("#palette");
    if (!p) return;
    p.hidden = false;
    document.body.classList.add("palette-open");
    const input = $("#paletteInput");
    input.value = "";
    state.searchSel = 0;
    renderSearch("");
    setTimeout(() => input.focus(), 30);
  }
  function closePalette() {
    const p = $("#palette");
    if (!p) return;
    p.hidden = true;
    document.body.classList.remove("palette-open");
  }
  function renderSearch(q) {
    const box = $("#paletteResults"), hint = $("#paletteHint");
    const query = q.trim();
    if (!query) {
      hint.textContent = T("search.hint");
      box.innerHTML = "";
      box.appendChild(U.h("div", { class: "palette__empty" },
        U.h("b", {}, T("search.empty")),
        U.h("div", { style: "margin-top:4px" }, T("search.emptyHint")),
        U.h("div", { class: "palette__sugg" }, ["视觉通道", "rollup", "CVD", "Marching Squares", "Data-Join", "45°"].map(s => U.h("button", { class: "chip", type: "button", onclick: () => { $("#paletteInput").value = s; renderSearch(s); } }, s)))));
      return;
    }
    const results = state.searchIndex.map(item => ({ item, score: scoreItem(item, query) })).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 12);
    hint.textContent = T("search.resultCount", { n: results.length });
    box.innerHTML = "";
    if (!results.length) {
      box.appendChild(U.h("div", { class: "palette__empty" },
        U.h("b", {}, T("search.noResult", { q: query })),
        U.h("div", { style: "margin-top:4px" }, T("search.noResultHint"))));
      return;
    }
    results.forEach((r, i) => {
      const item = r.item;
      const btn = U.h("button", { class: "palette__item" + (i === state.searchSel ? " is-on" : ""), type: "button", role: "option", "aria-selected": String(i === state.searchSel), onclick: () => { closePalette(); navigate(`read/${item.id}`); } },
        U.h("span", { class: "palette__num" }, item.id),
        U.h("span", { class: "palette__body" },
          U.h("span", { class: "palette__title" }, highlight(item.title, query)),
          U.h("span", { class: "palette__excerpt", html: highlight(excerpt(item, query), query) })),
        U.h("span", { class: "palette__chapter" }, item.chapter));
      box.appendChild(btn);
    });
  }
  document.getElementById("paletteInput")?.addEventListener("input", (e) => { state.searchSel = 0; renderSearch(e.target.value); });
  document.getElementById("paletteInput")?.addEventListener("keydown", (e) => {
    const items = U.qsa(".palette__item");
    if (e.key === "ArrowDown") { e.preventDefault(); state.searchSel = Math.min(items.length - 1, state.searchSel + 1); renderSearch(e.target.value); }
    else if (e.key === "ArrowUp") { e.preventDefault(); state.searchSel = Math.max(0, state.searchSel - 1); renderSearch(e.target.value); }
    else if (e.key === "Enter") { e.preventDefault(); items[state.searchSel]?.click(); }
  });

  // ---------- 知识地图 ----------
  function renderMap() {
    const root = U.h("div", { class: "map-page" });
    const main = U.h("div", { class: "map-main" });
    const head = U.h("div", { class: "map-head" });
    head.appendChild(U.h("div", {},
      U.h("div", { class: "tag" }, "CONCEPT MAP"),
      U.h("h1", {}, T("map.title")),
      U.h("p", {}, T("map.lead"))));
    const tools = U.h("div", { class: "map-tools" });
    const filterBtn = U.h("button", { class: "btn btn--sm" + (state.map.filter === "unfinished" ? " btn--primary" : ""), type: "button" }, T("map.unfinished"));
    filterBtn.addEventListener("click", () => { state.map.filter = state.map.filter === "all" ? "unfinished" : "all"; render(); });
    tools.appendChild(filterBtn);
    tools.appendChild(U.h("button", { class: "btn btn--sm btn--ghost", type: "button", onclick: () => { state.map.selected = null; state.map.filter = "all"; render(); } }, T("map.reset")));
    tools.appendChild(U.h("button", { class: "btn btn--sm btn--ghost", type: "button", onclick: () => { state.map.view = state.map.view === "graph" ? "list" : "graph"; render(); } }, state.map.view === "graph" ? T("map.viewList") : T("map.viewGraph")));
    head.appendChild(tools);
    main.appendChild(head);

    const canvas = U.h("div", { class: "map-canvas" });
    const legend = U.h("div", { class: "map-legend" });
    COURSE.chapters.forEach(ch => legend.appendChild(U.h("span", {}, U.h("i", { style: `background:${state.theme === "ink" ? ch.colorDark : ch.color}` }), `${ch.num} ${loc(ch).short}`)));
    legend.appendChild(U.h("span", {}, U.h("i", { style: "background:var(--accent-2)" }), T("map.done")));
    canvas.appendChild(legend);
    canvas.appendChild(U.h("div", { class: "map-hint" }, T("map.zoomHint")));
    main.appendChild(canvas);
    root.appendChild(main);

    const aside = U.h("aside", { class: "map-aside" });
    root.appendChild(aside);

    if (state.map.view === "list") {
      canvas.classList.add("map-canvas--list");
      canvas.innerHTML = "";
      canvas.appendChild(renderMapList());
    } else {
      drawMapGraph(canvas);
    }
    renderMapAside(aside);
    view.appendChild(root);
  }

  function renderMapList() {
    const box = U.h("div", { class: "maplist" });
    COURSE.chapters.forEach(ch => {
      const sec = U.h("section", { class: "maplist__ch" });
      sec.appendChild(U.h("h2", {}, U.h("span", { style: `color:${ch.color}` }, String(ch.num).padStart(2, "0")), " ", loc(ch).title, U.h("small", {}, ` ${chapterDone(ch)}/${ch.sections.length}`)));
      sec.appendChild(U.h("p", { class: "mini-note" }, loc(ch).blurb));
      const list = U.h("div", { class: "maplist__secs" });
      ch.sections.forEach(id => list.appendChild(U.h("a", { class: "maplist__item" + (isDone(id) ? " is-done" : ""), href: `#/read/${id}` },
        U.h("b", {}, id), U.h("span", {}, loc(S[id]).short), U.h("i", {}, isDone(id) ? "✓" : "→"))));
      sec.appendChild(list);
      box.appendChild(sec);
    });
    return box;
  }

  function drawMapGraph(canvas) {
    const c = U.colors();
    const W = 1100, H = 760, cx = W / 2, cy = H / 2 + 6;
    const R = 218;
    const positions = {};
    const chapterPos = {};
    COURSE.chapters.forEach((ch, i) => {
      const a = -Math.PI / 2 + i * (Math.PI * 2 / COURSE.chapters.length);
      const x = cx + R * 1.06 * Math.cos(a), y = cy + R * .92 * Math.sin(a);
      chapterPos[ch.id] = { x, y, a, ch };
      positions[ch.id] = { x, y, type: "chapter", ch };
      const n = ch.sections.length;
      const spread = n <= 5 ? 1.05 : 1.5;
      ch.sections.forEach((id, j) => {
        const off = n === 1 ? 0 : (j / (n - 1) - .5) * spread;
        const sa = a + off;
        const rr = 92 + (j % 2) * 30;
        positions[id] = {
          x: x + rr * Math.cos(sa), y: y + rr * Math.sin(sa),
          type: "section", ch, id, a: sa,
        };
      });
    });

    const svg = U.s("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": T("map.title") });
    svg.appendChild(U.s("rect", { x: 0, y: 0, width: W, height: H, fill: "transparent" }));
    const g = U.s("g", {});
    svg.appendChild(g);

    // 相关连线
    const relPairs = new Set();
    ORDER.forEach(id => {
      (S[id].related || []).forEach(other => {
        if (!S[other]) return;
        const key = [id, other].sort().join("|");
        if (relPairs.has(key)) return;
        relPairs.add(key);
        const a = positions[id], b = positions[other];
        if (!a || !b) return;
        const mx = (a.x + b.x) / 2 + (a.y - b.y) * .08;
        const my = (a.y + b.y) / 2 - (a.x - b.x) * .08;
        g.appendChild(U.s("path", { d: `M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}`, fill: "none", stroke: c.ink3, "stroke-width": .8, "stroke-dasharray": "2 4", opacity: .28, "data-rel": `${id}|${other}` }));
      });
    });
    // 章 → 节
    COURSE.chapters.forEach(ch => {
      ch.sections.forEach(id => {
        const a = positions[ch.id], b = positions[id];
        g.appendChild(U.s("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: ch.color, "stroke-width": .8, opacity: .22 }));
      });
    });

    const nodeEls = {};
    COURSE.chapters.forEach(ch => {
      const p = positions[ch.id];
      const done = chapterDone(ch), total = ch.sections.length;
      const el = U.s("g", { class: "mapnode mapnode--chapter viz-clickable", "data-id": ch.id, transform: `translate(${p.x},${p.y})`, tabindex: "0", role: "button" });
      el.appendChild(U.s("circle", { r: 40, fill: c.paper2, stroke: ch.color, "stroke-width": done === total ? 3 : 1.4, opacity: state.map.filter === "unfinished" && done === total ? .25 : 1 }));
      el.appendChild(U.s("text", { y: -2, "text-anchor": "middle", "font-family": "var(--font-display)", "font-size": "24", fill: ch.color }, String(ch.num).padStart(2, "0")));
      el.appendChild(U.s("text", { y: 15, "text-anchor": "middle", "font-family": "var(--font-mono)", "font-size": "8", fill: c.ink3 }, `${done}/${total}`));
      el.appendChild(U.s("text", { y: 60, "text-anchor": "middle", "font-family": "var(--font-display)", "font-size": "14", fill: c.ink }, loc(ch).short));
      el.addEventListener("mousemove", (e) => U.tip.show(`<b>${ch.num} · ${loc(ch).title}</b><br>${loc(ch).blurb}`, e.clientX, e.clientY));
      el.addEventListener("mouseleave", () => U.tip.hide());
      el.addEventListener("click", (e) => { e.stopPropagation(); selectMapNode(ch.id); });
      el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectMapNode(ch.id); } });
      g.appendChild(el);
      nodeEls[ch.id] = el;
    });

    ORDER.forEach(id => {
      const p = positions[id], sec = S[id], lo = loc(sec), ch = CHAPTER_BY_ID[sec.chapter];
      const done = isDone(id);
      const el = U.s("g", { class: "mapnode mapnode--section viz-clickable", "data-id": id, transform: `translate(${p.x},${p.y})`, tabindex: "0", role: "button" });
      el.appendChild(U.s("circle", { r: 13, fill: done ? c.accent2 : c.paper2, stroke: ch.color, "stroke-width": 1.4, opacity: state.map.filter === "unfinished" && done ? .2 : 1 }));
      el.appendChild(U.s("text", { y: 3, "text-anchor": "middle", "font-family": "var(--font-mono)", "font-size": "7.5", fill: done ? "#fff8ef" : c.ink2 }, id));
      el.addEventListener("mousemove", (e) => U.tip.show(`<b>${id} ${lo.short}</b><br>${lo.subtitle}`, e.clientX, e.clientY));
      el.addEventListener("mouseleave", () => U.tip.hide());
      el.addEventListener("click", (e) => { e.stopPropagation(); selectMapNode(id); });
      el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectMapNode(id); } });
      g.appendChild(el);
      nodeEls[id] = el;
    });

    // 缩放
    const zoom = d3.zoom().scaleExtent([.6, 2.5]).on("zoom", (e) => { g.setAttribute("transform", e.transform.toString()); });
    const sel = d3.select(svg);
    sel.call(zoom);
    sel.on("dblclick.zoom", null);
    svg.addEventListener("click", () => { state.map.selected = null; highlightMap(null); renderMapAside(document.querySelector(".map-aside")); });

    function highlightMap(id) {
      const related = new Set([id]);
      if (id && S[id]) (S[id].related || []).forEach(x => related.add(x));
      if (id && CHAPTER_BY_ID[id]) CHAPTER_BY_ID[id].sections.forEach(x => related.add(x));
      U.qsa(".mapnode", g).forEach(el => { el.style.opacity = !id ? 1 : (el === nodeEls[id] || related.has(el.dataset.id) || el.dataset.id === id ? 1 : .18); });
      U.qsa("[data-rel]", g).forEach(el => {
        const [a, b] = el.dataset.rel.split("|");
        el.setAttribute("opacity", id && (a === id || b === id) ? .75 : .15);
        el.setAttribute("stroke", id && (a === id || b === id) ? c.accent : c.ink3);
      });
    }

    function selectMapNode(id) {
      state.map.selected = id;
      highlightMap(id);
      renderMapAside(document.querySelector(".map-aside"));
      U.qsa(".mapnode", g).forEach(el => el.classList.remove("is-on"));
      nodeEls[id]?.classList.add("is-on");
    }

    canvas.appendChild(svg);

    if (state.map.selected) {
      const id = state.map.selected;
      setTimeout(() => {
        const el = nodeEls[id];
        if (el) {
          el.classList.add("is-on");
          highlightMap(id);
        }
      }, 0);
    }
  }

  function renderMapAside(aside) {
    if (!aside) return;
    U.clear(aside);
    const id = state.map.selected;
    if (!id) {
      aside.appendChild(U.h("div", { class: "map-aside__eyebrow" }, "HOW TO READ"));
      aside.appendChild(U.h("h2", {}, T("map.title")));
      aside.appendChild(U.h("p", { class: "map-aside__sub" }, T("map.selectHint")));
      aside.appendChild(U.h("div", { class: "map-aside__empty", style: "margin-top:22px" },
        U.h("p", {}, T("map.lead")),
        U.h("div", { class: "statline", style: "margin-top:16px" },
          U.h("div", {}, U.h("b", {}, ORDER.length), U.h("span", {}, ` ${T("common.sections")}`)),
          U.h("div", {}, U.h("b", {}, doneCount()), U.h("span", {}, ` ${T("common.done")}`)),
          U.h("div", {}, U.h("b", {}, COURSE.stats.widgets), U.h("span", {}, ` ${T("common.interactive")}`)))));
      return;
    }
    if (CHAPTER_BY_ID[id]) {
      const ch = CHAPTER_BY_ID[id];
      aside.appendChild(U.h("div", { class: "map-aside__eyebrow" }, `CHAPTER ${String(ch.num).padStart(2, "0")}`));
      aside.appendChild(U.h("h2", {}, loc(ch).title));
      aside.appendChild(U.h("p", { class: "map-aside__sub" }, loc(ch).blurb));
      aside.appendChild(U.h("div", { class: "map-aside__big" }, loc(ch).lead));
      const points = U.h("ul", { class: "map-aside__points" });
      ch.sections.forEach(sid => points.appendChild(U.h("li", {}, U.h("a", { href: `#/read/${sid}` }, `${sid} ${loc(S[sid]).short}`), isDone(sid) ? " ✓" : "")));
      aside.appendChild(points);
      aside.appendChild(U.h("a", { class: "btn btn--primary map-aside__cta", href: `#/read/${ch.sections[0]}` }, `${T("common.start")} →`));
      return;
    }
    const sec = S[id], lo = loc(sec), ch = chapterOf(id);
    aside.appendChild(U.h("div", { class: "map-aside__eyebrow" }, `SECTION ${id} · ${loc(ch).short}`));
    aside.appendChild(U.h("h2", {}, lo.title));
    aside.appendChild(U.h("p", { class: "map-aside__sub" }, lo.subtitle));
    aside.appendChild(U.h("div", { class: "map-aside__big" }, lo.bigIdea));
    const points = U.h("ul", { class: "map-aside__points" });
    lo.points.forEach(p => points.appendChild(U.h("li", {}, p)));
    aside.appendChild(points);
    const rel = (sec.related || []).filter(x => S[x]);
    if (rel.length) {
      const links = U.h("div", { class: "map-aside__links" });
      rel.forEach(x => links.appendChild(U.h("a", { class: "map-aside__link", href: `#/read/${x}` }, U.h("span", {}, `${x} ${loc(S[x]).short}`), U.h("span", {}, "↗"))));
      aside.appendChild(links);
    }
    aside.appendChild(U.h("a", { class: "btn btn--primary map-aside__cta", href: `#/read/${id}` }, `${T("map.openSection")} →`));
  }

  // ---------- 实验室 ----------
  function renderLab(tab) {
    const root = U.h("div", { class: "lab" });
    const head = U.h("div", { class: "lab-head" });
    head.appendChild(U.h("div", {},
      U.h("div", { class: "tag" }, "PLAYGROUND"),
      U.h("h1", {}, T("lab.title")),
      U.h("p", {}, T("lab.lead"))));
    head.appendChild(U.h("div", { class: "mono", style: "font-size:9px;color:var(--ink-3);letter-spacing:.1em" }, "20 FIGURES · OFFLINE"));
    root.appendChild(head);

    const tabs = U.h("nav", { class: "lab-tabs", "aria-label": "lab tabs" });
    [["color", "lab.tab.color"], ["channel", "lab.tab.channel"], ["time", "lab.tab.time"]].forEach(([k, label]) => {
      tabs.appendChild(U.h("a", { class: "lab-tab" + (k === tab ? " is-on" : ""), href: `#/lab/${k}` }, T(label)));
    });
    root.appendChild(tabs);

    const panel = U.h("div", { class: "lab-panel" });
    root.appendChild(panel);

    if (tab === "color") {
      panel.appendChild(U.h("div", { class: "lab-panel__head" }, U.h("h2", {}, T("lab.color.title")), U.h("p", {}, T("lab.color.lead"))));
      const card = U.h("div", { class: "viz" });
      card.appendChild(U.h("figcaption", { class: "viz__head" },
        U.h("span", { class: "viz__plate" }, "FIG. C-01"),
        U.h("span", { class: "viz__title" }, T("lab.color.title"))));
      const body = U.h("div", { class: "viz__body" });
      card.appendChild(body);
      panel.appendChild(card);
      CORE.mountWidget(body, "colorlab", { lang: state.lang });
    } else if (tab === "channel") {
      panel.appendChild(U.h("div", { class: "lab-panel__head" }, U.h("h2", {}, T("lab.channel.title")), U.h("p", {}, T("lab.channel.lead"))));
      panel.appendChild(widgetCard("FIG. C-02", T("lab.matrix.title"), T("lab.matrix.lead"), "scales"));
      panel.appendChild(widgetCard("FIG. C-03", T("lab.chart.title"), T("lab.chart.lead"), "chartchooser"));
    } else {
      panel.appendChild(U.h("div", { class: "lab-panel__head" }, U.h("h2", {}, T("lab.time.title")), U.h("p", {}, T("lab.time.lead"))));
      panel.appendChild(widgetCard("FIG. T-01", L("折线：标准时间域", "Line: standard time domain"), L("法国人名 1900–2020", "French names 1900–2020"), "line"));
      panel.appendChild(widgetCard("FIG. T-02", L("日历热图：周 × 星期", "Calendar: week × weekday"), L("2024 北京每日最高温", "Beijing daily max temperature, 2024"), "calendar"));
      panel.appendChild(widgetCard("FIG. T-03", L("螺旋：周期时间域", "Spiral: cyclic time domain"), L("同一份气温数据的另一条时间路径", "The same temperature data on another time path"), "spiral"));
      panel.appendChild(widgetCard("FIG. T-04", L("Storyline：多角色叙事", "Storyline: multi-actor narrative"), L("《侏罗纪公园》5 个角色", "Five characters from Jurassic Park"), "storyline"));
    }
    view.appendChild(root);
    if (window.Prism) { try { Prism.highlightAllUnder(view); } catch (e) {} }
  }

  function widgetCard(plate, title, lead, spec) {
    const card = U.h("div", { class: "viz" });
    card.appendChild(U.h("figcaption", { class: "viz__head" },
      U.h("span", { class: "viz__plate" }, plate),
      U.h("span", { class: "viz__title" }, title),
      U.h("span", { class: "viz__lead" }, lead)));
    const body = U.h("div", { class: "viz__body" });
    card.appendChild(body);
    CORE.mountWidget(body, spec, { lang: state.lang });
    return card;
  }

  // ---------- 重构说明 ----------
  function renderAbout() {
    const root = U.h("div", { class: "about" });
    const head = U.h("div", { class: "about__head" });
    head.appendChild(U.h("div", { class: "tag" }, "REFACTOR NOTES"));
    head.appendChild(U.h("h1", {}, T("about.title")));
    head.appendChild(U.h("p", {}, T("about.lead")));
    root.appendChild(head);

    const stats = U.h("div", { class: "about__stats" });
    [["5", T("home.stats.chapters")], ["27", T("home.stats.sections")], [String(COURSE.stats.widgets), T("home.stats.widgets")], [String(COURSE.stats.codeBlocks), L("个代码块", "code blocks")], [String(COURSE.stats.minutes), T("home.stats.minutes")]].forEach(([n, l]) => {
      stats.appendChild(U.h("div", { class: "about-stat" }, U.h("b", {}, n), U.h("span", {}, l)));
    });
    root.appendChild(stats);

    root.appendChild(U.h("h2", {}, T("about.principles")));
    const pg = U.h("div", { class: "about__grid" });
    [1, 2, 3, 4].forEach(i => pg.appendChild(U.h("div", { class: "about__box" },
      U.h("h4", {}, `0${i}`),
      U.h("h3", {}, T(`about.p${i}.title`)),
      U.h("p", {}, T(`about.p${i}.desc`)))));
    root.appendChild(pg);

    root.appendChild(U.h("h2", {}, L("改了什么：对照表", "What changed: before and after")));
    const rows = [
      [L("信息架构", "Information architecture"), L("门户 + 每章 3 个 tab；长页面里找一节靠滚动", "Portal + three tabs per chapter; finding a section meant scrolling"), L("课程目录 / 页内目录 / 知识地图三层导航；27 节可直接深链", "Course outline, in-page outline, and knowledge map; all 27 sections deep-linkable")],
      [L("内容呈现", "Content presentation"), L("讲解、代码、演示分散在三个 tab，来回切换会丢上下文", "Explanation, code, and demo split across tabs; switching lost context"), L("每节统一为「速览 → 讲义 → 实验 → 自测」四段；代码与解释相邻", "Each section is overview → lecture → experiment → self-check; code sits next to its explanation")],
      [L("可视化", "Visualization"), L("抽象概念以文字为主，图是静态截图", "Abstract ideas were mostly text; figures were static screenshots"), L("20 个可交互图：通道矩阵、Data-Join、树布局、colormap、CVD、45°、等值线、日历、螺旋、Storyline", "20 interactive figures: channel matrix, data-join, tree layout, colormaps, CVD, 45°, contours, calendar, spiral, Storyline")],
      [L("检索", "Search"), L("无全文检索", "No full-text search"), L("⌘K 全文检索标题、要点、正文；结果带上下文摘录", "⌘K full-text search over titles, key points, and body, with context excerpts")],
      [L("学习反馈", "Learning feedback"), L("无进度、无自测", "No progress, no self-check"), L("27 个自测题 + 本地进度 + 知识地图完成度着色", "27 self-check questions + local progress + completion coloring on the map")],
      [L("可访问性", "Accessibility"), L("以鼠标与浅色为主", "Mostly mouse and light theme"), L("键盘可达、焦点环、深浅主题、响应式、减少动效", "Keyboard reachable, focus rings, light/dark themes, responsive, reduced motion")],
      [L("可验证性", "Verifiability"), L("无测试", "No tests"), L("内容 / 双语 / 可视化 / 端到端四套测试；离线与响应式有断言", "Four suites: content, i18n, visualization, end-to-end; offline and responsive assertions")],
    ];
    const table = U.h("table", { class: "compare" });
    table.appendChild(U.h("thead", {}, U.h("tr", {}, [L("维度", "Dimension"), T("about.before"), T("about.after")].map(h => U.h("th", {}, h)))));
    table.appendChild(U.h("tbody", {}, rows.map(r => U.h("tr", {}, r.map(c => U.h("td", {}, c))))));
    root.appendChild(table);

    root.appendChild(U.h("h2", {}, L("27 个交互实验 · 20 种交互图", "27 experiments · 20 figure types")));
    const figList = U.h("div", { class: "maplist" });
    COURSE.chapters.forEach(ch => {
      const sec = U.h("section", { class: "maplist__ch" });
      sec.appendChild(U.h("h3", { style: "color:" + (state.theme === "ink" ? ch.colorDark : ch.color) }, `${ch.num} · ${loc(ch).title}`));
      const list = U.h("div", { class: "maplist__secs" });
      ch.sections.forEach(id => list.appendChild(U.h("a", { class: "maplist__item", href: `#/read/${id}` }, U.h("b", {}, id), U.h("span", {}, loc(S[id]).short), U.h("i", {}, "↗"))));
      sec.appendChild(list);
      figList.appendChild(sec);
    });
    root.appendChild(figList);

    root.appendChild(U.h("h2", {}, T("about.verify")));
    root.appendChild(U.h("p", {}, L("内容、双语、可视化与端到端四套测试，全部在本地运行。", "Four suites — content, i18n, visualization, and end-to-end — all run locally.")));
    const pre = U.h("pre", { class: "shell-code" });
    pre.textContent = `npm install\nnpm run build\nnpm test\n# 单独跑\nnode tests/content.mjs\nnode tests/i18n.mjs\nnode tests/viz.mjs\nnode tests/e2e.mjs`;
    root.appendChild(pre);
    root.appendChild(U.h("p", { class: "mini-note" }, L("端到端测试需要 Chromium；可用 PLAYWRIGHT_BROWSERS_PATH 指定本地浏览器目录。", "End-to-end tests need Chromium; set PLAYWRIGHT_BROWSERS_PATH to a local browser directory if needed.")));

    root.appendChild(U.h("h2", {}, T("about.deploy")));
    root.appendChild(U.h("p", {}, L("纯静态产物，无构建步骤。推送到任意静态托管即可；本站部署在 GitHub Pages。", "Pure static output, no build step. Push to any static host; this site is deployed on GitHub Pages.")));
    root.appendChild(U.h("p", {}, U.h("a", { href: "https://liquanlianshi.github.io/Layout_web4/", target: "_blank", rel: "noopener" }, "https://liquanlianshi.github.io/Layout_web4/")));

    root.appendChild(U.h("h2", {}, T("about.credits")));
    root.appendChild(U.h("p", {}, L("课程内容基于《可视化导论》课程站点（cinger007.github.io/vis）重构，用于课程作业。所有第三方库（D3.js、Prism）均已本地化，站点不加载任何外部 CDN 或跟踪脚本。", "Course content is rebuilt from the Visualization course site (cinger007.github.io/vis) for coursework. All third-party libraries (D3.js, Prism) are vendored locally; the site loads no external CDN or tracking scripts.")));
    root.appendChild(U.h("p", { class: "mini-note" }, T("footer.built")));

    view.appendChild(root);
  }

  // ---------- 渲染入口 ----------
  function render(opts = {}) {
    state.route = parseRoute();
    const r = state.route;
    const isReader = r.name === "read";
    const sideWasOpen = document.body.classList.contains("side-open");
    shell.classList.toggle("has-side", isReader);
    document.body.classList.toggle("reader-mode", isReader);
    if (state.onScroll) { window.removeEventListener("scroll", state.onScroll); state.onScroll = null; }
    U.qsa(".widget-mount", view).forEach(el => (el.__cleanups || []).forEach(fn => { try { fn(); } catch (e) {} }));
    U.tip.hide();
    U.clear(view);
    if (!isReader) topProgress.style.width = "0%";
    if (opts.keepSide && sideWasOpen) openSide(); else closeSide();

    if (r.name === "home") renderHome();
    else if (r.name === "read") renderReader(r.id);
    else if (r.name === "map") renderMap();
    else if (r.name === "lab") renderLab(r.tab);
    else if (r.name === "about") renderAbout();

    I18N.apply(view);
    updateActiveNav();
    renderCrumbs();
    updateSideProgress();
    const mTheme = $("#mTheme"), mLang = $("#mLang");
    if (mTheme) mTheme.textContent = `${T("nav.theme")} · ${state.theme === "paper" ? T("common.paper") : T("common.ink")}`;
    if (mLang) mLang.textContent = `${T("nav.lang")} · ${state.lang === "zh" ? "中文" : "EN"}`;
    const titles = { home: T("nav.home"), map: T("map.title"), lab: T("lab.title"), about: T("about.title") };
    document.title = isReader ? `${loc(sectionOf(r.id)).title} · 可视化导论` : `${titles[r.name] || ""} · 可视化导论`;
    if (isReader && state.onScroll) window.addEventListener("scroll", state.onScroll, { passive: true });
    if (isReader && !opts.keepScroll) window.scrollTo(0, 0);
    if (!isReader && !opts.keepScroll) window.scrollTo(0, 0);

    // 顶栏进度
    if (!isReader) topProgress.style.width = "0%";
  }

  function refreshProgressUI() {
    updateSideProgress();
    const r = state.route;
    if (r?.name === "read") {
      const btn = U.qs(".rail__donebtn");
      if (btn) updateDoneBtn(btn, r.id);
    }
    if (r?.name === "map") render();
  }

  // ---------- 事件 ----------
  function wire() {
    $("#btnSearch").addEventListener("click", openPalette);
    $("#btnMenu").addEventListener("click", () => document.body.classList.contains("side-open") ? closeSide() : openSide());
    $("#btnCloseSide").addEventListener("click", closeSide);
    const mTheme = $("#mTheme"), mLang = $("#mLang");
    if (mTheme) mTheme.addEventListener("click", () => setTheme(state.theme === "paper" ? "ink" : "paper"));
    if (mLang) mLang.addEventListener("click", () => setLang(state.lang === "zh" ? "en" : "zh"));
    $("#scrim").addEventListener("click", closeSide);
    $("#btnResetProgress").addEventListener("click", () => {
      if (!confirm(L("确定要清空全部学习进度吗？", "Clear all learning progress?"))) return;
      state.progress = { done: [], quiz: {} };
      saveProgress();
      U.toast(L("进度已重置", "Progress reset"));
      render();
    });
    U.qsa("#themeSeg .seg__btn").forEach(b => b.addEventListener("click", () => setTheme(b.dataset.themeVal)));
    U.qsa("#langSeg .seg__btn").forEach(b => b.addEventListener("click", () => setLang(b.dataset.langVal)));
    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-close-palette]")) closePalette();
      const copy = e.target.closest("[data-copy]");
      if (copy) {
        const block = copy.closest(".codeblock");
        const code = block?.querySelector("code");
        if (!code) return;
        U.copy(code.textContent).then(ok => {
          if (!ok) return;
          const old = copy.textContent;
          copy.textContent = L("已复制", "Copied");
          U.toast(T("common.copied"));
          setTimeout(() => { copy.textContent = old; }, 1400);
        });
      }
    });
    document.addEventListener("keydown", (e) => {
      const tag = (e.target.tagName || "").toLowerCase();
      const typing = tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openPalette(); return; }
      if (e.key === "Escape") { closePalette(); closeSide(); return; }
      if (e.key === "/" && !typing) { e.preventDefault(); openPalette(); return; }
      if (state.route?.name === "read" && !typing) {
        if (e.key === "ArrowRight") { const i = ORDER.indexOf(state.route.id); if (i < ORDER.length - 1) navigate(`read/${ORDER[i + 1]}`); }
        if (e.key === "ArrowLeft") { const i = ORDER.indexOf(state.route.id); if (i > 0) navigate(`read/${ORDER[i - 1]}`); }
        if (e.key.toLowerCase() === "m") { markDone(state.route.id, !isDone(state.route.id)); U.toast(isDone(state.route.id) ? T("reader.done") : L("已取消完成", "Marked not done")); }
      }
    });
    window.addEventListener("hashchange", () => render());
    window.addEventListener("scroll", () => {
      if (state.onScroll) state.onScroll();
    }, { passive: true });
    window.addEventListener("resize", U.debounce(() => {
      if (state.route?.name === "map") render();
    }, 220));
    window.addEventListener("storage", (e) => {
      if (e.key === "vis4.progress") U.toast(L("进度已在另一个标签页更新，刷新后生效", "Progress updated in another tab; refresh to sync"));
    });
  }

  // ---------- 启动 ----------
  function boot() {
    applyTheme();
    document.documentElement.setAttribute("data-lang", state.lang);
    document.documentElement.lang = state.lang === "zh" ? "zh-CN" : "en";
    I18N.setLang(state.lang);
    U.qsa("#langSeg .seg__btn").forEach(b => b.classList.toggle("is-on", b.dataset.langVal === state.lang));
    buildSidenav();
    buildSearchIndex();
    wire();
    const bar = $("#bootBar"), pct = $("#bootPct"), label = $("#bootLabel");
    let n = 0;
    const timer = setInterval(() => {
      n = Math.min(100, n + 12 + Math.random() * 20);
      bar.style.width = n + "%";
      pct.textContent = String(Math.round(n)).padStart(3, "0");
    }, 60);
    setTimeout(() => {
      clearInterval(timer);
      bar.style.width = "100%";
      pct.textContent = "100";
      label.textContent = L("就绪", "Ready");
      render();
      setTimeout(() => {
        const b = $("#boot");
        b.classList.add("is-off");
        setTimeout(() => b.remove(), 600);
      }, 220);
    }, 420);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
