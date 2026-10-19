// 2.1 三个流程模型
(function () {
  const L = (zh, en) => I18N.L(zh, en);
  const MODELS = [
    { key: "card", zh: "Card 数据流", en: "Card data flow" },
    { key: "mackinlay", zh: "Mackinlay 决策", en: "Mackinlay decisions" },
    { key: "vanwijk", zh: "van Wijk 反馈", en: "van Wijk feedback" },
  ];
  const STAGES = [
    { zh: "原始数据", en: "Raw Data", sub: ["表、日志、CSV", "tables, logs, CSV"], detail: ["未经整理的事实。可视化的输入不是「干净的数组」，而是先要理解它的字段、类型与口径。", "Unprocessed facts. The input is not a clean array; you must understand fields, types, and definitions first."] },
    { zh: "数据表", en: "Data Tables", sub: ["清洗、聚合、派生", "clean, aggregate, derive"], detail: ["Card 模型的 D→T 阶段：清洗、聚合、连接、派生。rollup、group、filter 都在这里。", "The D→T stage: clean, aggregate, join, derive. rollup, group, and filter live here."] },
    { zh: "视觉结构", en: "Visual Structure", sub: ["图元 + 通道", "marks + channels"], detail: ["把数据字段映射到位置、长度、颜色、形状。Mackinlay 的通道排名在此发挥作用。", "Map fields to position, length, color, shape. Mackinlay's channel ranking applies here."] },
    { zh: "视图", en: "Views", sub: ["渲染 + 交互", "render + interact"], detail: ["屏幕上的图。交互（筛选、缩放、下钻）让视图反过来改变数据表，形成回路。", "The chart on screen. Interaction (filter, zoom, drill-down) feeds back into the data table."] },
  ];
  const MACK = [
    { zh: "定量", en: "Quantitative", ch: ["位置", "长度", "角度"], chEn: ["position", "length", "angle"], why: ["量化误差最小，读者能比较倍数。", "Smallest quantization error; readers can compare ratios."] },
    { zh: "有序", en: "Ordinal", ch: ["位置", "亮度", "密度"], chEn: ["position", "brightness", "density"], why: ["能读出顺序，但不必读出精确差值。", "Order is readable without implying exact differences."] },
    { zh: "名义", en: "Nominal", ch: ["位置", "色相", "形状"], chEn: ["position", "hue", "shape"], why: ["只区分「是不是同一类」，不表达大小。", "Distinguishes categories, not magnitudes."] },
  ];
  registerWidget("pipeline", function (el) {
    let model = "card";
    let stage = 1;
    const tabs = U.h("div", { class: "viz-toolbar" });
    const canvas = U.h("div");
    const detail = U.h("div", { class: "pipeline__detail" });
    el.appendChild(U.h("div", { class: "viz__stack" }, tabs, canvas, detail));

    const seg = U.segmented({
      options: MODELS.map(m => ({ label: L(m.zh, m.en), value: m.key })),
      value: 0,
      onChange: (v) => { model = v; render(); },
    });
    tabs.appendChild(U.h("div", { class: "viz-toolbar__group" }, U.h("span", { class: "mono", style: "font-size:10px;color:var(--ink-3)" }, L("模型", "model")), seg));

    function render() {
      U.clear(canvas);
      if (model === "card") drawCard();
      else if (model === "mackinlay") drawMack();
      else drawLoop();
      renderDetail();
    }

    function drawCard() {
      const c = U.colors();
      const W = 660, H = 200, bw = 128, gap = 26, y = 52, bh = 72;
      const svg = U.s("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", role: "img", "aria-label": "Card pipeline" });
      const startX = 18;
      STAGES.forEach((s, i) => {
        const x = startX + i * (bw + gap);
        const on = i === stage;
        const g = U.s("g", { class: "viz-clickable", tabindex: "0", role: "button" },
          U.s("rect", { x, y, width: bw, height: bh, fill: on ? c.accent : c.paper3, stroke: on ? c.accent : c.line }),
          U.s("text", { x: x + bw / 2, y: y + 29, "text-anchor": "middle", "font-family": "var(--font-display)", "font-size": "14", fill: on ? "#fff8ef" : c.ink }, L(s.zh, s.en)),
          U.s("text", { x: x + bw / 2, y: y + 47, "text-anchor": "middle", "font-family": "var(--font-mono)", "font-size": "8", fill: on ? "rgba(255,248,239,.8)" : c.ink3 }, L(s.sub[0], s.sub[1])),
          U.s("text", { x: x + 10, y: y + bh - 9, "font-family": "var(--font-mono)", "font-size": "8", fill: on ? "rgba(255,248,239,.65)" : c.ink3 }, `0${i + 1}`),
        );
        g.addEventListener("click", () => { stage = i; render(); });
        svg.appendChild(g);
        if (i < STAGES.length - 1) {
          const ax = x + bw + 5, ay = y + bh / 2;
          svg.appendChild(U.s("line", { x1: ax, x2: ax + gap - 10, y1: ay, y2: ay, stroke: c.ink3, "stroke-width": 1 }));
          svg.appendChild(U.s("path", { d: `M${ax + gap - 10},${ay} l-5,-3.5 v7 z`, fill: c.ink3 }));
        }
      });
      // 反馈回线
      svg.appendChild(U.s("path", {
        d: `M${startX + 3 * (bw + gap) + bw / 2},${y + bh + 10} v28 H${startX + bw / 2} v-14`,
        fill: "none", stroke: c.accent, "stroke-width": 1, "stroke-dasharray": "4 3",
      }));
      svg.appendChild(U.s("path", { d: `M${startX + bw / 2},${y + bh + 24} l-3.5,-6 h7 z`, fill: c.accent }));
      svg.appendChild(U.s("text", { x: W / 2, y: H - 6, "text-anchor": "middle", "font-family": "var(--font-mono)", "font-size": "8.5", fill: c.accent }, L("交互：视图反过来改变数据表（van Wijk 反馈环）", "interaction: views feed back into data tables")));
      canvas.appendChild(svg);
    }

    function drawMack() {
      const c = U.colors();
      const W = 660, H = 190;
      const svg = U.s("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", role: "img", "aria-label": "Mackinlay ranking" });
      const colW = 190, x0 = 24;
      MACK.forEach((m, i) => {
        const x = x0 + i * (colW + 20);
        svg.appendChild(U.s("text", { x, y: 26, "font-family": "var(--font-display)", "font-size": "15", fill: c.ink }, L(m.zh, m.en)));
        m.ch.forEach((ch, j) => {
          const y = 48 + j * 34;
          svg.appendChild(U.s("rect", { x, y: y - 15, width: colW - 20, height: 26, fill: c.paper3, stroke: c.line2 }));
          svg.appendChild(U.s("text", { x: x + 10, y: y + 2, "font-family": "var(--font-mono)", "font-size": "9.5", fill: c.ink2 }, `${j + 1}. ${L(ch, m.chEn[j])}`));
          svg.appendChild(U.s("rect", { x: x + colW - 38, y: y - 9, width: 12, height: 14, fill: c.accent, opacity: 1 - j * 0.28 }));
        });
      });
      svg.appendChild(U.s("text", { x: W / 2, y: H - 8, "text-anchor": "middle", "font-family": "var(--font-mono)", "font-size": "8.5", fill: c.ink3 }, L("位置对三种数据类型都排第一；色相只对名义数据可靠。", "Position ranks first for all three types; hue is reliable only for nominal data.")));
      canvas.appendChild(svg);
    }

    function drawLoop() {
      const c = U.colors();
      const W = 660, H = 220, cx = W / 2, cy = 110, r = 70;
      const svg = U.s("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", role: "img", "aria-label": "van Wijk feedback loop" });
      const nodes = [
        { zh: "视图 View", en: "View", a: -90 },
        { zh: "筛选 Filter", en: "Filter", a: 30 },
        { zh: "参数 Param", en: "Param", a: 150 },
      ];
      const pos = nodes.map(n => ({ ...n, x: cx + r * Math.cos(n.a * Math.PI / 180), y: cy + r * Math.sin(n.a * Math.PI / 180) }));
      pos.forEach((n, i) => {
        const next = pos[(i + 1) % pos.length];
        const mx = (n.x + next.x) / 2, my = (n.y + next.y) / 2;
        svg.appendChild(U.s("path", {
          d: `M${n.x},${n.y} Q${mx + 28},${my - 28} ${next.x},${next.y}`,
          fill: "none", stroke: c.accent, "stroke-width": 1.4, "marker-end": "url(#arrow)",
        }));
      });
      svg.appendChild(U.s("defs", {}, U.s("marker", { id: "arrow", viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 5, markerHeight: 5, orient: "auto-start-reverse" },
        U.s("path", { d: "M0,0 L10,5 L0,10 z", fill: c.accent }))));
      pos.forEach((n) => {
        svg.appendChild(U.s("circle", { cx: n.x, cy: n.y, r: 34, fill: c.paper2, stroke: c.accent, "stroke-width": 1.2 }));
        svg.appendChild(U.s("text", { x: n.x, y: n.y + 3, "text-anchor": "middle", "font-family": "var(--font-mono)", "font-size": "9", fill: c.ink }, L(n.zh, n.en)));
      });
      svg.appendChild(U.s("text", { x: cx, y: cy + 5, "text-anchor": "middle", "font-family": "var(--font-display)", "font-size": "15", fill: c.accent }, "⇆"));
      svg.appendChild(U.s("text", { x: cx, y: H - 8, "text-anchor": "middle", "font-family": "var(--font-mono)", "font-size": "8.5", fill: c.ink3 }, L("反馈环是交互式可视化的核心：没有回路，就只是静态图。", "The feedback loop is the heart of interactive visualization.")));
      canvas.appendChild(svg);
    }

    function renderDetail() {
      U.clear(detail);
      if (model === "card") {
        const s = STAGES[stage];
        detail.appendChild(U.h("div", { class: "mono", style: "font-size:9px;letter-spacing:.1em;color:var(--accent)" }, `CARD · 0${stage + 1}`));
        detail.appendChild(U.h("div", { class: "pipeline__title" }, L(s.zh, s.en)));
        detail.appendChild(U.h("p", { class: "mini-note" }, L(s.detail[0], s.detail[1])));
      } else if (model === "mackinlay") {
        detail.appendChild(U.h("div", { class: "mono", style: "font-size:9px;letter-spacing:.1em;color:var(--accent)" }, "MACKINLAY 1986"));
        detail.appendChild(U.h("div", { class: "pipeline__title" }, L("按数据类型自动选通道", "Choose channels by data type")));
        detail.appendChild(U.h("p", { class: "mini-note" }, L("目标是量化误差最小：定量数据优先位置和长度，名义数据优先位置和色相。", "Minimize quantization error: position and length for quantitative data, position and hue for nominal data.")));
      } else {
        detail.appendChild(U.h("div", { class: "mono", style: "font-size:9px;letter-spacing:.1em;color:var(--accent)" }, "VAN WIJK 2005"));
        detail.appendChild(U.h("div", { class: "pipeline__title" }, L("交互反馈环", "The interaction feedback loop")));
        detail.appendChild(U.h("p", { class: "mini-note" }, L("用户改变筛选或参数 → 视图更新 → 用户再判断。这个回路才是可视化系统与静态图的区别。", "The user changes a filter or parameter → the view updates → the user evaluates again. This loop is what separates a visualization system from a static chart.")));
      }
    }

    render();
  });
})();
