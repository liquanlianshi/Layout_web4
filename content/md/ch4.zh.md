# 第 4 章 低维数据可视化

> 低维数据只有一两个属性，但"画得对"并不简单：数据要先摆进坐标系，坐标轴要选对尺度，线要选对插值方式，等值线要从标量场里"走"出来。本章把这四步拆开讲清楚。

## 4.1 数据转换

> 宽格式方便人读，长格式方便机器画。可视化之前，先把表"摆平"。

### 你的原案例

1985 年美国 50 州犯罪数据（Crime）是一张典型的宽表：每行一个州，每列一个犯罪指标（谋杀、抢劫、入室盗窃……）。要把它画成散点图或热图，先要转成长表。

### 两种表形，各有所长

| 形态 | 结构 | 优点 | 适合 |
|---|---|---|---|
| 宽格式 wide | 一行一个实体，一列一个指标 | 人眼读得懂、贴近 Excel | 录入、核对、展示原始表 |
| 长格式 long | 一行一个观测：`{state, metric, value}` | 方便过滤、分组、绑定数据 | D3 data-join、分面、热图 |

转换只需要一次 `flatMap`：

```js
// 宽 → 长：对每一行，遍历指标列，生成多条观测
const metrics = ["murder", "robbery", "burglary", "larceny_theft"];
const long = data.flatMap(row =>
  metrics.map(metric => ({
    state: row.state,
    metric,
    value: +row[metric],   // 字符串 → 数字
  }))
);
// 50 行 × 4 列 → 200 行长表
```

`d3.autoType` 可以在读取时自动推断列类型，省掉逐个 `+d.field`：

```js
const data = await d3.csv("data/crime.csv", d3.autoType);
// population 自动变成 number，date 列自动变成 Date
```

> **易错点**：`flatMap` 返回的是新数组，不会改动原始 `data`。如果先 `data.forEach(...push)` 再返回，就把"纯函数"变成了"副作用"，后续复用同一份数据时会出现重复行。

## 4.2 坐标轴变换

> 数据空间 → 坐标系空间 → 屏幕空间。三层职责分明，混在一起就会乱套。

### 三层空间

| 层 | 输入 | 输出 | 由谁负责 |
|---|---|---|---|
| 数据空间 | 原始数值，如人口 27,058,000、谋杀率 8 | 定义域 domain | 业务与统计 |
| 坐标系空间 | 归一化到 `0..innerWidth` 的坐标 | 值域 range | `d3.scaleLinear()` 等比例尺 |
| 屏幕空间 | 加上 margin 偏移后的像素坐标 | `x + margin.left` | SVG 分组 `transform` |

分层的意义：坐标系空间里的图元可以复用，窗口变宽时只改 `range`，不用重算数据。`d3.axisBottom(x)` 会自动完成"坐标系 → 屏幕"的刻度与标签。

### 比例尺选型

| 比例尺 | 映射关系 | 典型场景 | 误用后果 |
|---|---|---|---|
| `scaleLinear` | 线性 | 温度、年龄、比率 | 跨数量级时小值挤成一条线 |
| `scaleLog` | 对数 | 人口 53 万 → 2700 万、收入 | 含 0 或负值时无定义 |
| `scaleSqrt` | 平方根 | 圆面积编码数值 | 用半径直接编码面积会夸大 4 倍 |
| `scaleBand` | 离散分段 | 柱状图的类别轴 | 类别用线性轴会算出"0.5 个班" |
| `scalePoint` | 离散点 | 折线图的类别轴 | 点会贴在轴起点，缺少留白 |
| `scaleTime` | 时间 | 日期轴、时间序列 | 用序号当 x 轴会抹平不等间隔 |

```js
// 数据空间 → 坐标系空间 → 屏幕空间
const x = d3.scaleLinear().domain([0, d3.max(data, d => d.population)]).range([0, innerW]);
const y = d3.scaleLog().domain([1, d3.max(data, d => d.robbery)]).range([innerH, 0]);

const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
g.append("g").attr("transform", `translate(0,${innerH})`).call(d3.axisBottom(x));
```

> **一个常见错误**：把 margin 加进 `range`，又在 `<g>` 上 `translate` 一次，结果整体偏移了两遍。只在一处加偏移。

## 4.3 曲线拟合

> 同一组点，换一种 `curve` 就是另一种"叙事"。选曲线之前，先问：这条线是在**连接观测**，还是在**表达趋势**？

### 插值 vs 拟合

| | 插值 interpolation | 拟合 fitting |
|---|---|---|
| 是否经过数据点 | 全部经过 | 可以不经过 |
| 代表方法 | Catmull-Rom、natural、monotoneX | 线性回归、LOESS、多项式最小二乘 |
| 适合 | 数据点可信、需要连续读数 | 数据有噪声、只想看趋势 |
| 风险 | 在点之间"编造"出不存在的波动 | 掩盖局部异常 |

### D3 常用 curve

| curve | 经过所有点 | 保单调 | 适合 |
|---|---|---|---|
| `curveLinear` | ✅ | ✅ | 点少、强调真实读数 |
| `curveMonotoneX` | ✅ | ✅ | 时间序列，避免伪震荡 |
| `curveCatmullRom` | ✅ | ❌ | 叙事型折线、Storyline |
| `curveNatural` | ✅ | ❌ | 平滑的自然曲线 |
| `curveBasis` | ❌ | ❌ | 强平滑、只看大趋势 |
| `curveStep` / `curveStepAfter` | ✅（阶跃） | ✅ | 状态切换、离散信号 |

```js
const line = d3.line()
  .x(d => x(d.year))
  .y(d => y(d.value))
  .curve(d3.curveMonotoneX);   // 时间序列默认选它

path.attr("d", line(series));
```

> **判断题**：一条"平滑得很漂亮"的曲线，如果它经过了每个点、又在点之间上下摆动，那多半是 Catmull-Rom 在"编故事"。时间序列优先 `monotoneX`。

## 4.4 倾角感知（45° 黄金角）

> 同一组数据，拉宽或压扁画布，读者对"增长有多快"的判断会完全不同。

### Cleveland 的发现

Cleveland（1984）让被试估计直线的斜率，结果呈 U 型：

- 斜率接近 0°（几乎水平）或 90°（几乎垂直）时，估计误差最大；
- 斜率约 **45°** 时，估计最准；
- 人眼会把"陡度"适度夸张，感知幂律指数约 1.0–1.3。

### 设计原则

1. 关键趋势线的倾角尽量落在 **30°–60°**；
2. 对比两条增长曲线时，先把它们放进同一坐标系、同一尺度；
3. 跨数量级的数据用 **log 轴**，把陡度"压"回 45° 附近；
4. 不要用拉伸画布的方式制造"增长更快"的错觉——这叫**视觉谎言**。

```js
// 让趋势线的中位倾角接近 45°：先算斜率，再反推纵横比
const slope = (yScale(yMax) - yScale(yMin)) / (xScale(xMax) - xScale(xMin));
const idealH = innerW * Math.abs(slope);
```

> **银行家四原则**（banking to 45°）：在给定数据下，调整纵横比，使平均绝对倾角接近 45°。这不是"好看"，而是让读者的斜率判断误差最小。

## 4.5 等值线（Marching Squares）

> 标量场是一张"高度表"，等值线是把"同一高度"的点连起来的曲线。

### 算法原理

把平面离散成网格，每个格子看 4 个角：高于阈值记 1，低于记 0，得到 4 位二进制编号 `0–15`（共 16 种 case）。每种 case 对应 0、1 或 2 条线段，把"高区"与"低区"分开。

| 角编码 | 位 | 说明 |
|---|---|---|
| 左下 BL | bit0 | 起点 |
| 右下 BR | bit1 | |
| 右上 TR | bit2 | |
| 左上 TL | bit3 | |

```js
// 四个角的布尔值 → case 编号
const c = (bl > t ? 1 : 0) | (br > t ? 2 : 0) | (tr > t ? 4 : 0) | (tl > t ? 8 : 0);
// c = 0 或 15：整格同侧，无线段
// c = 5 或 10：鞍点，需要按中心值决定连法
```

扩展到三维就是 **Marching Cubes**（Lorensen & Cline, 1987）：2⁸ = 256 种 case，用于 MRI / CT 的等值面提取。

### 应用场景

- 地形等高线、气压/气温等值线；
- 核密度估计（KDE）的密度轮廓；
- 医学影像的三维重建；
- 把散点"密度"变成可读的区域边界。

> **实现提示**：网格越密，等值线越平滑，但计算量按 `n²` 增长。交互式阈值滑块建议先用 60×60 网格，够用且流畅。
