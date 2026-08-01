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

  /* ═══════════════════════════════════════════════════════
     WEATHER ICONS — PLACEHOLDERS

     Every condition Home Assistant can report is covered, so
     nothing ever falls through to a generic shape. The forms
     below are built from the design's own vocabulary (flat ink
     shapes with terracotta accents) but they are stand-ins,
     pending proper icons from the designer.

     To swap one in, replace its entry in SHAPES. Each is
     authored in a 60x60 box and drawn from the parts below;
     the large card icon reuses the same geometry scaled up, so
     the two sizes can never drift apart.
     ═══════════════════════════════════════════════════════ */

  // Cloud sitting low, for conditions with nothing beneath it.
  var CLOUD =
    '<circle cx="24" cy="28" r="13" fill="' + INK + '" />' +
    '<circle cx="38" cy="30" r="10" fill="' + INK + '" />' +
    '<rect x="24" y="28" width="24" height="12" rx="6" fill="' + INK + '" />';

  // Cloud lifted, to leave room for precipitation underneath.
  var CLOUD_HIGH =
    '<circle cx="24" cy="24" r="12" fill="' + INK + '" />' +
    '<circle cx="37" cy="26" r="9" fill="' + INK + '" />' +
    '<rect x="24" y="24" width="22" height="11" rx="5.5" fill="' + INK + '" />';

  var SUN = '<circle cx="30" cy="30" r="17" fill="' + GROUND + '" />';

  // Crescent as a single even-odd path, so it does not depend on
  // the card colour showing through a cut-out circle.
  var MOON =
    '<path fill-rule="evenodd" fill="' + GROUND + '" d="' +
    'M30 13a17 17 0 1 0 0 34 17 17 0 1 0 0-34z' +
    'M38 11a15 15 0 1 0 0 30 15 15 0 1 0 0-30z" />';

  function drop(x, y, h) {           // rain: vertical dash
    return '<rect x="' + x + '" y="' + y + '" width="3.5" height="' + h +
           '" rx="1.75" fill="' + GROUND + '" />';
  }
  function flake(x, y) {             // snow: soft round
    return '<circle cx="' + x + '" cy="' + y + '" r="3.2" fill="' + GROUND + '" />';
  }
  function stone(x, y) {             // hail: small and hard
    return '<circle cx="' + x + '" cy="' + y + '" r="2.6" fill="' + INK + '" />';
  }
  function bar(x, y, w) {            // fog / wind streak
    return '<rect x="' + x + '" y="' + y + '" width="' + w +
           '" height="3.4" rx="1.7" fill="' + GROUND + '" />';
  }
  var BOLT = '<path fill="' + GROUND + '" d="M33 38l-9 12h6l-2 9 10-13h-6l3-8z" />';

  var SHAPES = {
    'sunny':        SUN,
    'clear-night':  MOON,

    'partlycloudy':
      '<circle cx="36" cy="22" r="13" fill="' + GROUND + '" />' +
      '<circle cx="22" cy="38" r="12" fill="' + INK + '" />' +
      '<circle cx="36" cy="40" r="9" fill="' + INK + '" />' +
      '<rect x="22" y="38" width="24" height="11" rx="5.5" fill="' + INK + '" />',

    'partlycloudy-night':
      '<path fill-rule="evenodd" fill="' + GROUND + '" d="' +
      'M36 9a13 13 0 1 0 0 26 13 13 0 1 0 0-26z' +
      'M42 7a11 11 0 1 0 0 22 11 11 0 1 0 0-22z" />' +
      '<circle cx="22" cy="38" r="12" fill="' + INK + '" />' +
      '<circle cx="36" cy="40" r="9" fill="' + INK + '" />' +
      '<rect x="22" y="38" width="24" height="11" rx="5.5" fill="' + INK + '" />',

    'cloudy': CLOUD,

    'fog': CLOUD + bar(14, 46, 32) + bar(20, 53, 26),

    'rainy':   CLOUD_HIGH + drop(23, 42, 8) + drop(33, 45, 8) + drop(43, 42, 8),
    'pouring': CLOUD_HIGH + drop(20, 41, 13) + drop(29, 44, 13) +
               drop(38, 41, 13) + drop(46, 44, 11),

    'snowy':       CLOUD_HIGH + flake(23, 45) + flake(34, 48) + flake(44, 44),
    'snowy-rainy': CLOUD_HIGH + flake(23, 45) + drop(33, 42, 9) + flake(44, 44),
    'hail':        CLOUD_HIGH + stone(23, 45) + stone(34, 48) + stone(44, 44),

    'lightning':       CLOUD_HIGH + BOLT,
    'lightning-rainy': CLOUD_HIGH + BOLT + drop(20, 42, 8) + drop(45, 42, 8),

    'windy':         bar(10, 22, 38) + bar(16, 31, 32) + bar(10, 40, 26),
    'windy-variant': CLOUD + bar(12, 47, 30) + bar(20, 54, 22),

    // No agreed visual for "exceptional"; flagged rather than guessed.
    'exceptional': CLOUD_HIGH +
      '<rect x="28" y="40" width="4" height="12" rx="2" fill="' + GROUND + '" />' +
      '<circle cx="30" cy="56" r="2.6" fill="' + GROUND + '" />'
  };

  /* Conditions that get a distinct night form. HA already swaps
     sunny -> clear-night on its own, so partlycloudy is the only
     one that needs synthesising from the sun's position. */
  var NIGHT_VARIANT = { 'partlycloudy': 'partlycloudy-night' };

  /* Human-readable labels for the weather card. */
  var LABELS = {
    'sunny': 'Sunny',
    'clear-night': 'Clear',
    'partlycloudy': 'Partly cloudy',
    'cloudy': 'Cloudy',
    'fog': 'Fog',
    'rainy': 'Rain',
    'pouring': 'Heavy rain',
    'snowy': 'Snow',
    'snowy-rainy': 'Sleet',
    'hail': 'Hail',
    'lightning': 'Thunder',
    'lightning-rainy': 'Thunderstorm',
    'windy': 'Windy',
    'windy-variant': 'Windy',
    'exceptional': 'Severe'
  };

  function resolve(condition, night) {
    if (night && NIGHT_VARIANT[condition]) return NIGHT_VARIANT[condition];
    return SHAPES[condition] ? condition : 'cloudy';
  }

  // The card icon is hand-authored at 200x200 (exact spec geometry);
  // every other shape scales the 60x60 form by 200/60.
  var LARGE_PARTLYCLOUDY =
    '<circle cx="126" cy="62" r="54" fill="' + GROUND + '" />' +
    '<circle cx="70" cy="124" r="40" fill="' + INK + '" />' +
    '<circle cx="114" cy="128" r="31" fill="' + INK + '" />' +
    '<rect x="70" y="128" width="76" height="31" rx="15.5" fill="' + INK + '" />' +
    '<circle cx="40" cy="144" r="25" fill="' + INK + '" />' +
    '<rect x="40" y="134" width="76" height="25" rx="12.5" fill="' + INK + '" />';

  function weatherLarge(condition, night) {
    var key = resolve(condition, night);
    if (key === 'partlycloudy') {
      return svg('0 0 200 200', LARGE_PARTLYCLOUDY, 'preserveAspectRatio="xMidYMid meet"');
    }
    return svg('0 0 200 200', '<g transform="scale(3.3333)">' + SHAPES[key] + '</g>',
               'preserveAspectRatio="xMidYMid meet"');
  }

  function weatherSmall(condition, night) {
    return svg('0 0 60 60', SHAPES[resolve(condition, night)]);
  }

  function conditionLabel(condition) {
    return LABELS[condition] || 'Unknown';
  }

  global.Icons = {
    levelGlyph: levelGlyph,
    brighter: brighter,
    dimmer: dimmer,
    close: close,
    weatherLarge: weatherLarge,
    weatherSmall: weatherSmall,
    conditionLabel: conditionLabel,
    conditions: Object.keys(LABELS)
  };
})(window);
