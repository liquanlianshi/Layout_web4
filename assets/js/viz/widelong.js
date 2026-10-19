// 4.1 宽表 → 长表
(function () {
  const L = (zh, en) => I18N.L(zh, en);
  registerWidget("widelong", function (el) {
    const rows = DATA.crime.slice(0, 6);
    const metrics = ["murder", "robbery", "burglary", "larceny_theft"];
    let focus = "murder";
    const wideBox = U.h("div");
    const longBox = U.h("div");
    const controls = U.h("div", { class: "viz-toolbar" });
    const readout = U.h("div", { class: "readout" });
    el.appendChild(U.h("div", { class: "viz__stack" }, controls,
      U.h("div", { class: "viz__grid viz__grid--2" },
        U.h("div", {}, U.h("div", { class: "dataflow__label" }, L("宽格式 · 一行一个州", "wide · one row per state")), wideBox),
        U.h("div", {}, U.h("div", { class: "dataflow__label" }, L("长格式 · 一行一个观测", "long · one row per observation")), longBox)),
      readout));

    const seg = U.segmented({
      options: metrics.map(m => ({ label: m.replace("_", " "), value: m })), value: 0,
      onChange: (v) => { focus = v; render(); },
    });
    controls.appendChild(U.h("div", { class: "ctl" }, U.h("span", { class: "ctl__label" }, L("关注的指标", "metric")), seg));

    function render() {
      U.clear(wideBox);
      const t = U.h("table", { class: "minitable" });
      t.appendChild(U.h("thead", {}, U.h("tr", {}, [L("州", "state")].concat(metrics.map(m => L(m, m))).map((h, i) => U.h("th", { style: i > 0 && metrics[i - 1] === focus ? "color:var(--accent)" : "" }, h)))));
      const tb = U.h("tbody");
      rows.forEach(r => tb.appendChild(U.h("tr", {},
        U.h("td", {}, r.state),
        metrics.map(m => U.h("td", { style: m === focus ? "background:var(--accent-soft);color:var(--accent)" : "" }, U.fmtInt(r[m]))))));
      t.appendChild(tb);
      wideBox.appendChild(t);

      U.clear(longBox);
      const lt = U.h("table", { class: "minitable" });
      lt.appendChild(U.h("thead", {}, U.h("tr", {}, [L("州", "state"), L("指标", "metric"), L("值", "value")].map(h => U.h("th", {}, h)))));
      const lb = U.h("tbody");
      rows.forEach(r => metrics.forEach(m => {
        if (m === focus) lb.appendChild(U.h("tr", { style: "background:var(--accent-soft)" },
          U.h("td", {}, r.state), U.h("td", { style: "color:var(--accent)" }, m), U.h("td", {}, U.fmtInt(r[m]))));
      }));
      lt.appendChild(lb);
      longBox.appendChild(U.h("div", { style: "max-height:230px;overflow:auto" }, lt));

      U.clear(readout);
      readout.appendChild(U.h("span", {}, L("宽表", "wide"), " ", U.h("b", {}, `${rows.length} × ${metrics.length}`)));
      readout.appendChild(U.h("span", {}, "→ ", L("长表", "long"), " ", U.h("b", {}, `${rows.length * metrics.length} × 3`)));
      readout.appendChild(U.h("span", { class: "dim" }, L("flatMap 不修改原数组", "flatMap does not mutate the input")));
    }
    render();
  });
})();
