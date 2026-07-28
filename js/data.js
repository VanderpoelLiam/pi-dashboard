/* ─────────────────────────────────────────────────────────
   data.js — the seam between the UI and Home Assistant.

   Step 0 serves mock data shaped exactly like what the HA
   layer will eventually produce. When the WebSocket client
   lands (Step 1), only this file is replaced; nothing in
   app.js needs to change.
   ───────────────────────────────────────────────────────── */
(function (global) {
  'use strict';

  function inMinutes(m) {
    return new Date(Date.now() + m * 60000);
  }

  // Mock defaults come straight from the design spec.
  var mock = {
    lights: {
      living:  { on: true, level: 3, warm: true },
      bedroom: { on: true, level: 2, warm: false }
    },

    // Day counts until collection, as the HA sensors report them.
    waste: {
      paper:     { label: 'Paper',     days: 0 },
      cardboard: { label: 'Cardboard', days: 1 }
    },

    // Absolute departure times; countdowns are derived in the UI
    // so they tick every second instead of once a minute.
    departures: [inMinutes(8), inMinutes(17), inMinutes(30)],

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

  /* The interface app.js codes against. Every method here becomes
     an HA read or an HA service call in later steps. */
  var Data = {
    isLive: false,

    getLight: function (room) { return mock.lights[room]; },
    getWaste: function () { return mock.waste; },
    getDepartures: function () { return mock.departures; },
    getWeather: function () { return mock.weather; },
    getForecast: function () { return mock.forecast; },

    /* Actions. In Step 3 these fire HA scripts and the resulting
       state arrives back over the WebSocket. For now they mutate
       local state directly and invoke the change callback. */
    toggleLight: function (room) {
      var l = mock.lights[room];
      l.on = !l.on;
      Data.onChange();
    },
    stepBrightness: function (room, delta) {
      var l = mock.lights[room];
      l.level = Math.max(1, Math.min(3, l.level + delta));
      l.on = true;                      // either button forces the light on
      Data.onChange();
    },
    toggleColorTemp: function (room) {
      mock.lights[room].warm = !mock.lights[room].warm;
      Data.onChange();
    },

    onChange: function () {}            // app.js installs its renderer here
  };

  global.Data = Data;
})(window);
