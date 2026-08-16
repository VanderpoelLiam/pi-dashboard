/* ─────────────────────────────────────────────────────────
   app.js — state -> render. Nothing here talks to Home
   Assistant directly; it reads and acts through Data.
   ───────────────────────────────────────────────────────── */
(function (global) {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];

  var ui = { forecastOpen: false };

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function hhmm(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function isUnknown(v) { return v === null || v === undefined || v === ''; }

  /* ── Clock ──────────────────────────────────────────── */
  function renderClock(now) {
    $('clock-time').textContent = hhmm(now);
    $('clock-date').textContent =
      DAYS[now.getDay()] + ', ' + now.getDate() + ' ' + MONTHS[now.getMonth()];

    var fraction = (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400;
    var pct = (fraction * 100).toFixed(2) + '%';
    $('dayrule-fill').style.width = pct;
    $('dayrule-tick').style.left = pct;
  }

  /* ── Bin chips ──────────────────────────────────────────
     Data decides which chips are due; this only renders them.
     Paper reads as the filled chip, cardboard as the outlined one. */
  var CHIP_STYLE = { paper: 'chip chip-filled', cardboard: 'chip chip-outline' };

  function relativeDay(days) {
    if (days <= 0) return 'today';
    if (days === 1) return 'tomorrow';
    return 'in ' + days + ' days';
  }

  function renderBins() {
    $('bin-chips').innerHTML = Data.getWasteChips().map(function (chip) {
      return '<div class="' + (CHIP_STYLE[chip.key] || 'chip chip-outline') + '">' +
             '<div class="chip-swatch"></div>' +
             chip.label + ' ' + relativeDay(chip.days) + '</div>';
    }).join('');
  }

  /* ── Departures ─────────────────────────────────────────
     The countdown counts whole clock minutes between now and the
     departure, not elapsed time rounded to minutes. Rounding put
     it half a minute out of phase with the clock: it stepped down
     at :30 and then sat still across the minute change, which on
     a wall panel reads as a frozen card. */
  function minuteOf(d) { return Math.floor(d.getTime() / 60000); }

  function countdownText(target, now) {
    var mins = minuteOf(target) - minuteOf(now);
    return mins <= 0 ? 'now' : 'in ' + mins + ' min';
  }

  /* The comb is the wait made visible: it loses dashes off its right
     end as the bus closes in, and is gone entirely for the minute the
     bus is leaving in.

     Each dash is a fixed half minute, so the comb reads as a quantity
     of time rather than a proportion — six dashes always means three
     minutes, whatever the timetable is doing. Anything beyond the cap
     shows as a full comb: past a quarter of an hour the exact wait
     stops mattering, and the clock time next to it is the better
     answer anyway. The cost is that a comb sitting full and still is
     ambiguous between fifteen minutes and forty, which is the trade
     an absolute scale makes.

     A one-dash notch six dashes in marks the walk to the stop. The
     mark is fixed at that minute and the comb's right end travels
     towards it: while the end is right of the mark the bus is
     catchable, and when it passes to the left it is not. Nothing
     else on the card changes at that point — the comb carries it. */
  var COMB_DASH_MS = 30 * 1000;
  var COMB_CAP_MS = 15 * 60 * 1000;
  var COMB_WALK_MS = 3 * 60 * 1000;
  var COMB_PITCH_PX = 9;
  var COMB_WALK_DASHES = COMB_WALK_MS / COMB_DASH_MS;

  function renderComb(next, now) {
    var walk = $('dep-comb-walk');
    var rest = $('dep-comb-rest');
    if (!walk || !rest) return;

    /* Time left runs to the *start* of the departure's minute, not to
       its timestamp, so the last dash goes out on the same tick the
       countdown flips to "now" and the comb stays empty for the whole
       of that minute. Measuring to the timestamp left a dash burning
       for up to a minute after the card said the bus was here. */
    var left = next ? minuteOf(next) * 60000 - now.getTime() : 0;
    var capped = Math.max(0, Math.min(COMB_CAP_MS, left));

    /* Round up, so a bus still on its way keeps a last dash rather
       than showing the same bare card as one that has gone. */
    var dashes = Math.ceil(capped / COMB_DASH_MS);

    walk.style.width = (Math.min(dashes, COMB_WALK_DASHES) * COMB_PITCH_PX) + 'px';
    rest.style.width = (Math.max(0, dashes - COMB_WALK_DASHES) * COMB_PITCH_PX) + 'px';
  }

  /* A departure stays on the card for the whole minute it leaves in
     — 18:38 reads "now" from 18:38:00 to 18:38:59 — and drops off
     when the clock ticks over, shifting the later buses up. Same
     whole-clock-minute test as the countdown, so the card can never
     show "now" against a minute the clock has already left behind.

     HA keeps publishing a departure for a while after it has gone,
     so this is what decides which bus is next, not the sensor order.
     While the link is down the stale list ages out and the card ends
     up on em-dashes, which is the honest reading: we do not know
     when the next bus is. */
  function isUpcoming(d, now) {
    return !!d && minuteOf(d) >= minuteOf(now);
  }

  function renderDepartures(now) {
    var deps = Data.getDepartures().filter(function (d) {
      return isUpcoming(d, now);
    });

    for (var i = 0; i < 3; i++) {
      var d = deps[i];
      var n = i + 1;
      $('dep' + n + '-time').textContent = d ? hhmm(d) : '—';
      $('dep' + n + '-countdown').textContent = d ? countdownText(d, now) : '—';
    }

    renderComb(deps[0], now);
  }

  /* ── Lights ─────────────────────────────────────────── */
  function renderLight(room) {
    var card = document.querySelector('.light-card[data-room="' + room + '"]');
    var l = Data.getLight(room);

    card.classList.toggle('is-off', !l.on);
    card.querySelector('[data-glyph]').innerHTML = Icons.levelGlyph(l.on, l.level);

    var disc = card.querySelector('[data-temp-disc]');
    disc.style.background = l.on ? (l.warm ? '#e08a3c' : '#9ab6cc') : '#c3b8a6';
    card.querySelector('[data-temp-label]').textContent = l.warm ? 'WARM' : 'COOL';
  }

  function renderLights() {
    renderLight('living');
    renderLight('bedroom');
  }

  /* ── Weather ────────────────────────────────────────── */
  function renderWeather() {
    var w = Data.getWeather();
    if (!w) {
      $('weather-range').innerHTML = 'L. —° &nbsp; H. —°';
      $('weather-condition').textContent = '';
      $('weather-temp').textContent = '—';
      $('weather-icon').innerHTML = '';
      return;
    }

    // High/low come from the daily forecast, which lands a moment
    // after the entity state does.
    var lo = w.low === null || w.low === undefined ? '—' : w.low;
    var hi = w.high === null || w.high === undefined ? '—' : w.high;

    $('weather-range').innerHTML = 'L. ' + lo + '° &nbsp; H. ' + hi + '°';
    $('weather-condition').textContent = w.conditionLabel;
    $('weather-temp').textContent = isUnknown(w.temperature) ? '—' : Math.round(w.temperature);
    $('weather-icon').innerHTML = Icons.weatherLarge(w.condition, w.night);
  }

  function renderForecast(now) {
    var rows = Data.getForecast();
    var w = Data.getWeather() || {};
    now = now || new Date();

    var lo = isUnknown(w.low) ? '—' : w.low;
    var hi = isUnknown(w.high) ? '—' : w.high;
    $('forecast-sub').textContent =
      (DAYS[now.getDay()] + ' ' + now.getDate() + ' ' + MONTHS[now.getMonth()]).toUpperCase() +
      ' · L. ' + lo + '° H. ' + hi + '°';

    if (!rows.length) {
      $('forecast-chart').innerHTML =
        '<div class="fc-empty">NO FORECAST DATA</div>';
      return;
    }

    // Bar height is each hour's share of the range across the window,
    // floored so the coldest hour still reads as a bar.
    var temps = rows.map(function (r) { return r.temp; });
    var min = Math.min.apply(null, temps);
    var max = Math.max.apply(null, temps);
    var span = max - min || 1;

    $('forecast-chart').innerHTML = rows.map(function (r, i) {
      var height = 25 + ((r.temp - min) / span) * 50;   // 25%..75%, matching the mock
      return '<div class="fc-col">' +
        '<div class="fc-temp">' + r.temp + '°</div>' +
        '<div class="fc-bar-slot"><div class="fc-bar' + (i === 0 ? ' is-now' : '') +
        '" style="height:' + height.toFixed(1) + '%"></div></div>' +
        Icons.weatherSmall(r.condition, r.night) +
        '<div class="fc-hour">' + pad(r.hour) + ':00</div>' +
        '</div>';
    }).join('');
  }

  function setForecastOpen(open) {
    ui.forecastOpen = open;
    $('forecast').hidden = !open;
    if (open) renderForecast();
  }

  /* ── Events ─────────────────────────────────────────── */
  function bindLights() {
    document.querySelectorAll('.light-card').forEach(function (card) {
      var room = card.dataset.room;
      card.querySelector('[data-icon="brighter"]').innerHTML = Icons.brighter;
      card.querySelector('[data-icon="dimmer"]').innerHTML = Icons.dimmer;

      card.addEventListener('click', function (e) {
        var el = e.target.closest('[data-action]');
        if (!el) return;
        switch (el.dataset.action) {
          case 'toggle':            Data.toggleLight(room); break;
          case 'brightness_up':     Data.stepBrightness(room, 1); break;
          case 'brightness_down':   Data.stepBrightness(room, -1); break;
          case 'color_temp_toggle': Data.toggleColorTemp(room); break;
        }
      });
    });
  }

  function bindForecast() {
    $('forecast-close').innerHTML = Icons.close;
    $('weather-card').addEventListener('click', function () { setForecastOpen(true); });
    $('forecast-close').addEventListener('click', function (e) {
      e.stopPropagation();
      setForecastOpen(false);
    });
  }

  /* ── Connection state ───────────────────────────────────
     Step 1 wires the socket up and surfaces its health; the
     cards still render from mock data until each one is
     migrated in its own step. */
  var CONN_COPY = {
    connecting:   'CONNECTING',
    disconnected: 'NO CONNECTION',
    auth_failed:  'AUTH FAILED',
    unconfigured: 'NO CONFIG'
  };

  function renderConnection(state) {
    var chip = $('conn-chip');
    if (!chip) return;
    var copy = CONN_COPY[state];
    chip.hidden = !copy;                    // hidden while connected
    if (copy) chip.textContent = copy;
    chip.classList.toggle('is-fatal', state === 'auth_failed' || state === 'unconfigured');
  }

  /* ── Boot ───────────────────────────────────────────── */
  /* One `now` per pass, so the clock and the countdowns can never
     land either side of a minute boundary within the same render. */
  function renderAll() {
    var now = new Date();
    renderClock(now);
    renderBins();
    renderDepartures(now);
    renderLights();
    renderWeather();
    if (ui.forecastOpen) renderForecast(now);
  }

  function tick() {
    var now = new Date();
    renderClock(now);
    renderDepartures(now);
  }

  function init() {
    bindLights();
    bindForecast();
    Data.onChange = renderAll;
    renderAll();
    setInterval(tick, 1000);

    if (global.HA) {
      HA.onStatus(function (state) {
        renderConnection(state);
        // Forecasts are polled, not pushed, so they need kicking off
        // on connect and again after any reconnect.
        if (state === 'connected') Data.startForecastPolling();
      });
      HA.onUpdate(function () { if (Data.isLive) renderAll(); });
      HA.connect();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
  global.Dashboard = { render: renderAll, setForecastOpen: setForecastOpen };
})(window);
