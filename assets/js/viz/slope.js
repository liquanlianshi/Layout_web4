// 4.4 45° 倾角感知
(function () {
  const L = (zh, en) => I18N.L(zh, en);
  const YEARS = d3.range(2015, 2025);
  const VALUES = [100, 112, 125, 141, 158, 176, 196, 218, 241, 266];
  registerWidget("slope", function (el) {
    let aspect = .58, useLog = false;
    const controls = U.h("div", { class: "viz-toolbar" });
    const main = U.h("div");
    const inset = U.h("div");
    const readout = U.h("div", { class: "readout" });
    el.appendChild(U.h("div", { class: "viz__stack" }, controls,
      U.h("div", { class: "slope__grid" }, main, inset), readout));

    controls.appendChild(U.slider({ label: L("画布纵横比", "aspect ratio"), min: .3, max: 2.4, step: .02, value: aspect, fmt: v => v.toFixed(2), onInput: v => { aspect = v; draw(); } }));
    controls.appendChild(U.toggle({ label: L("纵轴取对数", "log y axis"), checked: false, onChange: v => { useLog = v; draw(); } }));

    function currentGeometry() {
      const W = 520, H = Math.round(W * aspect);
      const m = { t: 20, r: 18, b: 30, l: 38 };
      const iw = W - m.l - m.r, ih = H - m.t - m.b;
      const x = d3.scalePoint().domain(YEARS).range([m.l, W - m.r]);
      const y = useLog
        ? d3.scaleLog().domain([90, 300]).range([m.t + ih, m.t])
        : d3.scaleLinear().domain([80, 290]).range([m.t + ih, m.t]);
      const dx = x(YEARS[YEARS.length - 1]) - x(YEARS[0]);
      const dy = y(VALUES[VALUES.length - 1]) - y(VALUES[0]);
      const angle = Math.atan2(Math.abs(dy), dx) * 180 / Math.PI;
      return { W, H, m, iw, ih, x, y, angle, dx, dy };
    }

    function draw() {
      const { W, H, m, iw, ih, x, y, angle } = currentGeometry();
      const c = U.colors();
      U.clear(main);
      const svg = U.s("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", role: "img", "aria-label": "slope perception" });
      [100, 150, 200, 250].forEach(t => {
        if (useLog && t <= 90) return;
        const yy = y(t);
        if (yy < m.t - 1 || yy > m.t + ih + 1) return;
        svg.appendChild(U.s("line", { x1: m.l, x2: W - m.r, y1: yy, y2: yy, stroke: c.line2, "stroke-dasharray": "1 3" }));
        svg.appendChild(U.s("text", { x: m.l - 6, y: yy + 3, "text-anchor": "end", "font-family": "var(--font-mono)", "font-size": "8", fill: c.ink3 }, t));
      });
      YEARS.forEach((yr, i) => {
        if (i % 2 === 0) svg.appendChild(U.s("text", { x: x(yr), y: H - 10, "text-anchor": "middle", "font-family": "var(--font-mono)", "font-size": "7.5", fill: c.ink3 }, yr));
      });
      const line = d3.line().x((d, i) => x(YEARS[i])).y((d) => y(d)).curve(d3.curveMonotoneX);
      svg.appendChild(U.s("path", { d: line(VALUES), fill: "none", stroke: c.accent, "stroke-width": 2.2 }));
      VALUES.forEach((v, i) => {
        svg.appendChild(U.s("circle", { cx: x(YEARS[i]), cy: y(v), r: i === 0 || i === VALUES.length - 1 ? 4 : 2.6, fill: c.paper2, stroke: c.accent, "stroke-width": 1.5 }));
      });
      // 45° 基准线
      const x0 = x(YEARS[0]), y0 = y(VALUES[0]);
      svg.appendChild(U.s("line", { x1: x0, y1: y0, x2: x0 + Math.min(iw, ih) * .84, y2: y0 - Math.min(iw, ih) * .84, stroke: c.accent2, "stroke-width": 1, "stroke-dasharray": "5 4" }));
      svg.appendChild(U.s("text", { x: x0 + 8, y: y0 - Math.min(iw, ih) * .84 + 12, "font-family": "var(--font-mono)", "font-size": "8", fill: c.accent2 }, "45°"));
      // 角度弧
      const rad = angle * Math.PI / 180, r = 34;
      svg.appendChild(U.s("path", { d: `M${x0 + r},${y0} A${r},${r} 0 0 0 ${x0 + r * Math.cos(rad)},${y0 - r * Math.sin(rad)}`, fill: "none", stroke: c.ink3, "stroke-width": 1 }));
      svg.appendChild(U.s("text", { x: x0 + r + 6, y: y0 - 6, "font-family": "var(--font-mono)", "font-size": "9", fill: c.accent }, `${angle.toFixed(1)}°`));
      svg.appendChild(U.s("text", { x: W - m.r, y: m.t + 8, "text-anchor": "end", "font-family": "var(--font-mono)", "font-size": "8", fill: c.ink3 }, useLog ? "log y" : "linear y"));
      main.appendChild(svg);

      // 误差曲线
      U.clear(inset);
      const IW = 230, IH = 220;
      const isvg = U.s("svg", { viewBox: `0 0 ${IW} ${IH}`, width: "100%", role: "img", "aria-label": "slope error curve" });
      const ix = d3.scaleLinear().domain([0, 90]).range([28, IW - 12]);
      const iy = d3.scaleLinear().domain([0, 1.8]).range([IH - 30, 16]);
      const err = (a) => Math.min(1.7, 0.12 + 1.6 * Math.pow((a - 45) / 45, 2));
      const pts = d3.range(0, 91).map(a => [a, err(a)]);
      isvg.appendChild(U.s("path", { d: d3.line().x(d => ix(d[0])).y(d => iy(d[1]))(pts), fill: "none", stroke: c.ink2, "stroke-width": 1.4 }));
      isvg.appendChild(U.s("line", { x1: ix(45), x2: ix(45), y1: 16, y2: IH - 30, stroke: c.accent2, "stroke-dasharray": "3 3" }));
      isvg.appendChild(U.s("text", { x: ix(45), y: IH - 16, "text-anchor": "middle", "font-family": "var(--font-mono)", "font-size": "8", fill: c.accent2 }, "45°"));
      isvg.appendChild(U.s("circle", { cx: ix(angle), cy: iy(err(angle)), r: 5, fill: c.accent, stroke: c.paper2, "stroke-width": 1.5 }));
      isvg.appendChild(U.s("text", { x: 6, y: 18, "font-family": "var(--font-mono)", "font-size": "8", fill: c.ink3 }, L("估计误差", "error")));
      isvg.appendChild(U.s("text", { x: IW - 8, y: IH - 6, "text-anchor": "end", "font-family": "var(--font-mono)", "font-size": "8", fill: c.ink3 }, L("倾角 →", "angle →")));
      inset.appendChild(isvg);
      inset.appendChild(U.h("div", { class: "mini-note", style: "text-align:center" }, L("Cleveland：45° 附近误差最小", "Cleveland: error is lowest near 45°")));

      U.clear(readout);
      const verdict = angle >= 30 && angle <= 60;
      readout.appendChild(U.h("span", {}, L("当前倾角", "current angle"), " ", U.h("b", {}, angle.toFixed(1) + "°")));
      readout.appendChild(U.h("span", {}, `dy/dx = ${(Math.abs(y(VALUES[0]) - y(VALUES[9])) / Math.abs(x(YEARS[0]) - x(YEARS[9]))).toFixed(2)}`));
      readout.appendChild(U.h("span", { class: `pill ${verdict ? "pill--ok" : "pill--bad"}` }, verdict ? L("落在 30°–60°，可读", "within 30°–60°, readable") : L("角度过平/过陡，读者会误判", "too flat/steep, readers misjudge")));
      if (useLog) readout.appendChild(U.h("span", { class: "dim" }, L("log 轴把陡度压回中间", "log axis pulls steepness back")));
    }
    draw();
  });
})();
