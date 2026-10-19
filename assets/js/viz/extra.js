// 图表选择器（实验室）
(function () {
  const L = (zh, en) => I18N.L(zh, en);
  const TYPES = [
    { key: "nominal", zh: "名义", en: "Nominal", ex: ["性别、专业", "gender, major"] },
    { key: "ordinal", zh: "序数", en: "Ordinal", ex: ["等级、班级序号", "grade, class rank"] },
    { key: "interval", zh: "区间", en: "Interval", ex: ["摄氏温度", "Celsius"] },
    { key: "ratio", zh: "比率", en: "Ratio", ex: ["年龄、价格", "age, price"] },
  ];
  const TASKS = [
    { key: "compare", zh: "比较", en: "Compare" },
    { key: "distribution", zh: "分布", en: "Distribution" },
    { key: "relationship", zh: "关系", en: "Relationship" },
    { key: "composition", zh: "构成", en: "Composition" },
    { key: "trend", zh: "趋势", en: "Trend" },
  ];

  function recommend(type, task) {
    if (task === "distribution") {
      if (type === "ratio" || type === "interval") return { zh: "直方图 / 箱线图", en: "Histogram / box plot", kind: "hist", why: [ "连续数值先看分布形态：集中、偏斜、多峰、离群点。直方图看整体，箱线图看组间。", "For continuous values, look at the distribution first: center, skew, modes, outliers. Histogram for the whole, box plot for groups." ] };
      return { zh: "条形图（计数）", en: "Bar chart (counts)", kind: "bar", why: [ "类别/序数数据的分布就是各类计数；按频数排序，比饼图更易比较。", "The distribution of categorical data is its counts; sort by frequency, which is easier to compare than a pie." ] };
    }
    if (task === "relationship") {
      if (type === "ratio" || type === "interval") return { zh: "散点图（可加趋势线）", en: "Scatterplot (+ trend line)", kind: "scatter", why: [ "两个连续变量看关系：方向、强度、离群点；位置通道最准，必要时用 log 轴。", "Two continuous variables: direction, strength, outliers. Position is the most accurate channel; use a log axis if needed." ] };
      return { zh: "分组条形 / 交叉热力图", en: "Grouped bars / crosstab heatmap", kind: "heatmap", why: [ "两个类别变量的联合分布用交叉表；热力图用颜色看密度，分组条形用长度看差异。", "Use a crosstab for two categorical variables; heatmaps show density, grouped bars show differences by length." ] };
    }
    if (task === "composition") return { zh: "堆叠条形 / 矩形树图", en: "Stacked bar / treemap", kind: "stack", why: [ "部分与整体：堆叠条形适合少量类别，矩形树图适合层级与较多类别；避免 3D 饼图。", "Part-to-whole: stacked bars for few categories, treemaps for hierarchy and many categories. Avoid 3D pies." ] };
    if (task === "trend") return { zh: "折线图 / 面积图", en: "Line / area chart", kind: "line", why: [ "时间是最自然的顺序轴；折线看趋势，面积看累计量。多条线时先做小倍数，避免意大利面图。", "Time is the natural order axis: lines for trend, areas for cumulative volume. Use small multiples before spaghetti." ] };
    if (type === "ratio" || type === "interval") return { zh: "条形图 / 点图", en: "Bar / dot plot", kind: "bar", why: [ "比较不同类别的数值：长度或位置都能精确比较；点图比条形更轻，适合类别多的情况。", "Compare values across categories: length and position are precise. Dot plots are lighter for many categories." ] };
    return { zh: "排序条形图", en: "Sorted bar chart", kind: "bar", why: [ "类别比较先排序，读者能立刻看到最大/最小；不要用饼图表达「谁更多」。", "Sort categories so the largest and smallest are immediate. Do not use a pie to answer 'which is more'." ] };
  }

  function preview(host, kind) {
    host.innerHTML = "";
    CORE.chart(host, { aspect: .45 }, (svg, W, H) => {
      const c = U.colors();
      const m = { t: 12, r: 12, b: 20, l: 26 };
      const iw = W - m.l - m.r, ih = H - m.t - m.b;
      if (kind === "bar") {
        const vals = [42, 31, 24, 18, 12, 7];
        const x = d3.scaleBand().domain(d3.range(6)).range([m.l, W - m.r]).padding(.28);
        const y = d3.scaleLinear().domain([0, 45]).range([m.t + ih, m.t]);
        vals.forEach((v, i) => svg.append("rect").attr("x", x(i)).attr("y", y(v)).attr("width", x.bandwidth()).attr("height", y(0) - y(v)).attr("fill", i === 0 ? c.accent : c.paper4));
      } else if (kind === "hist") {
        const vals = [2, 4, 7, 12, 18, 22, 19, 13, 8, 5, 3, 1];
        const x = d3.scaleBand().domain(d3.range(vals.length)).range([m.l, W - m.r]).padding(.06);
        const y = d3.scaleLinear().domain([0, 24]).range([m.t + ih, m.t]);
        vals.forEach((v, i) => svg.append("rect").attr("x", x(i)).attr("y", y(v)).attr("width", x.bandwidth()).attr("height", y(0) - y(v)).attr("fill", c.accent).attr("opacity", .8));
      } else if (kind === "scatter") {
        const rnd = d3.randomNormal(0, 1);
        for (let i = 0; i < 30; i++) {
          const xx = m.l + 8 + Math.abs(rnd()) * iw * .36;
          const yy = m.t + ih - xx * .5 + rnd() * 12;
          svg.append("circle").attr("cx", Math.min(xx, W - m.r - 4)).attr("cy", Math.max(m.t + 4, Math.min(yy, m.t + ih - 4))).attr("r", 3.2).attr("fill", c.accent).attr("opacity", .65);
        }
      } else if (kind === "line") {
        const pts = d3.range(10).map(i => [m.l + i * iw / 9, m.t + ih - (10 + i * 4 + (i % 3) * 6) * ih / 70]);
        svg.append("path").attr("d", d3.line().x(p => p[0]).y(p => p[1]).curve(d3.curveMonotoneX)(pts)).attr("fill", "none").attr("stroke", c.accent).attr("stroke-width", 2);
      } else if (kind === "heatmap") {
        for (let r = 0; r < 4; r++) for (let col = 0; col < 4; col++) {
          svg.append("rect").attr("x", m.l + col * iw / 4).attr("y", m.t + r * ih / 4).attr("width", iw / 4 - 2).attr("height", ih / 4 - 2)
            .attr("fill", d3.interpolateViridis((r * 4 + col) / 15));
        }
      } else if (kind === "stack") {
        const cats = 5;
        for (let i = 0; i < cats; i++) {
          let y0 = m.t + ih;
          [30, 20, 12].forEach((v, si) => {
            const h = v * ih / 80;
            y0 -= h;
            svg.append("rect").attr("x", m.l + i * iw / cats).attr("y", y0).attr("width", iw / cats - 4).attr("height", h).attr("fill", [c.accent, c.blue, c.gold][si]).attr("opacity", .8);
          });
        }
      }
      svg.append("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", m.t + ih).attr("y2", m.t + ih).attr("stroke", c.line);
    });
  }

  registerWidget("chartchooser", function (el) {
    let type = "ratio", task = "relationship";
    const controls = U.h("div", { class: "viz-toolbar" });
    const body = U.h("div", { class: "viz__grid viz__grid--2" });
    const left = U.h("div", { class: "viz__stack" });
    const right = U.h("div", { class: "viz__stack" });
    body.appendChild(left); body.appendChild(right);
    el.appendChild(U.h("div", { class: "viz__stack" }, controls, body));

    controls.appendChild(U.h("div", { class: "ctl" }, U.h("span", { class: "ctl__label" }, L("数据类型", "data type")),
      U.segmented({ options: TYPES.map(t => ({ label: L(t.zh, t.en), value: t.key })), value: 3, onChange: v => { type = v; render(); } })));
    controls.appendChild(U.h("div", { class: "ctl" }, U.h("span", { class: "ctl__label" }, L("阅读任务", "reading task")),
      U.segmented({ options: TASKS.map(t => ({ label: L(t.zh, t.en), value: t.key })), value: 2, onChange: v => { task = v; render(); } })));

    function render() {
      const rec = recommend(type, task);
      const t = TYPES.find(x => x.key === type);
      U.clear(left);
      left.appendChild(U.h("div", { class: "rec-card" },
        U.h("div", { class: "mono", style: "font-size:9px;letter-spacing:.1em;color:var(--ink-3)" }, `${L(t.zh, t.en)} × ${L(TASKS.find(x => x.key === task).zh, TASKS.find(x => x.key === task).en)}`),
        U.h("div", { class: "rec-card__name" }, L(rec.zh, rec.en)),
        U.h("p", { class: "rec-card__why" }, L(rec.why[0], rec.why[1])),
      ));
      left.appendChild(U.h("div", { class: "mini-note" }, L("推荐不是规则表：先看数据语义，再看任务，最后检查通道是否够准。", "A recommendation is not a rule table: check semantics, then task, then whether the channel is accurate enough.")));
      U.clear(right);
      preview(right, rec.kind);
    }
    render();
  });
})();
