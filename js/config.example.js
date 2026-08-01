/* ─────────────────────────────────────────────────────────
   Copy this file to js/config.js and fill in the token.

       cp js/config.example.js js/config.js

   js/config.js is gitignored — the token must never be
   committed. Generate one in Home Assistant under:
       Profile -> Security -> Long-lived access tokens
   ───────────────────────────────────────────────────────── */
window.HA_CONFIG = {
  // No trailing slash. https:// is required for a wss:// socket.
  url: 'https://ha.internal.vanderpoel.ch',

  // Long-lived access token. Treat it like a password.
  token: 'PASTE_YOUR_LONG_LIVED_ACCESS_TOKEN_HERE'
};
