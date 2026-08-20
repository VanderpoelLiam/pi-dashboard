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

  /* ── MeteoSwiss ─────────────────────────────────────────
     The sensor's attributes carry MeteoSwiss's whole response, so
     the forecast now arrives over the subscription like every other
     value — no service call, no polling timer.

     Ids are MeteoSwiss's own, mapped onto the condition names
     icons.js keys off. Adding 100 is the source's night form, which
     is why no sun entity is needed. */
  var SYMBOL_CONDITIONS = {
    'clear-night':     [101],
    'cloudy':          [5, 35, 105, 126, 135],
    'fog':             [27, 28, 127, 128],
    'lightning':       [12, 36, 40, 41, 112, 136, 140, 141],
    'lightning-rainy': [13, 23, 24, 25, 32, 38, 113, 123, 124, 125, 138],
    'partlycloudy':    [2, 3, 4, 102, 103, 104],
    'pouring':         [20, 120],
    'rainy':           [6, 9, 14, 17, 29, 33, 106, 109, 114, 117, 129, 132, 133],
    'snowy':           [8, 11, 16, 19, 22, 30, 34, 37, 42, 108, 111, 116, 119, 122, 130, 134, 137, 142],
    'snowy-rainy':     [7, 10, 15, 18, 21, 31, 39, 107, 110, 115, 118, 121, 131, 139],
    'sunny':           [1, 26]
  };

  var SYMBOL_CONDITION = (function () {
    var map = {};
    Object.keys(SYMBOL_CONDITIONS).forEach(function (condition) {
      SYMBOL_CONDITIONS[condition].forEach(function (id) { map[id] = condition; });
    });
    return map;
  })();

  function symbolOf(id) {
    return { condition: SYMBOL_CONDITION[id] || 'cloudy', night: id >= 100 };
  }

  /* Temperature is hourly across the whole nine days. Precipitation
     arrives in two pieces: roughly the first 27 hours as 10-minute
     slots — a nowcast, refreshed faster than the rest of the feed —
     and the remainder hourly. Six slots fold into an hour by mean,
     which is how MeteoSwiss draws them on their own chart.

     Reparsing 192 hours on every render would be careless on a Pi,
     so the result is memoised against the graph object itself:
     ha.js swaps the whole array in when a new value lands, so its
     identity is a dependable cache key. */
  var parsed = { from: null, series: null };

  function fold(list, hour) {
    var sum = 0, n = 0;
    for (var i = hour * 6; i < hour * 6 + 6 && i < list.length; i++) {
      if (typeof list[i] === 'number') { sum += list[i]; n++; }
    }
    return n ? sum / n : 0;
  }

  function series() {
    var st = HA.get(ENTITIES.meteoswiss);
    var g = st && st.attributes && st.attributes.graph;
    if (!g || !g.temperatureMean1h || !g.start) return null;
    if (parsed.from === g) return parsed.series;

    var mean = g.temperatureMean1h, min = g.temperatureMin1h || [], max = g.temperatureMax1h || [];
    var ten = g.precipitation10m || [], tenMin = g.precipitationMin10m || [], tenMax = g.precipitationMax10m || [];
    var hr = g.precipitation1h || [], hrMin = g.precipitationMin1h || [], hrMax = g.precipitationMax1h || [];

    var nowcastHours = Math.floor(ten.length / 6);
    var hourlyFrom   = mean.length - hr.length;   // where the hourly block picks up

    var hours = [];
    for (var h = 0; h < mean.length; h++) {
      if (typeof mean[h] !== 'number') continue;
      var rain, rainMin, rainMax;
      if (h < nowcastHours) {
        rain = fold(ten, h); rainMin = fold(tenMin, h); rainMax = fold(tenMax, h);
      } else {
        var i = h - hourlyFrom;
        rain = hr[i]; rainMin = hrMin[i]; rainMax = hrMax[i];
      }
      hours.push({
        t: g.start + h * 3600000,
        temp: mean[h], tempMin: min[h], tempMax: max[h],
        rain: rain || 0, rainMin: rainMin || 0, rainMax: rainMax || 0
      });
    }
    if (!hours.length) return null;

    /* One id per three hours. Kept as its own list rather than
       stamped onto each hour: the chart draws them on their own row,
       at their own spacing. */
    var symbols = (g.weatherIcon3h || []).map(function (id, k) {
      var sym = symbolOf(id);
      sym.t = g.start + k * 3 * 3600000;
      return sym;
    });

    var days = hours.filter(function (h) { return new Date(h.t).getHours() === 0; })
                    .map(function (h) { return { t: h.t }; });

    parsed = { from: g, series: { hours: hours, symbols: symbols, days: days } };
    return parsed.series;
  }

  /* Which 3-hourly symbol covers a given moment. */
  function symbolAt(list, t) {
    var found = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].t <= t) found = list[i]; else break;
    }
    return found || list[0] || { condition: 'cloudy', night: false };
  }

  var WARM_BELOW_KELVIN  = global.WARM_BELOW_KELVIN;
  var BLUEPRINT_LOW      = global.BRIGHTNESS_LEVELS.lowMax;
  var BLUEPRINT_HIGH     = global.BRIGHTNESS_LEVELS.medMax;
  var SCRIPT_LEVEL       = global.SCRIPT_LEVEL;

  var Data = {

    get isLive() { return live(); },

    /* ── Departures ───────────────────────────────────────
       Read straight off the timestamp sensors rather than the
       bus_N_time / bus_N_countdown template sensors, so the
       countdown can tick every second instead of once a minute
       when HA re-evaluates now(). Returns three slots; a slot is
       null when HA has nothing useful for it.

       Departures are the one getter that does not fall back to the
       last values seen. Every other card degrades honestly when the
       link drops — a stale temperature is still roughly the weather
       outside — but a stale departure keeps counting down as
       convincingly as a live one, and you act on it by walking out
       of the door. With no HA there is nothing true to say about the
       next bus, so the card says nothing: em-dashes, under the
       NO CONNECTION chip. */
    getDepartures: function () {
      if (!live()) return DEMO ? mock.departures : [null, null, null];

      return ENTITIES.departures.map(function (id) {
        var s = HA.stateOf(id);
        if (isUnknown(s)) return null;
        var d = new Date(s);
        return isNaN(d.getTime()) ? null : d;
      });
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
       All of it comes off the one sensor now: current conditions
       from currentWeather, today's high and low from the first
       daily entry. Night is the source's own, not ours — it encodes
       it in the icon id. */
    getWeather: function () {
      return cached('weather', function () {
        var st = HA.get(ENTITIES.meteoswiss);
        var a = st && st.attributes;
        var cur = a && a.currentWeather;
        if (!cur) return null;

        var sym = symbolOf(cur.icon);
        var today = a.forecast && a.forecast[0];
        return {
          condition: sym.condition,
          conditionLabel: Icons.conditionLabel(sym.condition),
          temperature: cur.temperature,
          low:  today && today.temperatureMin != null ? Math.round(today.temperatureMin) : null,
          high: today && today.temperatureMax != null ? Math.round(today.temperatureMax) : null,
          night: sym.night
        };
      }, mock.weather) || null;
    },

    /* Eight hours starting from the current one. The symbols run at
       three-hour spacing, so each hour takes the one covering it. */
    getForecast: function () {
      return cached('forecast', function () {
        var s = series();
        if (!s) return null;

        var from = Date.now() - 3600000;
        return s.hours.filter(function (h) { return h.t >= from; })
          .slice(0, 8)
          .map(function (h) {
            var sym = symbolAt(s.symbols, h.t);
            return {
              hour: new Date(h.t).getHours(),
              temp: Math.round(h.temp),
              condition: sym.condition,
              night: sym.night
            };
          });
      }, mock.forecast) || [];
    },

    /* ── Actions ────────────────────────────────────────── */
    toggleLight: function (room) {
      if (!live()) return mockAction(room, function (l) { l.on = !l.on; });

      var cur = Data.getLight(room);
      HA.runScript(ENTITIES.lights[room].scripts.toggle);
      predict(room, { on: !cur.on, level: cur.level, warm: cur.warm });
    },

    /* The bright/dim/mid scripts each jump to an absolute
       brightness, so which one to call depends on where the light
       currently sits. The branch points are the dimmer blueprint's
       (< 40 going up, > 200 going down), which is what keeps the
       wall panel stepping 1->2->3 in step with the physical remote. */
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

      // The blueprint's defaults differ by direction: brightness|int(0)
      // going up, brightness|int(255) going down. With the light off
      // that lands both on the middle step, which is deliberate.
      var b = isUnknown(raw) ? (up ? 0 : 255) : Number(raw);

      var step;
      if (up ? b < BLUEPRINT_LOW : b > BLUEPRINT_HIGH) step = 'mid';
      else step = up ? 'bright' : 'dim';

      HA.runScript(cfg.scripts[step]);
      predict(room, {
        on: true,
        level: SCRIPT_LEVEL[step],
        warm: Data.getLight(room).warm
      });
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
