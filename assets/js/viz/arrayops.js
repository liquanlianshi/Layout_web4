// 1.4 八个函数式数组操作
(function () {
  const L = (zh, en) => I18N.L(zh, en);
  const OPS = [
    { key: "map", name: "map", zh: "逐项变换", en: "transform each item" },
    { key: "filter", name: "filter", zh: "按条件筛选", en: "keep items that pass" },
    { key: "reduce", name: "reduce", zh: "归约成一个值", en: "fold to one value" },
    { key: "cross", name: "cross", zh: "笛卡尔积", en: "Cartesian product" },
    { key: "merge", name: "merge", zh: "合并扁平化", en: "flatten" },
    { key: "pairs", name: "pairs", zh: "相邻元素对", en: "adjacent pairs" },
    { key: "transpose", name: "transpose", zh: "矩阵转置", en: "matrix transpose" },
    { key: "zip", name: "zip", zh: "按位合并", en: "zip by index" },
  ];
  registerWidget("arrayops", function (el, ctx) {
    const rows = DATA.newstudent;
    const ages = rows.map(d => d.age);
    const names = rows.map(d => d.name);
    const classes = rows.map(d => d.className);
    let sel = "filter";

    const tabs = U.h("div", { class: "ops__tabs" });
    const out = U.h("div", { class: "ops__out" });
    const chain = U.h("div", { class: "ops__chain" });
    const result = U.h("div", { class: "ops__result" });
    el.appendChild(U.h("div", { class: "viz__stack" }, tabs, chain, U.h("div", { class: "ops__grid" }, out, result)));

    OPS.forEach((op) => {
      const b = U.h("button", { type: "button", class: "ops__tab" + (op.key === sel ? " is-on" : ""), onclick: () => { sel = op.key; render(); } },
        U.h("b", {}, op.name), U.h("span", {}, L(op.zh, op.en)));
      tabs.appendChild(b);
    });

    const maleAge = rows.filter(d => d.gender === "男").map(d => d.age);
    chain.innerHTML = "";
    chain.appendChild(U.h("span", { class: "mono" }, `students.filter(s => s.gender === "男").map(s => s.age).reduce((a, b) => a + b, 0) / ${maleAge.length}`));
    chain.appendChild(U.h("b", {}, `${(maleAge.reduce((a, b) => a + b, 0) / maleAge.length).toFixed(2)} ${L("岁", "yrs")}`));

    function code(op) {
      const snippets = {
        map: [`const ages = d3.map(students, d => d.age);`, `const ages = d3.map(students, d => d.age);`],
        filter: [`const adults = students.filter(d => d.age >= 18);`, `const adults = students.filter(d => d.age >= 18);`],
        reduce: [`const total = d3.reduce(students, (sum, d) => sum + d.age, 0);`, `const total = d3.reduce(students, (sum, d) => sum + d.age, 0);`],
        cross: [`const combos = d3.cross(genders, classes);`, `const combos = d3.cross(genders, classes);`],
        merge: [`const all = d3.merge([groupA, groupB]);`, `const all = d3.merge([groupA, groupB]);`],
        pairs: [`const adjacent = d3.pairs(ages);`, `const adjacent = d3.pairs(ages);`],
        transpose: [`const cols = d3.transpose(rows3x4);`, `const cols = d3.transpose(rows3x4);`],
        zip: [`const zipped = d3.zip(names, ages);`, `const zipped = d3.zip(names, ages);`],
      };
      return snippets[op][ctx.lang === "en" ? 1 : 0];
    }

    function render() {
      U.clear(out);
      U.clear(result);
      const op = OPS.find(o => o.key === sel);
      U.qsa(".ops__tab", tabs).forEach((b, i) => b.classList.toggle("is-on", OPS[i].key === sel));
      out.appendChild(U.h("div", { class: "ops__name" }, op.name));
      out.appendChild(U.h("p", { class: "mini-note" }, L(op.zh, op.en)));
      out.appendChild(U.h("pre", { class: "ops__code" }, code(sel)));
      const desc = {
        map: L("返回新数组，长度不变；不修改原数组。", "Returns a new array of the same length; the input is untouched."),
        filter: L("只保留通过测试的元素；长度变小。", "Keeps only elements that pass; the array shrinks."),
        reduce: L("把数组折叠成一个值：这里把年龄加起来。", "Folds the array to one value: here, the sum of ages."),
        cross: L("两两组合：性别 × 班级，得到 2 × 3 = 6 组。", "Pairwise product: gender × class gives 2 × 3 = 6 combinations."),
        merge: L("把多个数组拼成一个扁平数组。", "Concatenates arrays into one flat array."),
        pairs: L("返回相邻元素对，长度 = n − 1。", "Returns adjacent pairs; length = n − 1."),
        transpose: L("行列互换：3 × 4 变成 4 × 3。", "Swaps rows and columns: 3 × 4 becomes 4 × 3."),
        zip: L("按索引把多个数组合并成元组。", "Merges arrays by index into tuples."),
      }[sel];
      out.appendChild(U.h("p", { class: "ops__desc" }, desc));

      const addChips = (arr, max = 18) => {
        const box = U.h("div", { class: "ops__chips" });
        arr.slice(0, max).forEach(v => box.appendChild(U.h("span", { class: "chip chip--sm" }, String(v))));
        if (arr.length > max) box.appendChild(U.h("span", { class: "chip chip--sm chip--plain" }, `+${arr.length - max}`));
        result.appendChild(box);
      };
      const addTable = (head, body, cls = "") => {
        const t = U.h("table", { class: "minitable " + cls });
        t.appendChild(U.h("thead", {}, U.h("tr", {}, head.map(h => U.h("th", {}, h)))));
        t.appendChild(U.h("tbody", {}, body.map(r => U.h("tr", {}, r.map((v, i) => U.h("td", {}, String(v)))))));
        result.appendChild(t);
      };

      if (sel === "map") { addChips(ages); result.appendChild(U.h("div", { class: "readout", style: "margin-top:8px" }, `div[0] = ${ages[0]} · length = ${ages.length}`)); }
      if (sel === "filter") {
        const a = rows.filter(d => d.age >= 18);
        result.appendChild(U.h("div", { class: "kpis" },
          U.h("div", { class: "kpi" }, U.h("b", {}, a.length), U.h("span", {}, L("通过", "kept"))),
          U.h("div", { class: "kpi" }, U.h("b", {}, rows.length - a.length), U.h("span", {}, L("剔除", "removed")))));
        addChips(a.map(d => d.name), 16);
      }
      if (sel === "reduce") {
        const total = ages.reduce((x, y) => x + y, 0), avg = total / ages.length;
        result.appendChild(U.h("div", { class: "kpis" },
          U.h("div", { class: "kpi kpi--accent" }, U.h("b", {}, total), U.h("span", {}, L("年龄总和", "sum"))),
          U.h("div", { class: "kpi" }, U.h("b", {}, avg.toFixed(2)), U.h("span", {}, L("平均年龄", "mean"))),
          U.h("div", { class: "kpi" }, U.h("b", {}, ages.length), U.h("span", {}, L("记录数", "rows")))));
      }
      if (sel === "cross") {
        const genders = ["男", "女"], cls = ["数据科学1班", "软件工程1班", "软件工程2班"];
        const m = new Map();
        rows.forEach(d => m.set(d.gender + "|" + d.className, (m.get(d.gender + "|" + d.className) || 0) + 1));
        addTable([L("性别", "gender")].concat(cls), genders.map(g => [g].concat(cls.map(c => m.get(g + "|" + c) || 0))));
        result.appendChild(U.h("div", { class: "mini-note", style: "margin-top:8px" }, L("6 个组合，其中 2 个为 0。", "Six combinations, two of them empty.")));
      }
      if (sel === "merge") {
        const a = rows.filter(d => d.className === "数据科学1班").map(d => d.name);
        const b = rows.filter(d => d.className === "软件工程1班").map(d => d.name);
        result.appendChild(U.h("div", { class: "readout" }, `merge([${a.length}, ${b.length}]) → ${a.length + b.length}`));
        addChips(a.concat(b), 18);
      }
      if (sel === "pairs") {
        const p = d3.pairs(ages).slice(0, 10);
        addTable(["i", "a[i]", "a[i+1]"], p.map((d, i) => [i, d[0], d[1]]));
      }
      if (sel === "transpose") {
        const mat = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]];
        result.appendChild(U.h("div", { class: "ops__matrix" },
          U.h("div", {}, U.h("div", { class: "mini-note" }, "3 × 4"), mat.map(r => U.h("div", { class: "ops__mrow" }, r.map(v => U.h("span", {}, v))))),
          U.h("div", { class: "ops__arrow" }, "→"),
          U.h("div", {}, U.h("div", { class: "mini-note" }, "4 × 3"), d3.transpose(mat).map(r => U.h("div", { class: "ops__mrow" }, r.map(v => U.h("span", {}, v))))),
        ));
      }
      if (sel === "zip") {
        const z = d3.zip(names, ages).slice(0, 8);
        addTable([L("姓名", "name"), L("年龄", "age")], z);
      }
    }

    render();
  });
})();
