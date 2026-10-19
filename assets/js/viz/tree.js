// 2.3 Reingold-Tilford 树布局
(function () {
  const L = (zh, en) => I18N.L(zh, en);
  registerWidget("tree", function (el) {
    const rows = DATA.newstudent;
    const majorOf = (cls) => (String(cls).match(/^(.+?)(\d+班)$/) || [, cls])[1];
    const tree = { name: L("2025 级", "Class of 2025"), children: [] };
    const majors = d3.group(rows, d => majorOf(d.className));
    for (const [major, list] of majors) {
      const classes = d3.group(list, d => d.className);
      const mnode = { name: major, children: [] };
      for (const [cls, clist] of classes) {
        const genders = d3.group(clist, d => d.gender);
        mnode.children.push({ name: cls, children: Array.from(genders, ([g, gl]) => ({ name: g, value: gl.length })) });
      }
      tree.children.push(mnode);
    }

    let separation = 1.2, naive = false, selected = null;
    const canvas = U.h("div");
    const detail = U.h("div", { class: "tree__detail" });
    const controls = U.h("div", { class: "viz-toolbar" });
    el.appendChild(U.h("div", { class: "viz__stack" }, controls, canvas, detail));

    controls.appendChild(U.slider({ label: L("兄弟间距 separation", "sibling separation"), min: .5, max: 2.6, step: .1, value: separation, fmt: v => v.toFixed(1), onInput: v => { separation = v; draw(); } }));
    controls.appendChild(U.toggle({ label: L("朴素网格布局（对照）", "naive grid (for contrast)"), checked: false, onChange: v => { naive = v; draw(); } }));

    const root = d3.hierarchy(tree).sum(d => d.value || 0);
    const layout = d3.tree().size([290, 560]).separation((a, b) => (a.parent === b.parent ? separation : separation * 2));

    function positions() {
      layout(root);
      const pos = new Map();
      root.each(d => pos.set(d, { x: d.x, y: d.y }));
      if (naive) {
        const byDepth = d3.group(root.descendants(), d => d.depth);
        for (const [depth, nodes] of byDepth) {
          nodes.forEach((n, i) => {
            pos.set(n, { x: (i + 0.5) * (290 / nodes.length), y: depth * (560 / 3) });
          });
        }
      }
      return pos;
    }

    function draw() {
      const pos = positions();
      const c = U.colors();
      const W = 680, H = 340, m = { l: 18, t: 22, r: 16, b: 10 };
      const svg = U.s("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", role: "img", "aria-label": "tree layout" });
      const g = U.s("g", { transform: `translate(${m.l},${m.t})` });
      svg.appendChild(g);

      // 层级导引
      [0, 1, 2, 3].forEach(d => {
        g.appendChild(U.s("line", { x1: d * 186, x2: d * 186, y1: -8, y2: 300, stroke: c.line2, "stroke-dasharray": "1 4" }));
        g.appendChild(U.s("text", { x: d * 186, y: -10, "font-family": "var(--font-mono)", "font-size": "7.5", fill: c.ink3 }, `depth ${d}`));
      });

      const link = d3.linkHorizontal().x(d => pos.get(d).y).y(d => pos.get(d).x);
      d3.select(g).selectAll(".link").data(root.links()).join("path")
        .attr("d", d => link({ source: d.source, target: d.target }))
        .attr("fill", "none").attr("stroke", c.line).attr("stroke-width", 1);

      const node = d3.select(g).selectAll(".node").data(root.descendants()).join("g")
        .attr("class", "viz-clickable")
        .attr("transform", d => `translate(${pos.get(d).y},${pos.get(d).x})`)
        .on("click", (e, d) => { selected = d; draw(); showDetail(d); })
        .on("mouseenter", (e, d) => U.tip.show(`<b>${d.data.name}</b><br>${d.value} ${L("人", "students")}`, e.clientX, e.clientY))
        .on("mouseleave", () => U.tip.hide());

      node.append("circle")
        .attr("r", d => d.depth === 0 ? 6 : d.children ? 4.5 : 3.5)
        .attr("fill", d => d === selected ? c.accent : d.children ? c.ink : c.paper2)
        .attr("stroke", d => d === selected ? c.accent : c.ink2)
        .attr("stroke-width", 1.2);

      node.append("text")
        .attr("x", d => d.depth === 0 ? 10 : d.children ? -9 : 9)
        .attr("text-anchor", d => d.depth === 0 ? "start" : d.children ? "end" : "start")
        .attr("dy", 3)
        .attr("font-family", d => d.depth === 0 ? "var(--font-display)" : "var(--font-mono)")
        .attr("font-size", d => d.depth === 0 ? "11" : "8.5")
        .attr("fill", d => d === selected ? c.accent : c.ink2)
        .text(d => `${d.data.name} · ${d.value}`);

      canvas.innerHTML = "";
      canvas.appendChild(svg);
    }

    function showDetail(d) {
      U.clear(detail);
      const path = d.ancestors().reverse().map(n => n.data.name).join(" → ");
      detail.appendChild(U.h("div", { class: "mono", style: "font-size:9px;color:var(--accent)" }, `depth ${d.depth} · ${d.value} ${L("人", "students")}`));
      detail.appendChild(U.h("div", { class: "pipeline__title" }, d.data.name));
      detail.appendChild(U.h("p", { class: "mini-note" }, path));
      detail.appendChild(U.h("p", { class: "mini-note" }, L("Reingold-Tilford 的目标：父节点居中于子节点，兄弟不重叠。朴素按序均分会让父节点偏移。", "Reingold-Tilford centers parents over children and keeps siblings apart. Naive even spacing shifts parents off-center.")));
    }

    draw();
    showDetail(root);
  });
})();
