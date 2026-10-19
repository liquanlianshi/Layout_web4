// 1.3 Stevens 尺度 × Mackinlay 通道矩阵
(function () {
  const L = (zh, en) => I18N.L(zh, en);
  const TYPES = [
    { zh: "名义", en: "Nominal", ex: ["姓名、性别、专业", "name, gender, major"] },
    { zh: "序数", en: "Ordinal", ex: ["班级序号、等级", "class rank, grade"] },
    { zh: "区间", en: "Interval", ex: ["摄氏温度", "Celsius temperature"] },
    { zh: "比率", en: "Ratio", ex: ["年龄、价格、人数", "age, price, count"] },
  ];
  const CHANNELS = [
    { zh: "位置", en: "Position", scores: [3, 3, 3, 3] },
    { zh: "长度", en: "Length", scores: [1, 2, 3, 3] },
    { zh: "角度", en: "Angle", scores: [0, 1, 2, 2] },
    { zh: "斜率", en: "Slope", scores: [0, 2, 2, 2] },
    { zh: "面积", en: "Area", scores: [1, 1, 2, 2] },
    { zh: "色相", en: "Hue", scores: [3, 1, 0, 0] },
    { zh: "形状", en: "Shape", scores: [2, 1, 0, 0] },
    { zh: "纹理", en: "Texture", scores: [2, 1, 0, 0] },
    { zh: "亮度", en: "Brightness", scores: [1, 2, 1, 1] },
    { zh: "体积", en: "Volume", scores: [1, 1, 1, 1] },
  ];
  const VALUES = [42, 31, 18, 9, 6, 3];
  const NAMES = ["A", "B", "C", "D", "E", "F"];

  registerWidget("scales", function (el) {
    let ti = 3, ci = 0;
    const matrixBox = U.h("div", { class: "matrix-wrap" });
    const detail = U.h("div", { class: "scales__detail" });
    const demo = U.h("div", { class: "scales__demo" });
    el.appendChild(U.h("div", { class: "viz__stack" },
      U.h("div", { class: "viz-toolbar" },
        U.h("div", { class: "viz-toolbar__group" },
          U.h("span", { class: "mono", style: "font-size:10px;color:var(--ink-3)" }, L("数据类型", "data type")),
          U.segmented({
            options: TYPES.map((t, i) => ({ label: L(t.zh, t.en), value: i })),
            value: ti,
            onChange: (v) => { ti = Number(v); render(); },
          }),
        ),
      ),
      matrixBox,
      U.h("div", { class: "viz__grid viz__grid--side" }, demo, detail),
    ));

    function render() {
      // 矩阵
      const c = U.colors();
      U.clear(matrixBox);
      const table = U.h("table", { class: "matrix" });
      const thead = U.h("thead");
      const hr = U.h("tr", {}, U.h("th", { class: "rowhead" }, ""));
      CHANNELS.forEach((ch) => hr.appendChild(U.h("th", {}, L(ch.zh, ch.en))));
      thead.appendChild(hr);
      table.appendChild(thead);
      const tbody = U.h("tbody");
      TYPES.forEach((t, ri) => {
        const tr = U.h("tr", {});
        tr.appendChild(U.h("th", { class: "rowhead" },
          U.h("span", { style: `display:inline-block;width:6px;height:6px;border-radius:50%;background:${c.accent};opacity:${0.35 + ri * 0.2};margin-right:6px` }),
          L(t.zh, t.en), U.h("i", { style: "font-style:normal;color:var(--ink-3);font-size:9px;margin-left:6px" }, L(t.ex[0], t.ex[1])),
        ));
        CHANNELS.forEach((ch, cix) => {
          const s = ch.scores[ri];
          const bg = d3.color(c.accent).copy({ opacity: 0.06 + s * 0.20 }).formatRgb();
          const btn = U.h("button", {
            type: "button", class: "cell" + (ri === ti && cix === ci ? " is-on" : ""),
            style: `background:${bg}`,
            title: `${L(t.zh, t.en)} × ${L(ch.zh, ch.en)}`,
            "aria-label": `${L(t.zh, t.en)} × ${L(ch.zh, ch.en)}: ${s}/3`,
            onclick: () => { ti = ri; ci = cix; render(); },
          }, "●".repeat(s) + "○".repeat(3 - s));
          tr.appendChild(U.h("td", {}, btn));
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      matrixBox.appendChild(table);

      const t = TYPES[ti], ch = CHANNELS[ci], s = ch.scores[ti];
      const verdict = s === 3 ? L("精确匹配", "precise match") : s === 2 ? L("可用，精度下降", "works, less precise") : s === 1 ? L("只能表达类别/粗略顺序", "category or rough order only") : L("错配", "mismatch");
      U.clear(detail);
      detail.appendChild(U.h("div", { class: "mono", style: "font-size:9px;letter-spacing:.1em;color:var(--ink-3)" }, `${L(t.zh, t.en)} × ${L(ch.zh, ch.en)}`));
      detail.appendChild(U.h("div", { class: "scales__verdict" }, verdict));
      detail.appendChild(U.h("p", { class: "mini-note" }, explain(s, t, ch)));
      detail.appendChild(U.h("div", { class: `pill ${s === 3 ? "pill--ok" : s === 2 ? "pill--warn" : "pill--bad"}`, style: "margin-top:8px" }, `${s} / 3`));

      drawDemo(t, ch, s);
    }

    function explain(s, t, ch) {
      if (s === 3) return L(`位置/长度这类通道有共同的尺度，读者可以直接比较倍数；${t.zh}数据用${ch.zh}编码最稳。`, `Channels like position and length share a scale, so readers can compare ratios directly. ${ch.en} is a strong encoding for ${t.en} data.`);
      if (s === 2) return L(`能读出顺序和大致差异，但不要指望读者精确比较；配合标签会更稳。`, `Order and rough differences are readable, but do not expect precise comparisons. Add labels.`);
      if (s === 1) return L(`这个通道主要用来区分「是不是同一类」，而不是「多多少」。`, `This channel mainly distinguishes categories, not magnitudes.`);
      return L(`这个通道无法承载${t.zh}数据的语义：读者会读不出顺序或数量。换位置或长度。`, `This channel cannot carry the semantics of ${t.en} data. Readers cannot recover order or magnitude. Use position or length.`);
    }

    function drawDemo(t, ch, s) {
      U.clear(demo);
      const c = U.colors();
      const W = 430, H = 170, m = { t: 18, r: 12, b: 24, l: 12 };
      const svg = U.s("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", role: "img", "aria-label": "encoding demo" });
      const x = d3.scalePoint().domain(NAMES).range([m.l + 24, W - m.r - 24]).padding(.5);
      const v = d3.scaleLinear().domain([0, 45]).range([0, 110]);
      const baseY = H - m.b - 14;
      const colors = d3.scaleOrdinal().domain(NAMES).range([c.accent, c.blue, c.accent2, c.gold, c.plum, c.ink3]);

      NAMES.forEach((n, i) => {
        const val = VALUES[i];
        const cx = x(n);
        if (ch.zh === "位置") {
          const px = d3.scaleLinear().domain([0, 45]).range([m.l + 20, W - m.r - 20])(val);
          svg.appendChild(U.s("line", { x1: m.l + 20, x2: W - m.r - 20, y1: baseY - 40, y2: baseY - 40, stroke: c.line2, "stroke-dasharray": "1 3" }));
          svg.appendChild(U.s("circle", { cx: px, cy: baseY - 40, r: 6, fill: c.accent }));
          svg.appendChild(U.s("text", { x: px, y: baseY - 52, "text-anchor": "middle", "font-family": "var(--font-mono)", "font-size": "8", fill: c.ink2 }, val));
        } else if (ch.zh === "长度") {
          svg.appendChild(U.s("rect", { x: cx - 14, y: baseY - v(val), width: 28, height: v(val), fill: c.accent, opacity: .82 }));
          svg.appendChild(U.s("text", { x: cx, y: baseY - v(val) - 5, "text-anchor": "middle", "font-family": "var(--font-mono)", "font-size": "8", fill: c.ink2 }, val));
        } else if (ch.zh === "角度") {
          const ang = (val / 45) * 150 - 75;
          const g = U.s("g", { transform: `translate(${cx},${baseY - 10}) rotate(${ang})` });
          g.appendChild(U.s("line", { x1: 0, y1: 0, x2: 0, y2: -62, stroke: c.accent, "stroke-width": 2 }));
          g.appendChild(U.s("circle", { cx: 0, cy: -62, r: 3, fill: c.accent }));
          svg.appendChild(g);
        } else if (ch.zh === "斜率") {
          const hgt = v(val);
          svg.appendChild(U.s("line", { x1: cx - 18, y1: baseY, x2: cx + 18, y2: baseY - hgt, stroke: c.accent, "stroke-width": 2 }));
          svg.appendChild(U.s("circle", { cx: cx + 18, cy: baseY - hgt, r: 3, fill: c.accent }));
        } else if (ch.zh === "面积") {
          const r = Math.sqrt(val) * 2.2;
          svg.appendChild(U.s("circle", { cx, cy: baseY - 34, r, fill: c.accent, opacity: .7, stroke: c.accent }));
        } else if (ch.zh === "色相") {
          svg.appendChild(U.s("circle", { cx, cy: baseY - 34, r: 12, fill: colors(n) }));
        } else if (ch.zh === "形状") {
          const sym = d3.symbol().type([d3.symbolCircle, d3.symbolSquare, d3.symbolTriangle, d3.symbolDiamond, d3.symbolCross, d3.symbolStar][i]).size(170)();
          svg.appendChild(U.s("path", { d: sym, transform: `translate(${cx},${baseY - 34})`, fill: c.ink2 }));
        } else if (ch.zh === "纹理") {
          svg.appendChild(U.s("circle", { cx, cy: baseY - 34, r: 13, fill: "none", stroke: c.accent, "stroke-width": 2, "stroke-dasharray": `${2 + i} ${2 + (i % 2)}` }));
        } else if (ch.zh === "亮度") {
          svg.appendChild(U.s("circle", { cx, cy: baseY - 34, r: 13, fill: c.accent, opacity: 0.2 + (val / 45) * 0.8 }));
        } else {
          const r = 8 + (val / 45) * 5;
          svg.appendChild(U.s("circle", { cx, cy: baseY - 34, r, fill: `url(#vol${i})`, stroke: c.accent }));
          const defs = U.s("defs", {}, U.s("radialGradient", { id: `vol${i}`, cx: "35%", cy: "30%" },
            U.s("stop", { offset: "0%", "stop-color": "#fff", "stop-opacity": .85 }),
            U.s("stop", { offset: "100%", "stop-color": c.accent })));
          svg.appendChild(defs);
        }
        svg.appendChild(U.s("text", { x: cx, y: baseY + 16, "text-anchor": "middle", "font-family": "var(--font-mono)", "font-size": "8.5", fill: c.ink3 }, n));
      });
      demo.appendChild(svg);
      const label = ch.zh === "长度" ? L("条形图", "bar chart") : ch.zh === "位置" ? L("点图", "dot plot") : ch.zh === "面积" ? L("气泡图", "bubble chart") : ch.zh === "色相" ? L("分类着色", "categorical color") : L("通道演示", "channel demo");
      demo.appendChild(U.h("div", { class: "mini-note", style: "margin-top:4px" }, `${L(t.zh, t.en)} × ${L(ch.zh, ch.en)} → ${label}`));
    }

    render();
  });
})();
