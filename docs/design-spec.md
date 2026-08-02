# Handoff: Home Assistant Wall Dashboard

## Overview
A wall-mounted touchscreen dashboard for Home Assistant, running fullscreen on a Raspberry Pi kiosk display at **1280 × 720, landscape, no scrolling** — everything must fit one screen. Viewed from several feet away, so type is large and hit targets are generous.

It shows: clock + date, bin/recycling reminders, the next three bus departures, current weather (tap for an 8-hour forecast screen), and light controls for the living room and bedroom.

## About the Design Files
The files in this bundle are **design references created in HTML** — a prototype showing intended look and behavior, not production code to copy directly. The task is to **recreate this design in the target codebase's environment** (a Home Assistant custom Lovelace card, a React/Vue kiosk page, plain HTML/JS — whatever the project uses) using its established patterns. If no environment exists yet, pick the most appropriate approach for a Pi kiosk page and implement there.

`Wall Dashboard v4.dc.html` is authored in a custom streaming component format; `support.js` is its runtime. Treat the markup as a **visual and structural spec**, not a dependency. Everything is inline-styled, so the styles transfer literally.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, and interactions. Recreate pixel-accurately with the codebase's own libraries. All values below are exact.

## Screens / Views

### 1. Dashboard (main screen)
**Purpose:** at-a-glance status, plus one-tap light control.

**Layout** — root is `1280 × 720`, `box-sizing: border-box`, `padding: 16px`, CSS grid:
- `grid-template-columns: 1.3fr 1.3fr 1fr`
- `grid-template-rows: 286px 178px 1fr`
- `gap: 14px`
- background `#b0603a` (terracotta), text `#16130f` (ink), `overflow: hidden`, `user-select: none`

Placement:
| Card | Grid area |
|---|---|
| Clock | col 1–2, row 1 |
| Departures | col 1–2, row 2 |
| Living room light | col 1, row 3 |
| Bedroom light | col 2, row 3 |
| Weather | col 3, rows 1–3 (full height) |

All cards: `background: #efe9de`, `border-radius: 26px`. A light card that is OFF uses `#ded7ca` instead.

#### Clock card (`data-ha="sensor.time"`)
`padding: 24px 28px`, flex column, `justify-content: space-between`.
- Time `20:14` — 168px / 700 / `letter-spacing:-0.055em` / `line-height:0.78`
- Seconds `38` — JetBrains Mono 32px, ink, baseline-aligned, 16px gap (optional, `showSeconds`)
- Date `Monday, 27 July` — 32px / 600, `margin-top: 14px`
- Day-progress rule at the bottom: 1px hairline `#c3b8a6` full width; ink 1px line from 0 to the current fraction of the day (84.2% in the mock); a 2px × 13px ink tick at that position. Below it, `00 06 12 18 24` in JetBrains Mono 11px, `letter-spacing:0.14em`, `#8a8072`, spaced `space-between`.
- Bin chips, stacked vertically top-right, `gap: 10px`, `flex: none`, `white-space: nowrap`:
  - Paper (`data-ha="sensor.waste_paper"`): filled `#16130f`, text `#f7efe4`, `padding: 13px 18px`, `border-radius: 999px`, 18px/600, with a 12px × 12px square swatch in `#f7efe4`, `gap: 10px`. Copy: `Paper today`.
  - Cardboard (`data-ha="sensor.waste_cardboard"`): same metrics but `border: 1.5px solid #16130f`, ink text, ink swatch. Copy: `Cardboard tomorrow`.
  - Chips are shown **only when the collection is within 2 days**; copy is relative (`today` / `tomorrow` / `in 2 days`).

#### Departures card (`data-ha="sensor.bus_stop"`)
`padding: 18px 28px`, flex row, `align-items: center`, `gap: 28px`.
- Left block (`data-ha="sensor.bus_stop.next"`, `flex: none`):
  - Label `NEXT DEPARTURE` — JetBrains Mono 12px, `letter-spacing:0.18em`, `#6f6559`, `margin-bottom: 6px`
  - Time `20:22` — 80px / 700 / `-0.05em` / `line-height:0.9`; countdown `in 8 min` — 28px / 600, ink, `nowrap`, 16px gap
  - Countdown comb below, `height: 11px`, `border-radius: 3px`, `margin-top: 12px`: `repeating-linear-gradient(90deg,#16130f 0 3px,transparent 3px 9px)`
- Right block: the two later departures, pushed right (`flex: 1; justify-content: flex-end; gap: 24px`), each with `border-left: 1px solid #cdc2b0; padding-left: 24px`:
  - 2nd (`sensor.bus_stop.second`): `20:31` 46px/700/`-0.045em`, `in 17 min` 20px/500 `#6f6559`
  - 3rd (`sensor.bus_stop.third`): same, both lines in `#8a8072`
- No route numbers or destinations — time and countdown only.

#### Light cards (living room, bedroom)
`padding: 18px 22px`, flex column, `justify-content: space-between`, `border-radius: 26px`.
- Header row (`space-between`, centered): left = room label (JetBrains Mono 12px, `0.18em`, `#6f6559`) above the **level glyph**; right = the on/off toggle.
- **Level glyph** — three stacked bars in a 62px SVG (`viewBox="0 0 72 72"`), rounded rects `rx=3`, bottom-aligned at y=58:
  - bar 1 `x=8 y=40 w=14 h=18`, bar 2 `x=29 y=26 w=14 h=32`, bar 3 `x=50 y=12 w=14 h=46`
  - lit bar: `fill: #16130f`; unlit bar: `fill:none; stroke:#cdc2b0; stroke-width:2.5`
  - OFF: all three hollow with `stroke: #b6ab99`
  - LOW = 1 lit, MED = 2 lit, HIGH = 3 lit. Wrapper is `height: 66px`, `margin-top: 4px`.
- **Toggle**: 74 × 42, `border-radius: 21px`, `border: 1.5px solid #16130f`, `padding: 3px`; knob 35 × 35 circle. ON: track `#16130f`, knob `#f7efe4`, `justify-content: flex-end`. OFF: track transparent, knob `#b6ab99`, `flex-start`.
- **Button row**, `gap: 10px`, each button `flex: 1`, `height: 62px`, `border-radius: 16px`, `border: 1.5px solid #16130f`, flex column, centered, `gap: 3px`. All three share the same outlined style — none is filled. Each has a 23px icon plus a JetBrains Mono 10px `0.14em` ink label:
  - `BRIGHTER` — sun outline (circle r=4.5 + 8 rays), stroke ink 1.5
  - `DIMMER` — circle outline with the right half filled ink
  - `WARM` / `COOL` — a 23px filled disc: warm `#e08a3c`, cool `#9ab6cc`, `#c3b8a6` when the light is off. The label is the current state.

`data-ha` hooks: `light.living_room.toggle`, `.brightness_up`, `.brightness_down`, `.color_temp_toggle`, and the same four under `light.bedroom`.

#### Weather card (`data-ha="weather.home"`, tap → forecast)
`position: relative`, `box-sizing: border-box`, `padding: 20px`, flex column, `overflow: hidden`, `cursor: pointer`.
- Top-left: `L. 14°   H. 23°` — JetBrains Mono 12px, `0.14em`, `#6f6559`, `padding-right: 48px`
- Condition word, absolutely positioned `top:20px; right:20px`, `writing-mode: vertical-rl`, 28px / 600 / `-0.01em`. Copy: `Partly cloudy`
- Icon area: `flex: 1; min-height: 0`, centered, `padding-right: 34px`, `margin: -6px 0`. SVG is `height: 100%; width: auto; max-width: 100%` so it fills the leftover height — the icon is deliberately the dominant element.
- Icon (partly cloudy, `viewBox="0 0 200 200"`): terracotta `#b0603a` sun disc `cx=126 cy=62 r=54`; ink cloud = circles `(70,124,r40)`, `(114,128,r31)`, `(40,144,r25)` plus rects `x=70 y=128 w=76 h=31 rx=15.5` and `x=40 y=134 w=76 h=25 rx=12.5`. Build one flat geometric icon per condition in this style (sun = single disc; rain = cloud + 3 discs; snow, cloudy, etc.).
- Bottom: `19` at 108px / 700 / `-0.055em` / `line-height:0.82` with `°C` at 30px / 600 (`margin-top: 8px`), then `TAP FOR FORECAST` — JetBrains Mono 11px, `0.16em`, `#8a8072`, `margin-top: 8px`.

### 2. Forecast screen (overlay)
Opens on tapping the weather card; `position: absolute; inset: 0; z-index: 5`, background `#b0603a`, `padding: 22px`, flex column, `gap: 14px`.
- Header row (`padding: 0 8px`): `Next 8 hours` 42px / 700 / `-0.03em` in `#f7efe4`; beneath it `MONDAY 27 JULY · L. 14° H. 23°` JetBrains Mono 12px `0.16em` `#f0cdb9`. Right: close button, 68px circle, `#16130f`, with an `f7efe4` X (`data-ha="ui.close_forecast"`).
- Chart card: `flex: 1`, `#efe9de`, `border-radius: 26px`, `padding: 24px 26px`, flex row, `gap: 14px`. Eight equal columns, each flex column centered with `gap: 12px`:
  1. temp `18°` — 34px / 700 / `-0.04em`
  2. bar — `flex: 1`, full width, bottom-aligned; height = share of the range; `border-radius: 10px 10px 3px 3px`. Current hour is ink `#16130f`, the rest terracotta `#b0603a`.
  3. 34px condition icon (same flat vocabulary)
  4. hour `21:00` — JetBrains Mono 14px `#6f6559`
- Mock data: 18/17/16/15/15/14/14/15 °C for 21:00→04:00, bar heights 75/62/50/38/38/25/25/38 %.

## Interactions & Behavior
- **Light toggle** — flips the room on/off. Off: card `#ded7ca`, glyph hollow, temp disc `#c3b8a6`, toggle knob left.
- **Brighter / Dimmer** — step the level through 1→2→3, clamped; either button also forces the light on. Only three brightness levels exist — map them to whatever HA brightness values you use (e.g. 25 / 60 / 100 %).
- **Warm/Cool** — a single button that toggles between two color temperatures and displays the current one (disc color + label). Only two states are ever used; map to your two Kelvin values (e.g. 2700 K / 4500 K).
- **Weather card tap** — opens the forecast overlay; the X closes it.
- No hover states (touch device). No animations in the mock; if you add them, keep them short (≤150 ms) and non-decorative.
- Everything must fit 1280 × 720 without scrolling; no responsive breakpoints required.

## State Management
```
livingOn: bool          bedroomOn: bool
livingLevel: 1|2|3      bedroomLevel: 1|2|3
livingWarm: bool        bedroomWarm: bool
forecastOpen: bool
```
Mock defaults: living = on / level 3 / warm; bedroom = on / level 2 / cool; forecast closed.

Data to fetch (all static in the mock): current time and date, day fraction for the progress rule; next three departures (time + minutes until) from one stop; current temp, condition, daily low/high, and 8 hourly temps + conditions; next paper and cardboard collection dates.

## Design Tokens
Colors
- Ground / terracotta: `#b0603a`
- Card: `#efe9de` · Card (off/muted): `#ded7ca`
- Ink (text + accent): `#16130f`
- Light text on ink: `#f7efe4` · on terracotta, secondary: `#f0cdb9`
- Muted text: `#6f6559` · Dimmer muted: `#8a8072` · Disabled: `#8a8175`
- Hairlines/borders: `#cdc2b0`, `#c3b8a6`, `#b6ab99`
- Warm bulb: `#e08a3c` · Cool bulb: `#9ab6cc`

Typography — **Space Grotesk** (400/500/600/700) for everything except monospace labels, which are **JetBrains Mono** (400/500), always uppercase with `letter-spacing: 0.14–0.20em`, sizes 10–14px.
Display sizes used: 168, 108, 80, 62 (glyph), 54, 46, 42, 34, 32, 30, 28, 21, 20, 18px.

Spacing: page padding 16, card padding 18–28, grid gap 14, control gap 10.
Radii: cards 26 · buttons 16 · chips/toggle 999 · comb/bars 3 · forecast bars `10 10 3 3`.
Shadows: none anywhere.

## Assets
No images. Every icon is inline SVG built from circles, rounded rects, and straight strokes — flat geometric shapes, no icon library, no emoji. Fonts load from Google Fonts; self-host them on the Pi so the kiosk works offline.

## Files
- `Wall Dashboard v4.dc.html` — the full design: dashboard + forecast overlay, with all `data-ha` hooks
- `support.js` — runtime for the prototype format; not needed in production

### data-ha wiring map
```
sensor.time
sensor.waste_paper
sensor.waste_cardboard
sensor.bus_stop            (card)
sensor.bus_stop.next
sensor.bus_stop.second
sensor.bus_stop.third
weather.home               (card, opens forecast)
ui.close_forecast
light.living_room.toggle
light.living_room.brightness_up
light.living_room.brightness_down
light.living_room.color_temp_toggle
light.bedroom.toggle
light.bedroom.brightness_up
light.bedroom.brightness_down
light.bedroom.color_temp_toggle
```
