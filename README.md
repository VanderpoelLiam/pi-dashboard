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

Open <http://localhost:8099>. Without a `js/config.js` you will get a `NO CONFIG`
chip and empty cards; add `?demo=1` to the URL to render mock data instead.

## Deploying to the Pi

Three steps to a working URL on the Pi. What you point at that URL — Chromium
kiosk, autostart, screen blanking — is up to you.

### 1. Copy the files over

From your machine:

```bash
rsync -av --delete --exclude '.git' --exclude 'js/config.js' ~/Documents/pi-dashboard/ pi@raspberrypi.local:~/pi-dashboard/
```

`js/config.js` is excluded on purpose: the Pi keeps its own copy, so redeploying
is a single rsync that can never overwrite the token.

### 2. Add the token, once

On the Pi:

```bash
cp ~/pi-dashboard/js/config.example.js ~/pi-dashboard/js/config.js
```

Then edit it:

```js
window.HA_CONFIG = {
  url: 'https://ha.internal.vanderpoel.ch',
  token: '<long-lived access token>'
};
```

Generate the token in Home Assistant under **profile → Security → Long-lived
access tokens**. It is only shown once.

The HA hostname resolves over Tailscale, so Tailscale needs to be up before the
dashboard can connect.

### 3. Serve it

Create `~/.config/systemd/user/pi-dashboard.service`:

```ini
[Unit]
Description=Wall dashboard static server
After=network.target

[Service]
ExecStart=/usr/bin/python3 -m http.server 8099 --directory %h/pi-dashboard
Restart=always

[Install]
WantedBy=default.target
```

Start it, and let it run without a login session:

```bash
systemctl --user enable --now pi-dashboard.service
```

```bash
sudo loginctl enable-linger $USER
```

The dashboard is now at `http://localhost:8099` on the Pi.

Serving over HTTP rather than opening the files directly avoids origin
awkwardness with the WebSocket and keeps browser caching predictable.

### Redeploying

Repeat step 1. The server picks up new files immediately; restart the browser to
drop cached JS and CSS.

## What you will see when something is wrong

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
weather-icons.svg   the designer's icon sprite — source of truth
js/
  config.js         HA URL + token (gitignored, never committed)
  entities.js       every HA entity id, and the brightness/kelvin thresholds
  ha.js             WebSocket client: auth, subscriptions, reconnect, keepalive
  data.js           the seam between Home Assistant and the UI
  app.js            rendering and input
  icons.js          all inline SVG
css/                styles and self-hosted font faces
docs/design-spec.md the original design handoff
```

Everything that depends on your Home Assistant setup lives in
[`js/entities.js`](js/entities.js) — entity ids, the brightness boundaries the
three-bar glyph uses, and the 3000 K warm/cool threshold. If something gets
renamed in HA, that is the only file to touch.

## Notes

- **The layout does not scale.** 1280 × 720 with no breakpoints. On a different
  panel it will crop or letterbox; the cheap fix is a `transform: scale()` on
  `.root`.
- **Lights are driven through HA scripts**, never `light.turn_on`. Which script a
  press calls depends on current brightness, mirroring the Hue dimmer blueprint
  so the wall panel and the physical remote step through the same three levels.
- **Forecasts are polled**, not pushed — they are not entity state, so they come
  from `weather.get_forecasts` every 15 minutes and on every reconnect.
- **`windy-variant` has no artwork** and borrows the `windy` mark. See
  [`docs/weather-icons-brief.md`](docs/weather-icons-brief.md).
- **To update the weather icons**, replace `weather-icons.svg` and copy each
  `<symbol>`'s contents into the `SHAPES` table in `js/icons.js`. Check the
  result at `/icons.html`.
