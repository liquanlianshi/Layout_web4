# Chapter 4 Low-Dimensional Data Visualization

> Low-dimensional data has only one or two attributes, yet drawing it correctly is not trivial: the data must be placed into a coordinate system, the axes must use the right scale, lines must use the right interpolation, and contours must be traced out of a scalar field. This chapter separates these four steps.

## 4.1 Data Transformation

> Wide tables are easy for humans; long tables are easy for machines. Flatten the table before you visualize it.

### Your original case

The 1985 US crime data (50 states) is a classic wide table: one row per state, one column per crime metric (murder, robbery, burglary...). To draw a scatterplot or a heatmap, reshape it into a long table first.

### Two shapes, two strengths

| Shape | Structure | Strength | Good for |
|---|---|---|---|
| Wide | one row per entity, one column per metric | human-readable, close to Excel | data entry, checking, showing the raw table |
| Long | one row per observation: `{state, metric, value}` | easy to filter, group, bind | D3 data-join, faceting, heatmaps |

One `flatMap` does the conversion:

```js
// wide → long: for each row, walk the metric columns
const metrics = ["murder", "robbery", "burglary", "larceny_theft"];
const long = data.flatMap(row =>
  metrics.map(metric => ({
    state: row.state,
    metric,
    value: +row[metric],   // string → number
  }))
);
// 50 rows × 4 columns → 200 rows
```

`d3.autoType` infers column types while reading, so you can skip the per-field `+d.field`:

```js
const data = await d3.csv("data/crime.csv", d3.autoType);
// population becomes a number, date columns become Date
```

> **Pitfall**: `flatMap` returns a new array and never mutates `data`. Pushing into the original array inside `forEach` turns a pure transformation into a side effect, and reusing the data later will duplicate rows.

## 4.2 Axis Transformation

> Data space → coordinate space → screen space. Keep the three layers separate or everything drifts.

### The three spaces

| Layer | Input | Output | Owner |
|---|---|---|---|
| Data space | raw values, e.g. population 27,058,000, murder rate 8 | domain | business / statistics |
| Coordinate space | normalized to `0..innerWidth` | range | `d3.scaleLinear()` and friends |
| Screen space | pixel position after the margin offset | `x + margin.left` | SVG group `transform` |

Separating them lets primitives be reused: when the window widens you only change `range`, not the data. `d3.axisBottom(x)` performs the coordinate → screen step for ticks and labels.

### Choosing a scale

| Scale | Mapping | Typical use | Failure mode |
|---|---|---|---|
| `scaleLinear` | linear | temperature, age, rates | small values collapse when the range spans orders of magnitude |
| `scaleLog` | logarithmic | population 530k → 27M, income | undefined at 0 or negative values |
| `scaleSqrt` | square root | circle area encoding | encoding area by radius exaggerates 4× |
| `scaleBand` | discrete bands | bar chart category axis | a linear axis on categories yields "0.5 of a class" |
| `scalePoint` | discrete points | line chart category axis | points stick to the axis start without padding |
| `scaleTime` | time | date axes, time series | using row index as x flattens uneven intervals |

```js
// data space → coordinate space → screen space
const x = d3.scaleLinear().domain([0, d3.max(data, d => d.population)]).range([0, innerW]);
const y = d3.scaleLog().domain([1, d3.max(data, d => d.robbery)]).range([innerH, 0]);

const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
g.append("g").attr("transform", `translate(0,${innerH})`).call(d3.axisBottom(x));
```

> **A common bug**: adding the margin inside `range` and also translating the `<g>` shifts everything twice. Add the offset in exactly one place.

## 4.3 Curve Fitting

> The same points, a different `curve`, tell a different story. Before choosing one, ask: is this line **connecting observations** or **expressing a trend**?

### Interpolation vs fitting

| | Interpolation | Fitting |
|---|---|---|
| Passes through every point | yes | not necessarily |
| Representatives | Catmull-Rom, natural, monotoneX | linear regression, LOESS, polynomial least squares |
| Good for | trustworthy points, continuous readings | noisy data, trend only |
| Risk | invents wiggles between points | hides local anomalies |

### Common D3 curves

| curve | passes all points | monotone | good for |
|---|---|---|---|
| `curveLinear` | yes | yes | few points, honest readings |
| `curveMonotoneX` | yes | yes | time series without phantom oscillation |
| `curveCatmullRom` | yes | no | narrative lines, Storyline |
| `curveNatural` | yes | no | smooth natural curves |
| `curveBasis` | no | no | heavy smoothing, trend only |
| `curveStep` / `curveStepAfter` | yes (step) | yes | state changes, discrete signals |

```js
const line = d3.line()
  .x(d => x(d.year))
  .y(d => y(d.value))
  .curve(d3.curveMonotoneX);   // the default for time series

path.attr("d", line(series));
```

> **Quick check**: a beautiful smooth curve that passes every point and still swings up and down between them is probably Catmull-Rom telling a story. For time series, prefer `monotoneX`.

## 4.4 Slope Perception (45° Golden Angle)

> The same data, stretched or squashed, changes how fast readers think it grew.

### Cleveland's finding

Cleveland (1984) asked subjects to estimate line slopes. The error curve is U-shaped:

- error is largest near 0° (almost flat) and 90° (almost vertical);
- error is smallest around **45°**;
- people slightly exaggerate steepness; the perceptual power exponent is about 1.0–1.3.

### Design rules

1. Keep the key trend line between **30° and 60°**;
2. When comparing two growth curves, put them in the same coordinate system and scale;
3. For data spanning orders of magnitude use a **log axis** to bring steepness back near 45°;
4. Never stretch the canvas to fake a steeper trend — that is a **visual lie**.

```js
// Aim the median slope at 45°: compute the slope, then solve for the aspect ratio
const slope = (yScale(yMax) - yScale(yMin)) / (xScale(xMax) - xScale(xMin));
const idealH = innerW * Math.abs(slope);
```

> **Banking to 45°**: adjust the aspect ratio so the average absolute slope is near 45°. This is not decoration; it minimizes the reader's slope-estimation error.

## 4.5 Contours (Marching Squares)

> A scalar field is a height map; a contour line connects points at the same height.

### How the algorithm works

Discretize the plane into a grid. For each cell, compare its four corners with the threshold: above = 1, below = 0. The four bits form a case number `0–15` (16 cases). Each case contributes zero, one, or two line segments separating the high region from the low region.

| Corner | Bit | Note |
|---|---|---|
| bottom-left BL | bit0 | start |
| bottom-right BR | bit1 | |
| top-right TR | bit2 | |
| top-left TL | bit3 | |

```js
// four corner booleans → case number
const c = (bl > t ? 1 : 0) | (br > t ? 2 : 0) | (tr > t ? 4 : 0) | (tl > t ? 8 : 0);
// c = 0 or 15: the whole cell is on one side, no segment
// c = 5 or 10: saddle point, use the center value to choose the connection
```

In 3D this becomes **Marching Cubes** (Lorensen & Cline, 1987): 2⁸ = 256 cases, used to extract isosurfaces from MRI / CT volumes.

### Applications

- terrain contours, isobars and isotherms;
- density contours from kernel density estimation (KDE);
- 3D reconstruction from medical scans;
- turning scatter density into readable region boundaries.

> **Implementation tip**: a denser grid gives smoother contours, but cost grows as `n²`. For an interactive threshold slider, a 60×60 grid is smooth enough and stays fast.
