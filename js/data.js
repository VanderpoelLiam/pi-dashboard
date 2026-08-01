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

  /* ── Mock fallbacks ─────────────────────────────────── */
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

  function cached(key, read) {
    if (live()) {
      var value = read();
      lastLive[key] = value;
      return value;
    }
    return key in lastLive ? lastLive[key] : null;
  }

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
      }) || mock.departures;
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
      }) || mock.wasteChips;
    },

    /* ── Lights ───────────────────────────────────────────
       Still mock — Step 3. */
    getLight: function (room) { return mock.lights[room]; },

    /* ── Weather ──────────────────────────────────────────
       Still mock — Steps 6-8. */
    getWeather: function () { return mock.weather; },
    getForecast: function () { return mock.forecast; },

    /* ── Actions (mock until Step 3) ──────────────────── */
    toggleLight: function (room) {
      mock.lights[room].on = !mock.lights[room].on;
      Data.onChange();
    },
    stepBrightness: function (room, delta) {
      var l = mock.lights[room];
      l.level = Math.max(1, Math.min(3, l.level + delta));
      l.on = true;
      Data.onChange();
    },
    toggleColorTemp: function (room) {
      mock.lights[room].warm = !mock.lights[room].warm;
      Data.onChange();
    },

    onChange: function () {}
  };

  global.Data = Data;
})(window);
