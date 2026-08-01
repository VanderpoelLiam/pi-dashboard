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
     WEATHER ICONS

     Taken verbatim from weather-icons.svg, the designer's sprite
     sheet, which stays in the repo as the source of truth. Each
     entry is one <symbol>'s contents, authored in a 60x60 box;
     the large card icon scales the same geometry by 200/60, so
     the two sizes cannot drift apart.

     To update: replace weather-icons.svg and re-extract.
     ═══════════════════════════════════════════════════════ */

  var SHAPES = {
    'sunny':
      '<circle cx="30" cy="30" r="18" fill="#b0603a"></circle>',

    'clear-night':
      '<path fill="#b0603a" d="M28.74 12.05A18 18 0 1 0 45.92 38.4A16.5 16.5 0 0 1 28.74 12.05z"></path>',

    'partlycloudy':
      '<circle cx="36" cy="22" r="13" fill="#b0603a"></circle><circle cx="20" cy="38" r="10" fill="#16130f"></circle><circle cx="31" cy="35" r="12" fill="#16130f"></circle><circle cx="40" cy="40" r="7" fill="#16130f"></circle><rect x="11" y="40" width="36" height="9" rx="4.5" fill="#16130f"></rect>',

    'partlycloudy-night':
      '<path fill="#b0603a" d="M35.83 5A13 13 0 1 0 48.24 22.37A12 12 0 0 1 35.83 5z"></path><circle cx="20" cy="38" r="10" fill="#16130f"></circle><circle cx="31" cy="35" r="12" fill="#16130f"></circle><circle cx="40" cy="40" r="7" fill="#16130f"></circle><rect x="11" y="40" width="36" height="9" rx="4.5" fill="#16130f"></rect>',

    'cloudy':
      '<circle cx="22" cy="32" r="10" fill="#16130f"></circle><circle cx="34" cy="29" r="13" fill="#16130f"></circle><circle cx="43" cy="35" r="7" fill="#16130f"></circle><rect x="12" y="34" width="38" height="10" rx="5" fill="#16130f"></rect>',

    'fog':
      '<rect x="8" y="11" width="44" height="6" rx="3" fill="#16130f"></rect><rect x="14" y="22" width="38" height="6" rx="3" fill="#b0603a"></rect><rect x="6" y="33" width="40" height="6" rx="3" fill="#16130f"></rect><rect x="16" y="44" width="30" height="6" rx="3" fill="#16130f"></rect>',

    'rainy':
      '<g transform="translate(2,4.5) scale(0.72)"><path d="M30 8c0 0 13 15 13 22a13 13 0 1 1 -26 0c0-7 13-22 13-22z" fill="#b0603a"></path></g><g transform="translate(27,6) scale(0.55)"><path d="M30 8c0 0 13 15 13 22a13 13 0 1 1 -26 0c0-7 13-22 13-22z" fill="#b0603a"></path></g><g transform="translate(22,30) scale(0.5)"><path d="M30 8c0 0 13 15 13 22a13 13 0 1 1 -26 0c0-7 13-22 13-22z" fill="#16130f"></path></g>',

    'pouring':
      '<g transform="translate(-2.35,-0.2) scale(0.55,1.15)"><path d="M30 8c0 0 13 15 13 22a13 13 0 1 1 -26 0c0-7 13-22 13-22z" fill="#b0603a"></path></g><g transform="translate(13.65,-0.2) scale(0.55,1.15)"><path d="M30 8c0 0 13 15 13 22a13 13 0 1 1 -26 0c0-7 13-22 13-22z" fill="#16130f"></path></g><g transform="translate(29.65,-0.2) scale(0.55,1.15)"><path d="M30 8c0 0 13 15 13 22a13 13 0 1 1 -26 0c0-7 13-22 13-22z" fill="#b0603a"></path></g>',

    'snowy':
      '<path d="M30 13v32M16.1 21l27.8 16M43.9 21L16.1 37" fill="none" stroke="#b0603a" stroke-width="3.4" stroke-linecap="round"></path><path d="M30 18l-4.5-4.5M30 18l4.5-4.5M30 40l-4.5 4.5M30 40l4.5 4.5M39.6 23.5l-.2-6M39.6 23.5l5.8 1.5M20.4 34.5l.2 6M20.4 34.5l-5.8-1.5M20.4 23.5l-5.8 1.5M20.4 23.5l.2-6M39.6 34.5l5.8-1.5M39.6 34.5l-.2 6" fill="none" stroke="#b0603a" stroke-width="2.6" stroke-linecap="round"></path>',

    'snowy-rainy':
      '<g transform="translate(-3,2) scale(0.62)"><path d="M30 13v32M16.1 21l27.8 16M43.9 21L16.1 37" fill="none" stroke="#b0603a" stroke-width="3.4" stroke-linecap="round"></path><path d="M30 18l-4.5-4.5M30 18l4.5-4.5M30 40l-4.5 4.5M30 40l4.5 4.5M39.6 23.5l-.2-6M39.6 23.5l5.8 1.5M20.4 34.5l.2 6M20.4 34.5l-5.8-1.5M20.4 23.5l-5.8 1.5M20.4 23.5l.2-6M39.6 34.5l5.8-1.5M39.6 34.5l-.2 6" fill="none" stroke="#b0603a" stroke-width="2.6" stroke-linecap="round"></path></g><g transform="translate(23,22) scale(0.55)"><path d="M30 8c0 0 13 15 13 22a13 13 0 1 1 -26 0c0-7 13-22 13-22z" fill="#16130f"></path></g>',

    'hail':
      '<path d="M29.00 26.00L23.00 36.39L11.00 36.39L5.00 26.00L11.00 15.61L23.00 15.61z" fill="#b0603a"></path><path d="M55.00 36.00L49.00 46.39L37.00 46.39L31.00 36.00L37.00 25.61L49.00 25.61z" fill="#16130f"></path>',

    'lightning':
      '<circle cx="22" cy="24" r="10" fill="#16130f"></circle><circle cx="34" cy="21" r="13" fill="#16130f"></circle><circle cx="43" cy="27" r="7" fill="#16130f"></circle><rect x="12" y="26" width="38" height="10" rx="5" fill="#16130f"></rect><path d="M35 37L22 52h7l-3 7L39 45h-7.5z" fill="#b0603a"></path>',

    'lightning-rainy':
      '<circle cx="22" cy="24" r="10" fill="#16130f"></circle><circle cx="34" cy="21" r="13" fill="#16130f"></circle><circle cx="43" cy="27" r="7" fill="#16130f"></circle><rect x="12" y="26" width="38" height="10" rx="5" fill="#16130f"></rect><g transform="translate(-11,0)"><path d="M33 37L23 49h6l-2.5 6L36 43h-6.5z" fill="#b0603a"></path></g><g transform="translate(8,3)"><path d="M33 37L23 49h6l-2.5 6L36 43h-6.5z" fill="#b0603a"></path></g>',

    'windy':
      '<path d="M6 20h20a6.5 6.5 0 1 0 -6.5-6.5" fill="none" stroke="#b0603a" stroke-width="5.5" stroke-linecap="round"></path><path d="M6 36h38a6.5 6.5 0 1 0 -6.5-6.5" fill="none" stroke="#16130f" stroke-width="5.5" stroke-linecap="round"></path><path d="M6 44h24a6.5 6.5 0 1 1 -6.5 6.5" fill="none" stroke="#b0603a" stroke-width="5.5" stroke-linecap="round"></path>',

    'exceptional':
      '<path d="M27.5 13.5Q30 9.5 32.5 13.5L52 48Q54.5 52.5 49.5 52.5H10.5Q5.5 52.5 8 48z" fill="#b0603a"></path><rect x="27" y="24" width="6" height="14" rx="3" fill="#16130f"></rect><circle cx="30" cy="45" r="3.6" fill="#16130f"></circle>'
  };

  /* Conditions with a distinct night form. Home Assistant already
     swaps sunny -> clear-night on its own, so partlycloudy is the
     only one that has to be chosen from the sun's position. */
  var NIGHT_VARIANT = { 'partlycloudy': 'partlycloudy-night' };

  /* windy-variant was not in the delivered sprite. Until it is, it
     borrows the plain windy mark rather than falling through to a
     cloud, which would read as the wrong weather entirely. */
  var FALLBACK = { 'windy-variant': 'windy' };

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
    if (SHAPES[condition]) return condition;
    return FALLBACK[condition] || 'cloudy';
  }

  function weatherLarge(condition, night) {
    return svg('0 0 200 200',
      '<g transform="scale(3.3333)">' + SHAPES[resolve(condition, night)] + '</g>',
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
