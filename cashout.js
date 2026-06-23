'use strict';
/**
 * cashout.js — The Turrelle Sisters Big Munny
 * v8.2.3 — Virtual Wallet: Supabase-backed vouchers
 * Vouchers stored in Supabase (gdmmoeggkqsvqnqyrubx).
 * Falls back to localStorage if Supabase unavailable.
 * NOT redeemable for real cash — entertainment purposes only.
 */

var CashOut = (function() {
  var CASINO_NAME    = 'Gold Coins Casino';
  var GAME_SLUG      = 'tsbigmunny';
  var LOBBY_URL      = 'https://theturrellesisters.github.io/turrelle_gold_coins_casino/';
  var SB_URL         = 'https://gdmmoeggkqsvqnqyrubx.supabase.co';
  var SB_ANON        = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkbW1vZWdna3FzdnFucXlydWJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4MDYzNTQsImV4cCI6MjA5NjM4MjM1NH0.i86afL3CMpmru4z3LZAbCJkxBiwo25QbwEji8tDBAis';

  /* Keep localStorage key for offline fallback */
  var VOUCHER_KEY_LS = 'turrelleSisters_vouchers_v1';

  /* Zero-balance flash timers */
  var insertCashFlashInterval = null;
  var insertCashFlashTimer    = null;

  /* ── Supabase fetch helper ── */
  function _sbFetch(path, opts) {
    var url     = SB_URL + '/rest/v1/' + path;
    var headers = {
      'apikey':        SB_ANON,
      'Authorization': 'Bearer ' + SB_ANON,
      'Content-Type':  'application/json',
      'Prefer':        opts.prefer || 'return=representation'
    };
    return fetch(url, {
      method:  opts.method || 'GET',
      headers: headers,
      body:    opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function(r) {
      if (opts.prefer === 'return=minimal') return {};
      return r.json();
    });
  }

  function _nick() {
    return ((window._playerNickname || '')).toLowerCase().trim();
  }

  function _fmt(v) {
    var n = parseFloat(v);
    if (isNaN(n) || n < 0) n = 0;
    return '$' + n.toFixed(2);
  }

  function _lobbyUrl() {
    try {
      var ref = document.referrer;
      if (ref && ref.indexOf('theturrellesisters.github.io') !== -1) return ref;
    } catch(e) {}
    return LOBBY_URL;
  }

  /* ── Timestamp ── */
  function formatTimestamp(ts) {
    var d = new Date(ts);
    function pad(n) { var s = String(n); return s.length < 2 ? '0' + s : s; }
    return pad(d.getMonth()+1)+'/'+pad(d.getDate())+'/'+String(d.getFullYear()).slice(-2)+
           ' '+pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds());
  }

  /* ── localStorage fallback ── */
  function _lsLoadVouchers() {
    try { var r = localStorage.getItem(VOUCHER_KEY_LS); return r ? JSON.parse(r) : []; }
    catch(e) { return []; }
  }
  function _lsSaveVouchers(v) {
    try { localStorage.setItem(VOUCHER_KEY_LS, JSON.stringify(v)); } catch(e) {}
  }

  /* ── Supabase: load wallet balance ── */
  function _loadWalletBal(cb) {
    var n = _nick();
    if (!n || typeof fetch === 'undefined') { cb(0); return; }
    _sbFetch('wallet?select=balance&nickname=eq.' + encodeURIComponent(n), {})
      .then(function(d) { cb(d && d[0] ? parseFloat(d[0].balance) || 0 : 0); })
      .catch(function() { cb(0); });
  }

  /* ── Supabase: upsert wallet balance ── */
  function _upsertWalletBal(newBal, cb) {
    var n = _nick();
    if (!n || typeof fetch === 'undefined') { if (cb) cb(false); return; }
    _sbFetch('wallet', {
      method:  'POST',
      prefer:  'resolution=merge-duplicates,return=minimal',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body:    { nickname: n, balance: newBal }
    })
    .then(function() { if (cb) cb(true); })
    .catch(function() { if (cb) cb(false); });
  }

  /* ── Supabase: insert voucher ── */
  function _insertVoucher(amount, sourceGame, cb) {
    var n = _nick();
    if (!n || typeof fetch === 'undefined') { if (cb) cb(false, null); return; }
    _sbFetch('vouchers', {
      method: 'POST',
      body:   { nickname: n, amount: amount, status: 'available', source_game: sourceGame }
    })
    .then(function(d) {
      var v = d && d[0] ? d[0] : null;
      if (cb) cb(true, v);
    })
    .catch(function() { if (cb) cb(false, null); });
  }

  /* ── Supabase: load available vouchers ── */
  function _loadVouchers(cb) {
    var n = _nick();
    if (!n || typeof fetch === 'undefined') {
      /* Fallback: localStorage */
      var lsv = _lsLoadVouchers().filter(function(v) { return v.status === 'active'; });
      cb(lsv, false); return;
    }
    _sbFetch('vouchers?select=id,amount,source_game,created_at' +
      '&nickname=eq.' + encodeURIComponent(n) +
      '&status=eq.available&order=created_at.desc', {})
    .then(function(d) { cb(d || [], true); })
    .catch(function() {
      var lsv = _lsLoadVouchers().filter(function(v) { return v.status === 'active'; });
      cb(lsv, false);
    });
  }

  /* ── Supabase: redeem voucher ── */
  function _redeemVoucherSB(voucherId, cb) {
    _sbFetch('vouchers?id=eq.' + voucherId, {
      method:  'PATCH',
      prefer:  'return=minimal',
      headers: { 'Prefer': 'return=minimal' },
      body:    { status: 'redeemed', redeemed_at: new Date().toISOString() }
    })
    .then(function() { if (cb) cb(true); })
    .catch(function() { if (cb) cb(false); });
  }

  /* ── CASH OUT ── */
  function doCashOut() {
    if (GameState.spinInProgress || GameState.activeBonus) {
      UI.showToast('Finish current game before cashing out.');
      return;
    }
    var amount = GameState.balance;
    if (amount <= 0) {
      UI.showToast('No credits to cash out.');
      return;
    }

    var amountRounded = Math.round(amount * 100) / 100;
    var n = _nick();

    /* Build the voucher display data for the modal */
    var now       = Date.now();
    var issuedStr = formatTimestamp(now);

    /* Zero the balance immediately */
    GameState.balance = 0;
    saveState();
    logEvent('CASH_OUT', {
      bonusType: 'CASH_OUT', amount: amountRounded,
      issuedStr: issuedStr, balanceAfter: 0
    });
    if (typeof UI !== 'undefined') UI.updateBalance(0);
    Audio && Audio.play('credit_sweep');

    /* Show voucher modal immediately with local data */
    _showVoucherModalLocal(amountRounded, issuedStr);

    /* Async: create voucher + update wallet in Supabase */
    if (n && typeof fetch !== 'undefined') {
      _insertVoucher(amountRounded, GAME_SLUG, function(ok, sbVoucher) {
        if (!ok) {
          /* Fallback: save to localStorage */
          var lsVouchers = _lsLoadVouchers();
          lsVouchers.unshift({
            id: 'LOCAL-' + now, amount: amountRounded,
            issuedAt: now, issuedStr: issuedStr, status: 'active'
          });
          _lsSaveVouchers(lsVouchers);
          return;
        }
        /* Update wallet balance: fetch current + add amount */
        _loadWalletBal(function(cur) {
          _upsertWalletBal(cur + amountRounded, null);
        });
      });
    } else {
      /* No Supabase — localStorage fallback */
      var lsVouchers = _lsLoadVouchers();
      lsVouchers.unshift({
        id: 'LOCAL-' + now, amount: amountRounded,
        issuedAt: now, issuedStr: issuedStr, status: 'active'
      });
      _lsSaveVouchers(lsVouchers);
    }
  }

  /* Show voucher modal using local data (no Supabase wait) */
  function _showVoucherModalLocal(amount, issuedStr) {
    var modal = document.getElementById('voucher-modal');
    if (!modal) return;
    document.getElementById('vm-casino').textContent  = CASINO_NAME;
    document.getElementById('vm-amount').textContent  = _fmt(amount);
    var issuedEl = document.getElementById('vm-issued');
    if (issuedEl) issuedEl.textContent = issuedStr;
    var idEl = document.getElementById('vm-id');
    if (idEl) idEl.textContent = 'GCC-' + Date.now().toString(36).toUpperCase();
    var serialEl = document.getElementById('vm-serial');
    if (serialEl) serialEl.textContent = '---';
    /* Regenerate barcode */
    var bars = document.getElementById('vm-barcode');
    if (bars) {
      bars.innerHTML = '';
      var seed = amount * 1000;
      for (var bi = 0; bi < 40; bi++) {
        var bar = document.createElement('div');
        var w = ((seed * (bi+7) * 13) % 3) + 1;
        bar.style.cssText = 'display:inline-block;width:'+w+'px;height:40px;background:#000;margin:0 0.5px;vertical-align:top;';
        bars.appendChild(bar);
      }
    }
    modal.classList.add('active');
  }

  /* ── JACKPOT CASH OUT ── */
  function doCashOutAmount(amount, label) {
    var amountRounded = Math.round(amount * 100) / 100;
    var now       = Date.now();
    var issuedStr = formatTimestamp(now);
    var n = _nick();
    logEvent('JACKPOT_CASHOUT', {
      bonusType: 'JACKPOT_CASHOUT', amount: amountRounded, label: label || 'JACKPOT'
    });
    if (typeof UI !== 'undefined') UI.showToast('Jackpot ' + _fmt(amountRounded) + ' saved to wallet!', 3000);
    if (n && typeof fetch !== 'undefined') {
      _insertVoucher(amountRounded, GAME_SLUG, function(ok) {
        if (!ok) return;
        _loadWalletBal(function(cur) { _upsertWalletBal(cur + amountRounded, null); });
      });
    }
  }

  /* ── INSERT CASH ── */
  function doInsertCash() {
    var walletModal = document.getElementById('wallet-modal');
    var listEl      = document.getElementById('wallet-list');
    if (!walletModal || !listEl) return;

    /* Show modal with loading state */
    listEl.innerHTML = '<div class="wallet-empty">Loading wallet\u2026</div>';
    walletModal.classList.add('active');

    /* Also load wallet balance into subtitle */
    var subtitleEl = document.getElementById('wallet-subtitle');
    _loadWalletBal(function(bal) {
      if (subtitleEl) subtitleEl.textContent = 'Wallet balance: ' + _fmt(bal);
    });

    /* Load vouchers */
    _loadVouchers(function(vouchers, fromSupabase) {
      listEl.innerHTML = '';
      var gameLabels = {
        'tsbigmunny':'Turrelle Sisters','straypups_1d':'StrayPups $1',
        'straypups_5d':'StrayPups $5','maxines':"Maxine's",'lobby':'Lobby'
      };
      if (!vouchers || !vouchers.length) {
        listEl.innerHTML = '<div class="wallet-empty">No vouchers available.<br><span>Return to lobby to generate one.</span></div>';
        return;
      }
      vouchers.forEach(function(v) {
        var row       = document.createElement('div');
        row.className = 'wallet-row';
        var vid       = fromSupabase ? v.id : v.id; /* same field */
        var dateStr   = fromSupabase
          ? (function(){ var d=new Date(v.created_at); return d.toLocaleDateString()+', '+d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}); }())
          : (v.issuedStr || '');
        var gameLbl   = fromSupabase
          ? (gameLabels[v.source_game] || v.source_game || 'Lobby')
          : 'Saved Voucher';
        row.innerHTML =
          '<div class="wallet-info">' +
            '<div class="wallet-id">' + gameLbl + '</div>' +
            '<div class="wallet-date">' + dateStr + '</div>' +
          '</div>' +
          '<div class="wallet-amount">' + _fmt(v.amount) + '</div>' +
          '<button class="wallet-use-btn" onclick="CashOut.redeemVoucher(\'' + vid + '\',' + (fromSupabase ? 'true' : 'false') + ',' + v.amount + ')">INSERT</button>';
        listEl.appendChild(row);
      });
    });
  }

  /* ── REDEEM VOUCHER ── */
  function redeemVoucher(voucherId, fromSupabase, amount) {
    /* Support legacy single-arg call from old HTML onclick */
    if (arguments.length === 1) {
      /* Legacy path: localStorage */
      _redeemVoucherLegacy(voucherId);
      return;
    }

    var listEl = document.getElementById('wallet-list');
    if (listEl) listEl.innerHTML = '<div class="wallet-empty">Loading\u2026</div>';

    if (fromSupabase) {
      _redeemVoucherSB(voucherId, function(ok) {
        if (!ok) {
          if (listEl) listEl.innerHTML = '<div class="wallet-empty">Redemption failed. Try again.</div>';
          return;
        }
        var redeemAmount = parseFloat(amount) || 0;
        GameState.balance += redeemAmount;
        saveState();
        logEvent('CASH_IN', {
          bonusType: 'CASH_IN', voucherId: voucherId,
          amount: redeemAmount, balanceAfter: GameState.balance
        });
        if (typeof UI !== 'undefined') {
          UI.updateBalance(GameState.balance);
          UI.stopInsertCashTicker();
          UI.showToast('\ud83d\udcb3 ' + _fmt(redeemAmount) + ' loaded \u2014 Good Luck!', 2500);
        }
        hideWalletModal();
        if (typeof Audio !== 'undefined') Audio.play('win_small');
      });
    } else {
      _redeemVoucherLegacy(voucherId);
    }
  }

  function _redeemVoucherLegacy(voucherId) {
    var vouchers = _lsLoadVouchers();
    var idx = -1;
    for (var ri = 0; ri < vouchers.length; ri++) {
      if (vouchers[ri].id === voucherId && vouchers[ri].status === 'active') { idx = ri; break; }
    }
    if (idx < 0) { UI.showToast('Voucher not found or already used.'); return; }
    var voucher = vouchers[idx];
    voucher.status     = 'redeemed';
    voucher.redeemedAt = Date.now();
    _lsSaveVouchers(vouchers);
    GameState.balance += voucher.amount;
    saveState();
    logEvent('CASH_IN', {
      bonusType: 'CASH_IN', voucherId: voucher.id,
      amount: voucher.amount, balanceAfter: GameState.balance
    });
    if (typeof UI !== 'undefined') {
      UI.updateBalance(GameState.balance);
      UI.stopInsertCashTicker();
      UI.showToast('\ud83d\udcb3 ' + _fmt(voucher.amount) + ' loaded \u2014 Good Luck!', 2500);
    }
    hideWalletModal();
    if (typeof Audio !== 'undefined') Audio.play('win_small');
  }

  /* ── CREATE VOUCHER (from wallet modal) ── */
  function doCreateVoucher() {
    hideWalletModal();
    setTimeout(showCreateVoucherModal, 150);
  }

  function showCreateVoucherModal() {
    var modal = document.getElementById('create-voucher-modal');
    if (modal) modal.classList.add('active');
  }

  function hideCreateVoucherModal() {
    var modal = document.getElementById('create-voucher-modal');
    if (modal) modal.classList.remove('active');
    var input = document.getElementById('cv-amount-input');
    if (input) input.value = '';
    var err = document.getElementById('cv-error');
    if (err) err.style.display = 'none';
  }

  function confirmCreateVoucher() {
    var input  = document.getElementById('cv-amount-input');
    if (!input) return;
    var amount = parseFloat(input.value);
    if (isNaN(amount) || amount <= 0) {
      var err = document.getElementById('cv-error');
      if (err) { err.textContent = 'Please enter a valid amount'; err.style.display = 'block'; }
      return;
    }
    var amountRounded = Math.round(amount * 100) / 100;
    var n = _nick();
    hideCreateVoucherModal();
    if (n && typeof fetch !== 'undefined') {
      _insertVoucher(amountRounded, 'lobby', function(ok) {
        if (ok) {
          /* Deduct from wallet balance (honor system — may go negative) */
          _loadWalletBal(function(cur) { _upsertWalletBal(cur - amountRounded, null); });
        }
        if (typeof UI !== 'undefined') UI.showToast((ok ? 'Voucher ' : 'Voucher (offline) ') + _fmt(amountRounded) + ' ready!', 2000);
        /* Reopen wallet to show new voucher */
        setTimeout(function() { doInsertCash(); }, 300);
      });
    } else {
      /* localStorage fallback */
      var now = Date.now();
      var lsVouchers = _lsLoadVouchers();
      lsVouchers.unshift({
        id: 'LOCAL-' + now, amount: amountRounded,
        issuedAt: now, issuedStr: formatTimestamp(now), status: 'active'
      });
      _lsSaveVouchers(lsVouchers);
      if (typeof UI !== 'undefined') UI.showToast('Voucher ' + _fmt(amountRounded) + ' ready!', 2000);
      setTimeout(function() { doInsertCash(); }, 300);
    }
  }

  /* ── VOUCHER MODAL ── */
  function hideVoucherModal() {
    var vm = document.getElementById('voucher-modal');
    if (vm) vm.classList.remove('active');
  }

  /* ── WALLET MODAL ── */
  function hideWalletModal() {
    var wm = document.getElementById('wallet-modal');
    if (wm) wm.classList.remove('active');
  }

  /* ── EXIT → LOBBY ── */
  function doExit() {
    window.location.href = _lobbyUrl();
  }

  /* ── ZERO BALANCE FLASH ── */
  function startZeroBalanceFlash() {
    stopZeroBalanceFlash();
    _flashMessage();
    insertCashFlashInterval = setInterval(function() {
      if (GameState.balance <= 0) _flashMessage();
      else stopZeroBalanceFlash();
    }, 5000);
  }

  function _flashMessage() {
    var el = document.getElementById('zero-balance-msg');
    if (!el) return;
    el.classList.add('visible');
    clearTimeout(insertCashFlashTimer);
    insertCashFlashTimer = setTimeout(function() { el.classList.remove('visible'); }, 2500);
  }

  function stopZeroBalanceFlash() {
    clearInterval(insertCashFlashInterval);
    clearTimeout(insertCashFlashTimer);
    var el = document.getElementById('zero-balance-msg');
    if (el) el.classList.remove('visible');
  }

  function checkZeroBalance() {
    if (GameState.balance <= 0) startZeroBalanceFlash();
    else stopZeroBalanceFlash();
  }

  /* ── INIT ── */
  function init() {
    var _cb = document.getElementById('cashout-btn');
    if (_cb) _cb.addEventListener('click', doCashOut);

    var _icb = document.getElementById('insertcash-btn');
    if (_icb) _icb.addEventListener('click', doInsertCash);

    var _eb = document.getElementById('exit-btn');
    if (_eb) _eb.addEventListener('click', doExit);

    var _cvc = document.getElementById('create-voucher-btn');
    if (_cvc) _cvc.addEventListener('click', doCreateVoucher);

    var _cvconf = document.getElementById('cv-confirm');
    if (_cvconf) _cvconf.addEventListener('click', confirmCreateVoucher);

    var _cvcan = document.getElementById('cv-cancel');
    if (_cvcan) _cvcan.addEventListener('click', hideCreateVoucherModal);

    /* Voucher modal buttons */
    var _vmc = document.getElementById('vm-close');
    if (_vmc) _vmc.addEventListener('click', function() {
      hideVoucherModal();
      /* v8.2.3: return to lobby after voucher dismissed */
      setTimeout(doExit, 400);
    });

    var _vmp = document.getElementById('vm-print');
    if (_vmp) _vmp.addEventListener('click', function() {
      hideVoucherModal();
      UI.showToast('Voucher saved to wallet \u2713', 2000);
      /* v8.2.3: return to lobby after brief confirmation */
      setTimeout(doExit, 2200);
    });

    var _wc = document.getElementById('wallet-close');
    if (_wc) _wc.addEventListener('click', hideWalletModal);

    /* Clear stale overlay/modal states */
    var staleOverlays = [
      'voucher-modal','wallet-modal','jackpot-overlay',
      'pick-screen','op-overlay','pin-overlay','log-screen'
    ];
    staleOverlays.forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.classList.remove('active');
    });
  }

  /* v8.1.58 factory reset support */
  function clearAllVouchers() {
    try { localStorage.removeItem(VOUCHER_KEY_LS); } catch(e) {}
  }

  return {
    init:                  init,
    doCashOut:             doCashOut,
    doCreateVoucher:       doCreateVoucher,
    doCashOutAmount:       doCashOutAmount,
    doInsertCash:          doInsertCash,
    redeemVoucher:         redeemVoucher,
    checkZeroBalance:      checkZeroBalance,
    startZeroBalanceFlash: startZeroBalanceFlash,
    stopZeroBalanceFlash:  stopZeroBalanceFlash,
    loadVouchers:          _lsLoadVouchers,
    clearAllVouchers:      clearAllVouchers,
    doExit:                doExit,
  };
}());
