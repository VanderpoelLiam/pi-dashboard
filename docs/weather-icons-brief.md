# Design brief: weather icons

## What this is for

A wall-mounted Home Assistant dashboard running fullscreen on a Raspberry Pi at
**1280 × 720**, viewed from several feet away. It has a weather card down the
right-hand side and an 8-hour forecast overlay behind a tap.

Every weather icon currently in the build is a **placeholder**. This brief asks
for the real set.

## Where the icons appear

| Context | Size | Notes |
|---|---|---|
| Weather card | fills the card's leftover height, roughly **300 × 300** | The dominant element on the card — deliberately large |
| Forecast overlay | **34 × 34**, eight in a row | Must stay legible from across a room |

Both sizes are rendered from **one piece of geometry**. Icons are authored in a
`0 0 60 60` viewBox; the large version scales the same shapes by 3.333× into a
`0 0 200 200` box. So each icon needs to work at both scales without a separate
drawing.

## Style rules

These are fixed by the existing design and are not up for negotiation.

- **Flat geometric only** — circles, rounded rectangles, straight strokes.
  Built up by overlapping solid shapes, not outlines.
- **No gradients, no shadows, no transparency, no icon library, no emoji.**
- **Two colours only:**
  - Ink `#16130f` — clouds and primary structure
  - Terracotta `#b0603a` — the accent: sun, moon, precipitation, lightning
- The background behind every icon is always the card colour `#efe9de`. Do not
  rely on knocking shapes out with a background-coloured shape — use a single
  path with `fill-rule="evenodd"` where a shape needs a bite taken out of it, so
  the icon stays correct on any background.
- No animation.

## Already approved — please match these

Three icons come from the original design and should be kept as-is. They set the
proportions for everything else.

**`partlycloudy`** (60 × 60):
```
circle cx=36 cy=22 r=13  fill #b0603a
circle cx=22 cy=38 r=12  fill #16130f
circle cx=36 cy=40 r=9   fill #16130f
rect x=22 y=38 w=24 h=11 rx=5.5 fill #16130f
```

**`cloudy`** (60 × 60):
```
circle cx=24 cy=28 r=13  fill #16130f
circle cx=38 cy=30 r=10  fill #16130f
rect x=24 y=28 w=24 h=12 rx=6 fill #16130f
```

**`rainy`** (60 × 60):
```
circle cx=24 cy=26 r=12  fill #16130f
circle cx=37 cy=28 r=9   fill #16130f
rect x=24 y=26 w=22 h=11 rx=5.5 fill #16130f
circle cx=24 cy=46 r=3.5 fill #b0603a
circle cx=34 cy=48 r=3.5 fill #b0603a
circle cx=44 cy=45 r=3.5 fill #b0603a
```

`partlycloudy` also has a hand-authored large form at `0 0 200 200` which is kept
verbatim rather than scaled. If the new set changes its proportions, that large
form needs redrawing too.

## What to design — 13 icons

Twelve conditions plus one night variant.

| # | Key | Label shown | Notes |
|---|---|---|---|
| 1 | `sunny` | Sunny | A single terracotta disc, per the original spec. Needs to read as clearly distinct from `clear-night` |
| 2 | `clear-night` | Clear | Crescent moon, terracotta. Must be unmistakably a moon at 34px |
| 3 | `partlycloudy-night` | Partly cloudy | The approved `partlycloudy` with the sun replaced by the crescent |
| 4 | `fog` | Fog | Cloud plus horizontal banding |
| 5 | `pouring` | Heavy rain | Must read as heavier than `rainy` at 34px — this pair is the hardest to tell apart |
| 6 | `snowy` | Snow | Distinct from rain at 34px |
| 7 | `snowy-rainy` | Sleet | A mix of the snow and rain marks |
| 8 | `hail` | Hail | Distinct from both snow and rain |
| 9 | `lightning` | Thunder | Bolt, no precipitation |
| 10 | `lightning-rainy` | Thunderstorm | Bolt plus precipitation |
| 11 | `windy` | Windy | No cloud — streaks only |
| 12 | `windy-variant` | Windy | Cloud plus streaks |
| 13 | `exceptional` | Severe | **No agreed visual.** Home Assistant uses this for severe-weather alerts. Open to interpretation — it should read as "something unusual, check the forecast" |

## Constraints worth designing against

- **Optical balance.** The current placeholders fail here: the sun disc reads far
  smaller than the precipitation icons, because those fill more of the box. The
  set should feel like one family at a glance.
- **The 34px test is the real one.** Several pairs must stay distinguishable at
  that size from a few feet away: rainy/pouring, snowy/hail, snowy/snowy-rainy,
  lightning/lightning-rainy, windy/windy-variant.
- **Precipitation needs vertical room.** The approved `rainy` lifts its cloud to
  y=26 rather than y=28 to make space. Expect to do the same for anything with
  marks beneath the cloud.

## Deliverable

For each icon, the shape list in a `0 0 60 60` viewBox — circles, rects and paths
with explicit coordinates and fills, in the same form as the approved three
above. Raw SVG is fine; it gets transcribed into a single `SHAPES` entry per
icon.

If any icon cannot work at both 34px and ~300px from one geometry, flag it and
supply a separate large form, as `partlycloudy` already does.
