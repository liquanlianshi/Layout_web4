// 4.5 Marching Squares 等值线
(function () {
  const L = (zh, en) => I18N.L(zh, en);
  registerWidget("marching", function (el) {
    let threshold = .52, n = 36, showGrid = false, fill = true, selected = null;
    const controls = U.h("div", { class: "viz-toolbar" });
    const canvasWrap = U.h("div", { class: "march__wrap" });
    const canvas = U.h("canvas", { class: "march__canvas" });
    const overlay = U.s("svg", { class: "march__overlay", viewBox: "0 0 100 60", preserveAspectRatio: "none" });
    canvasWrap.appendChild(canvas);
    canvasWrap.appendChild(overlay);
    const detail = U.h("div", { class: "march__detail" });
    const stats = U.h("div", { class: "readout" });
    el.appendChild(U.h("div", { class: "viz__stack" }, controls, U.h("div", { class: "viz__grid viz__grid--side" }, canvasWrap, detail), stats));

    controls.appendChild(U.slider({ label: L("阈值", "threshold"), min: .05, max: .95, step: .01, value: threshold, fmt: v => v.toFixed(2), onInput: v => { threshold = v; const segs = drawContours(); renderStats(segs); } }));
    controls.appendChild(U.select({
      label: L("网格", "grid"), value: String(n),
      options: [{ value: "24", label: "24 × 24" }, { value: "36", label: "36 × 36" }, { value: "48", label: "48 × 48" }, { value: "60", label: "60 × 60" }],
      onChange: v => { n = Number(v); drawAll(); },
    }));
    controls.appendChild(U.toggle({ label: L("显示网格", "show grid"), checked: false, onChange: v => { showGrid = v; drawAll(); } }));
    controls.appendChild(U.toggle({ label: L("填充高值区", "fill high region"), checked: true, onChange: v => { fill = v; drawAll(); } }));

    function field(x, y) {
      // 两个高斯峰 + 一个鞍点，形成 0..1 的标量场
      const g1 = .95 * Math.exp(-(((x - .34) ** 2) / .045 + ((y - .38) ** 2) / .06));
      const g2 = .82 * Math.exp(-(((x - .70) ** 2) / .065 + ((y - .66) ** 2) / .075));
      const g3 = .28 * Math.exp(-(((x - .55) ** 2) / .02 + ((y - .22) ** 2) / .02));
      return U.clamp(g1 + g2 + g3, 0, 1);
    }

    // 网格值 (n+1)²
    let grid = [];
    function computeGrid() {
      grid = [];
      for (let j = 0; j <= n; j++) {
        const row = [];
        for (let i = 0; i <= n; i++) row.push(field(i / n, j / n));
        grid.push(row);
      }
    }

    let W = 640, H = 400, pad = 0;
    function size() {
      W = Math.max(320, Math.round(canvasWrap.clientWidth || 640));
      H = Math.round(W * 0.62);
      pad = 2;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = "100%";
      canvas.style.height = "auto";
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return ctx;
    }

    function cellSize() { return (W - pad * 2) / n; }

    function drawAll() {
      computeGrid();
      const ctx = size();
      const cell = cellSize();
      const c = U.colors();
      ctx.clearRect(0, 0, W, H);
      // 背景
      ctx.fillStyle = c.paper;
      ctx.fillRect(0, 0, W, H);
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          const v = (grid[j][i] + grid[j][i + 1] + grid[j + 1][i] + grid[j + 1][i + 1]) / 4;
          ctx.fillStyle = d3.interpolateViridis(v);
          ctx.fillRect(pad + i * cell, pad + j * cell, Math.ceil(cell) + .5, Math.ceil(cell) + .5);
        }
      }
      if (fill) {
        // 高值区加一层淡色覆盖，让阈值以上的区域更清楚
        ctx.fillStyle = "rgba(255,248,239,.12)";
        for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
          if (grid[j][i] > threshold) ctx.fillRect(pad + i * cell, pad + j * cell, Math.ceil(cell) + .5, Math.ceil(cell) + .5);
        }
      }
      if (showGrid) {
        ctx.strokeStyle = "rgba(255,255,255,.18)";
        ctx.lineWidth = .5;
        const step = Math.max(1, Math.round(n / 24));
        for (let i = 0; i <= n; i += step) {
          ctx.beginPath(); ctx.moveTo(pad + i * cell, pad); ctx.lineTo(pad + i * cell, H - pad); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(pad, pad + i * cell); ctx.lineTo(W - pad, pad + i * cell); ctx.stroke();
        }
      }
      const segCount = drawContours();
      renderStats(segCount);
    }

    function renderStats(segCount) {
      U.clear(stats);
      let above = 0;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (grid[j][i] > threshold) above++;
      stats.appendChild(U.h("span", {}, L("高于阈值", "above threshold"), " ", U.h("b", {}, `${(above / (n * n) * 100).toFixed(0)}%`)));
      stats.appendChild(U.h("span", {}, L("阈值", "threshold"), " ", U.h("b", {}, threshold.toFixed(2))));
      stats.appendChild(U.h("span", {}, L("网格", "grid"), " ", U.h("b", {}, `${n} × ${n}`)));
      stats.appendChild(U.h("span", {}, L("线段", "segments"), " ", U.h("b", {}, segCount)));
    }

    function drawContours() {
      const cell = cellSize();
      const c = U.colors();
      U.clear(overlay);
      overlay.setAttribute("viewBox", `0 0 ${W} ${H}`);
      overlay.setAttribute("preserveAspectRatio", "none");
      const segs = [];
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          const tl = grid[j][i], tr = grid[j][i + 1], br = grid[j + 1][i + 1], bl = grid[j + 1][i];
          const pts = [];
          const interp = (a, b, pa, pb) => {
            const t = (threshold - a) / (b - a || 1e-9);
            return [pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t];
          };
          if ((tl > threshold) !== (tr > threshold)) pts.push(interp(tl, tr, [i, j], [i + 1, j]));
          if ((tr > threshold) !== (br > threshold)) pts.push(interp(tr, br, [i + 1, j], [i + 1, j + 1]));
          if ((bl > threshold) !== (br > threshold)) pts.push(interp(bl, br, [i, j + 1], [i + 1, j + 1]));
          if ((tl > threshold) !== (bl > threshold)) pts.push(interp(tl, bl, [i, j], [i, j + 1]));
          const px = (p) => [pad + p[0] * cell, pad + p[1] * cell];
          if (pts.length === 2) segs.push([px(pts[0]), px(pts[1])]);
          else if (pts.length === 4) {
            const center = (tl + tr + br + bl) / 4;
            if (center > threshold) {
              segs.push([px(pts[0]), px(pts[1])]);
              segs.push([px(pts[2]), px(pts[3])]);
            } else {
              segs.push([px(pts[0]), px(pts[3])]);
              segs.push([px(pts[1]), px(pts[2])]);
            }
          }
        }
      }
      const d = segs.map(([a, b]) => `M${a[0]},${a[1]}L${b[0]},${b[1]}`).join("");
      overlay.appendChild(U.s("path", { d, fill: "none", stroke: "#fffdf7", "stroke-width": 1.4, "stroke-linecap": "round", opacity: .92 }));
      overlay.appendChild(U.s("path", { d, fill: "none", stroke: c.accent, "stroke-width": .7, "stroke-linecap": "round", opacity: .9 }));
      // 选中格
      if (selected) {
        const { i, j } = selected;
        overlay.appendChild(U.s("rect", { x: pad + i * cell, y: pad + j * cell, width: cell, height: cell, fill: "none", stroke: c.accent, "stroke-width": 2 }));
      }
      // 点击/悬停
      overlay.onclick = (e) => {
        const rect = overlay.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width * W;
        const y = (e.clientY - rect.top) / rect.height * H;
        const i = U.clamp(Math.floor((x - pad) / cell), 0, n - 1);
        const j = U.clamp(Math.floor((y - pad) / cell), 0, n - 1);
        selected = { i, j };
        drawContours();
        showDetail(i, j);
      };
      overlay.onmousemove = (e) => {
        const rect = overlay.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width * W;
        const y = (e.clientY - rect.top) / rect.height * H;
        const i = U.clamp(Math.floor((x - pad) / cell), 0, n - 1);
        const j = U.clamp(Math.floor((y - pad) / cell), 0, n - 1);
        if (i >= 0 && j >= 0 && i < n && j < n) {
          U.tip.show(`<b>cell ${i},${j}</b><br>${L("中心值", "center value")} ${grid[j][i].toFixed(3)}`, e.clientX, e.clientY);
        }
      };
      overlay.onmouseleave = () => U.tip.hide();
      return segs.length;
    }

    function showDetail(i, j) {
      const tl = grid[j][i], tr = grid[j][i + 1], br = grid[j + 1][i + 1], bl = grid[j + 1][i];
      const bit = (v) => v > threshold ? 1 : 0;
      const cse = bit(bl) | (bit(br) << 1) | (bit(tr) << 2) | (bit(tl) << 3);
      U.clear(detail);
      detail.appendChild(U.h("div", { class: "mono", style: "font-size:9px;color:var(--accent)" }, `case ${cse}`));
      detail.appendChild(U.h("div", { class: "pipeline__title" }, `cell ${i}, ${j}`));
      const svg = U.s("svg", { viewBox: "0 0 120 120", width: "100%", role: "img", "aria-label": "cell corners" });
      const cells = [[0, 0, tl, "TL"], [60, 0, tr, "TR"], [0, 60, bl, "BL"], [60, 60, br, "BR"]];
      cells.forEach(([x, y, v, name]) => {
        svg.appendChild(U.s("rect", { x, y, width: 57, height: 57, fill: v > threshold ? "rgba(188,74,36,.18)" : "var(--paper-3)", stroke: "var(--line)" }));
        svg.appendChild(U.s("text", { x: x + 28, y: y + 25, "text-anchor": "middle", "font-family": "var(--font-mono)", "font-size": "9", fill: "var(--ink-3)" }, name));
        svg.appendChild(U.s("text", { x: x + 28, y: y + 42, "text-anchor": "middle", "font-family": "var(--font-mono)", "font-size": "10", fill: v > threshold ? cseColor() : "var(--ink-3)" }, v.toFixed(2)));
      });
      detail.appendChild(svg);
      detail.appendChild(U.h("p", { class: "mini-note" }, L(`四角编码 bit0=BL … bit3=TL → case ${cse}。` + (cse === 5 || cse === 10 ? "鞍点：用中心值决定连法。" : ""), `Corner bits bit0=BL … bit3=TL → case ${cse}.` + (cse === 5 || cse === 10 ? " Saddle: use the center value." : ""))));
    }
    function cseColor() { return U.colors().accent; }

    const off = U.onResize(canvasWrap, () => drawAll());
    if (!el.__cleanups) el.__cleanups = [];
    el.__cleanups.push(off);
    drawAll();
    // 默认选中一个真正被等值线穿过的格子，便于观察 16 种 case
    let found = null;
    for (let j = 0; j < n && !found; j++) for (let i = 0; i < n && !found; i++) {
      const tl = grid[j][i] > threshold, tr = grid[j][i + 1] > threshold, br = grid[j + 1][i + 1] > threshold, bl = grid[j + 1][i] > threshold;
      const cse = (bl ? 1 : 0) | (br ? 2 : 0) | (tr ? 4 : 0) | (tl ? 8 : 0);
      if (cse !== 0 && cse !== 15) found = { i, j };
    }
    if (found) { selected = found; drawContours(); showDetail(found.i, found.j); }
  });
})();
