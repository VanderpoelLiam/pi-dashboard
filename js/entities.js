/* ─────────────────────────────────────────────────────────
   entities.js — the single place where design slots are
   mapped onto real Home Assistant entity IDs. If something
   gets renamed in HA, this is the only file to touch.
   ───────────────────────────────────────────────────────── */
(function (global) {
  'use strict';

  global.ENTITIES = {

    /* Lights are read from the light entity but *driven* through
       scripts — the scripts own the actual brightness and kelvin
       values, so the dashboard never calls light.turn_on itself. */
    lights: {
      living: {
        entity: 'light.dresden_elektronik_conbee_ii_living_room',
        scripts: {
          toggle: 'script.living_room_toggle',
          bright: 'script.living_room_bright',
          dim:    'script.living_room_dim',
          temp:   'script.living_room_warm_cool_toggle'
        }
      },
      bedroom: {
        entity: 'light.dresden_elektronik_conbee_ii_bedroom',
        scripts: {
          toggle: 'script.bedroom_toggle',
          bright: 'script.bedroom_bright',
          dim:    'script.bedroom_dim',
          temp:   'script.bedroom_warm_cool_toggle'
        }
      }
    },

    /* Raw timestamp sensors, not the bus_N_time/countdown template
       sensors. The raw values are ISO timestamps, which lets the UI
       render both the clock time and a countdown that ticks every
       second rather than once a minute. */
    departures: [
      'sensor.zurich_waserstrasse_zurich_hb_departure',
      'sensor.zurich_waserstrasse_zurich_hb_departure_1',
      'sensor.zurich_waserstrasse_zurich_hb_departure_2'
    ],

    /* Visibility is gated on the binary sensors (which already
       encode the <= 1 day rule); the day count drives the copy. */
    waste: {
      paper: {
        label: 'Paper',
        days: 'sensor.papier_days_until_pickup',
        warn: 'binary_sensor.papier_pickup_warning'
      },
      cardboard: {
        label: 'Cardboard',
        days: 'sensor.karton_days_until_pickup',
        warn: 'binary_sensor.karton_pickup_warning'
      }
    },

    weather: 'weather.meteoswiss_at_8053_sma_weather_at_8053',

    // Drives the day/night weather icon variants.
    sun: 'sun.sun'
  };

  /* Brightness -> level mapping.

     These boundaries are lifted from the Hue dimmer blueprint so the
     wall dashboard and the physical remote agree on what "low",
     "medium" and "high" mean: the remote branches on b < 40 and
     b < 200, and parks at 77 when jumping into the middle band. */
  global.BRIGHTNESS_LEVELS = {
    lowMax: 40,   // brightness < 40  -> level 1
    medMax: 200   // brightness < 200 -> level 2, else level 3
  };

  global.brightnessToLevel = function (brightness) {
    var b = Number(brightness) || 0;
    if (b < global.BRIGHTNESS_LEVELS.lowMax) return 1;
    if (b < global.BRIGHTNESS_LEVELS.medMax) return 2;
    return 3;
  };

  /* Every entity the dashboard subscribes to. */
  global.ALL_ENTITY_IDS = (function () {
    var e = global.ENTITIES;
    var ids = [e.weather, e.sun];
    Object.keys(e.lights).forEach(function (k) { ids.push(e.lights[k].entity); });
    e.departures.forEach(function (id) { ids.push(id); });
    Object.keys(e.waste).forEach(function (k) {
      ids.push(e.waste[k].days, e.waste[k].warn);
    });
    return ids;
  })();
})(window);
