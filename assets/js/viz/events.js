// 2.4 事件委托 + transition
(function () {
  const L = (zh, en) => I18N.L(zh, en);
  registerWidget("events", function (el) {
    const rows = DATA.newstudent;
    const majors = d3.group(rows, d => (String(d.className).match(/^(.+?)(\d+班)$/) || [, d.className])[1]);
    let stopProp = true, duration = 400, seq = 0;
    const logBox = U.h("div", { class: "ev__log", "aria-live": "polite" });
    const detail = U.h("div", { class: "ev__detail" });
    const list = U.h("div", { class: "ev__list" });
    const controls = U.h("div", { class: "viz-toolbar" });
    const pathBox = U.h("div", { class: "ev__path" });
    el.appendChild(U.h("div", { class: "viz__stack" }, controls, U.h("div", { class: "viz__grid viz__grid--2" }, list, U.h("div", { class: "viz__stack" }, pathBox, logBox, detail))));

    controls.appendChild(U.toggle({ label: L("toggle 上调用 stopPropagation", "stopPropagation on toggle"), checked: true, onChange: v => { stopProp = v; drawPath(); } }));
    controls.appendChild(U.slider({ label: L("动画时长 duration", "duration"), min: 0, max: 1200, step: 50, value: 400, fmt: v => `${v}ms`, onInput: v => { duration = v; list.style.setProperty("--ev-dur", v + "ms"); log(`duration = ${v}ms`); } }));
    controls.appendChild(U.h("button", { class: "btn btn--sm btn--ghost", type: "button", onclick: () => { logBox.innerHTML = ""; seq = 0; log(L("日志已清空", "log cleared")); } }, L("清空日志", "Clear log")));

    function log(msg, tone) {
      const t = new Date();
      const ts = `${String(t.getMinutes()).padStart(2, "0")}:${String(t.getSeconds()).padStart(2, "0")}.${String(t.getMilliseconds()).padStart(3, "0")}`;
      const line = U.h("div", { class: "ev__logline" + (tone ? " is-" + tone : "") },
        U.h("span", { class: "ev__ts" }, ts), U.h("span", {}, msg));
      logBox.appendChild(line);
      logBox.scrollTop = logBox.scrollHeight;
    }

    function drawPath() {
      U.clear(pathBox);
      const c = U.colors();
      const phases = [
        { zh: "捕获", en: "Capture", on: false },
        { zh: "目标", en: "Target", on: true },
        { zh: "冒泡", en: "Bubble", on: !stopProp },
      ];
      const svg = U.s("svg", { viewBox: "0 0 520 70", width: "100%", role: "img", "aria-label": "event phases" });
      phases.forEach((p, i) => {
        const x = 18 + i * 170;
        svg.appendChild(U.s("rect", { x, y: 14, width: 140, height: 32, fill: p.on ? c.accent : c.paper3, stroke: p.on ? c.accent : c.line }));
        svg.appendChild(U.s("text", { x: x + 70, y: 35, "text-anchor": "middle", "font-family": "var(--font-mono)", "font-size": "10", fill: p.on ? "#fff8ef" : c.ink2 }, L(p.zh, p.en)));
        if (i < 2) svg.appendChild(U.s("path", { d: `M${x + 146},30 l10,0 m-4,-3 l4,3 l-4,3`, stroke: c.ink3, fill: "none" }));
      });
      svg.appendChild(U.s("text", { x: 260, y: 64, "text-anchor": "middle", "font-family": "var(--font-mono)", "font-size": "8", fill: stopProp ? c.accent2 : c.accent },
        stopProp ? L("stopPropagation 截断冒泡：父级 select 不会触发", "stopPropagation cuts the bubble: parent select does not fire") : L("冒泡未截断：父级 select 也会触发", "bubble not cut: parent select also fires")));
      pathBox.appendChild(svg);
    }

    function renderList() {
      U.clear(list);
      list.style.setProperty("--ev-dur", duration + "ms");
      Array.from(majors).forEach(([major, mrows]) => {
        const mdiv = U.h("div", { class: "ev__major" });
        mdiv.appendChild(U.h("div", { class: "ev__majorhead" }, U.h("b", {}, major), U.h("span", {}, `${mrows.length} ${L("人", "students")}`)));
        const classes = d3.group(mrows, d => d.className);
        Array.from(classes).forEach(([cls, crows]) => {
          const li = U.h("div", { class: "ev__class", tabindex: "0", role: "group", "aria-label": cls });
          const toggle = U.h("button", { class: "ev__toggle", type: "button", "aria-label": L("折叠/展开", "collapse/expand") }, "▾");
          const head = U.h("div", { class: "ev__classhead" },
            toggle,
            U.h("span", { class: "ev__classname" }, cls),
            U.h("span", { class: "ev__count" }, `${crows.length}`),
          );
          const kids = U.h("div", { class: "ev__kids" }, U.h("div", { class: "ev__kidsinner" },
            crows.slice(0, 7).map(d => U.h("span", { class: "ev__student" }, d.name)).concat(crows.length > 7 ? [U.h("span", { class: "ev__student ev__student--more" }, `+${crows.length - 7}`)] : [])));
          li.appendChild(head);
          li.appendChild(kids);

          toggle.addEventListener("click", (e) => {
            log(`toggle click · ${cls}`);
            if (stopProp) {
              e.stopPropagation();
              log(L("stopPropagation() → 父级 select 被截断", "stopPropagation() → parent select blocked"), "ok");
            } else {
              log(L("未调用 stopPropagation → 继续冒泡", "no stopPropagation → bubbles"), "bad");
            }
            li.classList.toggle("is-collapsed");
            toggle.textContent = li.classList.contains("is-collapsed") ? "▸" : "▾";
          });
          li.addEventListener("click", () => {
            U.qsa(".ev__class.is-selected", list).forEach(x => x.classList.remove("is-selected"));
            li.classList.add("is-selected");
            log(`li click · select ${cls}`, "sel");
            U.clear(detail);
            detail.appendChild(U.h("div", { class: "mono", style: "font-size:9px;color:var(--accent)" }, "selected"));
            detail.appendChild(U.h("div", { class: "pipeline__title" }, cls));
            detail.appendChild(U.h("p", { class: "mini-note" }, L(`${crows.length} 人 · 点击 toggle 时若未阻止冒泡，这里也会被选中。`, `${crows.length} students. Without stopPropagation, clicking the toggle also selects this row.`)));
          });
          mdiv.appendChild(li);
        });
        list.appendChild(mdiv);
      });
    }

    drawPath();
    renderList();
    log(L("就绪：点击 ▾ 折叠，观察右侧事件路径。", "Ready: click ▾ and watch the event path."));
  });
})();
