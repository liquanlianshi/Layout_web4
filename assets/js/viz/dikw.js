// 1.2 DIKW 金字塔
(function () {
  const L = (zh, en) => I18N.L(zh, en);
  registerWidget("dikw", function (el, ctx) {
    const layers = [
      { zh: "数据 Data", en: "Data", q: ["是什么？", "What?"], ex: ["80 条新生记录：姓名、年龄、班级…", "80 student records: name, age, class…"], reach: 1, note: ["可视化的起点：把原始表变成可读的结构。", "The starting point: turn a raw table into readable structure."] },
      { zh: "信息 Information", en: "Information", q: ["谁 / 什么 / 何时 / 何地？", "Who / what / when / where?"], ex: ["各班级人数：软件 1 班 40、2 班 30、数据科学 1 班 10", "Class sizes: 40, 30, 10"], reach: 1, note: ["条形图、折线图、热图主要停在这一层。", "Bars, lines, and heatmaps mostly stop here."] },
      { zh: "知识 Knowledge", en: "Knowledge", q: ["如何？为什么？", "How? Why?"], ex: ["软件工程 1 班人数偏多，可能与专业热度有关", "One class is larger, possibly due to major popularity"], reach: 2, note: ["需要统计模型或领域假设辅助，图表只能提供线索。", "Needs statistical or domain models; charts only offer clues."] },
      { zh: "智慧 Wisdom", en: "Wisdom", q: ["应该怎么做？", "What should we do?"], ex: ["下学期是否调整班级规模与师资配置", "Should class size and staffing change next term?"], reach: 0, note: ["涉及价值判断与决策，超出图表本身的能力。", "Involves values and decisions, beyond charts."] },
    ];
    let sel = 1;
    const side = U.h("div", { class: "dikw-side" });
    const chartBox = U.h("div");
    const body = U.h("div", { class: "viz__grid viz__grid--side" }, chartBox, side);
    el.appendChild(body);

    const c = U.colors();
    const W = 420, H = 300, cx = W / 2, topW = 66, botW = 300, y0 = 28, lh = 58;

    function draw() {
      chartBox.innerHTML = "";
      const svg = U.s("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", role: "img", "aria-label": "DIKW pyramid" });
      layers.forEach((d, i) => {
        const t = i / (layers.length - 1);
        const tw = topW + (botW - topW) * t;
        const bw = topW + (botW - topW) * ((i + 1) / (layers.length - 1));
        const y = y0 + i * lh;
        const isOn = i === sel;
        const path = `M${cx - tw / 2},${y} L${cx + tw / 2},${y} L${cx + bw / 2},${y + lh - 4} L${cx - bw / 2},${y + lh - 4} Z`;
        const g = U.s("g", { class: "viz-clickable", tabindex: "0", role: "button", "aria-label": d.zh },
          U.s("path", { d: path, fill: isOn ? c.accent : c.paper3, stroke: isOn ? c.accent : c.line, "stroke-width": isOn ? 1.5 : 1 }),
          U.s("text", { x: cx, y: y + lh / 2 - 2, "text-anchor": "middle", "font-family": "var(--font-display)", "font-size": "13", fill: isOn ? "#fff8ef" : c.ink, "pointer-events": "none" }, L(d.zh, d.en)),
        );
        g.addEventListener("click", () => { sel = i; draw(); detail(); });
        g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); sel = i; draw(); detail(); } });
        svg.appendChild(g);
      });
      // 右侧括号：可视化作用区
      const bx = cx + botW / 2 + 20;
      svg.appendChild(U.s("path", { d: `M${bx},${y0 + lh - 6} h10 v${lh - 2} h-10`, fill: "none", stroke: c.accent, "stroke-width": 1 }));
      svg.appendChild(U.s("text", { x: bx + 16, y: y0 + lh + 4, "font-family": "var(--font-mono)", "font-size": "8", fill: c.accent, "writing-mode": "tb" }, L("可视化主战场", "visualization lives here")));
      svg.appendChild(U.s("text", { x: cx, y: H - 8, "text-anchor": "middle", "font-family": "var(--font-mono)", "font-size": "8.5", fill: c.ink3 }, L("点击任意一层 →", "click any layer →")));
      chartBox.appendChild(svg);
    }

    function detail() {
      const d = layers[sel];
      U.clear(side);
      side.appendChild(U.h("div", { class: "dikw-side__q" }, L(d.q[0], d.q[1])));
      side.appendChild(U.h("div", { class: "dikw-side__name" }, L(d.zh, d.en)));
      side.appendChild(U.h("p", { class: "dikw-side__ex" }, L(d.ex[0], d.ex[1])));
      const reachLabels = [
        L("图表到不了", "beyond charts"),
        L("图表直接完成", "charts do this"),
        L("需要模型辅助", "needs models"),
      ];
      side.appendChild(U.h("div", { class: `pill ${d.reach === 1 ? "pill--ok" : d.reach === 2 ? "pill--warn" : "pill--bad"}` }, reachLabels[d.reach]));
      side.appendChild(U.h("p", { class: "mini-note", style: "margin-top:8px" }, L(d.note[0], d.note[1])));
    }

    draw(); detail();
  });
})();
