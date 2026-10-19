# Chapter 3 Color Topics

> Color is not decoration; it is a **data channel**. Choose it badly and readers draw the wrong conclusion. This chapter covers color spaces, colormaps, gamuts, palette rules, and color-vision deficiency (CVD), then distills a reusable palette method.

## 3.1 Color Model Fundamentals

> Why four color spaces? Because each answers a different question.

### Four color spaces

| Space | Coordinates | Good at | Bad at |
|---|---|---|---|
| RGB | red / green / blue, additive | screens, device output | not perceptual; do not interpolate directly |
| HSL | hue / saturation / lightness | artistic control, quick palettes | uneven lightness; still not perceptual |
| CIE Lab | lightness L + opponent axes a / b | perceptual uniformity, interpolation, color difference | needs color management; not directly CSS |
| CMYK | cyan / magenta / yellow / black, subtractive | print | rarely used on the web |

RGB is not perceptually uniform: `rgb(255,0,0)` and `rgb(0,255,0)` have the same numeric distance, yet green looks much brighter. Interpolating in RGB makes gradients turn muddy or gray in the middle.

```js
// Blue to gold: RGB interpolation goes gray; Lab stays clean
const rgbGrad = d3.interpolateRgb("steelblue", "gold")(0.5);
const labGrad = d3.interpolateLab("steelblue", "gold")(0.5);
```

### CVD (color-vision deficiency)

About **8% of men and 0.5% of women** have some form of CVD:

| Type | Missing cone | Experience | Prevalence in men |
|---|---|---|---|
| Protanopia | red | red looks dark; red/green confuse | ≈1% |
| Deuteranopia | green | red and green look nearly identical | ≈6% (most common) |
| Tritanopia | blue | blue/yellow confuse | very rare |

> **Design implication**: red-green contrast is the most dangerous pairing. Never rely on color alone; add shape, labels, line style, or direct annotation.

## 3.2 The Three Categories of Colormaps

> Sequential / diverging / qualitative. Choosing the wrong type misleads readers.

### Three colormap types

| Type | Data semantics | Color behavior | Examples | Counterexample |
|---|---|---|---|---|
| Sequential | ordered: population, temperature, density | monotone lightness + slight hue shift | Viridis, Cividis, Blues | rainbow Jet |
| Diverging | a meaningful midpoint: 0, ±, distance from mean | two hues, light in the middle | RdBu, BrBG, PiYG | diverging on data without a midpoint |
| Qualitative | unordered categories: products, countries, gender | hue separation, similar lightness | Tableau10, Wong, Set2 | qualitative colors for continuous values |

### A classic mistake

Using diverging `RdBu` for "murder rate by state": the pale middle suggests a meaningful midpoint near 100, but 100 means nothing. **The middle color of a diverging map must correspond to a meaningful baseline** (0, the mean, a policy target).

### CVD-friendly checklist

- Viridis / Cividis: ✅ excellent (uniform, CVD-safe, grayscale-safe)
- Wong / Okabe-Ito / Paul Tol: ✅ excellent category palettes
- RdBu / BrBG: △ moderate (red-green issues, but lightness helps)
- Tableau10: △ hue-dependent, red and green adjacent
- Jet / Rainbow: ⚠ avoid (non-uniform, false boundaries, CVD-hostile)

```js
// Sequential: value → color
const color = d3.scaleSequential(d3.interpolateViridis).domain([0, max]);

// Diverging: centered at 0
const diverging = d3.scaleDiverging(d3.interpolateRdBu).domain([-max, 0, max]);

// Qualitative: category → color
const ordinal = d3.scaleOrdinal(d3.schemeTableau10);
```

## 3.3 CIE Lab Gamut Diagram

> In a perceptually uniform space, distance between colors approximates what the eye sees.

### The three Lab coordinates

- `L*`: lightness, 0 (black) → 100 (white);
- `a*`: green (negative) ↔ red (positive);
- `b*`: blue (negative) ↔ yellow (positive).

Color difference is measured by `ΔE`. `ΔE76` is Euclidean distance in Lab; `ΔE2000` is weighted toward human perception. Rules of thumb: `ΔE < 2` is nearly indistinguishable; `ΔE > 5` is a safe distinction between categories.

### Three gamuts

| Gamut | Use | Coverage of CIE 1931 (approx.) |
|---|---|---|
| sRGB | web, ordinary screens, slides | 35% |
| Adobe RGB | photography, print | 50% |
| Rec.2020 | 4K / HDR television | 75% |

Colors outside sRGB cannot be shown on ordinary screens; they are **clamped** to the boundary. Generate colormaps by interpolating in Lab, then convert back to sRGB, to avoid muddy midpoints.

```js
// Lab interpolation: perceptually even, good for colormaps
const ramp = d3.range(0, 1.01, 0.05)
  .map(t => d3.interpolateLab("#1f4e79", "#f2c14e")(t));

// Lab → sRGB, then check for clipping
const rgb = d3.lab(60, 40, -30).rgb();
const clipped = rgb.displayable();   // false means outside sRGB
```

> **Practical tip**: highly saturated colors (e.g. `#00ff00`) often fall outside sRGB in Lab terms. The color you see in a design tool and the color on a user's screen may differ.

## 3.4 Color Scheme Combination Rules (5 major types)

> Monochromatic / analogous / complementary / triadic / split-complementary. When to use which?

### Five rules

| Rule | Hue relationship | Mood | Good for |
|---|---|---|---|
| Monochromatic | one hue, varying L / S | restrained, professional | serious research, layered single metrics |
| Analogous | neighbors within ±30° | harmonious, soft | groups under one theme |
| Complementary | opposite, 180° | strong, easily harsh | treatment vs control |
| Triadic | 120° apart | lively, balanced | three categories |
| Split-complementary | 150° / 210° | gentle contrast | a good default |

### Selection principles

1. Keep categories ≤ 7; with more, switch to a continuous colormap or merge into "other";
2. Use a complementary color for emphasis, but let **one** color carry the emphasis;
3. Keep backgrounds, grids, and annotations low-saturation; save saturation for data;
4. Check in grayscale: if categories collapse without hue, lightness is not doing enough work.

```js
// HSL analogous palette: hue ±30°, stepped saturation and lightness
const base = { h: 18, s: 62, l: 46 };
const analogous = [-30, -15, 0, 15, 30].map((dh, i) =>
  d3.hsl((base.h + dh + 360) % 360, base.s - i * 4, base.l + i * 5).formatHex()
);
```

## 3.5 Classic Scientific Palettes

> Wong / Paul Tol / Okabe-Ito / Tableau / Viridis — what do top journals actually use?

### Three gold standards

| Palette | Colors | Features | Source |
|---|---|---|---|
| Wong | 8 | CVD-safe, grayscale-safe | Wong, Nature Methods 2011 |
| Okabe-Ito | 8 | essentially the same family; early journal default | Okabe & Ito 2002 |
| Paul Tol bright | 7 | crisp on white, evenly spaced hues | SRON Technical Note |

Wong 8: `#000000 #E69F00 #56B4E9 #009E73 #F0E442 #0072B2 #D55E00 #CC79A7`.

```js
// Register Wong 8 as an ordinal scale
const wong8 = ["#000000", "#E69F00", "#56B4E9", "#009E73",
               "#F0E442", "#0072B2", "#D55E00", "#CC79A7"];
const color = d3.scaleOrdinal(wong8);
```

### Commercial and general

- **Tableau 10**: the workhorse of business charts, 10 colors; red and green are adjacent, so CVD-unsafe.
- **Paired (12)**: designed in pairs (before/after); 12 colors is easy to overload.

### Sequential / diverging

- **Viridis**: the matplotlib / d3 default, perceptually uniform and CVD-safe;
- **Cividis**: a CVD-hardened Viridis with clearer blue-yellow separation;
- **RdBu**: diverging red-blue, best for data centered on zero.

> **Rules of thumb**: ≤ 7 categories; always run a CVD simulation; prefer palettes that are both CVD-safe and grayscale-safe.

## 3.6 Right-vs-Wrong Case Comparison

> Four charts, three wrong, one right. Decide first, then read why.

### Four typical mistakes

| # | Mistake | Problem | Fix |
|---|---|---|---|
| 1 | rainbow Jet for continuous values | non-uniform, false boundaries, CVD-hostile | Viridis / Cividis |
| 2 | red-green contrast for two classes | nearly identical for red-green colorblind readers | Wong orange + blue, or add shape/labels |
| 3 | 12 colors for 12 categories | beyond ~7, hue discrimination collapses | merge to 7 + "other" |
| 4 | diverging map without a midpoint | pale middle misread as a meaningful baseline | use a sequential map |

> **Teaching tip**: let students vote on "which one is right" before revealing the CVD simulation. Getting it wrong once sticks better than ten readings.

```js
// Quick grayscale check: two classes must not rely on hue alone
const gray = (hex) => {
  const c = d3.rgb(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
};
const pairs = wong8.slice(0, 4).map((c, i) => [gray(c), c]);
```

## 3.7 Vivid + Low-Saturation Philosophy Generator

> ≤ 7 colors, vivid accents + low-saturation companions = attractive and durable.

### Three rules

1. **Count ≤ 7**: beyond seven, hue discrimination collapses;
2. **Hue spacing ≥ 30°**: use H to create between-category distance;
3. **Vivid primary, muted companions**: primary S 70–80%, companions S 30–50%.

### The 7-color formula

Primary + 2 analogous (±30°) + 1 muted analogous + 1 complementary + 1 muted complementary + 1 highlight = 7.

```js
const h = base.h;
const palette = [
  hsl(h, 72, 48),          // primary
  hsl(h + 30, 64, 52),     // analogous +
  hsl(h - 30, 60, 44),     // analogous -
  hsl(h + 15, 38, 60),     // muted analogous
  hsl(h + 180, 58, 46),    // complementary
  hsl(h + 150, 34, 62),    // muted complementary
  hsl(h, 88, 88),          // highlight / background
];
```

> **Note**: these seven colors are a starting point, not a verdict. Run a CVD and grayscale check afterward; if two categories share lightness, add shape or direct labels.

## 3.8 CVD Academic-Figure Test

> Can your figure still be read by a colorblind reader? Test it on real journal figures.

### How simulation works

CVD simulation is not "turn red into gray"; it transforms colors according to cone response. The common Brettel / Viénot matrices model protanopia, deuteranopia, and tritanopia.

```js
// Simplified deuteranopia matrix, applied to linear sRGB
const deuteranopia = [
  [0.625, 0.375, 0.0],
  [0.7,   0.3,   0.0],
  [0.0,   0.3,   0.7],
];
```

### Test workflow

1. Export the figure as PNG (not a cropped screenshot);
2. Run all three simulations with Coblis / Color Oracle / the Color Lab in this site;
3. Ask three questions: can categories still be distinguished? is order still readable? are key annotations still visible?

### Findings

- Wong / Okabe-Ito / Paul Tol: distinguishable under all three CVD types;
- red-green contrast: nearly identical for deuteranopes — the most serious failure;
- Viridis: keeps lightness order under all three CVD types, suitable for continuous values;
- Nature / Science / Cell increasingly require CVD-safe palettes.

> **One-line summary**: color is a helper, not the only encoding. Shape, position, labels, and line style are the insurance that makes a chart readable for everyone.
