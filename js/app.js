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

     The sixth tooth is drawn in accent instead of ink: it is the last
     dash of the three-minute walk to the stop. It holds its place
     whatever the comb is doing, so while ink teeth still stand to its
     right the bus is catchable, and once they have gone it is not.
     Nothing else on the card changes at that point — the comb carries
     it. The ink run therefore stops one tooth short of the walk, at
     five, and the mark supplies the sixth. */
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

    walk.style.width = (Math.min(dashes, COMB_WALK_DASHES - 1) * COMB_PITCH_PX) + 'px';
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

  /* ── Forecast chart ─────────────────────────────────────
     A structural copy of MeteoSwiss's own detail-view chart, drawn
     from our data in our colours: temperature min/max band with the
     mean splined through it, precipitation columns with min/max
     whiskers along the baseline, and the 3-hourly symbols on their
     own row. Geometry is computed here; every colour is a class,
     styled from the tokens in dashboard.css.

     Their chart scrolls sideways through nine days. This one is a
     fixed panel, so it shows the two days that fit at the same
     spacing, an hour of the past included. */
  var CHART_HOURS = 48;
  var CHART_PAST_HOURS = 1;

  function niceScales(hours) {
    /* MeteoSwiss's own rule, checked against three of their towns:
       temperature always steps in 5°, floored and ceiled to a
       multiple of 5, and the gridline count falls out of that.
       Precipitation starts at 0, shares those lines, and takes the
       smallest step that is a multiple of 2. Nothing is fixed, so
       winter needs no special case.

       They compute it over all nine days; we use the hours on
       screen, or a mild spell inside a cold fortnight would draw as
       a flat ribbon through the middle of the card. */
    var TEMP_STEP = 5, RAIN_STEP = 2;

    var lows = hours.map(function (h) { return h.tempMin != null ? h.tempMin : h.temp; });
    var highs = hours.map(function (h) { return h.tempMax != null ? h.tempMax : h.temp; });
    var lo = Math.floor(Math.min.apply(null, lows) / TEMP_STEP) * TEMP_STEP;
    var hi = Math.ceil(Math.max.apply(null, highs) / TEMP_STEP) * TEMP_STEP;
    if (hi === lo) hi = lo + TEMP_STEP;

    var divisions = Math.round((hi - lo) / TEMP_STEP);
    var wettest = Math.max.apply(null, hours.map(function (h) { return h.rainMax || 0; }).concat([0]));
    var rainStep = Math.max(RAIN_STEP, Math.ceil(wettest / divisions / RAIN_STEP) * RAIN_STEP);

    return { lo: lo, hi: hi, divisions: divisions, rainStep: rainStep };
  }

  /* Catmull-Rom through the points, as a cubic bezier path — the
     same smoothing their chart uses, so the curve reads as weather
     rather than as a chain of readings. */
  function spline(points) {
    if (points.length < 2) return '';
    var d = 'M' + points[0][0].toFixed(1) + ' ' + points[0][1].toFixed(1);
    for (var i = 0; i < points.length - 1; i++) {
      var p0 = points[i - 1] || points[i], p1 = points[i];
      var p2 = points[i + 1], p3 = points[i + 2] || p2;
      d += ' C' + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + ' ' + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) +
           ' ' + (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + ' ' + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) +
           ' ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
    }
    return d;
  }

  function chartSvg(series, box, now) {
    var W = box.w, H = box.h;
    /* The panel carries no padding of its own: the drawing is inset
       by these margins instead, so the SVG can be sized to the box
       exactly and nothing lands under a rounded corner. */
    var AXIS_L = 58, AXIS_R = 62;
    var DAY_ROW = 30, ICON_ROW = 40, TOP = 100, BOTTOM = 46;
    var plotW = W - AXIS_L - AXIS_R, plotH = H - TOP - BOTTOM;
    var base = TOP + plotH;

    var t0 = Math.floor((now - CHART_PAST_HOURS * 3600000) / 3600000) * 3600000;
    var t1 = t0 + CHART_HOURS * 3600000;
    var within = function (t) { return t >= t0 && t <= t1; };
    var x = function (t) { return AXIS_L + plotW * (t - t0) / (t1 - t0); };

    var hours = series.hours.filter(function (h) { return within(h.t); });
    if (hours.length < 2) return '';

    var scale = niceScales(hours);
    var y = function (v) { return base - plotH * (v - scale.lo) / (scale.hi - scale.lo); };
    var rainY = function (v) { return base - plotH * (v / (scale.rainStep * scale.divisions)); };

    var out = [];

    // The hour already under way, shaded off.
    out.push('<rect class="fc-past" x="' + AXIS_L + '" y="' + TOP + '" width="' +
      (x(now) - AXIS_L).toFixed(1) + '" height="' + plotH + '"/>');

    // One grid, read as °C down the left and mm/h down the right.
    for (var i = 0; i <= scale.divisions; i++) {
      var gy = base - plotH * i / scale.divisions;
      out.push('<line class="fc-grid" x1="' + AXIS_L + '" y1="' + gy.toFixed(1) +
        '" x2="' + (W - AXIS_R) + '" y2="' + gy.toFixed(1) + '"/>');
      out.push('<text class="fc-axis fc-axis-l" x="' + (AXIS_L - 8) + '" y="' + (gy + 4).toFixed(1) +
        '">' + (scale.lo + 5 * i) + '</text>');
      out.push('<text class="fc-axis" x="' + (W - AXIS_R + 8) + '" y="' + (gy + 4).toFixed(1) +
        '">' + (scale.rainStep * i) + '</text>');
    }
    out.push('<text class="fc-unit fc-axis-l" x="' + (AXIS_L - 8) + '" y="' + DAY_ROW + '">°C</text>');
    out.push('<text class="fc-unit" x="' + (W - AXIS_R + 8) + '" y="' + DAY_ROW + '">MM/H</text>');

    // Midnight boundaries, named from the date — the feed's own day
    // label comes back localised.
    series.days.forEach(function (d) {
      if (!within(d.t) || d.t === t0) return;
      out.push('<line class="fc-divider" x1="' + x(d.t).toFixed(1) + '" y1="' + DAY_ROW +
        '" x2="' + x(d.t).toFixed(1) + '" y2="' + base + '"/>');
      out.push('<text class="fc-day" x="' + (x(d.t) + 10).toFixed(1) + '" y="' + DAY_ROW + '">' +
        DAYS[new Date(d.t).getDay()].toUpperCase() + '</text>');
    });

    // Temperature: the band first, the mean over it.
    var top = hours.map(function (h) { return [x(h.t), y(h.tempMax != null ? h.tempMax : h.temp)]; });
    var bottom = hours.map(function (h) { return [x(h.t), y(h.tempMin != null ? h.tempMin : h.temp)]; });
    var last = bottom[bottom.length - 1];
    out.push('<path class="fc-band" d="' + spline(top) + ' L' + last[0].toFixed(1) + ' ' +
      last[1].toFixed(1) + ' ' + spline(bottom.slice().reverse()).slice(1) + ' Z"/>');
    out.push('<path class="fc-line" d="' +
      spline(hours.map(function (h) { return [x(h.t), y(h.temp)]; })) + '"/>');

    // Precipitation: expected as a column, possible as a whisker.
    var slot = plotW / CHART_HOURS;
    var barW = Math.min(14, slot * 0.55);
    hours.forEach(function (h) {
      if (h.rain > 0) {
        out.push('<rect class="fc-bar" x="' + (x(h.t) - barW / 2).toFixed(1) + '" y="' +
          rainY(h.rain).toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' +
          (base - rainY(h.rain)).toFixed(1) + '"/>');
      }
      if (h.rainMax > h.rainMin) {
        var cx = x(h.t), cap = barW * 0.62;
        out.push('<line class="fc-whisker" x1="' + cx.toFixed(1) + '" y1="' + rainY(h.rainMin).toFixed(1) +
          '" x2="' + cx.toFixed(1) + '" y2="' + rainY(h.rainMax).toFixed(1) + '"/>');
        out.push('<line class="fc-whisker" x1="' + (cx - cap).toFixed(1) + '" y1="' + rainY(h.rainMax).toFixed(1) +
          '" x2="' + (cx + cap).toFixed(1) + '" y2="' + rainY(h.rainMax).toFixed(1) + '"/>');
      }
    });

    out.push('<line class="fc-base" x1="' + AXIS_L + '" y1="' + base + '" x2="' + (W - AXIS_R) + '" y2="' + base + '"/>');
    out.push('<line class="fc-now" x1="' + x(now).toFixed(1) + '" y1="' + DAY_ROW +
      '" x2="' + x(now).toFixed(1) + '" y2="' + base + '"/>');

    for (var t = Math.ceil(t0 / 10800000) * 10800000; t < t1; t += 3 * 3600000) {
      out.push('<text class="fc-hour" x="' + x(t).toFixed(1) + '" y="' + (base + 24) + '">' +
        pad(new Date(t).getHours()) + '.00</text>');
    }

    /* Symbols sit on their own row at their own three-hour spacing.
       One whose mark would run under an axis is dropped rather than
       nudged inwards, which would stack it on its neighbour. */
    var icons = series.symbols.filter(function (sym) {
      return within(sym.t) && x(sym.t) - 19 >= AXIS_L && x(sym.t) + 19 <= W - AXIS_R;
    }).map(function (sym) {
      return '<g class="fc-icon" transform="translate(' + (x(sym.t) - 19).toFixed(1) + ',' + ICON_ROW + ') scale(0.633)">' +
        Icons.weatherSmall(sym.condition, sym.night).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '') +
        '</g>';
    }).join('');

    return '<svg class="fc-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">' +
      out.join('') + icons + '</svg>';
  }

  /* renderAll runs every second so the clock and the countdowns stay
     honest, but the chart changes at most once a minute — and only
     the "now" line moves even then. Rebuilding several hundred SVG
     nodes a second is not something to ask of a Pi, so a redraw is
     skipped unless the data or the minute has actually changed. */
  var drawn = { series: null, minute: null };

  function renderForecast(now) {
    var series = Data.getForecastChart();
    var w = Data.getWeather() || {};
    now = now || new Date();

    var lo = isUnknown(w.low) ? '—' : w.low;
    var hi = isUnknown(w.high) ? '—' : w.high;
    $('forecast-sub').textContent =
      (DAYS[now.getDay()] + ' ' + now.getDate() + ' ' + MONTHS[now.getMonth()]).toUpperCase() +
      ' · L. ' + lo + '° H. ' + hi + '°';

    var host = $('forecast-chart');
    if (!series || !series.hours.length) {
      host.innerHTML = '<div class="fc-empty">NO FORECAST DATA</div>';
      return;
    }

    // Drawn at the panel's own pixel size, so nothing is scaled and
    // the type stays the size it was designed at.
    var minute = Math.floor(now.getTime() / 60000);
    if (drawn.series === series && drawn.minute === minute && host.firstChild) return;
    drawn = { series: series, minute: minute };

    var box = { w: host.clientWidth, h: host.clientHeight };
    if (!box.w || !box.h) box = { w: 1188, h: 476 };

    host.innerHTML = chartSvg(series, box, now.getTime());
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
      HA.onStatus(renderConnection);
      HA.onUpdate(function () { if (Data.isLive) renderAll(); });
      HA.connect();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
  global.Dashboard = { render: renderAll, setForecastOpen: setForecastOpen };
})(window);
