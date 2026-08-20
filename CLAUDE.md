# Working on this dashboard

A Home Assistant wall dashboard for a Raspberry Pi touchscreen. Plain HTML, CSS
and JavaScript — **no build step, no framework, no dependencies, no package
manager**. Keep it that way: it has to stay debuggable over SSH on a Pi.

## Hard rules

**Never write to `js/config.js`.** It holds the user's Home Assistant URL and
long-lived access token, it is gitignored, and it exists only on the user's
machines. Overwriting or deleting it costs them a token regeneration. To test
against a fake Home Assistant, serve an isolated copy of the app from a
scratchpad directory with its own config — never point the real tree at a mock.

**Never fire light service calls at the real instance while testing.** The
entities are real bulbs in someone's home. Read-only inspection is fine;
`toggle`, `bright`, `mid`, `dim` and `warm_cool_toggle` are not.

**Classic scripts only.** No ES modules, no `import`/`export`. Scripts load in
order from `index.html` and attach to `window`. This is deliberate so the page
also works over `file://`.

## Architecture

```
index.html          the dashboard
icons.html          every weather icon at both sizes, rendered from icons.js
weather-icons.svg   the designer's icon sprite — source of truth for artwork
js/
  config.js         HA URL + token (gitignored, never committed, never written)
  config.example.js the template users copy
  entities.js       every HA entity id, plus brightness and kelvin thresholds
  ha.js             WebSocket client: auth, subscriptions, reconnect, keepalive
  data.js           the seam between Home Assistant and the UI
  app.js            rendering and input handling
  icons.js          all inline SVG
css/dashboard.css   layout and design tokens
css/fonts.css       self-hosted @font-face declarations
```

Two files carry all the coupling:

- **`entities.js`** is the only place HA entity ids and tuning constants live. If
  something is renamed in Home Assistant, nothing else should need touching.
- **`data.js`** is the only file that reads from `HA` or calls services. `app.js`
  renders from whatever `Data` returns and never talks to Home Assistant. Keep
  that boundary — it is what let every card be wired one at a time.

## Data rules

**Never invent data.** Precedence in `data.js` is: live HA values → the last real
values seen (stale but true) → nothing. Mock data appears only under `?demo=1`.
A wall display showing plausible-but-fake bus times is worse than one visibly
showing none, and it once masked a real connection failure for an hour.

**Departures are the exception: they never fall back to the last values seen.**
Link down, the card goes to em-dashes at once. Every other card degrades
honestly — a stale temperature is still roughly the weather outside — but a
stale departure counts down as convincingly as a live one, and you act on it by
walking out of the door. `getDepartures` therefore skips `cached()`.

Past departures are dropped in `app.js`, not `data.js`: a departure holds the
card for the whole clock minute it leaves in (18:38 reads "now" until 18:39:00),
then falls off and the later buses shift up. HA keeps publishing a departure for
a while after it has gone, so this — not the sensor order — is what decides which
bus is next.

Missing values render as em-dashes, with a chip in the bottom-left corner:

| Chip | Meaning |
|---|---|
| *(none)* | Connected |
| `NO CONNECTION` | Link dropped; reconnecting with backoff, values are stale |
| `AUTH FAILED` | Token rejected; not retrying, since that will not self-fix |
| `NO CONFIG` | `js/config.js` missing or still has the placeholder token |

**All weather comes from one REST sensor**, `sensor.meteoswiss_8053`, whose
attributes carry MeteoSwiss's whole response for the postcode: current
conditions, nine daily entries, and the hourly series behind the chart —
including the precipitation min/max the chart is built on. Home Assistant does
the fetching because the feed sends no CORS headers and a browser is therefore
not allowed to read it. See "Weather" in README.md for the config.

Because it is ordinary entity state, the forecast arrives over the subscription
like everything else. There is no polling timer and no service call that returns
a response, which is why `ha.js` has only fire-and-forget `callService()`.

`graph.temperature*1h` is hourly across all nine days. Precipitation is not: the
first ~27 hours arrive as 10-minute slots — a nowcast, refreshed faster than the
rest of the feed — and the remainder hourly. Six slots fold into an hour by
mean, matching MeteoSwiss's own chart. In settled weather the two agree exactly;
under fast convective rain they drift, because the nowcast has been updated more
recently than the hourly series has. Parsing is memoised against the `graph`
object, since `ha.js` swaps the whole array in on change and the render loop
runs every second.

**Departures read the raw timestamp sensors**, not the user's
`bus_N_time`/`bus_N_countdown` template sensors. Those only re-evaluate when HA
re-runs `now()`, roughly once a minute, and one of them was mismapped. Reading
`sensor.zurich_waserstrasse_zurich_hb_departure{,_1,_2}` directly gives both the
clock time and a countdown that ticks every second.

## Lights

Both entities are **light groups**, so `brightness` is the mean across whichever
members are on. The three-bar glyph shows that average, which is correct because
the scripts always drive every member together.

All control goes through HA scripts — never `light.turn_on`. Each script jumps to
an absolute brightness, so which one to call depends on where the light is now.
The branch points come from the user's Hue dimmer blueprint, which calls these
same scripts from its UP and DOWN presses — that shared call is what keeps the
wall panel and the physical remote stepping through the same three levels:

| Current brightness | BRIGHTER | DIMMER |
|---|---|---|
| `< 40` | `_mid` | `_dim` |
| `40 – 200` | `_bright` | `_dim` |
| `> 200` | `_bright` | `_mid` |

With the light off, brightness defaults to `0` going up and `255` going down, so
both land on mid. That is deliberate, and matches the blueprint.

**`_mid` must stay strictly between 40 and 200.** If it ever reached 200, a
DIMMER press from mid would re-select mid and the level would stick at 2. The
bedroom script is `brightness: 77` — the raw 0–255 scale, not a percentage — and
the living room averages ~142 across its group, so both sit well clear of either
boundary.

Warm versus cool is decided at **3000 K**, taken from the `warm_cool_toggle`
scripts themselves (`2202` warm, `3600` cool). The living room splits its LED
controller onto 2000/6500, but the group mean still lands either side of 3000, so
one threshold covers both rooms.

Presses render their expected outcome immediately and yield as soon as real state
arrives — a Zigbee group command takes a few hundred ms and the button would
otherwise look dead. Predictions are stored as levels, not brightness values,
because `_mid` resolves differently per room.

## Weather icons

`weather-icons.svg` is the source of truth. Each `<symbol>` is authored in a
`0 0 60 60` box; its contents are copied verbatim into the `SHAPES` table in
`icons.js`. The large card icon scales the same geometry by 200/60, so the two
sizes cannot drift apart.

To update: replace the sprite, re-extract into `SHAPES`, then check every
condition at `/icons.html`.

All 15 Home Assistant conditions are covered. Two things to know:

- **`windy-variant` has no artwork** and borrows the `windy` mark via `FALLBACK`.
  It is flagged in `icons.html`. If a sprite ever supplies it, delete the
  fallback entry.
- **Night forms come from the source, not from us.** MeteoSwiss encodes night by
  adding 100 to its icon id, so every hour of the forecast already says which
  form it means and the dashboard subscribes to no sun entity. `SYMBOL_CONDITIONS`
  in `data.js` maps the ids onto Home Assistant's condition vocabulary, which is
  what `icons.js` keys off.

## Design constraints

Recreated from a high-fidelity design handoff. The full original spec is no
longer checked out, but remains in git history:

```bash
git log --diff-filter=D --name-only -- docs/design-spec.md
git show <commit>^:docs/design-spec.md
```

- **1280 × 720, fixed.** No breakpoints, no scrolling, everything on one screen.
  If it must run on another panel, add a `transform: scale()` on `.root` rather
  than reworking the grid.
- Viewed from several feet away: large type, generous hit targets.
- Touch device, so **no hover states**. Animations, if any, stay ≤150 ms and
  non-decorative.
- **No shadows anywhere.** No images — every icon is inline SVG built from
  circles, rounded rects and straight strokes.
- Colours, sizes and spacing live as custom properties at the top of
  `dashboard.css`. Take values from there rather than hardcoding.

## Testing

It is a browser app, so verify changes in the browser rather than assuming.
Start the preview with the `dashboard` config in `.claude/launch.json`, then
check the console, read back computed styles, and screenshot visual changes.

For anything touching Home Assistant, run against a mock WebSocket server rather
than the real instance:

1. Copy the app to a scratchpad directory, excluding `js/config.js`
2. Write a config there pointing at `http://localhost:8123`
3. Run a mock server that speaks the HA WebSocket protocol — `auth_required` →
   `auth` → `auth_ok`, then `subscribe_entities` with an `a` snapshot and `c`
   deltas
4. Serve the copy on a different port and drive it

Worth reproducing in the mock: Zigbee latency on script calls (~400 ms), and the
weather sensor's attributes, which are where every weather value now lives —
`mockha.py` in the demo folder serves a real captured response.
