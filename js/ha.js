/* ─────────────────────────────────────────────────────────
   ha.js — Home Assistant WebSocket client.

   Uses subscribe_entities rather than subscribe_events, so HA
   only pushes the ~12 entities this dashboard cares about
   instead of every state change in the house. That matters on
   a Pi running 24/7.

   The connection rides over Tailscale, which can drop without
   closing the socket, so a ping/pong watchdog forces a
   reconnect when the link goes quiet.
   ───────────────────────────────────────────────────────── */
(function (global) {
  'use strict';

  var PING_INTERVAL   = 30000;  // how often to prove the link is alive
  var PING_TIMEOUT    = 10000;  // no pong within this -> assume dead
  var BACKOFF_MIN     = 1000;
  var BACKOFF_MAX     = 30000;

  var socket = null;
  var msgId = 1;
  var backoff = BACKOFF_MIN;
  var reconnectTimer = null;
  var pingTimer = null;
  var pongTimer = null;
  var pendingPingId = null;

  var states = Object.create(null);   // entity_id -> { state, attributes }
  var status = 'idle';
  var updateHandlers = [];
  var statusHandlers = [];

  function setStatus(next, detail) {
    if (status === next) return;
    status = next;
    statusHandlers.forEach(function (fn) { fn(next, detail); });
  }

  function emitUpdate() {
    updateHandlers.forEach(function (fn) { fn(states); });
  }

  function send(payload) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return null;
    var id = msgId++;
    payload.id = id;
    socket.send(JSON.stringify(payload));
    return id;
  }

  /* ── subscribe_entities delta handling ──────────────────
     HA sends a compressed shape:
       a = added (full state), c = changed (+ added / - removed
       keys), r = removed entities. */
  function applyAdded(map) {
    Object.keys(map).forEach(function (id) {
      var e = map[id];
      states[id] = { state: e.s, attributes: e.a || {} };
    });
  }

  function applyChanged(map) {
    Object.keys(map).forEach(function (id) {
      var cur = states[id] || { state: null, attributes: {} };
      var delta = map[id];

      if (delta['+']) {
        var plus = delta['+'];
        if (plus.s !== undefined) cur.state = plus.s;
        if (plus.a) {
          Object.keys(plus.a).forEach(function (k) { cur.attributes[k] = plus.a[k]; });
        }
      }
      if (delta['-'] && delta['-'].a) {
        delta['-'].a.forEach(function (k) { delete cur.attributes[k]; });
      }
      states[id] = cur;
    });
  }

  function handleEvent(ev) {
    if (!ev) return;
    if (ev.a) applyAdded(ev.a);
    if (ev.c) applyChanged(ev.c);
    if (ev.r) ev.r.forEach(function (id) { delete states[id]; });
    emitUpdate();
  }

  /* ── Keepalive ──────────────────────────────────────── */
  function clearPing() {
    clearTimeout(pingTimer);
    clearTimeout(pongTimer);
    pingTimer = pongTimer = null;
    pendingPingId = null;
  }

  function schedulePing() {
    clearPing();
    pingTimer = setTimeout(function () {
      pendingPingId = send({ type: 'ping' });
      if (pendingPingId === null) return;
      pongTimer = setTimeout(function () {
        // Socket is open but HA stopped answering — Tailscale
        // most likely dropped underneath us.
        console.warn('[ha] pong timeout, forcing reconnect');
        if (socket) socket.close();
      }, PING_TIMEOUT);
    }, PING_INTERVAL);
  }

  /* ── Connection lifecycle ───────────────────────────── */
  function scheduleReconnect() {
    clearTimeout(reconnectTimer);
    // Jitter avoids every reconnect landing on the same tick
    // if HA and the Pi come back at once.
    var delay = backoff + Math.random() * 1000;
    reconnectTimer = setTimeout(connect, delay);
    backoff = Math.min(backoff * 2, BACKOFF_MAX);
  }

  function connect() {
    var cfg = global.HA_CONFIG;
    if (!cfg || !cfg.url || !cfg.token || /PASTE_YOUR/.test(cfg.token)) {
      setStatus('unconfigured');
      console.error('[ha] js/config.js is missing or still has the placeholder token.');
      return;
    }

    clearTimeout(reconnectTimer);

    // Drop any previous socket first, otherwise a reconnect that races
    // a half-open one leaves two live sockets pushing into the store.
    if (socket) {
      socket.onclose = socket.onmessage = socket.onerror = null;
      try { socket.close(); } catch (e) { /* already closing */ }
      socket = null;
    }
    clearPing();
    setStatus('connecting');

    var wsUrl = cfg.url.replace(/^http/, 'ws').replace(/\/$/, '') + '/api/websocket';
    try {
      socket = new WebSocket(wsUrl);
    } catch (err) {
      console.error('[ha] could not open socket', err);
      scheduleReconnect();
      return;
    }

    socket.addEventListener('message', function (raw) {
      var msg;
      try { msg = JSON.parse(raw.data); } catch (e) { return; }

      switch (msg.type) {
        case 'auth_required':
          socket.send(JSON.stringify({ type: 'auth', access_token: cfg.token }));
          break;

        case 'auth_ok':
          backoff = BACKOFF_MIN;
          setStatus('connected');
          states = Object.create(null);
          send({ type: 'subscribe_entities', entity_ids: global.ALL_ENTITY_IDS });
          schedulePing();
          break;

        case 'auth_invalid':
          // A bad token will never fix itself — stop retrying.
          setStatus('auth_failed', msg.message);
          console.error('[ha] auth rejected:', msg.message);
          socket.close();
          socket = null;
          return;

        case 'pong':
          if (msg.id === pendingPingId) schedulePing();
          break;

        case 'event':
          handleEvent(msg.event);
          schedulePing();
          break;

        case 'result':
          if (!msg.success) console.warn('[ha] call failed', msg.error);
          break;
      }
    });

    socket.addEventListener('close', function () {
      clearPing();
      if (status === 'auth_failed') return;
      setStatus('disconnected');
      scheduleReconnect();
    });

    socket.addEventListener('error', function () {
      // 'close' always follows, which is where reconnect is handled.
      console.warn('[ha] socket error');
    });
  }

  /* ── Public surface ─────────────────────────────────── */
  global.HA = {
    connect: connect,

    status: function () { return status; },
    isConnected: function () { return status === 'connected'; },

    /* Returns { state, attributes } or null if not yet known. */
    get: function (entityId) { return states[entityId] || null; },

    /* Convenience: state string, or null. */
    stateOf: function (entityId) {
      var e = states[entityId];
      return e ? e.state : null;
    },

    attr: function (entityId, name) {
      var e = states[entityId];
      return e && e.attributes ? e.attributes[name] : undefined;
    },

    callService: function (domain, service, data) {
      return send({
        type: 'call_service',
        domain: domain,
        service: service,
        service_data: data || {}
      });
    },

    /* Fire an HA script by its full entity_id. */
    runScript: function (scriptEntityId) {
      var name = scriptEntityId.replace(/^script\./, '');
      return global.HA.callService('script', name, {});
    },

    onUpdate: function (fn) { updateHandlers.push(fn); },
    onStatus: function (fn) { statusHandlers.push(fn); fn(status); },

    /* Debug helper — run HA.dump() in the browser console to see
       exactly what HA is reporting for every wired entity. */
    dump: function () {
      var out = {};
      global.ALL_ENTITY_IDS.forEach(function (id) {
        out[id] = states[id] || '(not received)';
      });
      console.log(JSON.stringify(out, null, 2));
      return out;
    }
  };
})(window);
