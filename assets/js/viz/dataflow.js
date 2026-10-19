// 1.1 数据生成：CSV → 类型化对象
(function () {
  const L = (zh, en) => I18N.L(zh, en);
  registerWidget("datagen", function (el, ctx) {
    const rows = DATA.newstudent;
    let idx = 0;
    let trimmed = true;

    const rawBox = U.h("div", { class: "dataflow__table" });
    const typedBox = U.h("div", { class: "dataflow__table" });
    const chartBox = U.h("div");
    const readout = U.h("div", { class: "readout" });
    const controls = U.h("div", { class: "viz-toolbar" });
    const top = U.h("div", { class: "viz__grid viz__grid--2" },
      U.h("div", { class: "dataflow__panel" }, U.h("div", { class: "dataflow__label" }, "CSV row · 字符串"), rawBox),
      U.h("div", { class: "dataflow__panel" }, U.h("div", { class: "dataflow__label" }, "transformRow(d) · 类型化"), typedBox),
    );
    el.appendChild(controls);
    el.appendChild(top);
    el.appendChild(chartBox);
    el.appendChild(readout);

    const slider = U.slider({
      label: L("选择一行", "Pick a row"), min: 1, max: rows.length, step: 1, value: 1,
      fmt: (v) => `#${v}`, onInput: (v) => { idx = v - 1; render(); },
    });
    const toggle = U.toggle({
      label: L("trim() 清洗班级名", "trim() class names"), checked: true,
      onChange: (v) => { trimmed = v; render(); },
    });
    controls.appendChild(slider);
    controls.appendChild(toggle);

    function render() {
      const d = rows[idx];
      const cls = trimmed ? d.className : (idx === 0 ? d.className + " " : d.className);
      const raw = [
        ["序号", d.id], ["姓名", d.name], ["性别", d.gender],
        ["生日", d.birthday], ["年龄", d.age], ["班级", cls],
      ];
      const typed = [
        ["id", d.id, "number"], ["name", d.name, "string"], ["gender", d.gender, "string"],
        ["birthday", d.birthday, "string→Date"], ["age", d.age, "number"], ["class", cls.trim(), "string"],
      ];
      U.clear(rawBox);
      const rt = U.h("table", { class: "minitable" });
      rt.appendChild(U.h("tbody", {}, raw.map(([k, v]) => U.h("tr", {}, U.h("td", { style: "color:var(--ink-3)" }, k), U.h("td", {}, `"${v}"`)))));
      rawBox.appendChild(rt);

      U.clear(typedBox);
      const tt = U.h("table", { class: "minitable" });
      tt.appendChild(U.h("tbody", {}, typed.map(([k, v, t]) => U.h("tr", {},
        U.h("td", { style: "color:var(--ink-3)" }, k),
        U.h("td", {}, String(v)),
        U.h("td", {}, U.h("span", { class: "mono-badge" }, t)),
      ))));
      typedBox.appendChild(tt);

      drawChart(cls);
      U.clear(readout);
      readout.appendChild(U.h("span", {}, "typeof age = ", U.h("b", {}, "number")));
      readout.appendChild(U.h("span", {}, "age = ", U.h("b", {}, d.age)));
      readout.appendChild(U.h("span", {}, "class = ", U.h("b", {}, JSON.stringify(cls))));
    }

    function drawChart(dirtyCls) {
      chartBox.innerHTML = "";
      const counts = d3.rollup(rows.map((r, i) => ({ ...r, cls: trimmed ? r.className : (i === 0 ? r.className + " " : r.className) })), v => v.length, d => d.cls);
      const arr = Array.from(counts, ([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v);
      const c = U.colors();
      const W = 640, H = 170, m = { t: 16, r: 16, b: 34, l: 34 };
      const svg = U.s("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", role: "img", "aria-label": "class counts" });
      const x = d3.scaleBand().domain(arr.map(d => d.k)).range([m.l, W - m.r]).padding(.28);
      const y = d3.scaleLinear().domain([0, 45]).range([H - m.b, m.t]);
      [0, 15, 30, 45].forEach(t => {
        svg.appendChild(U.s("line", { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), stroke: c.line2, "stroke-dasharray": "1 3" }));
        svg.appendChild(U.s("text", { x: m.l - 6, y: y(t) + 3, "text-anchor": "end", "font-family": "var(--font-mono)", "font-size": "8", fill: c.ink3 }, t));
      });
      arr.forEach(d => {
        const isDirty = /\s$/.test(d.k);
        svg.appendChild(U.s("rect", { x: x(d.k), y: y(d.v), width: x.bandwidth(), height: y(0) - y(d.v), fill: isDirty ? c.accent : c.accent2, opacity: .85 }));
        svg.appendChild(U.s("text", { x: x(d.k) + x.bandwidth() / 2, y: y(d.v) - 5, "text-anchor": "middle", "font-family": "var(--font-mono)", "font-size": "9", fill: c.ink }, d.v));
        svg.appendChild(U.s("text", { x: x(d.k) + x.bandwidth() / 2, y: H - 16, "text-anchor": "middle", "font-family": "var(--font-mono)", "font-size": "8.5", fill: isDirty ? c.accent : c.ink2 }, isDirty ? `"${d.k}"` : d.k));
      });
      svg.appendChild(U.s("text", { x: m.l, y: H - 2, "font-family": "var(--font-mono)", "font-size": "8", fill: c.ink3 }, L("班级人数 · 末尾空格会把同一班拆成两类", "class counts · a trailing space splits one class")));
      chartBox.appendChild(svg);
    }

    render();
  });
})();
