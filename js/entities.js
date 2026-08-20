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
          mid:    'script.living_room_mid',
          dim:    'script.living_room_dim',
          temp:   'script.living_room_warm_cool_toggle'
        }
      },
      bedroom: {
        entity: 'light.dresden_elektronik_conbee_ii_bedroom',
        scripts: {
          toggle: 'script.bedroom_toggle',
          bright: 'script.bedroom_bright',
          mid:    'script.bedroom_mid',
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

    /* One REST sensor holds MeteoSwiss's whole response for postcode
       8053 — current conditions, nine daily entries, and the hourly
       series behind the forecast chart — in its attributes. Home
       Assistant fetches it because the feed sends no CORS headers,
       so the page cannot. See "Weather" in README.md.

       No sun entity: MeteoSwiss encodes night by adding 100 to its
       icon ids, so the source already says which form it means. */
    meteoswiss: 'sensor.meteoswiss_8053'
  };

  /* Brightness -> level mapping.

     These boundaries are lifted from the Hue dimmer blueprint so the
     wall dashboard and the physical remote agree on what "low",
     "medium" and "high" mean: UP selects mid below 40 and bright
     otherwise, DOWN selects mid above 200 and dim otherwise. Which
     brightness mid actually lands on is a property of the scripts,
     and differs per room — see SCRIPT_LEVEL below. */
  global.BRIGHTNESS_LEVELS = {
    lowMax: 40,   // brightness < 40  -> level 1
    medMax: 200   // brightness < 200 -> level 2, else level 3
  };

  /* Both warm_cool_toggle scripts branch on
       color_temp_kelvin > 3000 ? 2202 : 3600
     so 3000 K is the dividing line between warm and cool. The
     living room splits its LED controller onto 2000/6500, but
     averaged across the group that still lands either side of
     3000, so one threshold covers both rooms. */
  global.WARM_BELOW_KELVIN = 3000;

  /* Which level each brightness script lands on, so a press can
     render its outcome before the light reports back.

     Deliberately levels rather than brightness values, because the
     scripts do not agree on a number across rooms:
       dim     5%                     -> 13         both rooms
       mid     raw 77, not a percent  -> 77         bedroom
       mid     50% no-LED + 77% LED   -> ~142 mean  living room
       bright  100%                   -> 255        both rooms
     The levels are identical even though the values are not.

     Constraint worth knowing if these scripts are ever retuned: mid
     must land strictly between lowMax and medMax. If it crept to
     >= 200, pressing DIMMER from mid would re-select mid and the
     level would stick at 2. */
  global.SCRIPT_LEVEL = {
    dim:    1,
    mid:    2,
    bright: 3
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
    var ids = [e.meteoswiss];
    Object.keys(e.lights).forEach(function (k) { ids.push(e.lights[k].entity); });
    e.departures.forEach(function (id) { ids.push(id); });
    Object.keys(e.waste).forEach(function (k) {
      ids.push(e.waste[k].days, e.waste[k].warn);
    });
    return ids;
  })();
})(window);
