// 3.x 色彩实验室：色板 / colormap / 色域 / 配色 / CVD
(function () {
  const L = (zh, en) => I18N.L(zh, en);
  const { simulate, contrast, deltaE, PALETTES } = CORE;
  const CVD = [
    { value: "none", zh: "正常", en: "Normal" },
    { value: "protan", zh: "红色盲", en: "Protanopia" },
    { value: "deutan", zh: "绿色盲", en: "Deuteranopia" },
    { value: "tritan", zh: "蓝色盲", en: "Tritanopia" },
  ];
  const MAPS = [
    { value: "viridis", zh: "Viridis 顺序", en: "Viridis sequential" },
    { value: "rdbu", zh: "RdBu 发散", en: "RdBu diverging" },
    { value: "tableau", zh: "Tableau10 定性", en: "Tableau10 qualitative" },
    { value: "jet", zh: "Jet 彩虹（反例）", en: "Jet rainbow (avoid)" },
  ];
  const jetRamp = d3.interpolateRgbBasis(PALETTES.jet.colors);
  const mapColor = (map, t, idx = 0) => {
    if (map === "viridis") return d3.interpolateViridis(U.clamp(t, 0, 1));
    if (map === "rdbu") return d3.interpolateRdBu(U.clamp(t, 0, 1));
    if (map === "jet") return jetRamp(U.clamp(t, 0, 1));
    return d3.schemeTableau10[idx % 10];
  };

  function swatches(colors, mode, opts = {}) {
    const box = U.h("div", { class: "swatches" });
    colors.forEach((hex) => {
      const shown = simulate(hex, mode);
      const el = U.h("div", { class: "swatch" + (opts.tall ? " swatch--tall" : ""), style: `background:${shown}`, title: `${hex} → ${shown}` }, U.h("span", {}, hex));
      box.appendChild(el);
    });
    return box;
  }

  function sampleChart(host, colors, mode, kind = "bar") {
    host.innerHTML = "";
    const shown = colors.map(c => simulate(c, mode));
    CORE.chart(host, { aspect: kind === "line" ? 0.42 : 0.4 }, (svg, W, H) => {
      const c = U.colors();
      const m = { t: 14, r: 12, b: 24, l: 26 };
      const iw = W - m.l - m.r, ih = H - m.t - m.b;
      if (kind === "bar") {
        const cats = ["A", "B", "C", "D", "E", "F"].slice(0, Math.min(6, shown.length));
        const vals = [42, 31, 24, 18, 12, 7];
        const x = d3.scaleBand().domain(cats).range([m.l, W - m.r]).padding(.28);
        const y = d3.scaleLinear().domain([0, 45]).range([m.t + ih, m.t]);
        svg.selectAll("rect").data(cats).join("rect")
          .attr("x", d => x(d)).attr("y", d => y(vals[cats.indexOf(d)]))
          .attr("width", x.bandwidth()).attr("height", d => y(0) - y(vals[cats.indexOf(d)]))
          .attr("fill", (d, i) => shown[i]);
        svg.selectAll("text.val").data(cats).join("text").attr("class", "val")
          .attr("x", d => x(d) + x.bandwidth() / 2).attr("y", d => y(vals[cats.indexOf(d)]) - 4)
          .attr("text-anchor", "middle").attr("font-family", "var(--font-mono)").attr("font-size", "8").attr("fill", c.ink3)
          .text(d => vals[cats.indexOf(d)]);
      } else if (kind === "line") {
        const n = 12;
        const x = d3.scalePoint().domain(d3.range(n)).range([m.l, W - m.r]);
        const y = d3.scaleLinear().domain([0, 100]).range([m.t + ih, m.t]);
        const series = shown.slice(0, 5).map((col, si) => ({
          col,
          vals: d3.range(n).map(i => 20 + 55 * Math.abs(Math.sin(i * .55 + si * 1.2)) + si * 4),
        }));
        series.forEach(s => {
          const line = d3.line().x(i => x(i)).y(i => y(s.vals[i])).curve(d3.curveMonotoneX);
          svg.append("path").attr("d", line(d3.range(n))).attr("fill", "none").attr("stroke", s.col).attr("stroke-width", 1.8);
        });
      } else {
        const cats = shown.slice(0, 5);
        const rnd = d3.randomNormal(0, 1);
        cats.forEach((col, ci) => {
          for (let i = 0; i < 9; i++) {
            svg.append("circle").attr("cx", m.l + 14 + ci * ((iw - 20) / cats.length) + rnd() * 7)
              .attr("cy", m.t + ih / 2 + rnd() * ih * .28).attr("r", 4).attr("fill", col).attr("opacity", .85);
          }
          svg.append("text").attr("x", m.l + 14 + ci * ((iw - 20) / cats.length)).attr("y", H - 8)
            .attr("text-anchor", "middle").attr("font-family", "var(--font-mono)").attr("font-size", "8").attr("fill", c.ink3)
            .text(String.fromCharCode(65 + ci));
        });
      }
      svg.append("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", m.t + ih).attr("y2", m.t + ih).attr("stroke", c.line);
    });
  }

  // ---------- 色板 + CVD ----------
  function paletteMode(host, opts = {}) {
    let pal = opts.palette || "wong";
    let mode = "none";
    let kind = "bar";
    const sw = U.h("div");
    const chartHost = U.h("div");
    const readout = U.h("div", { class: "readout" });
    const controls = U.h("div", { class: "viz-toolbar" });
    host.appendChild(U.h("div", { class: "viz__stack" }, controls, sw, chartHost, readout));

    controls.appendChild(U.select({
      label: L("色板", "palette"), value: pal,
      options: Object.entries(PALETTES).map(([k, v]) => ({ value: k, label: L(v.zh, v.en) })),
      onChange: (v) => { pal = v; render(); },
    }));
    const cvdSeg = U.segmented({
      options: CVD.map(x => ({ label: L(x.zh, x.en), value: x.value })), value: 0,
      onChange: (v) => { mode = v; render(); },
    });
    controls.appendChild(U.h("div", { class: "ctl" }, U.h("span", { class: "ctl__label" }, L("色觉模拟", "CVD simulation")), cvdSeg));
    controls.appendChild(U.select({
      label: L("示例图", "sample"), value: kind,
      options: [{ value: "bar", label: L("分组条形", "bars") }, { value: "line", label: L("多线折线", "lines") }, { value: "scatter", label: L("分类散点", "scatter") }],
      onChange: (v) => { kind = v; render(); },
    }));

    function render() {
      const colors = PALETTES[pal].colors;
      U.clear(sw);
      sw.appendChild(swatches(colors, mode, { tall: true }));
      sampleChart(chartHost, colors, mode, kind);
      const minDE = minPairDelta(colors.slice(0, 6), mode);
      const minC = Math.min(...colors.slice(0, 6).map(c => contrast(simulate(c, mode), U.colors().paper)));
      U.clear(readout);
      readout.appendChild(U.h("span", {}, L("最小色差", "min ΔE"), " ", U.h("b", { style: minDE < 5 ? "color:var(--accent)" : "color:var(--accent-2)" }, minDE.toFixed(1))));
      readout.appendChild(U.h("span", {}, L("与纸面最小对比", "min contrast vs paper"), " ", U.h("b", {}, minC.toFixed(1) + ":1")));
      readout.appendChild(U.h("span", {}, mode === "none" ? L("未开启模拟", "simulation off") : CVD.find(x => x.value === mode)[I18N.lang === "en" ? "en" : "zh"]));
    }
    render();
  }

  function minPairDelta(colors, mode) {
    let min = Infinity;
    for (let i = 0; i < colors.length; i++) {
      for (let j = i + 1; j < colors.length; j++) {
        min = Math.min(min, deltaE(simulate(colors[i], mode), simulate(colors[j], mode)));
      }
    }
    return min === Infinity ? 0 : min;
  }

  // ---------- colormap ----------
  function colormapMode(host) {
    let scenario = "seq", map = "viridis";
    const controls = U.h("div", { class: "viz-toolbar" });
    const strip = U.h("div");
    const chartHost = U.h("div");
    const verdict = U.h("div", { class: "rec-card", style: "margin-top:10px" });
    host.appendChild(U.h("div", { class: "viz__stack" }, controls, strip, chartHost, verdict));

    controls.appendChild(U.select({
      label: L("数据语义", "data semantics"), value: scenario,
      options: [{ value: "seq", label: L("顺序：0 → 1", "sequential: 0 → 1") }, { value: "div", label: L("发散：−1 → 0 → 1", "diverging: −1 → 0 → 1") }, { value: "qual", label: L("定性：6 个类别", "qualitative: 6 categories") }],
      onChange: v => { scenario = v; render(); },
    }));
    controls.appendChild(U.select({
      label: L("colormap", "colormap"), value: map,
      options: MAPS.map(m => ({ value: m.value, label: L(m.zh, m.en) })),
      onChange: v => { map = v; render(); },
    }));

    function render() {
      U.clear(strip);
      const steps = 48;
      const bar = U.h("div", { class: "swatches", style: "height:22px" });
      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        bar.appendChild(U.h("div", { style: `flex:1;background:${scenario === "qual" ? mapColor(map, 0, i % 10) : mapColor(map, t)}` }));
      }
      strip.appendChild(bar);
      strip.appendChild(U.h("div", { style: "display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:9px;color:var(--ink-3);margin-top:3px" },
        U.h("span", {}, scenario === "div" ? "−1" : scenario === "qual" ? L("类别", "categories") : "0"),
        U.h("span", {}, scenario === "div" ? "0" : "→"),
        U.h("span", {}, scenario === "div" ? "+1" : scenario === "qual" ? "" : "1")));

      // 热图
      chartHost.innerHTML = "";
      const n = 9;
      CORE.chart(chartHost, { aspect: 0.42 }, (svg, W, H) => {
        const c = U.colors();
        const cell = Math.min((W - 80) / n, (H - 30) / n);
        const x0 = 50, y0 = 10;
        for (let r = 0; r < n; r++) {
          for (let col = 0; col < n; col++) {
            const v = scenario === "qual"
              ? (r * n + col) % 6
              : scenario === "div"
                ? (Math.sin((r - 4) / 2) * Math.cos((col - 4) / 2)) * 1.1
                : U.clamp((Math.sin(r / 2) * Math.cos(col / 2) + 1) / 2, 0, 1);
            const fill = scenario === "qual" ? mapColor(map, 0, v) : mapColor(map, scenario === "div" ? (v + 1) / 2 : v);
            svg.node().appendChild(U.s("rect", { x: x0 + col * cell, y: y0 + r * cell, width: cell - 1, height: cell - 1, fill }));
          }
        }
      });

      // 判定
      const correct = (scenario === "seq" && map === "viridis") || (scenario === "div" && map === "rdbu") || (scenario === "qual" && map === "tableau");
      const bad = map === "jet";
      verdict.style.borderLeftColor = correct && !bad ? "var(--accent-2)" : "var(--accent)";
      U.clear(verdict);
      verdict.appendChild(U.h("div", { class: "mono", style: "font-size:9px;letter-spacing:.1em;color:var(--ink-3)" }, correct && !bad ? L("✓ 匹配", "✓ matched") : L("✗ 不匹配", "✗ mismatched")));
      verdict.appendChild(U.h("div", { class: "rec-card__name" }, bad ? L("Jet：看起来热闹，读起来错", "Jet: loud but misleading") : correct ? L("类型与语义一致", "Type matches semantics") : L("颜色在替数据说谎", "The colors misrepresent the data")));
      verdict.appendChild(U.h("p", { class: "rec-card__why" }, explainColormap(scenario, map, correct, bad)));
    }

    function explainColormap(scenario, map, correct, bad) {
      if (bad) return L("Jet 不是感知均匀的：中段出现假的亮带，色盲不友好，灰度打印也会丢顺序。换 Viridis。", "Jet is not perceptually uniform: it creates false bright bands, fails CVD, and loses order in grayscale. Use Viridis.");
      if (correct) return {
        seq: L("顺序数据配顺序色：亮度单调变化，读者能读出大小方向。", "Ordered data with a sequential map: lightness changes monotonically, so magnitude is readable."),
        div: L("发散数据配发散色：中间浅色对应 0，两端表示正负偏离。", "Diverging data with a diverging map: the pale middle is zero, the ends are positive/negative departure."),
        qual: L("无序类别配定性色：色相区分，亮度接近，不暗示顺序。", "Unordered categories with a qualitative palette: hue separates, lightness stays close, no implied order."),
      }[scenario];
      if (scenario === "seq" && map === "rdbu") return L("RdBu 的中间浅色会被读成「中点」，但顺序数据没有中点。改用 Viridis。", "RdBu's pale middle reads as a midpoint, but sequential data has none. Use Viridis.");
      if (scenario === "div" && map === "viridis") return L("Viridis 没有中点：正负偏离看起来只是「小和大」，丢掉了 0 的语义。改用 RdBu。", "Viridis has no midpoint: positive and negative departures look merely small and large. Use RdBu.");
      if (scenario === "qual" && map !== "tableau") return L("连续色给无序类别带来假顺序，读者会以为 A 比 B「更大」。改用定性色。", "A continuous map gives unordered categories a false order; readers think A is 'more' than B. Use a qualitative palette.");
      return L("换一种类型试试。", "Try another type.");
    }
    render();
  }

  // ---------- Lab 色域 ----------
  function gamutMode(host) {
    let Lval = 65, pick = { a: 34, b: 22 };
    const chartHost = U.h("div");
    const readout = U.h("div", { class: "gamut__readout" });
    const controls = U.h("div", { class: "viz-toolbar" });
    host.appendChild(U.h("div", { class: "viz__stack" }, controls, U.h("div", { class: "viz__grid viz__grid--side" }, chartHost, readout)));

    controls.appendChild(U.slider({
      label: L("亮度 L*", "lightness L*"), min: 20, max: 95, step: 1, value: Lval,
      fmt: v => v, onInput: v => { Lval = v; render(); },
    }));

    function boundary() {
      const pts = [];
      for (let h = 0; h < 360; h += 2) {
        let best = 0;
        for (let c = 0; c <= 150; c += 2) {
          const lab = d3.lab(Lval, c * Math.cos(h * Math.PI / 180), c * Math.sin(h * Math.PI / 180));
          if (lab.rgb().displayable()) best = c; else break;
        }
        const rad = h * Math.PI / 180;
        pts.push([best * Math.cos(rad), best * Math.sin(rad)]);
      }
      return pts;
    }

    function render() {
      const c = U.colors();
      const pts = boundary();
      CORE.chart(chartHost, { aspect: 0.72 }, (svg, W, H) => {
        const m = { l: 34, r: 16, t: 14, b: 30 };
        const x = d3.scaleLinear().domain([-100, 100]).range([m.l, W - m.r]);
        const y = d3.scaleLinear().domain([-100, 100]).range([H - m.b, m.t]);
        // 网格
        [-80, -40, 0, 40, 80].forEach(v => {
          svg.node().appendChild(U.s("line", { x1: x(v), x2: x(v), y1: m.t, y2: H - m.b, stroke: c.line2, "stroke-dasharray": "1 4" }));
          svg.node().appendChild(U.s("line", { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), stroke: c.line2, "stroke-dasharray": "1 4" }));
        });
        svg.node().appendChild(U.s("line", { x1: x(0), x2: x(0), y1: m.t, y2: H - m.b, stroke: c.line }));
        svg.node().appendChild(U.s("line", { x1: m.l, x2: W - m.r, y1: y(0), y2: y(0), stroke: c.line }));
        svg.node().appendChild(U.s("text", { x: W - m.r, y: y(0) - 4, "text-anchor": "end", "font-family": "var(--font-mono)", "font-size": "8", fill: c.ink3 }, "a* →"));
        svg.node().appendChild(U.s("text", { x: x(0) + 4, y: m.t + 8, "font-family": "var(--font-mono)", "font-size": "8", fill: c.ink3 }, "↑ b*"));
        const path = pts.map((p, i) => `${i ? "L" : "M"}${x(p[0])},${y(p[1])}`).join(" ") + "Z";
        svg.node().appendChild(U.s("path", { d: path, fill: c.accent, "fill-opacity": .10, stroke: c.accent, "stroke-width": 1.2 }));
        // 已选颜色
        const hex = d3.lab(Lval, pick.a, pick.b).rgb().formatHex();
        const P = { x: x(pick.a), y: y(pick.b) };
        svg.node().appendChild(U.s("line", { x1: P.x, x2: P.x, y1: P.y, y2: H - m.b, stroke: c.ink3, "stroke-dasharray": "2 2" }));
        svg.node().appendChild(U.s("line", { x1: m.l, x2: P.x, y1: P.y, y2: P.y, stroke: c.ink3, "stroke-dasharray": "2 2" }));
        svg.node().appendChild(U.s("circle", { cx: P.x, cy: P.y, r: 8, fill: hex, stroke: "#fff", "stroke-width": 1.5 }));
        svg.node().appendChild(U.s("circle", { cx: P.x, cy: P.y, r: 10, fill: "none", stroke: c.ink }));
        // 点击
        svg.on("click", (event) => {
          const [mx, my] = d3.pointer(event, svg.node());
          const a = x.invert(mx), b = y.invert(my);
          if (Math.abs(a) > 100 || Math.abs(b) > 100) return;
          pick = { a, b };
          render();
        });
      });

      const rgb = d3.lab(Lval, pick.a, pick.b).rgb();
      const hex = rgb.formatHex();
      U.clear(readout);
      readout.appendChild(U.h("div", { class: "gamut__chip", style: `background:${hex}` }));
      readout.appendChild(U.h("div", { class: "gamut__vals" },
        U.h("div", {}, U.h("span", {}, "L*"), U.h("b", {}, Lval)),
        U.h("div", {}, U.h("span", {}, "a*"), U.h("b", {}, pick.a.toFixed(0))),
        U.h("div", {}, U.h("span", {}, "b*"), U.h("b", {}, pick.b.toFixed(0))),
        U.h("div", {}, U.h("span", {}, "hex"), U.h("b", {}, hex)),
        U.h("div", {}, U.h("span", {}, "ΔE vs white"), U.h("b", {}, deltaE(hex, "#ffffff").toFixed(0))),
      ));
      readout.appendChild(U.h("div", { class: `pill ${rgb.displayable() ? "pill--ok" : "pill--bad"}` }, rgb.displayable() ? L("在 sRGB 内", "inside sRGB") : L("超出 sRGB，会被裁切", "outside sRGB, clipped")));
      readout.appendChild(U.h("p", { class: "mini-note", style: "margin-top:8px" }, L("点击色域内任意位置取色。L* 越高，色域越小。", "Click inside the gamut to pick a color. Higher L* means a smaller gamut.")));
    }
    render();
  }

  // ---------- 配色规则 ----------
  function harmonyMode(host) {
    let hue = 18, scheme = "analogous";
    const controls = U.h("div", { class: "viz-toolbar" });
    const wheelBox = U.h("div");
    const swBox = U.h("div");
    const chartHost = U.h("div");
    const verdict = U.h("div", { class: "readout" });
    host.appendChild(U.h("div", { class: "viz__stack" }, controls, U.h("div", { class: "harmony__grid" }, wheelBox, U.h("div", { class: "viz__stack" }, swBox, verdict)), chartHost));

    controls.appendChild(U.slider({ label: L("基色 H", "base hue"), min: 0, max: 359, step: 1, value: hue, fmt: v => `${v}°`, onInput: v => { hue = v; render(); } }));
    controls.appendChild(U.h("div", { class: "ctl" }, U.h("span", { class: "ctl__label" }, L("规则", "scheme")),
      U.segmented({
        options: [
          { value: "mono", label: L("单色", "mono") },
          { value: "analogous", label: L("类比", "analogous") },
          { value: "complementary", label: L("互补", "complement") },
          { value: "triadic", label: L("三等分", "triadic") },
          { value: "split", label: L("分裂互补", "split") },
        ], value: 1,
        onChange: (v) => { scheme = v; render(); },
      })));

    function colors() {
      const h = (x) => ((x % 360) + 360) % 360;
      const mk = (dh, s, l) => d3.hsl(h(hue + dh), s / 100, l / 100).formatHex();
      if (scheme === "mono") return [mk(0, 72, 36), mk(0, 62, 48), mk(0, 52, 58), mk(0, 38, 70), mk(0, 22, 84)];
      if (scheme === "analogous") return [mk(-40, 62, 42), mk(-20, 68, 50), mk(0, 72, 46), mk(20, 58, 56), mk(40, 42, 66)];
      if (scheme === "complementary") return [mk(0, 72, 44), mk(0, 52, 62), mk(180, 68, 44), mk(180, 44, 64), mk(0, 16, 86)];
      if (scheme === "triadic") return [mk(0, 68, 46), mk(120, 62, 48), mk(240, 58, 52), mk(0, 30, 78), mk(120, 30, 82)];
      return [mk(0, 70, 46), mk(150, 56, 48), mk(210, 52, 50), mk(0, 26, 80), mk(180, 28, 84)];
    }

    function drawWheel(cols) {
      U.clear(wheelBox);
      const W = 220, H = 220, cx = 110, cy = 110;
      const svg = U.s("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", role: "img", "aria-label": "hue wheel" });
      const arc = d3.arc().innerRadius(52).outerRadius(86);
      for (let a = 0; a < 360; a += 4) {
        const p = arc({ startAngle: (a - 90) * Math.PI / 180, endAngle: (a - 86) * Math.PI / 180 });
        svg.appendChild(U.s("path", { d: p, transform: `translate(${cx},${cy})`, fill: d3.hsl(a, .68, .5).formatHex() }));
      }
      cols.forEach((hex, i) => {
        const hh = d3.hsl(hex).h;
        const rad = (hh - 90) * Math.PI / 180;
        const x = cx + 96 * Math.cos(rad), y = cy + 96 * Math.sin(rad);
        svg.appendChild(U.s("circle", { cx: x, cy: y, r: 6, fill: hex, stroke: "#fff", "stroke-width": 1.5 }));
      });
      svg.appendChild(U.s("circle", { cx, cy, r: 48, fill: "var(--paper-2)", stroke: "var(--line)" }));
      svg.appendChild(U.s("text", { x: cx, y: cy + 3, "text-anchor": "middle", "font-family": "var(--font-mono)", "font-size": "9", fill: "var(--ink-3)" }, `${hue}°`));
      wheelBox.appendChild(svg);
    }

    function render() {
      const cols = colors();
      drawWheel(cols);
      U.clear(swBox);
      swBox.appendChild(swatches(cols, "none", { tall: true }));
      sampleChart(chartHost, cols, "none", "bar");
      const minDE = minPairDelta(cols.slice(0, 5), "none");
      U.clear(verdict);
      verdict.appendChild(U.h("span", {}, L("最小色差", "min ΔE"), " ", U.h("b", {}, minDE.toFixed(1))));
      verdict.appendChild(U.h("span", {}, L("5 色 · 类别之间仍有区分", "5 colors · still distinguishable")));
    }
    render();
  }

  // ---------- 经典色板墙 ----------
  function palettesMode(host) {
    let mode = "none";
    const controls = U.h("div", { class: "viz-toolbar" });
    const grid = U.h("div", { class: "palette-wall" });
    host.appendChild(U.h("div", { class: "viz__stack" }, controls, grid));
    controls.appendChild(U.h("div", { class: "ctl" }, U.h("span", { class: "ctl__label" }, L("色觉模拟", "CVD simulation")),
      U.segmented({ options: CVD.map(x => ({ label: L(x.zh, x.en), value: x.value })), value: 0, onChange: v => { mode = v; render(); } })));

    function render() {
      U.clear(grid);
      ["wong", "tol", "tableau", "viridis", "rdbu", "jet"].forEach(key => {
        const p = PALETTES[key];
        const card = U.h("div", { class: "palette-card" + (key === "jet" ? " is-bad" : "") });
        card.appendChild(U.h("div", { class: "palette-card__head" }, U.h("b", {}, L(p.zh, p.en)), U.h("span", {}, key === "jet" ? "⚠" : minPairDelta(p.colors.slice(0, 6), mode) > 5 ? "✓" : "△")));
        card.appendChild(swatches(p.colors, mode));
        card.appendChild(U.h("div", { class: "palette-card__meta" }, L("最小 ΔE", "min ΔE"), " ", minPairDelta(p.colors.slice(0, 6), mode).toFixed(1)));
        grid.appendChild(card);
      });
    }
    render();
  }

  // ---------- 对错案例 ----------
  function quizMode(host) {
    const cards = [
      { id: "jet", zh: "Jet 彩虹热图", en: "Jet rainbow heatmap", right: false, why: ["Jet 非感知均匀，制造假边界，且对 CVD 与灰度打印都不友好。", "Jet is not perceptually uniform, invents boundaries, and fails CVD and grayscale."] },
      { id: "redgreen", zh: "红绿双线", en: "Red-green lines", right: false, why: ["红绿在绿色盲眼中几乎同色；应改用橙/蓝并加线型。", "Red and green collapse for deuteranopes; use orange/blue plus line styles."] },
      { id: "many", zh: "12 色分类", en: "12-color categories", right: false, why: ["超过约 7 类后，色相不再可靠；应归并或分面。", "Beyond about seven categories hue is unreliable; merge or facet."] },
      { id: "wong", zh: "Wong 8 色", en: "Wong 8", right: true, why: ["CVD 友好、灰度友好、类别数 ≤ 8，是这四张里唯一稳妥的选择。", "CVD-safe, grayscale-safe, and ≤ 8 categories: the only robust choice here."] },
    ];
    let answered = null, cvd = "none";
    const grid = U.h("div", { class: "quiz-grid" });
    const controls = U.h("div", { class: "viz-toolbar" });
    const verdict = U.h("div", { class: "quiz-verdict" });
    host.appendChild(U.h("div", { class: "viz__stack" }, controls, grid, verdict));
    controls.appendChild(U.h("div", { class: "ctl" }, U.h("span", { class: "ctl__label" }, L("查看 CVD", "view CVD")),
      U.segmented({ options: CVD.map(x => ({ label: L(x.zh, x.en), value: x.value })), value: 0, onChange: v => { cvd = v; render(); } })));

    function mini(card) {
      const box = U.h("div", { class: "quiz-card__chart" });
      CORE.chart(box, { aspect: 0.5 }, (svg, W, H) => {
        const c = U.colors();
        if (card.id === "jet") {
          for (let r = 0; r < 6; r++) for (let col = 0; col < 8; col++) {
            const t = (Math.sin(r) * Math.cos(col) + 1) / 2;
            svg.append("rect").attr("x", col * (W / 8)).attr("y", r * (H / 6)).attr("width", W / 8 - 1).attr("height", H / 6 - 1).attr("fill", jetRamp(t));
          }
        } else if (card.id === "redgreen") {
          const x = d3.scalePoint().domain(d3.range(8)).range([10, W - 10]);
          const y = d3.scaleLinear().domain([0, 100]).range([H - 8, 8]);
          [["#d62728", [20, 35, 42, 55, 62, 75, 82, 90]], ["#2ca02c", [18, 30, 45, 50, 60, 70, 80, 88]]].forEach(([col, vals], si) => {
            svg.append("path").attr("d", d3.line().x(i => x(i)).y(i => y(vals[i])).curve(d3.curveMonotoneX)(d3.range(8)))
              .attr("fill", "none").attr("stroke", simulate(col, cvd)).attr("stroke-width", 1.8);
          });
        } else if (card.id === "many") {
          const cats = d3.range(12);
          const cols = d3.schemeTableau10.concat(["#8c564b", "#e377c2"]);
          const x = d3.scaleBand().domain(cats).range([0, W]).padding(.1);
          cats.forEach(i => svg.append("rect").attr("x", x(i)).attr("y", H - (H * .25 + (i % 7) * H * .08)).attr("width", x.bandwidth()).attr("height", H * .25 + (i % 7) * H * .08).attr("fill", simulate(cols[i], cvd)));
        } else {
          const cols = PALETTES.wong.colors;
          const x = d3.scaleBand().domain(d3.range(8)).range([0, W]).padding(.16);
          d3.range(8).forEach(i => svg.append("rect").attr("x", x(i)).attr("y", H - (30 + i * 8) * (H / 120)).attr("width", x.bandwidth()).attr("height", (30 + i * 8) * (H / 120)).attr("fill", simulate(cols[i], cvd)));
        }
      });
      return box;
    }

    function render() {
      U.clear(grid);
      cards.forEach(card => {
        const el = U.h("button", { type: "button", class: "quiz-card" + (answered ? (card.right ? " is-correct" : " is-wrong") : "") + (answered === card.id ? " is-picked" : ""), onclick: () => { answered = card.id; render(); } },
          U.h("div", { class: "quiz-card__head" }, U.h("b", {}, L(card.zh, card.en)), U.h("span", {}, answered ? (card.right ? "✓" : "✕") : "?")),
          mini(card),
          U.h("div", { class: "quiz-card__why" }, answered ? L(card.why[0], card.why[1]) : L("点击选择你认为「对」的那张", "Click the one you think is right")),
        );
        grid.appendChild(el);
      });
      U.clear(verdict);
      if (answered) {
        const right = answered === "wong";
        verdict.className = "quiz-verdict " + (right ? "is-ok" : "is-no");
        verdict.textContent = right ? L("答对了：Wong 8 色是唯一同时通过 CVD 与灰度检查的选项。", "Correct: Wong 8 is the only option that passes both CVD and grayscale checks.") : L("再想想：这张图的问题在下面的解释里。答案是 Wong 8 色。", "Not quite. Read the explanation, then note that Wong 8 is the answer.");
      } else {
        verdict.className = "quiz-verdict";
        verdict.textContent = L("四张图，三错一对。", "Four charts: three wrong, one right.");
      }
    }
    render();
  }

  // ---------- 7 色生成器 ----------
  function generatorMode(host) {
    let hue = 18, sat = 72, light = 48;
    const controls = U.h("div", { class: "viz-toolbar" });
    const swBox = U.h("div");
    const chartHost = U.h("div");
    const readout = U.h("div", { class: "readout" });
    host.appendChild(U.h("div", { class: "viz__stack" }, controls, swBox, chartHost, readout));

    controls.appendChild(U.slider({ label: L("主色 H", "primary hue"), min: 0, max: 359, step: 1, value: hue, fmt: v => `${v}°`, onInput: v => { hue = v; render(); } }));
    controls.appendChild(U.slider({ label: L("主色 S", "primary saturation"), min: 40, max: 90, step: 1, value: sat, fmt: v => `${v}%`, onInput: v => { sat = v; render(); } }));
    controls.appendChild(U.slider({ label: L("主色 L", "primary lightness"), min: 30, max: 65, step: 1, value: light, fmt: v => `${v}%`, onInput: v => { light = v; render(); } }));

    function palette() {
      const h = (x) => ((x % 360) + 360) % 360;
      const mk = (dh, s, l) => d3.hsl(h(hue + dh), s / 100, l / 100).formatHex();
      return [
        { role: L("主色", "primary"), hex: mk(0, sat, light) },
        { role: L("类比 +30°", "analogous +30°"), hex: mk(30, Math.max(35, sat - 10), Math.min(78, light + 6)) },
        { role: L("类比 −30°", "analogous −30°"), hex: mk(-30, Math.max(35, sat - 16), Math.max(30, light - 4)) },
        { role: L("低饱和类比", "muted analogous"), hex: mk(15, 38, 62) },
        { role: L("互补 180°", "complementary"), hex: mk(180, Math.max(45, sat - 14), light) },
        { role: L("低饱和互补", "muted complementary"), hex: mk(150, 34, 66) },
        { role: L("高亮 / 背景", "highlight / background"), hex: d3.hsl(hue, .86, .88).formatHex() },
      ];
    }

    function render() {
      const pal = palette();
      U.clear(swBox);
      const grid = U.h("div", { class: "gen-grid" });
      pal.forEach(p => {
        grid.appendChild(U.h("div", { class: "gen-swatch" },
          U.h("div", { class: "gen-swatch__color", style: `background:${p.hex}` }),
          U.h("b", {}, p.role),
          U.h("span", {}, p.hex)));
      });
      swBox.appendChild(grid);
      sampleChart(chartHost, pal.slice(0, 5).map(p => p.hex), "none", "line");
      const minDE = minPairDelta(pal.slice(0, 6).map(p => p.hex), "none");
      const minC = Math.min(...pal.slice(0, 6).map(p => contrast(p.hex, "#ffffff")));
      U.clear(readout);
      readout.appendChild(U.h("span", {}, "7 ", L("色", "colors")));
      readout.appendChild(U.h("span", {}, L("最小色差", "min ΔE"), " ", U.h("b", { style: minDE < 5 ? "color:var(--accent)" : "color:var(--accent-2)" }, minDE.toFixed(1))));
      readout.appendChild(U.h("span", {}, L("对白底最小对比", "min contrast vs white"), " ", U.h("b", {}, minC.toFixed(1) + ":1")));
      if (minDE < 5) readout.appendChild(U.h("span", { class: "pill pill--warn" }, L("有颜色太接近，加形状/标签", "some colors are too close; add shape/labels")));
    }
    render();
  }

  // ---------- CVD 图测 ----------
  function cvdTestMode(host) {
    let mode = "deutan", pal = "tableau";
    const controls = U.h("div", { class: "viz-toolbar" });
    const chartHost = U.h("div");
    const matrixBox = U.h("div");
    const readout = U.h("div", { class: "readout" });
    host.appendChild(U.h("div", { class: "viz__stack" }, controls, U.h("div", { class: "viz__grid viz__grid--2" }, chartHost, matrixBox), readout));

    controls.appendChild(U.select({ label: L("测试色板", "test palette"), value: pal, options: Object.entries(PALETTES).slice(0, 5).map(([k, v]) => ({ value: k, label: L(v.zh, v.en) })), onChange: v => { pal = v; render(); } }));
    controls.appendChild(U.h("div", { class: "ctl" }, U.h("span", { class: "ctl__label" }, L("模拟", "simulate")),
      U.segmented({ options: CVD.map(x => ({ label: L(x.zh, x.en), value: x.value })), value: 2, onChange: v => { mode = v; render(); } })));

    function render() {
      const colors = PALETTES[pal].colors.slice(0, 5);
      sampleChart(chartHost, colors, mode, "line");
      U.clear(matrixBox);
      const t = U.h("table", { class: "minitable de-matrix" });
      const head = U.h("tr", {}, U.h("th", {}, "ΔE"));
      colors.forEach((c, i) => head.appendChild(U.h("th", {}, String.fromCharCode(65 + i))));
      t.appendChild(U.h("thead", {}, head));
      const body = U.h("tbody");
      let min = Infinity, pair = null;
      colors.forEach((a, i) => {
        const tr = U.h("tr", {}, U.h("td", { style: "color:var(--ink-3)" }, String.fromCharCode(65 + i)));
        colors.forEach((b, j) => {
          if (i === j) { tr.appendChild(U.h("td", { class: "de-self" }, "—")); return; }
          const v = deltaE(simulate(a, mode), simulate(b, mode));
          if (i < j) { if (v < min) { min = v; pair = [i, j]; } }
          const bg = v < 5 ? `rgba(188,74,36,${0.18 + (5 - v) * 0.08})` : `rgba(47,111,98,${0.10 + Math.min(v, 40) * 0.012})`;
          tr.appendChild(U.h("td", { style: `background:${bg};text-align:center`, title: `ΔE ${v.toFixed(1)}` }, v.toFixed(0)));
        });
        body.appendChild(tr);
      });
      t.appendChild(body);
      matrixBox.appendChild(t);
      matrixBox.appendChild(U.h("div", { class: "mini-note", style: "margin-top:6px" }, L("数值越大越容易区分；< 5 基本不可靠。", "Larger means easier to distinguish; below 5 is unreliable.")));
      U.clear(readout);
      readout.appendChild(U.h("span", {}, L("最小色差", "min ΔE"), " ", U.h("b", { style: min < 5 ? "color:var(--accent)" : "color:var(--accent-2)" }, min.toFixed(1))));
      if (pair) readout.appendChild(U.h("span", {}, `${String.fromCharCode(65 + pair[0])} ↔ ${String.fromCharCode(65 + pair[1])}`));
      readout.appendChild(U.h("span", { class: `pill ${min < 5 ? "pill--bad" : "pill--ok"}` }, min < 5 ? L("在模拟下不可靠", "unreliable under simulation") : L("模拟下仍可区分", "still distinguishable")));
    }
    render();
  }

  const MODES = { cvd: paletteMode, colormap: colormapMode, gamut: gamutMode, harmony: harmonyMode, palettes: palettesMode, quiz: quizMode, generator: generatorMode, cvdtest: cvdTestMode };

  registerWidget("color", function (el, ctx) {
    const fn = MODES[ctx.variant] || paletteMode;
    fn(el, ctx);
  });

  // 实验室用：完整色彩实验室
  registerWidget("colorlab", function (el) {
    const tabs = [
      { key: "cvd", zh: "色板与 CVD", en: "Palettes & CVD" },
      { key: "colormap", zh: "colormap", en: "colormaps" },
      { key: "gamut", zh: "Lab 色域", en: "Lab gamut" },
      { key: "harmony", zh: "色系搭配", en: "Harmony" },
      { key: "generator", zh: "7 色生成器", en: "7-color generator" },
      { key: "quiz", zh: "对错案例", en: "Right or wrong" },
      { key: "cvdtest", zh: "CVD 图测", en: "CVD test" },
    ];
    let active = "cvd";
    const bar = U.h("div", { class: "lab-subtabs" });
    const body = U.h("div", { class: "lab-subpanel" });
    el.appendChild(bar);
    el.appendChild(body);
    tabs.forEach(t => bar.appendChild(U.h("button", { type: "button", class: "lab-subtab" + (t.key === active ? " is-on" : ""), onclick: () => { active = t.key; render(); } }, L(t.zh, t.en))));
    function render() {
      U.qsa(".lab-subtab", bar).forEach((b, i) => b.classList.toggle("is-on", tabs[i].key === active));
      body.innerHTML = "";
      MODES[active](body, {});
    }
    render();
  });
})();
