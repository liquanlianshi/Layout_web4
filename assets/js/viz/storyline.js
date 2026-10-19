// 5.5 Storyline 时间线
(function () {
  const L = (zh, en) => I18N.L(zh, en);
  const EVENT_EN = { "T-REX 攻击": "T-REX attack", "Raptor 追逐": "Raptor chase", "Nedry 事件": "Nedry incident" };
  registerWidget("storyline", function (el) {
    const data = DATA.storyline;
    let tension = .5, showEvents = true;
    const controls = U.h("div", { class: "viz-toolbar" });
    const host = U.h("div");
    const legend = U.h("div", { class: "legend", style: "margin-top:8px" });
    el.appendChild(U.h("div", { class: "viz__stack" }, controls, host, legend));

    controls.appendChild(U.slider({ label: L("张力 α", "tension α"), min: 0, max: 1, step: .05, value: tension, fmt: v => v.toFixed(2), onInput: v => { tension = v; draw(); } }));
    controls.appendChild(U.toggle({ label: L("显示事件层", "show events"), checked: true, onChange: v => { showEvents = v; draw(); } }));

    function draw() {
      host.innerHTML = "";
      legend.innerHTML = "";
      const c = U.colors();
      const W = 780, H = 360, m = { t: 24, r: 20, b: 34, l: 26 };
      const iw = W - m.l - m.r, ih = H - m.t - m.b;
      const x = d3.scaleLinear().domain([0, data.duration_min]).range([m.l, W - m.r]);
      const y = d3.scaleLinear().domain([0, 390]).range([m.t + ih, m.t]);
      const svg = U.s("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", role: "img", "aria-label": "Jurassic Park storyline" });
      // 时间网格
      for (let t = 0; t <= 120; t += 20) {
        svg.appendChild(U.s("line", { x1: x(t), x2: x(t), y1: m.t, y2: m.t + ih, stroke: c.line2, "stroke-dasharray": "1 3" }));
        svg.appendChild(U.s("text", { x: x(t), y: H - 12, "text-anchor": "middle", "font-family": "var(--font-mono)", "font-size": "8", fill: c.ink3 }, `${t}′`));
      }
      data.characters.forEach(ch => {
        const col = ch.color;
        const line = d3.line().x(d => x(d.time)).y(d => y(d.y)).curve(d3.curveCatmullRom.alpha(tension));
        svg.appendChild(U.s("path", { d: line(ch.points), fill: "none", stroke: col, "stroke-width": ch.width || 3, opacity: .9, "stroke-linecap": "round" }));
        const first = ch.points[0], last = ch.points[ch.points.length - 1];
        svg.appendChild(U.s("text", { x: x(first.time) + 6, y: y(first.y) - 6, "text-anchor": "start", "font-family": "var(--font-mono)", "font-size": "8.5", fill: col }, ch.name));
        svg.appendChild(U.s("circle", { cx: x(first.time), cy: y(first.y), r: 2.5, fill: col }));
        svg.appendChild(U.s("circle", { cx: x(last.time), cy: y(last.y), r: 2.5, fill: col }));
        if (showEvents && ch.events) {
          ch.events.forEach(ev => {
            const px = x(ev.time), py = y(ch.points.reduce((best, p) => Math.abs(p.time - ev.time) < Math.abs(best.time - ev.time) ? p : best, ch.points[0]).y);
            svg.appendChild(U.s("circle", { cx: px, cy: py, r: 9, fill: col, opacity: .18 }));
            svg.appendChild(U.s("circle", { cx: px, cy: py, r: 3.4, fill: col }));
            svg.appendChild(U.s("text", { x: px + 12, y: py - 8, "font-family": "var(--font-mono)", "font-size": "8", fill: col }, L(ev.name, EVENT_EN[ev.name] || ev.name)));
            const hit = U.s("circle", { cx: px, cy: py, r: 12, fill: "transparent", style: "cursor:pointer" });
            hit.addEventListener("mousemove", (e) => U.tip.show(`<b>${L(ev.name, EVENT_EN[ev.name] || ev.name)}</b><br>${ev.desc} · ${ev.time}′`, e.clientX, e.clientY));
            hit.addEventListener("mouseleave", () => U.tip.hide());
            svg.appendChild(hit);
          });
        }
        legend.appendChild(U.h("span", { class: "legend__item" },
          U.h("i", { class: "legend__swatch legend__swatch--line", style: `background:${col}` }), U.h("span", {}, ch.name)));
      });
      svg.appendChild(U.s("text", { x: m.l, y: 14, "font-family": "var(--font-mono)", "font-size": "8", fill: c.ink3 }, `${data.duration_min} ${L("分钟", "minutes")} · Catmull-Rom α=${tension.toFixed(2)}`));
      host.appendChild(svg);
    }
    draw();
  });
})();
