# Chapter 5 Time-Series Data Visualization

> Time has five properties: ordered, continuous, periodic, independent of space, and structured. Whether you draw a line, a calendar, or a spiral depends on whether you want readers to see a trend, a cycle, or a narrative.

## 5.1 Temporal Attributes

> Before drawing a time-series chart, take "time" apart.

### Five core properties

| Property | Meaning | Design constraint | Cost of ignoring it |
|---|---|---|---|
| Ordered | events have an order, tied to causality | the x axis must be time-sorted | points misalign into noise; trends vanish |
| Continuous | another instant always exists between two | connect continuous data; use steps/points for discrete events | discrete states get drawn as continuous change |
| Periodic | seasons, day/night, weekly cycles | cyclic time domains (calendar, spiral) | seasonal patterns are flattened by a linear axis |
| Independent of space | time correlates with space but is usually handled separately | time gets one axis; do not mix spatial coordinates | dual-axis confusion and false causality |
| Structured | year/month/day/hour/min/sec, natural + human-made | handle leap years, month ends, weekdays/weekends | misalignment across months, years, leap days |

### Property → chart choice

| What readers should see | Prefer | Why |
|---|---|---|
| Long-term trend | line / area chart | a linear time domain is the most direct |
| Weekly rhythm, holiday anomalies | calendar heatmap | weekdays align; anomalies pop out |
| Annual cycle, rhythm | spiral / polar | one loop = one cycle |
| Multi-actor narrative | Storyline | converging and diverging lines express relationships |
| Precise single readings | line + points + tooltip | position is the most accurate channel |

```js
// Parse time explicitly; do not rely on browser differences in new Date("2007/8/15")
const parse = d3.timeParse("%Y-%m-%d");
const date = parse("2024-03-01");        // explicit and portable
const fmt = d3.timeFormat("%Y day %j");
```

> **Pitfall**: `new Date("2024-03-01")` parses as UTC, while `new Date("2024/03/01")` parses as local time. Across time zones the same day can shift to the previous day. Use `d3.timeParse` or ISO strings consistently.

## 5.2 Standard Temporal Visualization (Line Chart)

> x axis = time, y axis = measure. It is the most common time-series chart and one of the easiest to get wrong.

### Your original case

The usage frequency of French given names from 1900 to 2020 (Marie / Jean / Camille). The original page added a word cloud, hover highlighting, and a time-range filter.

### Three design rules

1. **Use real time intervals**: `scaleTime`, not row indices. 1900→1950 and 1950→2020 should have widths proportional to their real durations.
2. **Let point count choose the smoothing**: ≤50 points `curveLinear`; 50–500 `curveMonotoneX`; >500 consider area or binned aggregation.
3. **Interaction serves reading**: hover for exact values, brush to select a period, double-click to reset.

```js
const x = d3.scaleTime()
  .domain(d3.extent(data, d => d.date))
  .range([0, width]);

const y = d3.scaleLinear()
  .domain([0, d3.max(data, d => d.value)]).nice()
  .range([height, 0]);

const line = d3.line()
  .x(d => x(d.date))
  .y(d => y(d.value))
  .curve(d3.curveMonotoneX);

svg.append("path").datum(data).attr("d", line)
  .attr("fill", "none").attr("stroke", "var(--cinnabar)");
```

> **Common bug**: stacking multi-year data by "month index 1–12" makes the line jump from December back to January, creating a cliff that does not exist. Keep real dates for multi-year data.

## 5.3 Calendar Heatmap (van Wijk)

> Arrange a whole year as "week = column, weekday = row" to show cycles and anomalies at once.

### Layout algorithm

- For each date, compute its week-of-year and weekday;
- x = week index, y = weekday, color = value;
- draw dividers between months; they make a 7×53 grid readable;
- use a sequential colormap (e.g. Viridis), never a rainbow.

```js
// week index and weekday, with Monday as the first day
const week = d3.timeWeek.count(d3.timeYear(date), date);
const weekday = (date.getDay() + 6) % 7;   // Monday=0 … Sunday=6

const x = d3.scaleLinear().domain([0, 53]).range([0, width]);
const y = d3.scaleBand().domain(d3.range(7)).range([0, height]);
```

### The clever month-divider test

Do not draw lines on "the 1st of each month"; compare the current cell with the previous one:

```js
const isMonthDivider = (d, i) => i > 0 &&
  d.getMonth() !== data[i - 1].getMonth();
```

This places the divider on the exact cell where the month changes, regardless of the starting weekday or month length.

> **Design note**: starting weeks on Monday or Sunday changes where "the weekend" appears. Pick one convention and state it in the caption.

## 5.4 Cyclic Time Visualization (Archimedean Spiral)

> Arrange time around a circle: one loop = one cycle. A spiral is a circle that keeps unfolding.

### Why a spiral

A line chart shows trends but hides cycles: the same season in two years sits far apart. A spiral puts the same phase on the same ray, making seasonal rhythms visible.

Archimedean spiral: `r = a + bθ`; each turn adds a constant `b` to the radius.

```js
const theta = (dayOfYear / 365) * Math.PI * 2;
const turn = yearIndex;                    // which year
const r = r0 + turn * gap;                 // expand by gap per turn
const x = cx + r * Math.cos(theta);
const y = cy + r * Math.sin(theta);
```

The original notes a neat detail: `Δθ = boxSize / √(b² + r²)` adjusts each cell's angular width so every date cell has roughly the same **arc length**, preventing outer cells from stretching.

### When to use it

| Good for | Not good for |
|---|---|
| annual / seasonal / weekly cycles | no cycle, or a very long cycle |
| comparing the same phase across years | precise single-value readings |
| showing rhythm rather than trend | sparse, irregular events |

## 5.5 Storyline Timeline (Jurassic Park)

> Multi-actor narrative: each line = a character / organization / process; convergence and divergence express changing relationships.

### Three elements

1. **Time-scale mapping**: film duration → SVG width, with the x axis strictly proportional;
2. **Lifelines**: `curveCatmullRom.alpha(0.5)` splines; lines converge for encounters/conflicts and separate for distance;
3. **Event layer**: translucent circles plus labels for key turning points.

```js
const line = d3.line()
  .x(d => d.time)
  .y(d => d.y)
  .curve(d3.curveCatmullRom.alpha(0.5));

g.selectAll(".character").data(characters).join("path")
  .attr("d", d => line(d.points))
  .attr("stroke", d => d.color)
  .attr("fill", "none");
```

### Why Catmull-Rom instead of monotoneX

`monotoneX` avoids overshoot but makes the lines too straight, losing the "river-like" narrative flow. A Catmull-Rom tension of `0.5` is the empirical sweet spot: it flows naturally without oscillating between control points.

> **Applications**: film analysis, multi-person case timelines, sports interactions, project handoffs. Storyline is about how relationships change over time, not about exact readings.
