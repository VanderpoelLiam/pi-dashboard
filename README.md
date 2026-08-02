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

## Deploying with NixOS

The dashboard is served by Caddy from the Nix store on the server that already
runs Home Assistant. The Pi is then just a browser pointed at the resulting URL —
nothing is installed on it, and there is no token on it either.

Caddy serves the static files directly; there is no container, because there is
no application to run.

### 1. Add the repo as a flake input

In `flake.nix`:

```nix
pi-dashboard = {
  url = "github:VanderpoelLiam/pi-dashboard";
  flake = false;
};
```

The repo must be public, or the server needs a GitHub token — which would break
unattended `system.autoUpgrade`. Nothing secret lives here; the token is supplied
separately in step 3.

Make sure `inputs` reaches your modules through `specialArgs`.

### 2. Add the service module

`modules/services/dashboard.nix`:

```nix
{ config, lib, pkgs, inputs, userConfig, ... }:
let
  service = "dashboard";
  cfg = config.services.${service};
  tpl = config.sops.templates."dashboard-config.js";

  site = pkgs.runCommand "pi-dashboard" { } ''
    mkdir -p $out
    cp -r ${inputs.pi-dashboard}/{index.html,icons.html,css,js,fonts} $out/
  '';
in
{
  options.services.${service} = {
    enable = lib.mkEnableOption "Wall dashboard";
    url = lib.mkOption {
      type = lib.types.str;
      default = "${service}.internal.${userConfig.global.baseDomain}";
    };
    homeAssistantUrl = lib.mkOption {
      type = lib.types.str;
      default = "https://ha.internal.${userConfig.global.baseDomain}";
    };
  };

  config = lib.mkIf cfg.enable {
    sops.secrets.ha_dashboard_token = { };

    # js/config.js is gitignored, so it is rendered at runtime from
    # sops rather than ever existing in the repo.
    sops.templates."dashboard-config.js" = {
      content = ''
        window.HA_CONFIG = {
          url: '${cfg.homeAssistantUrl}',
          token: '${config.sops.placeholder.ha_dashboard_token}'
        };
      '';
      owner = config.services.caddy.user;
    };

    services.caddy.virtualHosts."${cfg.url}" = {
      useACMEHost = userConfig.global.baseDomain;
      extraConfig = ''
        handle /js/config.js {
          root * ${builtins.dirOf tpl.path}
          rewrite * /${builtins.baseNameOf tpl.path}
          file_server
        }
        handle {
          root * ${site}
          file_server
        }
      '';
    };
  };
}
```

Register it in `modules/services/default.nix`:

```nix
imports = [ ./caddy.nix ./tailscale.nix ./dashboard.nix ];
```

### 3. Add the token to sops

Create a long-lived access token in Home Assistant, then add it to the host's
secrets file under the key `ha_dashboard_token`:

```bash
sops modules/nixos/hyperion/secrets.yaml
```

```yaml
ha_dashboard_token: <long-lived access token>
```

The module renders it into `js/config.js` at activation and Caddy serves that one
path from the rendered file. The token never enters this repo or the Nix store.

### 4. Enable it on the host

In `modules/nixos/hyperion/default.nix`:

```nix
services.dashboard.enable = true;
```

Then rebuild:

```bash
sudo nixos-rebuild switch --flake .#hyperion
```

The dashboard is now at `https://dashboard.internal.vanderpoel.ch`.

### 5. Point the Pi at it

Launch Chromium in kiosk mode against that URL. Nothing else is needed on the Pi.

### Updating

Bump the input and rebuild:

```bash
nix flake update pi-dashboard
```

Since the token is delivered to the browser, anyone who can load the dashboard
URL can read it. It grants full Home Assistant API access and does not expire.

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
