// 1.5 Data-Join 三态
(function () {
  const L = (zh, en) => I18N.L(zh, en);
  const START = [
    { id: 1, label: "A", v: 72 }, { id: 2, label: "B", v: 48 },
    { id: 3, label: "C", v: 91 }, { id: 4, label: "D", v: 33 },
    { id: 5, label: "E", v: 64 },
  ];
  registerWidget("datajoin", function (el) {
    let items = START.map(d => ({ ...d }));
    let bound = items.map(d => d.id);
    let prevItems = items.map(d => ({ ...d }));
    let useKey = true;
    let nextId = 6;
    let lastDiff = { enter: [], update: [], exit: [] };

    const strip = U.h("div", { class: "join__strip" });
    const code = U.h("pre", { class: "ops__code" });
    const counts = U.h("div", { class: "join__counts" });
    const lanes = U.h("div", { class: "join__lanes" });
    const note = U.h("p", { class: "mini-note" });
    const toolbar = U.h("div", { class: "viz-toolbar" });
    el.appendChild(U.h("div", { class: "viz__stack" }, toolbar, strip, code, lanes, U.h("div", { class: "join__foot" }, counts, note)));

    const addBtn = U.h("button", { class: "btn btn--sm", type: "button", onclick: () => mutate(add) }, L("＋ 添加一条", "＋ Add") );
    const delBtn = U.h("button", { class: "btn btn--sm", type: "button", onclick: () => mutate(del) }, L("－ 删除一条", "－ Remove"));
    const shufBtn = U.h("button", { class: "btn btn--sm", type: "button", onclick: () => mutate(shuffle) }, L("打乱顺序", "Shuffle"));
    const resetBtn = U.h("button", { class: "btn btn--sm btn--ghost", type: "button", onclick: reset }, L("重置", "Reset"));
    toolbar.appendChild(U.h("div", { class: "viz-toolbar__group" }, addBtn, delBtn, shufBtn, resetBtn));
    toolbar.appendChild(U.toggle({ label: L("使用 key 函数", "use key function"), checked: true, onChange: (v) => { useKey = v; render(); } }));

    function add() {
      items.push({ id: nextId, label: String.fromCharCode(64 + nextId), v: 20 + Math.round(Math.random() * 80) });
      nextId++;
    }
    function del() {
      if (items.length <= 1) return;
      items.splice(Math.floor(Math.random() * items.length), 1);
    }
    function shuffle() {
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
      }
    }
    function reset() {
      items = START.map(d => ({ ...d })); bound = items.map(d => d.id);
      prevItems = items.map(d => ({ ...d })); nextId = 6;
      render();
    }

    function diff() {
      const oldIds = bound;
      const newIds = items.map(d => d.id);
      let enter, update, exit;
      if (useKey) {
        enter = newIds.filter(id => !oldIds.includes(id));
        update = newIds.filter(id => oldIds.includes(id));
        exit = oldIds.filter(id => !newIds.includes(id));
      } else {
        const n = Math.min(oldIds.length, newIds.length);
        update = newIds.slice(0, n);
        enter = newIds.slice(n);
        exit = oldIds.slice(n);
      }
      return {
        enter: enter.map(id => items.find(d => d.id === id)).filter(Boolean),
        update: update.map(id => items.find(d => d.id === id)).filter(Boolean),
        exit: exit.map(id => items.find(d => d.id === id) || prevItems.find(d => d.id === id)).filter(Boolean),
      };
    }

    function mutate(fn) {
      prevItems = items.map(d => ({ ...d }));
      fn();
      render();
    }

    function render() {
      const d = diff();
      lastDiff = d;

      // 数据条
      U.clear(strip);
      strip.appendChild(U.h("span", { class: "join__label" }, "data[]"));
      items.forEach(it => strip.appendChild(U.h("span", { class: "join__item" }, U.h("b", {}, it.id), it.label, U.h("i", {}, it.v))));

      // 代码
      code.textContent = useKey
        ? `svg.selectAll("circle")\n   .data(data, d => d.id)\n   .join(enter => enter.append("circle"),\n         update => update, \n         exit => exit.remove());`
        : `svg.selectAll("circle")\n   .data(data)   // 没有 key，按索引绑定\n   .join(enter => enter.append("circle"),\n         update => update,\n         exit => exit.remove());`;

      // 三态
      U.clear(lanes);
      const laneDefs = [
        { key: "enter", title: L("enter · 新元素", "enter · new"), color: "var(--accent-2)", hint: L("数据比元素多：append", "more data than elements: append") },
        { key: "update", title: L("update · 复用", "update · reuse"), color: "var(--gold)", hint: L("对得上的元素：改属性", "matched elements: update attrs") },
        { key: "exit", title: L("exit · 多余", "exit · leftover"), color: "var(--accent)", hint: L("元素比数据多：remove", "more elements than data: remove") },
      ];
      laneDefs.forEach(def => {
        const lane = U.h("div", { class: "join__lane" });
        lane.appendChild(U.h("div", { class: "join__lanehead" },
          U.h("span", { class: "join__lanetitle", style: `color:${def.color}` }, def.title),
          U.h("span", { class: "join__lanehint" }, def.hint)));
        const dots = U.h("div", { class: "join__dots", "data-lane": def.key });
        const arr = d[def.key];
        if (!arr.length) dots.appendChild(U.h("span", { class: "join__empty" }, "—"));
        arr.forEach(it => {
          const dot = U.h("div", { class: "join__dot", style: `--dot:${def.color}` },
            U.h("b", {}, it.id), U.h("span", {}, it.label), U.h("i", {}, it.v));
          dots.appendChild(dot);
        });
        lane.appendChild(dots);
        lanes.appendChild(lane);
      });

      // 计数
      U.clear(counts);
      counts.appendChild(U.h("span", {}, "enter ", U.h("b", { style: "color:var(--accent-2)" }, d.enter.length)));
      counts.appendChild(U.h("span", {}, "update ", U.h("b", { style: "color:var(--gold)" }, d.update.length)));
      counts.appendChild(U.h("span", {}, "exit ", U.h("b", { style: "color:var(--accent)" }, d.exit.length)));
      counts.appendChild(U.h("span", { class: "dim" }, useKey ? "key: d => d.id" : "key: index"));

      note.textContent = !useKey && d.enter.length === 0 && d.exit.length === 0 && d.update.length === items.length
        ? L("没有 key 时，数据重排会被当成「全部 update」：元素身份丢了，过渡动画只能按索引硬切。", "Without a key, a reorder becomes 'all update': identity is lost and transitions cut by index.")
        : useKey
          ? L("key 函数让每个元素记住自己的 id；增删改只影响真正变化的那几条。", "The key function lets each element remember its id; only real changes enter, update, or exit.")
          : L("按索引绑定：长度变化才会产生 enter / exit，顺序变化不会。", "Index binding: only length changes produce enter/exit; reordering does not.");

      bound = items.map(d => d.id);
      prevItems = items.map(d => ({ ...d }));
    }

    render();
  });
})();
