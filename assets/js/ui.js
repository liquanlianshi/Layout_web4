// =============================================================
// assets/js/ui.js — DOM / SVG / 数值 / 存储 / 提示等小组件
// =============================================================
(function () {
  const U = {};

  // ---------- DOM ----------
  U.h = function (tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs && typeof attrs === "object" && !(attrs instanceof Node) && !Array.isArray(attrs)) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === "class") el.className = v;
        else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
        else if (k === "html") el.innerHTML = v;
        else if (k === "text") el.textContent = v;
        else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === "dataset") Object.assign(el.dataset, v);
        else el.setAttribute(k, v === true ? "" : v);
      }
    } else if (attrs != null) {
      children.unshift(attrs);
    }
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false) continue;
      el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  };
  U.esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  U.qs = (sel, root) => (root || document).querySelector(sel);
  U.qsa = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  U.clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

  // SVG helper：属性名保持原样（viewBox / stroke-width / text-anchor…）
  U.s = function (tag, attrs, ...children) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    if (attrs && typeof attrs === "object" && !(attrs instanceof Node) && !Array.isArray(attrs)) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === "text") el.textContent = v;
        else if (k === "html") el.innerHTML = v;
        else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
        else el.setAttribute(k, v);
      }
    } else if (attrs != null) {
      children.unshift(attrs);
    }
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false) continue;
      el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  };

  // ---------- 数值 / 格式 ----------
  U.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.range = (n) => Array.from({ length: n }, (_, i) => i);
  U.unique = (arr) => Array.from(new Set(arr));
  U.sum = (arr) => arr.reduce((a, b) => a + b, 0);
  U.mean = (arr) => (arr.length ? U.sum(arr) / arr.length : 0);
  U.fmtInt = (n) => (n == null || Number.isNaN(n)) ? "—" : Math.round(n).toLocaleString("en-US");
  U.fmtNum = (n, d = 1) => (n == null || Number.isNaN(n)) ? "—" : Number(n).toFixed(d);
  U.fmtPct = (n, d = 0) => (n == null || Number.isNaN(n)) ? "—" : `${(n * 100).toFixed(d)}%`;
  U.fmtDate = (d, lang) => {
    const dt = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(dt.getTime())) return String(d);
    return lang === "en"
      ? dt.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : `${dt.getMonth() + 1} 月 ${dt.getDate()} 日`;
  };
  U.uid = (() => { let n = 0; return (p = "u") => `${p}${++n}`; })();

  // ---------- 存储 ----------
  U.store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
      catch (e) { return fallback; }
    },
    set(key, val) {
      try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; }
    },
    del(key) { try { localStorage.removeItem(key); } catch (e) {} },
  };

  // ---------- 事件 ----------
  U.debounce = (fn, ms = 200) => {
    let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  };
  U.throttle = (fn, ms = 100) => {
    let last = 0, timer;
    return (...args) => {
      const now = Date.now();
      if (now - last >= ms) { last = now; fn(...args); }
      else { clearTimeout(timer); timer = setTimeout(() => { last = Date.now(); fn(...args); }, ms - (now - last)); }
    };
  };

  // ---------- 尺寸 ----------
  U.size = (el, aspect = 0.56) => {
    const w = Math.max(240, el.clientWidth || 640);
    return { w, h: Math.round(w * aspect) };
  };
  U.onResize = (el, fn) => {
    if (typeof ResizeObserver === "undefined") { window.addEventListener("resize", fn); return () => window.removeEventListener("resize", fn); }
    let raf = 0;
    const ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(fn); });
    ro.observe(el);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  };

  // ---------- 主题色 ----------
  U.cssVar = (name, fallback) => {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name);
    return v ? v.trim() : fallback;
  };
  U.colors = () => ({
    paper: U.cssVar("--paper", "#f6f2e9"),
    paper2: U.cssVar("--paper-2", "#fffdf7"),
    paper3: U.cssVar("--paper-3", "#ebe3d4"),
    paper4: U.cssVar("--paper-4", "#e2d7c4"),
    ink: U.cssVar("--ink", "#1c1712"),
    ink2: U.cssVar("--ink-2", "#574d42"),
    ink3: U.cssVar("--ink-3", "#8b7f70"),
    line: U.cssVar("--line", "#d9cfbe"),
    accent: U.cssVar("--accent", "#bc4a24"),
    accent2: U.cssVar("--accent-2", "#2f6f62"),
    gold: U.cssVar("--gold", "#a97b2f"),
    blue: U.cssVar("--blue", "#33566f"),
    plum: U.cssVar("--plum", "#6b4a63"),
  });

  // ---------- Toast ----------
  U.toast = (msg, ms = 2200) => {
    const box = document.getElementById("toasts");
    if (!box) return;
    const el = U.h("div", { class: "toast" }, msg);
    box.appendChild(el);
    requestAnimationFrame(() => el.classList.add("is-in"));
    setTimeout(() => {
      el.classList.remove("is-in");
      setTimeout(() => el.remove(), 220);
    }, ms);
  };

  // ---------- 复制 ----------
  U.copy = async (text) => {
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
      else {
        const ta = document.createElement("textarea");
        ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
      }
      return true;
    } catch (e) { return false; }
  };

  // ---------- Tooltip ----------
  const tip = () => document.getElementById("vizTip");
  U.tip = {
    show(html, x, y) {
      const el = tip(); if (!el) return;
      el.innerHTML = html;
      el.classList.add("is-on");
      el.setAttribute("aria-hidden", "false");
      const pad = 12;
      const r = el.getBoundingClientRect();
      let left = x + 14, top = y + 14;
      if (left + r.width + pad > window.innerWidth) left = x - r.width - 14;
      if (top + r.height + pad > window.innerHeight) top = y - r.height - 14;
      el.style.left = Math.max(pad, left) + "px";
      el.style.top = Math.max(pad, top) + "px";
    },
    hide() {
      const el = tip(); if (!el) return;
      el.classList.remove("is-on");
      el.setAttribute("aria-hidden", "true");
    },
    bind(sel, htmlFn) {
      const el = typeof sel === "string" ? document.querySelector(sel) : sel;
      if (!el) return;
      el.addEventListener("mousemove", (e) => U.tip.show(htmlFn(e), e.clientX, e.clientY));
      el.addEventListener("mouseleave", () => U.tip.hide());
    },
  };

  // ---------- 常用控件 ----------
  U.slider = (opts) => {
    const { label, min, max, step = 1, value, onInput, fmt = (v) => v, hint } = opts;
    const out = U.h("output", { class: "ctl__out" }, fmt(value));
    const input = U.h("input", { type: "range", min, max, step, value, class: "ctl__range" });
    input.addEventListener("input", () => {
      const v = Number(input.value);
      out.textContent = fmt(v);
      onInput(v);
    });
    return U.h("label", { class: "ctl ctl--range" },
      U.h("span", { class: "ctl__label" }, label, hint ? U.h("i", { class: "ctl__hint" }, hint) : null),
      U.h("span", { class: "ctl__row" }, input, out),
    );
  };

  U.segmented = (opts) => {
    const { label, options, value, onChange } = opts;
    const wrap = U.h("div", { class: "ctl__seg", role: "group", "aria-label": label || "" });
    const buttons = options.map((o, i) => {
      const b = U.h("button", {
        type: "button", class: "seg__btn" + (i === value ? " is-on" : ""),
        onclick: () => { buttons.forEach((x, j) => x.classList.toggle("is-on", j === i)); onChange(o.value, i); },
      }, o.label);
      wrap.appendChild(b);
      return b;
    });
    return label ? U.h("div", { class: "ctl ctl--seg" }, U.h("span", { class: "ctl__label" }, label), wrap) : wrap;
  };

  U.select = (opts) => {
    const { label, options, value, onChange } = opts;
    const sel = U.h("select", { class: "ctl__select" },
      options.map(o => U.h("option", { value: o.value, selected: o.value === value ? "selected" : null }, o.label)));
    sel.addEventListener("change", () => onChange(sel.value));
    return U.h("label", { class: "ctl ctl--select" }, label ? U.h("span", { class: "ctl__label" }, label) : null, sel);
  };

  U.toggle = (opts) => {
    const { label, checked, onChange } = opts;
    const input = U.h("input", { type: "checkbox", class: "switch__input", checked: checked ? "checked" : null });
    input.addEventListener("change", () => onChange(input.checked));
    return U.h("label", { class: "switch" }, input, U.h("span", { class: "switch__track" }), U.h("span", { class: "switch__label" }, label));
  };

  U.chip = (text, opts = {}) => U.h(opts.href ? "a" : "span", {
    class: "chip" + (opts.tone ? ` chip--${opts.tone}` : "") + (opts.small ? " chip--sm" : ""),
    href: opts.href || null, onclick: opts.onClick || null,
  }, text);

  U.figure = (opts) => {
    const { title, lead, body, foot, plate } = opts;
    return U.h("figure", { class: "viz" },
      U.h("figcaption", { class: "viz__head" },
        plate ? U.h("span", { class: "viz__plate" }, plate) : null,
        U.h("span", { class: "viz__title" }, title),
        lead ? U.h("span", { class: "viz__lead" }, lead) : null,
      ),
      U.h("div", { class: "viz__body" }, body),
      foot ? U.h("div", { class: "viz__foot" }, foot) : null,
    );
  };

  U.legend = (items, opts = {}) => {
    const el = U.h("div", { class: "legend" + (opts.vertical ? " legend--v" : "") });
    for (const it of items) {
      el.appendChild(U.h("span", { class: "legend__item" },
        U.h("i", { class: "legend__swatch", style: `background:${it.color}` }),
        U.h("span", {}, it.label)));
    }
    return el;
  };

  // 把数据分成 n 个好看的分箱
  U.bins = (values, n = 6) => {
    const v = values.filter(x => Number.isFinite(x));
    const min = Math.min(...v), max = Math.max(...v);
    const step = (max - min) / n || 1;
    const edges = U.range(n + 1).map(i => min + step * i);
    const counts = U.range(n).fill(0);
    for (const x of v) {
      let i = Math.floor((x - min) / step);
      if (i >= n) i = n - 1;
      if (i < 0) i = 0;
      counts[i]++;
    }
    return { min, max, step, edges, counts };
  };

  U.download = (filename, text, type = "text/plain") => {
    const blob = new Blob([text], { type });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 100);
  };

  // 语义化数字后缀
  U.compact = (n) => {
    if (n == null) return "—";
    if (n >= 1e8) return (n / 1e8).toFixed(1) + " 亿";
    if (n >= 1e4) return (n / 1e4).toFixed(1) + " 万";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
    return String(Math.round(n));
  };

  window.U = U;
})();
