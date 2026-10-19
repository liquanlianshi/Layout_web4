// 4.3 十种曲线
(function () {
  const L = (zh, en) => I18N.L(zh, en);
  const CURVES = [
    { key: "curveLinear", zh: "线性", en: "Linear", pass: true, mono: true, smooth: 0 },
    { key: "curveMonotoneX", zh: "单调", en: "MonotoneX", pass: true, mono: true, smooth: 2 },
    { key: "curveCatmullRom", zh: "Catmull-Rom", en: "Catmull-Rom", pass: true, mono: false, smooth: 3 },
    { key: "curveNatural", zh: "自然样条", en: "Natural", pass: true, mono: false, smooth: 3 },
    { key: "curveBasis", zh: "B 样条", en: "Basis", pass: false, mono: false, smooth: 3 },
    { key: "curveStep", zh: "阶梯", en: "Step", pass: true, mono: true, smooth: 0 },
    { key: "curveStepAfter", zh: "阶梯（后）", en: "Step after", pass: true, mono: true, smooth: 0 },
    { key: "curveStepBefore", zh: "阶梯（前）", en: "Step before", pass: true, mono: true, smooth: 0 },
  ];
  const PTS = [
    { x: 0, y: 12 }, { x: 1, y: 20 }, { x: 2, y: 15 }, { x: 3, y: 27 },
    { x: 4, y: 22 }, { x: 5, y: 31 }, { x: 6, y: 25 }, { x: 7, y: 36 },
    { x: 8, y: 30 }, { x: 9, y: 39 }, { x: 10, y: 44 }, { x: 11, y: 41 },
  ];
  registerWidget("curves", function (el) {
    let curveKey = "curveMonotoneX", tension = .5, showPoints = true, showLinear = false;
    const controls = U.h("div", { class: "viz-toolbar" });
    const host = U.h("div");
    const readout = U.h("div", { class: "readout" });
    el.appendChild(U.h("div", { class: "viz__stack" }, controls, host, readout));

    controls.appendChild(U.select({
      label: L("曲线类型", "curve"), value: curveKey,
      options: CURVES.map(c => ({ value: c.key, label: L(c.zh, c.en) })),
      onChange: v => { curveKey = v; render(); },
    }));
    controls.appendChild(U.slider({ label: L("张力 α（Catmull-Rom）", "tension α (Catmull-Rom)"), min: 0, max: 1, step: .05, value: tension, fmt: v => v.toFixed(2), onInput: v => { tension = v; render(); } }));
    controls.appendChild(U.toggle({ label: L("显示数据点", "show points"), checked: true, onChange: v => { showPoints = v; render(); } }));
    controls.appendChild(U.toggle({ label: L("线性参照", "linear reference"), checked: false, onChange: v => { showLinear = v; render(); } }));

    function render() {
      host.innerHTML = "";
      const c = U.colors();
      CORE.chart(host, { aspect: .46 }, (svg, W, H) => {
        const m = { t: 18, r: 18, b: 30, l: 34 };
        const iw = W - m.l - m.r, ih = H - m.t - m.b;
        const x = d3.scaleLinear().domain([0, 11]).range([m.l, W - m.r]);
        const y = d3.scaleLinear().domain([8, 48]).range([m.t + ih, m.t]);
        [10, 20, 30, 40].forEach(t => {
          svg.append("line").attr("class", "grid").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y(t)).attr("y2", y(t));
          svg.append("text").attr("x", m.l - 6).attr("y", y(t) + 3).attr("text-anchor", "end").attr("font-family", "var(--font-mono)").attr("font-size", "8").attr("fill", c.ink3).text(t);
        });
        if (showLinear) {
          const line = d3.line().x(d => x(d.x)).y(d => y(d.y)).curve(d3.curveLinear);
          svg.append("path").attr("d", line(PTS)).attr("fill", "none").attr("stroke", c.line).attr("stroke-width", 1).attr("stroke-dasharray", "4 3");
        }
        let curve = d3[curveKey];
        if (curveKey === "curveCatmullRom") curve = d3.curveCatmullRom.alpha(tension);
        const line = d3.line().x(d => x(d.x)).y(d => y(d.y)).curve(curve);
        svg.append("path").attr("d", line(PTS)).attr("fill", "none").attr("stroke", c.accent).attr("stroke-width", 2);
        if (showPoints) {
          svg.selectAll("circle.pt").data(PTS).join("circle").attr("class", "pt")
            .attr("cx", d => x(d.x)).attr("cy", d => y(d.y)).attr("r", 3.4)
            .attr("fill", c.paper2).attr("stroke", c.accent).attr("stroke-width", 1.4);
        }
        svg.append("text").attr("x", m.l).attr("y", H - 6).attr("font-family", "var(--font-mono)").attr("font-size", "8").attr("fill", c.ink3).text(L("x →", "x →"));
        svg.append("text").attr("x", 8).attr("y", m.t + 8).attr("font-family", "var(--font-mono)").attr("font-size", "8").attr("fill", c.ink3).text("y");
      });
      const cv = CURVES.find(c => c.key === curveKey);
      U.clear(readout);
      readout.appendChild(U.h("span", {}, L("经过所有点", "passes all points"), " ", U.h("b", { style: cv.pass ? "color:var(--accent-2)" : "color:var(--accent)" }, cv.pass ? L("是", "yes") : L("否", "no"))));
      readout.appendChild(U.h("span", {}, L("保持单调", "monotone"), " ", U.h("b", { style: cv.mono ? "color:var(--accent-2)" : "color:var(--accent)" }, cv.mono ? L("是", "yes") : L("否", "no"))));
      readout.appendChild(U.h("span", { class: "dim" }, {
        curveLinear: L("点少、强调真实读数", "few points, honest readings"),
        curveMonotoneX: L("时间序列默认，避免伪震荡", "default for time series, no phantom wiggles"),
        curveCatmullRom: L("叙事型曲线，可能过冲", "narrative curves, may overshoot"),
        curveNatural: L("平滑自然，但不保单调", "smooth, not monotone"),
        curveBasis: L("强平滑，不经过点", "heavy smoothing, misses points"),
        curveStep: L("离散状态切换", "discrete state changes"),
        curveStepAfter: L("状态在之后跳变", "state jumps after"),
        curveStepBefore: L("状态在之前跳变", "state jumps before"),
      }[curveKey]));
    }
    render();
  });
})();
