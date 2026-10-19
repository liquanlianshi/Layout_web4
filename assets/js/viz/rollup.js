// 2.2 rollup：原始数据 → 数据表
(function () {
  const L = (zh, en) => I18N.L(zh, en);
  registerWidget("rollup", function (el) {
    const rows = DATA.newstudent;
    let filterOn = false, deriveOn = true, dim = "major";
    const controls = U.h("div", { class: "viz-toolbar" });
    const left = U.h("div");
    const right = U.h("div");
    const steps = U.h("div", { class: "rollup__steps" });
    const code = U.h("pre", { class: "ops__code" });
    el.appendChild(U.h("div", { class: "viz__stack" }, controls, steps, U.h("div", { class: "viz__grid viz__grid--2" }, left, right), code));

    controls.appendChild(U.toggle({ label: L("只保留 18 岁及以上", "keep age ≥ 18"), checked: false, onChange: (v) => { filterOn = v; render(); } }));
    controls.appendChild(U.toggle({ label: L("从班级派生专业", "derive major from class"), checked: true, onChange: (v) => { deriveOn = v; render(); } }));
    controls.appendChild(U.h("div", { class: "ctl" }, U.h("span", { class: "ctl__label" }, L("聚合维度", "group by")),
      U.segmented({
        options: [{ label: L("专业", "major"), value: "major" }, { label: L("班级", "class"), value: "class" }],
        value: 0,
        onChange: (v) => { dim = v; render(); },
      })));

    function majorOf(cls) {
      const m = String(cls).match(/^(.+?)(\d+班)$/);
      return m ? m[1] : cls;
    }

    function render() {
      let data = rows.map(d => ({ ...d, major: deriveOn ? majorOf(d.className) : d.className }));
      const afterFilter = filterOn ? data.filter(d => d.age >= 18) : data;
      const groups = d3.rollup(afterFilter, v => v.length, d => dim === "major" ? d.major : d.className);
      const arr = Array.from(groups, ([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v);
      const key = dim === "major" ? "major" : "className";

      // 步骤
      U.clear(steps);
      const stepDefs = [
        { n: "01", name: "raw", val: `${data.length} 行`, on: true },
        { n: "02", name: "filter", val: filterOn ? `${afterFilter.length} 行` : L("跳过", "skip"), on: filterOn },
        { n: "03", name: "derive", val: deriveOn ? L("major 列", "major column") : L("跳过", "skip"), on: deriveOn },
        { n: "04", name: "rollup", val: `${arr.length} 组`, on: true },
      ];
      stepDefs.forEach((s, i) => {
        steps.appendChild(U.h("div", { class: "rollup__step" + (s.on ? " is-on" : "") },
          U.h("span", { class: "rollup__num" }, s.n),
          U.h("b", {}, s.name),
          U.h("span", {}, s.val)));
        if (i < stepDefs.length - 1) steps.appendChild(U.h("span", { class: "rollup__arrow" }, "→"));
      });

      // 左：原表 + 派生列
      U.clear(left);
      left.appendChild(U.h("div", { class: "dataflow__label" }, L("数据表（前 7 行）", "data table (first 7 rows)")));
      const t = U.h("table", { class: "minitable" });
      t.appendChild(U.h("thead", {}, U.h("tr", {}, [L("序号", "#"), L("班级", "class"), L("年龄", "age")].concat(deriveOn ? [L("专业", "major")] : []).map(h => U.h("th", {}, h)))));
      const tb = U.h("tbody");
      data.slice(0, 7).forEach(d => {
        const kept = !filterOn || d.age >= 18;
        tb.appendChild(U.h("tr", { style: kept ? "" : "opacity:.35;text-decoration:line-through" },
          [d.id, d.className, d.age].concat(deriveOn ? [d.major] : []).map(v => U.h("td", {}, String(v)))));
      });
      t.appendChild(tb);
      left.appendChild(t);
      left.appendChild(U.h("div", { class: "readout", style: "margin-top:8px" },
        `d3.rollup(data, v => v.length, d => d.${key})`));

      // 右：聚合条形
      U.clear(right);
      right.appendChild(U.h("div", { class: "dataflow__label" }, L("聚合结果", "aggregated result")));
      const W = 420, H = Math.max(130, arr.length * 42 + 30), m = { t: 8, r: 42, b: 8, l: 90 };
      const svg = U.s("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", role: "img", "aria-label": "rollup counts" });
      const c = U.colors();
      const x = d3.scaleLinear().domain([0, d3.max(arr, d => d.v) || 1]).range([0, W - m.l - m.r]);
      const y = d3.scaleBand().domain(arr.map(d => d.k)).range([m.t, H - m.b]).padding(.3);
      const rowsG = svg;
      arr.forEach((d, i) => {
        const g = U.s("g", {});
        g.appendChild(U.s("text", { x: m.l - 8, y: y(d.k) + y.bandwidth() / 2 + 3, "text-anchor": "end", "font-family": "var(--font-mono)", "font-size": "9", fill: c.ink2 }, d.k));
        g.appendChild(U.s("rect", { x: m.l, y: y(d.k), width: 0, height: y.bandwidth(), fill: i === 0 ? c.accent : c.paper4 }));
        const rect = g.querySelector("rect");
        requestAnimationFrame(() => { rect.setAttribute("width", x(d.v)); });
        g.appendChild(U.s("text", { x: m.l + x(d.v) + 6, y: y(d.k) + y.bandwidth() / 2 + 3, "font-family": "var(--font-mono)", "font-size": "9", fill: c.ink }, d.v));
        rowsG.appendChild(g);
      });
      right.appendChild(svg);

      // 代码
      code.textContent = `const rows = await d3.csv("newstudent.csv", d => ({\n  ...d, age: +d["年龄"],\n  major: d["班级"].match(/^(.+?)(\\d+班)$/)?.[1] ?? d["班级"],\n}));\n\nconst by${dim === "major" ? "Major" : "Class"} = d3.rollup(\n  ${filterOn ? "rows.filter(d => d.age >= 18)" : "rows"},\n  v => v.length,\n  d => d.${key}\n);\n// Map(${arr.length}) { ${arr.slice(0, 3).map(d => `"${d.k}" => ${d.v}`).join(", ")}${arr.length > 3 ? ", …" : ""} }`;
    }

    render();
  });
})();
