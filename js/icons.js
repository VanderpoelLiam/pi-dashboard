/* ─────────────────────────────────────────────────────────
   icons.js — every icon is inline SVG built from circles,
   rounded rects and straight strokes. No icon library, no
   emoji, no bitmaps (per the design spec).
   ───────────────────────────────────────────────────────── */
(function (global) {
  'use strict';

  var INK = '#16130f';
  var GROUND = '#b0603a';

  function svg(viewBox, body, attrs) {
    return '<svg viewBox="' + viewBox + '" ' + (attrs || '') + '>' + body + '</svg>';
  }

  /* ── Light level glyph ──────────────────────────────────
     Three stacked bars, bottom-aligned at y=58.
     level 0 = off (all hollow, dead stroke), 1..3 = lit count. */
  var BARS = [
    { x: 8,  y: 40, w: 14, h: 18 },
    { x: 29, y: 26, w: 14, h: 32 },
    { x: 50, y: 12, w: 14, h: 46 }
  ];

  function levelGlyph(on, level) {
    var body = BARS.map(function (b, i) {
      var base = 'x="' + b.x + '" y="' + b.y + '" width="' + b.w +
                 '" height="' + b.h + '" rx="3"';
      if (on && i < level) {
        return '<rect ' + base + ' fill="' + INK + '" />';
      }
      var stroke = on ? '#cdc2b0' : '#b6ab99';
      return '<rect ' + base + ' fill="none" stroke="' + stroke + '" stroke-width="2.5" />';
    }).join('');
    return svg('0 0 72 72', body);
  }

  /* ── Light card buttons ─────────────────────────────── */
  var brighter = svg('0 0 24 24',
    '<circle cx="12" cy="12" r="4.5" stroke="' + INK + '" stroke-width="1.5" fill="none" />' +
    '<path d="M12 2.5v3.2M12 18.3v3.2M2.5 12h3.2M18.3 12h3.2M5.3 5.3l2.3 2.3' +
    'M16.4 16.4l2.3 2.3M18.7 5.3l-2.3 2.3M7.6 16.4l-2.3 2.3" ' +
    'stroke="' + INK + '" stroke-width="1.5" stroke-linecap="round" fill="none" />');

  var dimmer = svg('0 0 24 24',
    '<path d="M12 4.5a7.5 7.5 0 100 15 7.5 7.5 0 000-15z" stroke="' + INK +
    '" stroke-width="1.5" fill="none" />' +
    '<path d="M12 4.5a7.5 7.5 0 010 15z" fill="' + INK + '" />');

  var close = svg('0 0 24 24',
    '<path d="M6 6l12 12M18 6L6 18" stroke="#f7efe4" stroke-width="1.8" stroke-linecap="round" />');

  /* ── Weather ────────────────────────────────────────────
     Authored in a 60x60 box; the large card icon reuses the
     same geometry scaled up, so the two always agree.

     NOTE: only the three conditions present in the design mock
     are implemented. The remaining Home Assistant conditions
     fall back to the nearest shape below and are pending the
     icon set decision — see README "Weather icons (pending)".
     ──────────────────────────────────────────────────────── */
  var SHAPES = {
    partlycloudy:
      '<circle cx="36" cy="22" r="13" fill="' + GROUND + '" />' +
      '<circle cx="22" cy="38" r="12" fill="' + INK + '" />' +
      '<circle cx="36" cy="40" r="9" fill="' + INK + '" />' +
      '<rect x="22" y="38" width="24" height="11" rx="5.5" fill="' + INK + '" />',

    cloudy:
      '<circle cx="24" cy="28" r="13" fill="' + INK + '" />' +
      '<circle cx="38" cy="30" r="10" fill="' + INK + '" />' +
      '<rect x="24" y="28" width="24" height="12" rx="6" fill="' + INK + '" />',

    rainy:
      '<circle cx="24" cy="26" r="12" fill="' + INK + '" />' +
      '<circle cx="37" cy="28" r="9" fill="' + INK + '" />' +
      '<rect x="24" y="26" width="22" height="11" rx="5.5" fill="' + INK + '" />' +
      '<circle cx="24" cy="46" r="3.5" fill="' + GROUND + '" />' +
      '<circle cx="34" cy="48" r="3.5" fill="' + GROUND + '" />' +
      '<circle cx="44" cy="45" r="3.5" fill="' + GROUND + '" />'
  };

  /* Every HA condition string this weather integration can emit,
     mapped to a shape we actually have. Entries marked TODO are
     placeholders until the real icons are designed. */
  var CONDITION_SHAPE = {
    'partlycloudy':   'partlycloudy',
    'cloudy':         'cloudy',
    'rainy':          'rainy',
    'sunny':          'partlycloudy',  // TODO: bare sun disc
    'clear-night':    'partlycloudy',  // TODO: crescent moon
    'pouring':        'rainy',         // TODO: heavier drops
    'snowy':          'rainy',         // TODO
    'snowy-rainy':    'rainy',         // TODO
    'hail':           'rainy',         // TODO
    'fog':            'cloudy',        // TODO
    'lightning':      'cloudy',        // TODO
    'lightning-rainy':'rainy',         // TODO
    'windy':          'cloudy',        // TODO
    'windy-variant':  'cloudy',        // TODO
    'exceptional':    'cloudy'         // TODO
  };

  // The card icon is hand-authored at 200x200 (exact spec geometry);
  // everything else scales the 60x60 shape by 200/60.
  var LARGE_PARTLYCLOUDY =
    '<circle cx="126" cy="62" r="54" fill="' + GROUND + '" />' +
    '<circle cx="70" cy="124" r="40" fill="' + INK + '" />' +
    '<circle cx="114" cy="128" r="31" fill="' + INK + '" />' +
    '<rect x="70" y="128" width="76" height="31" rx="15.5" fill="' + INK + '" />' +
    '<circle cx="40" cy="144" r="25" fill="' + INK + '" />' +
    '<rect x="40" y="134" width="76" height="25" rx="12.5" fill="' + INK + '" />';

  function shapeFor(condition) {
    return SHAPES[CONDITION_SHAPE[condition] || 'cloudy'];
  }

  function weatherLarge(condition) {
    if ((CONDITION_SHAPE[condition] || 'cloudy') === 'partlycloudy') {
      return svg('0 0 200 200', LARGE_PARTLYCLOUDY, 'preserveAspectRatio="xMidYMid meet"');
    }
    var scaled = '<g transform="scale(3.3333)">' + shapeFor(condition) + '</g>';
    return svg('0 0 200 200', scaled, 'preserveAspectRatio="xMidYMid meet"');
  }

  function weatherSmall(condition) {
    return svg('0 0 60 60', shapeFor(condition));
  }

  global.Icons = {
    levelGlyph: levelGlyph,
    brighter: brighter,
    dimmer: dimmer,
    close: close,
    weatherLarge: weatherLarge,
    weatherSmall: weatherSmall,
    conditions: Object.keys(CONDITION_SHAPE)
  };
})(window);
