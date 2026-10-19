// 5.x 时间属性 / 折线 / 日历热图 / 螺旋
(function () {
  const L = (zh, en) => I18N.L(zh, en);
  const parse = d3.timeParse("%Y-%m-%d");

  // ---------- 5.1 五个时间属性 ----------
  registerWidget("timeattrs", function (el) {
    const attrs = [
      { key: "ordered", zh: "有序性", en: "Ordered", q: ["谁先谁后？", "What comes first?"], desc: ["两个事件有先后，且与因果相连。x 轴必须按时间排序。", "Events have an order tied to causality. The x axis must be time-sorted."], ex: ["git log、事件日志、火车时刻表", "git log, event logs, timetables"], chart: ["折线图 / 时间线", "line / timeline"] },
      { key: "continuous", zh: "连续性", en: "Continuous", q: ["中间还有没有？", "Is there something in between?"], desc: ["两个时间点之间总存在另一个时间点。连续数据才能连线；离散事件用阶梯或点。", "Another instant always exists between two. Connect continuous data; use steps or points for discrete events."], ex: ["温度传感器、心率、流式数据", "temperature sensors, heart rate, streams"], chart: ["折线 / 面积", "line / area"] },
      { key: "periodic", zh: "周期性", en: "Periodic", q: ["多久重复一次？", "How often does it repeat?"], desc: ["季节、昼夜、周循环。循环时间域（日历、螺旋）能把相同相位对齐。", "Seasons, day/night, weekly cycles. Cyclic domains (calendar, spiral) align the same phase."], ex: ["12 个月气温、24 小时体温", "12 months of temperature, 24-hour body temperature"], chart: ["日历热图 / 螺旋", "calendar / spiral"] },
      { key: "independent", zh: "独立于空间", en: "Independent of space", q: ["要不要和地图混在一起？", "Should it share a map?"], desc: ["时间与空间相关，但通常分开处理；时间占一个轴，不混用空间坐标。", "Time correlates with space but is usually handled separately; give it its own axis."], ex: ["折线图 x=时间、y=度量", "line chart with x=time, y=measure"], chart: ["折线 + 小倍数", "line + small multiples"] },
      { key: "structured", zh: "结构性", en: "Structured", q: ["年/月/日怎么切？", "How is it divided?"], desc: ["年/月/日/时/分/秒，既有自然分割（昼夜）也有人为定义（60 秒）。闰年、月末要显式处理。", "Year/month/day/hour/min/sec, with natural and human-made divisions. Handle leap years and month ends explicitly."], ex: ["日历、财年、工作日 vs 周末", "calendars, fiscal years, weekdays vs weekends"], chart: ["日历 / 分组小图", "calendar / grouped charts"] },
    ];
    let sel = 0;
    const grid = U.h("div", { class: "timeattrs" });
    const detail = U.h("div", { class: "timeattrs__detail" });
    el.appendChild(U.h("div", { class: "viz__stack" }, grid, detail));

    attrs.forEach((a, i) => {
      const b = U.h("button", { type: "button", class: "time-attr" + (i === 0 ? " is-on" : ""), onclick: () => { sel = i; render(); } },
        U.h("b", {}, L(a.zh, a.en)), U.h("span", {}, L(a.q[0], a.q[1])));
      grid.appendChild(b);
    });

    function mini(key) {
      const c = U.colors();
      const W = 360, H = 110;
      const svg = U.s("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", role: "img", "aria-label": key });
      if (key === "ordered") {
        svg.appendChild(U.s("line", { x1: 20, x2: W - 20, y1: 60, y2: 60, stroke: c.line }));
        [40, 120, 230, 310].forEach((x, i) => {
          svg.appendChild(U.s("circle", { cx: x, cy: 60, r: 5, fill: c.accent, opacity: 1 - i * .18 }));
          svg.appendChild(U.s("text", { x, y: 84, "text-anchor": "middle", "font-family": "var(--font-mono)", "font-size": "8", fill: c.ink3 }, `t${i + 1}`));
        });
        svg.appendChild(U.s("path", { d: `M${W - 22},60 l-6,-3.5 v7 z`, fill: c.ink3 }));
      } else if (key === "continuous") {
        const grad = U.s("defs", {}, U.s("linearGradient", { id: "cont", x1: "0", x2: "1" },
          U.s("stop", { offset: "0%", "stop-color": c.accent, "stop-opacity": .1 }),
          U.s("stop", { offset: "100%", "stop-color": c.accent, "stop-opacity": .85 })));
        svg.appendChild(grad);
        svg.appendChild(U.s("rect", { x: 20, y: 38, width: W - 40, height: 20, fill: "url(#cont)" }));
        svg.appendChild(U.s("line", { x1: 20, x2: W - 20, y1: 70, y2: 70, stroke: c.line }));
        [40, 180, 320].forEach(x => svg.appendChild(U.s("circle", { cx: x, cy: 70, r: 3, fill: c.accent })));
        svg.appendChild(U.s("text", { x: W / 2, y: 30, "text-anchor": "middle", "font-family": "var(--font-mono)", "font-size": "8", fill: c.ink3 }, "∞"));
      } else if (key === "periodic") {
        const cx = W / 2, cy = 58, r = 36;
        svg.appendChild(U.s("circle", { cx, cy, r, fill: "none", stroke: c.line }));
        for (let i = 0; i < 12; i++) {
          const a = i / 12 * Math.PI * 2 - Math.PI / 2;
          const x = cx + (r + 8) * Math.cos(a), y = cy + (r + 8) * Math.sin(a);
          svg.appendChild(U.s("circle", { cx: x, cy: y, r: 2.5, fill: c.accent, opacity: .35 + (i % 3) * .2 }));
        }
        svg.appendChild(U.s("path", { d: `M${cx + r * Math.cos(-Math.PI / 2)},${cy + r * Math.sin(-Math.PI / 2)} A${r},${r} 0 1 1 ${cx + r * Math.cos(-Math.PI / 2 + 2 * Math.PI * .75)},${cy + r * Math.sin(-Math.PI / 2 + 2 * Math.PI * .75)}`, fill: "none", stroke: c.accent, "stroke-width": 2 }));
      } else if (key === "independent") {
        svg.appendChild(U.s("line", { x1: 20, x2: 160, y1: 70, y2: 70, stroke: c.ink3 }));
        svg.appendChild(U.s("text", { x: 90, y: 88, "text-anchor": "middle", "font-family": "var(--font-mono)", "font-size": "8", fill: c.ink3 }, L("时间轴", "time")));
        [200, 260, 320].forEach((x, i) => [40, 60, 80].forEach((y, j) => svg.appendChild(U.s("circle", { cx: x + j * 6, cy: y + i * 4, r: 2, fill: c.accent, opacity: .5 }))));
        svg.appendChild(U.s("text", { x: 260, y: 100, "text-anchor": "middle", "font-family": "var(--font-mono)", "font-size": "8", fill: c.ink3 }, L("空间坐标", "space")));
      } else {
        const bars = [[20, 280, "year"], [34, 220, "month"], [48, 110, "day"]];
        bars.forEach(([x, w, label], i) => {
          svg.appendChild(U.s("rect", { x, y: 28 + i * 22, width: w, height: 14, fill: c.accent, opacity: .2 + i * .22 }));
          svg.appendChild(U.s("text", { x: x + w + 6, y: 39 + i * 22, "font-family": "var(--font-mono)", "font-size": "8", fill: c.ink3 }, label));
        });
      }
      return svg;
    }

    function render() {
      U.qsa(".time-attr", grid).forEach((b, i) => b.classList.toggle("is-on", i === sel));
      const a = attrs[sel];
      U.clear(detail);
      detail.appendChild(U.h("div", { class: "viz__grid viz__grid--side" }, mini(a.key), U.h("div", { class: "viz__stack" },
        U.h("div", { class: "pipeline__title" }, L(a.zh, a.en)),
        U.h("p", { class: "mini-note" }, L(a.desc[0], a.desc[1])),
        U.h("div", { class: "readout" }, U.h("span", {}, L("例子", "examples"), " ", U.h("b", {}, L(a.ex[0], a.ex[1])))),
        U.h("div", { class: "readout" }, U.h("span", {}, L("优先图表", "prefer"), " ", U.h("b", {}, L(a.chart[0], a.chart[1])))),
      )));
    }
    render();
  });

  // ---------- 5.2 折线图 ----------
  registerWidget("line", function (el) {
    const raw = DATA.frenchNames.names;
    const series = Object.keys(raw).map((k, i) => ({ name: k, color: [U.colors().accent, U.colors().blue, U.colors().gold][i], data: raw[k] }));
    let visible = series.map(() => true);
    let skip = false, indexAxis = false;
    const controls = U.h("div", { class: "viz-toolbar" });
    const host = U.h("div");
    const readout = U.h("div", { class: "readout" });
    el.appendChild(U.h("div", { class: "viz__stack" }, controls, host, readout));

    const chipsBox = U.h("div", { class: "viz-toolbar__group" });
    series.forEach((s, i) => {
      chipsBox.appendChild(U.h("button", { type: "button", class: "chip" + (i === 0 ? " chip--accent" : ""), style: `border-color:${s.color};color:${s.color}`, onclick: (e) => { visible[i] = !visible[i]; e.currentTarget.style.opacity = visible[i] ? 1 : .45; draw(); } }, s.name));
    });
    controls.appendChild(chipsBox);
    controls.appendChild(U.toggle({ label: L("跳过 1940–1945", "skip 1940–1945"), checked: false, onChange: v => { skip = v; draw(); } }));
    controls.appendChild(U.toggle({ label: L("按序号轴", "index axis"), checked: false, onChange: v => { indexAxis = v; draw(); } }));

    function draw() {
      host.innerHTML = "";
      const c = U.colors();
      const W = 760, H = 320, m = { t: 20, r: 18, b: 36, l: 44 };
      const iw = W - m.l - m.r, ih = H - m.t - m.b;
      const data = series.map(s => s.data.filter(d => !skip || d.year < 1940 || d.year > 1945));
      const years = data[0].map(d => d.year);
      const x = indexAxis
        ? d3.scalePoint().domain(d3.range(years.length)).range([m.l, W - m.r])
        : d3.scaleLinear().domain([1900, 2020]).range([m.l, W - m.r]);
      const y = d3.scaleLinear().domain([0, 5800]).range([m.t + ih, m.t]);
      const svg = U.s("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", role: "img", "aria-label": "French names line chart" });
      [0, 1500, 3000, 4500].forEach(t => {
        svg.appendChild(U.s("line", { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), stroke: c.line2, "stroke-dasharray": "1 3" }));
        svg.appendChild(U.s("text", { x: m.l - 7, y: y(t) + 3, "text-anchor": "end", "font-family": "var(--font-mono)", "font-size": "8", fill: c.ink3 }, U.fmtInt(t)));
      });
      [1900, 1920, 1940, 1960, 1980, 2000, 2020].forEach(yr => {
        const i = years.indexOf(yr);
        if (i < 0) return;
        const xx = indexAxis ? x(i) : x(yr);
        svg.appendChild(U.s("text", { x: xx, y: H - 16, "text-anchor": "middle", "font-family": "var(--font-mono)", "font-size": "8", fill: c.ink3 }, yr));
      });
      data.forEach((s, si) => {
        if (!visible[si]) return;
        const d = s.map((p, i) => [indexAxis ? x(i) : x(p.year), y(p.count)]);
        const path = d3.line().x(p => p[0]).y(p => p[1]).curve(d3.curveMonotoneX)(d);
        svg.appendChild(U.s("path", { d: path, fill: "none", stroke: series[si].color, "stroke-width": 1.7 }));
      });
      // 悬停
      const hoverLine = U.s("line", { x1: 0, x2: 0, y1: m.t, y2: m.t + ih, stroke: c.ink3, "stroke-dasharray": "3 3", opacity: 0 });
      svg.appendChild(hoverLine);
      const dots = series.map(s => U.s("circle", { r: 3.5, fill: s.color, opacity: 0, stroke: c.paper2, "stroke-width": 1 }));
      dots.forEach(d => svg.appendChild(d));
      svg.addEventListener("mousemove", (e) => {
        const rect = svg.getBoundingClientRect();
        const mx = (e.clientX - rect.left) / rect.width * W;
        let idx = 0;
        if (indexAxis) idx = U.clamp(Math.round(x.invert(mx)), 0, years.length - 1);
        else {
          const yr = x.invert(mx);
          idx = U.clamp(Math.round(yr - 1900) - (skip && yr > 1945 ? 6 : 0), 0, years.length - 1);
        }
        const xx = indexAxis ? x(idx) : x(years[idx]);
        hoverLine.setAttribute("x1", xx); hoverLine.setAttribute("x2", xx); hoverLine.setAttribute("opacity", .6);
        const lines = [];
        data.forEach((s, si) => {
          const p = s[Math.min(idx, s.length - 1)];
          if (!visible[si]) { dots[si].setAttribute("opacity", 0); return; }
          dots[si].setAttribute("cx", xx); dots[si].setAttribute("cy", y(p.count)); dots[si].setAttribute("opacity", 1);
          lines.push(`<span style="color:${series[si].color}">●</span> ${series[si].name}: <b>${U.fmtInt(p.count)}</b>`);
        });
        U.tip.show(`<b>${years[idx]}</b><br>${lines.join("<br>")}`, e.clientX, e.clientY);
      });
      svg.addEventListener("mouseleave", () => { hoverLine.setAttribute("opacity", 0); dots.forEach(d => d.setAttribute("opacity", 0)); U.tip.hide(); });
      svg.appendChild(U.s("text", { x: W - m.r, y: H - 4, "text-anchor": "end", "font-family": "var(--font-mono)", "font-size": "8", fill: c.ink3 }, indexAxis ? L("序号轴（不等间隔被压平）", "index axis (uneven gaps flattened)") : L("时间轴（真实间隔）", "time axis (real intervals)")));
      host.appendChild(svg);

      U.clear(readout);
      readout.appendChild(U.h("span", {}, L("法国人名使用频率", "French name frequency"), " ", U.h("b", {}, "1900–2020")));
      readout.appendChild(U.h("span", {}, indexAxis ? L("序号轴：时间间隔被等分", "index axis: time gaps forced equal") : L("时间轴：按真实年份", "time axis: real years")));
    }
    draw();
  });

  // ---------- 5.3 日历热图 ----------
  registerWidget("calendar", function (el) {
    const pts = DATA.weather.map(d => ({ ...d, date: parse(d.date) }));
    let showDividers = true;
    const controls = U.h("div", { class: "viz-toolbar" });
    const host = U.h("div");
    const readout = U.h("div", { class: "readout" });
    el.appendChild(U.h("div", { class: "viz__stack" }, controls, host, readout));
    controls.appendChild(U.toggle({ label: L("月份分隔线", "month dividers"), checked: true, onChange: v => { showDividers = v; draw(); } }));

    function draw() {
      host.innerHTML = "";
      const c = U.colors();
      const W = 820, H = 270, m = { t: 34, r: 16, b: 44, l: 40 };
      const cw = (W - m.l - m.r) / 53, ch = (H - m.t - m.b) / 7;
      const temps = pts.map(d => d.temp);
      const [lo, hi] = d3.extent(temps);
      const color = d3.scaleSequential(d3.interpolateViridis).domain([lo, hi]);
      const svg = U.s("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", role: "img", "aria-label": "calendar heatmap" });
      const week = d => d3.timeWeek.count(d3.timeYear(d.date), d.date);
      const wd = d => (d.date.getDay() + 6) % 7;
      const days = [L("一", "Mon"), L("二", "Tue"), L("三", "Wed"), L("四", "Thu"), L("五", "Fri"), L("六", "Sat"), L("日", "Sun")];
      days.forEach((d, i) => svg.appendChild(U.s("text", { x: m.l - 8, y: m.t + i * ch + ch / 2 + 3, "text-anchor": "end", "font-family": "var(--font-mono)", "font-size": "8", fill: c.ink3 }, d)));
      const monthNames = L("一月,二月,三月,四月,五月,六月,七月,八月,九月,十月,十一月,十二月", "Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec").split(",");
      pts.forEach(d => {
        const x = m.l + week(d) * cw, y = m.t + wd(d) * ch;
        const rect = U.s("rect", {
          x: x + .5, y: y + .5, width: Math.max(1, cw - 1), height: Math.max(1, ch - 1),
          fill: color(d.temp), rx: 1, class: "cal-cell",
        });
        rect.addEventListener("mousemove", (e) => {
          U.tip.show(`<b>${d.date.getFullYear()}-${String(d.date.getMonth() + 1).padStart(2, "0")}-${String(d.date.getDate()).padStart(2, "0")}</b><br>${L("最高温", "max temp")} ${d.temp}°C<br>${L("降水", "rain")} ${d.rain} mm`, e.clientX, e.clientY);
        });
        rect.addEventListener("mouseleave", () => U.tip.hide());
        svg.appendChild(rect);
      });
      if (showDividers) {
        pts.forEach((d, i) => {
          if (i > 0 && d.date.getMonth() !== pts[i - 1].date.getMonth()) {
            const x = m.l + week(d) * cw;
            svg.appendChild(U.s("line", { x1: x, x2: x, y1: m.t - 6, y2: H - m.b, stroke: c.accent, "stroke-width": 1, opacity: .55 }));
            svg.appendChild(U.s("text", { x: x + 2, y: m.t - 10, "font-family": "var(--font-mono)", "font-size": "7.5", fill: c.accent }, monthNames[d.date.getMonth()]));
          }
        });
      }
      // 图例
      const lx = W - m.r - 160, ly = H - 18;
      const grad = U.s("defs", {}, U.s("linearGradient", { id: "tempgrad" },
        d3.range(0, 1.01, .1).map(t => U.s("stop", { offset: `${t * 100}%`, "stop-color": d3.interpolateViridis(t) }))));
      svg.appendChild(grad);
      svg.appendChild(U.s("rect", { x: lx, y: ly, width: 120, height: 8, fill: "url(#tempgrad)" }));
      svg.appendChild(U.s("text", { x: lx - 4, y: ly + 7, "text-anchor": "end", "font-family": "var(--font-mono)", "font-size": "8", fill: c.ink3 }, `${lo}°C`));
      svg.appendChild(U.s("text", { x: lx + 124, y: ly + 7, "font-family": "var(--font-mono)", "font-size": "8", fill: c.ink3 }, `${hi}°C`));
      host.appendChild(svg);

      U.clear(readout);
      readout.appendChild(U.h("span", {}, L("最高", "max"), " ", U.h("b", {}, `${hi}°C`)));
      readout.appendChild(U.h("span", {}, L("最低", "min"), " ", U.h("b", {}, `${lo}°C`)));
      readout.appendChild(U.h("span", {}, L("平均", "mean"), " ", U.h("b", {}, `${(temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1)}°C`)));
      readout.appendChild(U.h("span", { class: "dim" }, L("7 行 × 53 列 = 全年 366 天", "7 rows × 53 columns = 366 days")));
    }
    draw();
  });

  // ---------- 5.4 阿基米德螺旋 ----------
  registerWidget("spiral", function (el) {
    const pts = DATA.weather.map(d => ({ ...d, date: parse(d.date) }));
    let showGuide = true;
    const controls = U.h("div", { class: "viz-toolbar" });
    const host = U.h("div");
    const readout = U.h("div", { class: "readout" });
    el.appendChild(U.h("div", { class: "viz__stack" }, controls, host, readout));
    controls.appendChild(U.toggle({ label: L("螺旋导引线", "spiral guide"), checked: true, onChange: v => { showGuide = v; draw(); } }));

    function draw() {
      host.innerHTML = "";
      const c = U.colors();
      const W = 520, H = 520, cx = W / 2, cy = H / 2;
      const svg = U.s("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", role: "img", "aria-label": "spiral calendar" });
      const temps = pts.map(d => d.temp);
      const [lo, hi] = d3.extent(temps);
      const color = d3.scaleSequential(d3.interpolateViridis).domain([lo, hi]);
      const r0 = 46, gap = 15, totalTurns = 12;
      if (showGuide) {
        const d = d3.range(0, totalTurns * 360 + 1, 2).map(deg => {
          const th = deg * Math.PI / 180;
          const r = r0 + gap * (deg / 360);
          return [cx + r * Math.cos(th - Math.PI / 2), cy + r * Math.sin(th - Math.PI / 2)];
        });
        svg.appendChild(U.s("path", { d: d3.line()(d), fill: "none", stroke: c.line2, "stroke-width": 1 }));
      }
      const monthNames = L("一月,二月,三月,四月,五月,六月,七月,八月,九月,十月,十一月,十二月", "Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec").split(",");
      pts.forEach(d => {
        const month = d.date.getMonth();
        const dayFrac = (d.date.getDate() - 1) / new Date(d.date.getFullYear(), month + 1, 0).getDate();
        const turn = month + dayFrac;
        const th = turn * Math.PI * 2 - Math.PI / 2;
        const r = r0 + gap * turn;
        const x = cx + r * Math.cos(th), y = cy + r * Math.sin(th);
        const dot = U.s("circle", { cx: x, cy: y, r: 4.2, fill: color(d.temp), stroke: c.paper2, "stroke-width": .8 });
        dot.addEventListener("mousemove", (e) => U.tip.show(`<b>${d.date.getMonth() + 1} 月 ${d.date.getDate()} 日</b><br>${d.temp}°C`, e.clientX, e.clientY));
        dot.addEventListener("mouseleave", () => U.tip.hide());
        svg.appendChild(dot);
      });
      // 月份标签
      for (let m = 0; m < 12; m++) {
        const th = m * Math.PI * 2 - Math.PI / 2;
        const r = r0 + gap * m + 22;
        svg.appendChild(U.s("text", { x: cx + r * Math.cos(th), y: cy + r * Math.sin(th) + 3, "text-anchor": "middle", "font-family": "var(--font-mono)", "font-size": "8", fill: c.ink3 }, monthNames[m]));
      }
      svg.appendChild(U.s("text", { x: cx, y: 18, "text-anchor": "middle", "font-family": "var(--font-mono)", "font-size": "9", fill: c.accent }, L("12 圈 = 12 个月", "12 turns = 12 months")));
      host.appendChild(svg);
      U.clear(readout);
      readout.appendChild(U.h("span", {}, L("每圈", "per turn"), " ", U.h("b", {}, L("1 个月", "1 month"))));
      readout.appendChild(U.h("span", {}, L("半径增量", "radius step"), " ", U.h("b", {}, `${gap}px`)));
      readout.appendChild(U.h("span", { class: "dim" }, L("相同季节落在相邻圈的同一条射线上", "the same season lands on the same ray of adjacent turns")));
    }
    draw();
  });
})();
