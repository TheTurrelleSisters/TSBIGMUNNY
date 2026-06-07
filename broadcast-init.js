/*
 * broadcast-init.js — Turrelle Sisters Big Munny
 * v1.0 — Wires Progressive.onMessage so operator broadcast messages
 *         reach players as a persistent gold toast overlay.
 *         Also wires onForceNotify (ATTITUDE CHECK).
 *
 * DROP THIS FILE: TSBIGMUNNY/ root (same folder as progressive.js)
 *
 * ADD ONE LINE to index.html, immediately after the <script> tag
 * that loads progressive.js:
 *
 *   <script src="broadcast-init.js?v=1.0"></script>
 *
 * That is the ONLY change needed to index.html.
 * No other files are modified.
 *
 * ES5 only. No const/let/arrow functions/backticks.
 */

(function () {

  /* ── Broadcast toast overlay ─────────────────────────────────────── */
  function showBroadcastToast(body, title) {
    var DURATION_MS = 12000;
    var el = document.getElementById('broadcast-toast');

    if (!el) {
      el = document.createElement('div');
      el.id = 'broadcast-toast';
      el.style.cssText = [
        'position:fixed',
        'bottom:90px',
        'left:50%',
        'transform:translateX(-50%)',
        'background:rgba(10,10,30,0.96)',
        'color:#ffd700',
        'border:2px solid #ffd700',
        'border-radius:10px',
        'padding:14px 20px',
        'max-width:88vw',
        'width:340px',
        'font-size:14px',
        'line-height:1.45',
        'text-align:center',
        'z-index:9999',
        'box-shadow:0 4px 24px rgba(0,0,0,0.85)',
        'cursor:pointer',
        'display:none'
      ].join(';');
      document.body.appendChild(el);
    }

    var html = '';
    if (title) {
      html += '<div style="font-weight:bold;font-size:15px;margin-bottom:6px;">'
            + title + '</div>';
    }
    html += '<div>' + body + '</div>';
    html += '<div style="margin-top:8px;font-size:11px;color:#aaa;">(tap to dismiss)</div>';
    el.innerHTML = html;
    el.style.display = 'block';

    el.onclick = function () {
      clearTimeout(el._timer);
      el.style.display = 'none';
    };

    clearTimeout(el._timer);
    el._timer = setTimeout(function () {
      el.style.display = 'none';
    }, DURATION_MS);
  }

  /* ── Wait for Progressive to be available, then wire handlers ────── */
  function wireProgressiveHandlers() {
    if (typeof Progressive === 'undefined' || typeof Progressive.onMessage !== 'function') {
      /* progressive.js not loaded yet — retry in 200ms */
      setTimeout(wireProgressiveHandlers, 200);
      return;
    }

    /* Broadcast messages — operator announcements */
    Progressive.onMessage(function (msg) {
      if (!msg || !msg.message) return;
      showBroadcastToast(msg.message, msg.title || '');
    });

    /* ATTITUDE CHECK — another device just won */
    Progressive.onForceNotify(function (amt, gameId) {
      var label = gameId && gameId !== 'unknown' ? gameId : 'another game';
      var text = '\u2605 JACKPOT HIT on ' + label + '! $' + amt.toFixed(2);
      /* Use UI.showToast if available, else fall back to broadcast overlay */
      if (typeof UI !== 'undefined' && typeof UI.showToast === 'function') {
        UI.showToast(text);
      } else {
        showBroadcastToast(text, '');
      }
    });

    console.log('[broadcast-init] handlers wired to Progressive v' +
      (Progressive.getSessionKey ? 'ok' : '?'));
  }

  /* Start wiring as soon as this script executes */
  wireProgressiveHandlers();

}());
