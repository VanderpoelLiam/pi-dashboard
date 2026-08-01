/* ─────────────────────────────────────────────────────────
   data.js — the seam between the UI and Home Assistant.

   Every getter returns live HA data when the socket is up and
   falls back to mock data otherwise, so the page still renders
   something sane before the first snapshot arrives (and while
   developing without a token).
   ───────────────────────────────────────────────────────── */
(function (global) {
  'use strict';

  var UNKNOWN = ['unknown', 'unavailable', 'none', 'None', null, ''];

  function isUnknown(v) { return v == null || UNKNOWN.indexOf(v) !== -1; }

  function live() {
    return !!(global.HA && global.HA.isConnected());
  }

  function inMinutes(m) { return new Date(Date.now() + m * 60000); }

  /* Mock data is opt-in via ?demo=1, for working on the design
     without a Home Assistant connection. It is never shown by
     accident: a dashboard that invents plausible bus times when
     it cannot reach HA is worse than one that visibly has none. */
  var DEMO = /[?&]demo=1\b/.test(global.location.search);

  /* ── Mock fallbacks (demo mode only) ────────────────── */
  var mock = {
    lights: {
      living:  { on: true, level: 3, warm: true },
      bedroom: { on: true, level: 2, warm: false }
    },
    departures: [inMinutes(8), inMinutes(17), inMinutes(30)],
    wasteChips: [
      { key: 'paper',     label: 'Paper',     days: 0 },
      { key: 'cardboard', label: 'Cardboard', days: 1 }
    ],
    weather: {
      condition: 'partlycloudy',
      conditionLabel: 'Partly cloudy',
      temperature: 19,
      low: 14,
      high: 23
    },
    forecast: [
      { hour: 21, temp: 18, condition: 'partlycloudy' },
      { hour: 22, temp: 17, condition: 'cloudy' },
      { hour: 23, temp: 16, condition: 'cloudy' },
      { hour: 0,  temp: 15, condition: 'cloudy' },
      { hour: 1,  temp: 15, condition: 'cloudy' },
      { hour: 2,  temp: 14, condition: 'rainy' },
      { hour: 3,  temp: 14, condition: 'rainy' },
      { hour: 4,  temp: 15, condition: 'partlycloudy' }
    ]
  };

  /* Last values actually read from HA. Once real data has been
     seen we never fall back to mock again — showing invented bus
     times on a wall display is worse than showing stale ones, and
     the connection chip already flags that the link is down. */
  var lastLive = {};

  function cached(key, read, demoValue) {
    if (live()) {
      var value = read();
      lastLive[key] = value;
      return value;
    }
    if (key in lastLive) return lastLive[key];   // stale, but real
    return DEMO ? demoValue : null;              // nothing real ever seen
  }

  /* ── Optimistic light updates ───────────────────────────
     A Zigbee group command takes a few hundred ms to come back
     round over the socket. Without this the button looks dead
     on a touch panel, so a press renders its expected outcome
     immediately and yields as soon as the real state lands. */
  var OPTIMISTIC_MS = 4000;
  var optimistic = {};

  /* Default to cool when nothing is known, matching the scripts'
     own `| default(3600)`. */
  var lastWarm = { living: false, bedroom: false };

  function fingerprint(cfg) {
    var st = HA.get(cfg.entity);
    if (!st) return 'none';
    return st.state + '|' + st.attributes.brightness + '|' + st.attributes.color_temp_kelvin;
  }

  function predict(room, view) {
    optimistic[room] = {
      view: view,
      seen: fingerprint(ENTITIES.lights[room]),
      until: Date.now() + OPTIMISTIC_MS
    };
    Data.onChange();
  }

  function optimisticView(room, cfg) {
    var p = optimistic[room];
    if (!p) return null;
    // Stop guessing once the real state moves, or the wait runs out.
    if (Date.now() > p.until || fingerprint(cfg) !== p.seen) {
      delete optimistic[room];
      return null;
    }
    return p.view;
  }

  function mockAction(room, mutate) {
    mutate(mock.lights[room]);
    Data.onChange();
  }

  var WARM_BELOW_KELVIN = global.WARM_BELOW_KELVIN;
  var BLUEPRINT_LOW  = global.BRIGHTNESS_LEVELS.lowMax;
  var BLUEPRINT_HIGH = global.BRIGHTNESS_LEVELS.medMax;
  var BLUEPRINT_MID  = global.BRIGHTNESS_LEVELS.mid;

  var Data = {

    get isLive() { return live(); },

    /* ── Departures ───────────────────────────────────────
       Read straight off the timestamp sensors rather than the
       bus_N_time / bus_N_countdown template sensors, so the
       countdown can tick every second instead of once a minute
       when HA re-evaluates now(). Returns three slots; a slot is
       null when HA has nothing useful for it. */
    getDepartures: function () {
      return cached('departures', function () {
        return ENTITIES.departures.map(function (id) {
          var s = HA.stateOf(id);
          if (isUnknown(s)) return null;
          var d = new Date(s);
          return isNaN(d.getTime()) ? null : d;
        });
      }, mock.departures) || [null, null, null];
    },

    /* ── Waste chips ──────────────────────────────────────
       Visibility is gated on the binary sensors, which already
       encode the "within a day" rule; the day count only drives
       the wording. Returns just the chips that should be shown,
       in display order. */
    getWasteChips: function () {
      return cached('wasteChips', function () {
        var out = [];
        ['paper', 'cardboard'].forEach(function (key) {
          var cfg = ENTITIES.waste[key];
          if (HA.stateOf(cfg.warn) !== 'on') return;

          var raw = HA.stateOf(cfg.days);
          if (isUnknown(raw)) return;
          var days = parseInt(raw, 10);
          if (isNaN(days)) return;

          out.push({ key: key, label: cfg.label, days: days });
        });
        return out;
      }, mock.wasteChips) || [];
    },

    /* ── Lights ───────────────────────────────────────────
       Both entities are light *groups*, so `brightness` is the
       mean across whichever members are on. The three-bar glyph
       therefore reflects the group average, which is what we
       want: the scripts always drive every member together. */
    getLight: function (room) {
      var cfg = ENTITIES.lights[room];

      var pending = optimisticView(room, cfg);
      if (pending) return pending;

      return cached('light.' + room, function () {
        var st = HA.get(cfg.entity);
        if (!st) return null;

        var on = st.state === 'on';
        var kelvin = st.attributes.color_temp_kelvin;
        var warm = isUnknown(kelvin) ? lastWarm[room] : kelvin <= WARM_BELOW_KELVIN;

        // While off, colour temp reads null; keep showing the last
        // known setting rather than flipping the label arbitrarily.
        if (!isUnknown(kelvin)) lastWarm[room] = warm;

        return {
          on: on,
          level: brightnessToLevel(st.attributes.brightness),
          warm: warm
        };
      }, mock.lights[room]) || { on: false, level: 1, warm: lastWarm[room] };
    },

    /* ── Weather ──────────────────────────────────────────
       Still mock — Steps 6-8. */
    getWeather: function () { return mock.weather; },
    getForecast: function () { return mock.forecast; },

    /* ── Actions ────────────────────────────────────────── */
    toggleLight: function (room) {
      if (!live()) return mockAction(room, function (l) { l.on = !l.on; });

      var cur = Data.getLight(room);
      HA.runScript(ENTITIES.lights[room].scripts.toggle);
      predict(room, { on: !cur.on, level: cur.level, warm: cur.warm });
    },

    /* Mirrors the Hue dimmer blueprint rather than calling
       bright/dim straight through, because those scripts jump to
       an absolute brightness (bright is brightness_pct: 100), so
       calling them alone would skip the middle level entirely.
       Reproducing the blueprint's branch points keeps the wall
       panel and the physical remote in step with each other. */
    stepBrightness: function (room, delta) {
      if (!live()) {
        return mockAction(room, function (l) {
          l.level = Math.max(1, Math.min(3, l.level + delta));
          l.on = true;
        });
      }

      var cfg = ENTITIES.lights[room];
      var raw = HA.attr(cfg.entity, 'brightness');
      var up = delta > 0;

      // The blueprint defaults differ by direction: brightness|int(0)
      // going up, brightness|int(255) going down. With the light off
      // that lands both on the mid step, which is deliberate.
      var b = isUnknown(raw) ? (up ? 0 : 255) : Number(raw);
      var toMid = up ? b < BLUEPRINT_LOW : b > BLUEPRINT_HIGH;

      if (toMid) {
        // TODO: this reaches past the scripts and drives the light
        // directly, which breaks the "all light control goes through
        // HA scripts" rule the rest of this file follows. It only
        // exists because the stepping logic lives in the dimmer
        // blueprint rather than in a script. Cleaner fix: add a
        // script.<room>_mid (or make bright/dim step relatively) and
        // call that instead, then delete this branch.
        HA.callService('light', 'turn_on', {
          entity_id: cfg.entity,
          brightness: BLUEPRINT_MID
        });
        predict(room, { on: true, level: brightnessToLevel(BLUEPRINT_MID),
                        warm: Data.getLight(room).warm });
        return;
      }

      HA.runScript(up ? cfg.scripts.bright : cfg.scripts.dim);
      if (up) {
        // bright is brightness_pct: 100, so the outcome is known.
        predict(room, { on: true, level: 3, warm: Data.getLight(room).warm });
      }
      // dim's target value is not known here, so nothing is predicted;
      // the real state lands over the socket a moment later.
    },

    toggleColorTemp: function (room) {
      if (!live()) return mockAction(room, function (l) { l.warm = !l.warm; });

      var cur = Data.getLight(room);
      HA.runScript(ENTITIES.lights[room].scripts.temp);
      lastWarm[room] = !cur.warm;
      predict(room, { on: cur.on, level: cur.level, warm: !cur.warm });
    },

    onChange: function () {}
  };

  global.Data = Data;
})(window);
