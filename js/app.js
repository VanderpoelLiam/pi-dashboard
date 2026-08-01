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

  /* ── Clock ──────────────────────────────────────────── */
  function renderClock() {
    var now = new Date();
    $('clock-time').textContent = hhmm(now);
    $('clock-seconds').textContent = pad(now.getSeconds());
    $('clock-date').textContent =
      DAYS[now.getDay()] + ', ' + now.getDate() + ' ' + MONTHS[now.getMonth()];

    var fraction = (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400;
    var pct = (fraction * 100).toFixed(2) + '%';
    $('dayrule-fill').style.width = pct;
    $('dayrule-tick').style.left = pct;
  }

  /* ── Bin chips ──────────────────────────────────────────
     Shown only when collection is within the threshold; copy
     is relative. Threshold is 2 days per the design spec. */
  var WASTE_THRESHOLD_DAYS = 2;

  function relativeDay(days) {
    if (days === 0) return 'today';
    if (days === 1) return 'tomorrow';
    return 'in ' + days + ' days';
  }

  function renderBins() {
    var waste = Data.getWaste();
    var host = $('bin-chips');
    var html = '';
    ['paper', 'cardboard'].forEach(function (key, i) {
      var w = waste[key];
      if (!w || w.days === null || w.days > WASTE_THRESHOLD_DAYS) return;
      // Paper reads as the filled chip, cardboard as the outlined one.
      var cls = i === 0 ? 'chip chip-filled' : 'chip chip-outline';
      html += '<div class="' + cls + '"><div class="chip-swatch"></div>' +
              w.label + ' ' + relativeDay(w.days) + '</div>';
    });
    host.innerHTML = html;
  }

  /* ── Departures ─────────────────────────────────────── */
  function countdownText(target) {
    var mins = Math.round((target.getTime() - Date.now()) / 60000);
    return mins <= 0 ? 'now' : 'in ' + mins + ' min';
  }

  function renderDepartures() {
    var deps = Data.getDepartures();
    for (var i = 0; i < 3; i++) {
      var d = deps[i];
      var n = i + 1;
      $('dep' + n + '-time').textContent = d ? hhmm(d) : '—';
      $('dep' + n + '-countdown').textContent = d ? countdownText(d) : '—';
    }
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
    $('weather-range').innerHTML = 'L. ' + w.low + '° &nbsp; H. ' + w.high + '°';
    $('weather-condition').textContent = w.conditionLabel;
    $('weather-temp').textContent = Math.round(w.temperature);
    $('weather-icon').innerHTML = Icons.weatherLarge(w.condition);
  }

  function renderForecast() {
    var rows = Data.getForecast();
    var w = Data.getWeather();
    var now = new Date();

    $('forecast-sub').textContent =
      (DAYS[now.getDay()] + ' ' + now.getDate() + ' ' + MONTHS[now.getMonth()]).toUpperCase() +
      ' · L. ' + w.low + '° H. ' + w.high + '°';

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
        Icons.weatherSmall(r.condition) +
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
  function renderAll() {
    renderClock();
    renderBins();
    renderDepartures();
    renderLights();
    renderWeather();
    if (ui.forecastOpen) renderForecast();
  }

  function tick() {
    renderClock();
    renderDepartures();
  }

  function init() {
    bindLights();
    bindForecast();
    Data.onChange = renderAll;
    renderAll();
    setInterval(tick, 1000);

    if (global.HA) {
      HA.onStatus(renderConnection);
      HA.onUpdate(function () { if (Data.isLive) renderAll(); });
      HA.connect();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
  global.Dashboard = { render: renderAll, setForecastOpen: setForecastOpen };
})(window);
