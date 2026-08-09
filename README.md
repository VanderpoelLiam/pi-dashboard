# Wall Dashboard

A Home Assistant wall dashboard for a Raspberry Pi touchscreen: clock, bin
reminders, the next three bus departures, weather with an 8-hour forecast, and
light controls for the living room and bedroom.

Fixed at **1280 × 720**, no scrolling. Plain HTML, CSS and JavaScript — no build
step, no framework, no dependencies. Fonts are self-hosted so it works with no
internet.

## Running it locally

```bash
python3 -m http.server 8099
```

Open <http://localhost:8099>. Without a `js/config.js` you get a `NO CONFIG` chip
and empty cards; append `?demo=1` to render mock data instead.

To connect it to a real instance, copy the template and fill in a token:

```bash
cp js/config.example.js js/config.js
```

```js
window.HA_CONFIG = {
  url: 'https://ha.internal.example.com',
  token: '<long-lived access token>'
};
```

Generate the token in Home Assistant under **profile → Security → Long-lived
access tokens**. `js/config.js` is gitignored and must never be committed.

## What you see when something is wrong

The dashboard never invents data. If it cannot reach Home Assistant it shows the
last real values it saw, with a chip in the bottom-left corner:

| Chip | Meaning |
|---|---|
| *(none)* | Connected |
| `NO CONNECTION` | Link dropped. Reconnecting with backoff; values are stale |
| `AUTH FAILED` | Token rejected. Not retrying, because that will not fix itself |
| `NO CONFIG` | `js/config.js` missing or still has the placeholder token |

## Layout

```
index.html          the dashboard
icons.html          every weather icon at both sizes, rendered from icons.js
weather-icons.svg   the icon sprite — source of truth for the artwork
js/
  config.js         HA URL + token (gitignored, never committed)
  entities.js       every HA entity id, and the brightness/kelvin thresholds
  ha.js             WebSocket client: auth, subscriptions, reconnect, keepalive
  data.js           the seam between Home Assistant and the UI
  app.js            rendering and input
  icons.js          all inline SVG
css/                styles and self-hosted font faces
CLAUDE.md           architecture and conventions, for working on this
```

Everything that depends on a particular Home Assistant setup lives in
[`js/entities.js`](js/entities.js) — entity ids, the brightness boundaries the
three-bar glyph uses, and the 3000 K warm/cool threshold. If something gets
renamed in HA, that is the only file to touch.

## Notes

- **The layout does not scale.** 1280 × 720 with no breakpoints. On a different
  panel it will crop or letterbox; the cheap fix is a `transform: scale()` on
  `.root`.
- **Lights are driven through HA scripts**, never `light.turn_on`. Which script a
  press calls depends on current brightness, mirroring a Hue dimmer blueprint so
  the wall panel and the physical remote step through the same three levels.
- **Forecasts are polled**, not pushed — they are not entity state, so they come
  from `weather.get_forecasts` every 15 minutes and on every reconnect.
- **`windy-variant` has no artwork** and borrows the `windy` mark.
- **To update the weather icons**, replace `weather-icons.svg` and copy each
  `<symbol>`'s contents into the `SHAPES` table in `js/icons.js`. Check the
  result at `/icons.html`.
