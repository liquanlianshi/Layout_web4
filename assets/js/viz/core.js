// =============================================================
// assets/js/viz/core.js — 交互图公共设施：注册、响应式 SVG、色彩工具
// =============================================================
(function () {
  const WIDGETS = {};
  const L = (zh, en) => (window.I18N ? I18N.L(zh, en) : zh);

  function registerWidget(name, fn) { WIDGETS[name] = fn; }
  function getWidget(name) { return WIDGETS[name]; }

  function mountWidget(el, spec, ctx = {}) {
    const [name, variant] = String(spec || "").split(":");
    const fn = WIDGETS[name];
    el.innerHTML = "";
    el.classList.add("widget-mount");
    if (!fn) {
      el.appendChild(U.h("div", { class: "widget-fallback" }, `未注册的可视化组件: ${name}`));
      return;
    }
    try {
      fn(el, { ...ctx, variant, lang: ctx.lang || (window.I18N ? I18N.lang : "zh"), L });
    } catch (err) {
      console.error(`[widget:${name}]`, err);
      el.appendChild(U.h("div", { class: "widget-fallback" }, `组件加载失败：${err.message}`));
    }
  }

  // 响应式 SVG：宽度跟随容器，viewBox 决定纵横比
  function chart(host, opts, draw) {
    const o = typeof opts === "number" ? { aspect: opts } : (opts || {});
    const wrap = U.h("div", { class: "viz-chart" + (o.fixed ? " viz-chart--fixed" : "") });
    host.appendChild(wrap);
    let lastW = 0;
    let raf = 0;

    function render() {
      const w = Math.max(240, Math.round(wrap.clientWidth || 640));
      if (Math.abs(w - lastW) < 2 && wrap.querySelector("svg")) return;
      lastW = w;
      const h = Math.round(o.height ? o.height(w) : w * (o.aspect || 0.55));
      wrap.innerHTML = "";
      const svg = d3.select(wrap).append("svg")
        .attr("viewBox", `0 0 ${w} ${h}`)
        .attr("width", "100%")
        .attr("role", "img")
        .attr("aria-label", o.label || "");
      draw(svg, w, h);
    }

    render();
    const off = U.onResize(wrap, () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(render);
    });
    if (!host.__cleanups) host.__cleanups = [];
    host.__cleanups.push(off);
    return { wrap, redraw: render };
  }

  // 悬停提示
  function hover(sel, htmlFn) {
    sel.on("mousemove", function (event, d) {
      const html = typeof htmlFn === "function" ? htmlFn(d, event) : htmlFn;
      if (html == null) return;
      U.tip.show(html, event.clientX, event.clientY);
    }).on("mouseleave", () => U.tip.hide());
    return sel;
  }

  // ---------- 色彩工具 ----------
  const hexToRgb = (hex) => {
    let h = String(hex).replace("#", "").trim();
    if (h.length === 3) h = h.split("").map(c => c + c).join("");
    const n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  };
  const rgbToHex = (r, g, b) => "#" + [r, g, b].map(v => U.clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("");
  const srgbToLinear = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const linearToSrgb = (v) => { v = U.clamp(v, 0, 1); return 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055); };

  const CVD_MAT = {
    protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
    deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
    tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
  };

  function simulate(hex, mode) {
    if (!mode || mode === "none" || !CVD_MAT[mode]) return hex;
    const { r, g, b } = hexToRgb(hex);
    const lin = [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
    const m = CVD_MAT[mode];
    const out = m.map(row => row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2]);
    return rgbToHex(linearToSrgb(out[0]), linearToSrgb(out[1]), linearToSrgb(out[2]));
  }

  function luminance(hex) {
    const { r, g, b } = hexToRgb(hex);
    return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
  }
  function contrast(a, b) {
    const l1 = luminance(a), l2 = luminance(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  function deltaE(a, b) {
    const x = d3.lab(a), y = d3.lab(b);
    return Math.sqrt((x.l - y.l) ** 2 + (x.a - y.a) ** 2 + (x.b - y.b) ** 2);
  }
  function mix(a, b, t) { return d3.interpolateLab(a, b)(t); }

  const PALETTES = {
    wong: { zh: "Wong 8", en: "Wong 8", colors: ["#000000", "#E69F00", "#56B4E9", "#009E73", "#F0E442", "#0072B2", "#D55E00", "#CC79A7"] },
    tol: { zh: "Paul Tol bright", en: "Paul Tol bright", colors: ["#4477AA", "#EE6677", "#228833", "#CCBB44", "#66CCEE", "#AA3377", "#BBBBBB"] },
    tableau: { zh: "Tableau 10", en: "Tableau 10", colors: ["#4E79A7", "#F28E2B", "#E15759", "#76B7B2", "#59A14F", "#EDC948", "#B07AA1", "#FF9DA7", "#9C755F", "#BAB0AC"] },
    okabe: { zh: "Okabe-Ito", en: "Okabe-Ito", colors: ["#000000", "#E69F00", "#56B4E9", "#009E73", "#F0E442", "#0072B2", "#D55E00", "#CC79A7"] },
    viridis: { zh: "Viridis", en: "Viridis", colors: ["#440154", "#46327e", "#365c8d", "#277f8e", "#1fa187", "#4ac16d", "#a0da39", "#fde725"] },
    rdbu: { zh: "RdBu 发散", en: "RdBu diverging", colors: ["#b2182b", "#ef8a62", "#fddbc7", "#f7f7f7", "#d1e5f0", "#67a9cf", "#2166ac"] },
    jet: { zh: "Jet（反例）", en: "Jet (avoid)", colors: ["#000080", "#0000ff", "#00ffff", "#00ff00", "#ffff00", "#ff0000", "#800000"] },
  };

  // 供图表使用的色板（随主题保持可读性）
  const inkPalette = () => {
    const c = U.colors();
    return [c.accent, c.blue, c.accent2, c.gold, c.plum, c.ink3, "#8a6d3b", "#7a8b99"];
  };

  // 简易轴
  function axisBottom(g, scale, h, opts = {}) {
    const ax = d3.axisBottom(scale).ticks(opts.ticks || 6).tickSizeOuter(0);
    if (opts.format) ax.tickFormat(opts.format);
    g.append("g").attr("class", "axis axis--x").attr("transform", `translate(0,${h})`).call(ax);
  }
  function axisLeft(g, scale, opts = {}) {
    const ax = d3.axisLeft(scale).ticks(opts.ticks || 5).tickSizeOuter(0);
    if (opts.format) ax.tickFormat(opts.format);
    g.append("g").attr("class", "axis axis--y").call(ax);
  }

  // 生成类似 SVG 的圆角矩形路径
  function roundedRect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    return `M${x + r},${y}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${y + r}V${y + h - r}A${r},${r} 0 0 1 ${x + w - r},${y + h}H${x + r}A${r},${r} 0 0 1 ${x},${y + h - r}V${y + r}A${r},${r} 0 0 1 ${x + r},${y}Z`;
  }

  window.registerWidget = registerWidget;
  window.getWidget = getWidget;
  window.CORE = {
    WIDGETS, mountWidget, chart, hover,
    hexToRgb, rgbToHex, simulate, luminance, contrast, deltaE, mix,
    PALETTES, inkPalette, axisBottom, axisLeft, roundedRect, L,
    CVD_MAT,
  };
})();
