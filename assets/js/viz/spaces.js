// 4.2 数据空间 / 坐标系空间 / 屏幕空间
(function () {
  const L = (zh, en) => I18N.L(zh, en);
  registerWidget("spaces", function (el) {
    const rows = DATA.crime.filter(d => [ "California", "Texas", "New York", "Florida", "Alaska", "Vermont" ].includes(d.state));
    let scaleType = "linear", margin = 28, selected = "California";
    const controls = U.h("div", { class: "viz-toolbar" });
    const panels = U.h("div", { class: "spaces__grid" });
    const readout = U.h("div", { class: "readout" });
    el.appendChild(U.h("div", { class: "viz__stack" }, controls, panels, readout));

    controls.appendChild(U.select({
      label: L("比例尺", "scale"), value: scaleType,
      options: [{ value: "linear", label: "scaleLinear" }, { value: "log", label: "scaleLog" }],
      onChange: v => { scaleType = v; draw(); },
    }));
    controls.appendChild(U.slider({ label: L("margin", "margin"), min: 0, max: 56, step: 2, value: margin, fmt: v => `${v}px`, onInput: v => { margin = v; draw(); } }));
    controls.appendChild(U.select({
      label: L("选中的州", "state"), value: selected, options: rows.map(r => ({ value: r.state, label: r.state })),
      onChange: v => { selected = v; draw(); },
    }));

    function makePanel(title, sub) {
      const box = U.h("div", { class: "spaces__panel" });
      box.appendChild(U.h("div", { class: "spaces__title" }, title));
      box.appendChild(U.h("div", { class: "spaces__sub" }, sub));
      const host = U.h("div");
      box.appendChild(host);
      panels.appendChild(box);
      return host;
    }

    function draw() {
      U.clear(panels);
      const c = U.colors();
      const pop = rows.map(d => d.population);
      const rob = rows.map(d => d.robbery);
      const xData = scaleType === "log" ? d3.scaleLog().domain([Math.min(...pop) * .8, Math.max(...pop) * 1.2]) : d3.scaleLinear().domain([0, Math.max(...pop) * 1.05]);
      const yData = d3.scaleLinear().domain([0, Math.max(...rob) * 1.05]);
      const panelsData = [
        { host: makePanel(L("① 数据空间", "① Data space"), L("原始数值：人口 / 抢劫案", "raw values: population / robbery")) },
        { host: makePanel(L("② 坐标系空间", "② Coordinate space"), L("归一化到 0…1", "normalized to 0…1")) },
        { host: makePanel(L("③ 屏幕空间", "③ Screen space"), L("加 margin，变成像素", "add margin, become pixels")) },
      ];
      const W = 280, H = 190;
      panelsData.forEach((p, pi) => {
        const svg = U.s("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", role: "img", "aria-label": p.host.parentElement.querySelector(".spaces__title").textContent });
        const inner = pi === 2 ? { l: margin, r: 10, t: 14, b: 24 } : { l: 28, r: 10, t: 14, b: 24 };
        const iw = W - inner.l - inner.r, ih = H - inner.t - inner.b;
        const x = pi === 0 ? xData.copy().range([inner.l, W - inner.r]) : pi === 1
          ? d3.scaleLinear().domain([0, 1]).range([inner.l, W - inner.r])
          : d3.scaleLinear().domain([0, 1]).range([inner.l, W - inner.r]);
        const y = pi === 0 ? yData.copy().range([H - inner.b, inner.t]) : d3.scaleLinear().domain([0, 1]).range([H - inner.b, inner.t]);
        // 坐标框
        svg.appendChild(U.s("rect", { x: inner.l, y: inner.t, width: iw, height: ih, fill: "none", stroke: c.line, "stroke-dasharray": pi === 2 ? "3 3" : "none" }));
        if (pi === 2) {
          svg.appendChild(U.s("rect", { x: 0, y: 0, width: W, height: H, fill: c.paper3, opacity: .45 }));
          svg.appendChild(U.s("rect", { x: inner.l, y: inner.t, width: iw, height: ih, fill: c.paper2 }));
          svg.appendChild(U.s("text", { x: margin / 2, y: H / 2, "text-anchor": "middle", transform: `rotate(-90 ${margin / 2} ${H / 2})`, "font-family": "var(--font-mono)", "font-size": "7", fill: c.accent }, "margin"));
        }
        rows.forEach(d => {
          let px, py;
          if (pi === 0) { px = x(d.population); py = y(d.robbery); }
          else {
            const nx = scaleType === "log"
              ? (Math.log(d.population) - Math.log(Math.min(...pop) * .8)) / (Math.log(Math.max(...pop) * 1.2) - Math.log(Math.min(...pop) * .8))
              : d.population / (Math.max(...pop) * 1.05);
            const ny = d.robbery / (Math.max(...rob) * 1.05);
            px = x(nx); py = y(ny);
          }
          const on = d.state === selected;
          svg.appendChild(U.s("circle", { cx: px, cy: py, r: on ? 5 : 3.2, fill: on ? c.accent : c.ink3, opacity: on ? 1 : .6 }));
          if (on) svg.appendChild(U.s("text", { x: px + 7, y: py - 5, "font-family": "var(--font-mono)", "font-size": "8", fill: c.accent }, d.state));
        });
        svg.appendChild(U.s("text", { x: inner.l, y: H - 6, "font-family": "var(--font-mono)", "font-size": "7.5", fill: c.ink3 }, pi === 2 ? `x = ${margin} + ${iw} × t` : pi === 1 ? "0 … 1" : "population →"));
        p.host.appendChild(svg);
      });

      const d = rows.find(r => r.state === selected);
      const nx = scaleType === "log"
        ? (Math.log(d.population) - Math.log(Math.min(...pop) * .8)) / (Math.log(Math.max(...pop) * 1.2) - Math.log(Math.min(...pop) * .8))
        : d.population / (Math.max(...pop) * 1.05);
      U.clear(readout);
      readout.appendChild(U.h("span", {}, `${selected}: population `, U.h("b", {}, U.fmtInt(d.population))));
      readout.appendChild(U.h("span", {}, "normalized x ", U.h("b", {}, nx.toFixed(3))));
      readout.appendChild(U.h("span", {}, "screen x ", U.h("b", {}, (margin + (280 - margin - 10) * nx).toFixed(1) + "px")));
    }
    draw();
  });
})();
