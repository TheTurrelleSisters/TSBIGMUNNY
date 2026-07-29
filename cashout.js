'use strict';
/**
 * cashout.js — The Turrelle Sisters Big Munny
 * v8.2.9 — delegates to WalletUI (wallet_module.js)
 */
var CashOut = (function() {
  var LOBBY_URL = 'https://theturrellesisters.github.io/turrelle_gold_coins_casino/';
  function _lobbyUrl() {
    try { var r=document.referrer; if(r&&r.indexOf('theturrellesisters')!==-1) return r; } catch(e){}
    return LOBBY_URL;
  }

  function doCashOut() {
    if (GameState.spinInProgress||GameState.activeBonus) {
      UI.showToast('Finish current game before cashing out.'); return;
    }
    var amt = Math.round((GameState.balance||0)*100)/100;
    if (amt<=0) { UI.showToast('No credits to cash out.'); return; }
    GameState.balance=0; saveState();
    logEvent('CASH_OUT',{bonusType:'CASH_OUT',amount:amt,balanceAfter:0});
    if (typeof _writeGameHistory === 'function')
      _writeGameHistory({ type:'CASH_OUT', amount:amt, balBefore:amt, balAfter:0 });
    if (typeof UI!=='undefined') UI.updateBalance(0);
    if (typeof Audio!=='undefined') Audio.play('credit_sweep');
    WalletUI.cashOut(function(ok) {
      if (typeof UI!=='undefined')
        UI.showToast('CASHED OUT $'+amt.toFixed(2)+(ok?' • SAVED TO WALLET':''),2500);
      /* Cash out saved — player stays in game */
    });
  }

  function doInsertCash() { WalletUI.open(); }

  function doExit() {
    if ((GameState.balance||0)>0) {
      WalletUI.forceSave();
      setTimeout(function(){ window.location.href=_lobbyUrl(); },1200);
    } else { window.location.href=_lobbyUrl(); }
  }

  function doCashOutAmount(amount,label) {
    var amt=Math.round(parseFloat(amount)*100)/100;
    logEvent('JACKPOT_CASHOUT',{bonusType:'JACKPOT_CASHOUT',amount:amt,label:label||'JACKPOT'});
    WalletUI.cashOut(function(ok){
      if(typeof UI!=='undefined') UI.showToast('Jackpot saved to wallet!',3000);
    });
  }

  var _fi=null,_ft=null;
  function startZeroBalanceFlash(){
    stopZeroBalanceFlash(); _fm();
    _fi=setInterval(function(){ if(GameState.balance<=0) _fm(); else stopZeroBalanceFlash(); },5000);
  }
  function _fm(){
    var el=document.getElementById('zero-balance-msg'); if(!el) return;
    el.classList.add('visible'); clearTimeout(_ft);
    _ft=setTimeout(function(){ el.classList.remove('visible'); },2500);
  }
  function stopZeroBalanceFlash(){
    clearInterval(_fi); clearTimeout(_ft);
    var el=document.getElementById('zero-balance-msg'); if(el) el.classList.remove('visible');
  }
  function checkZeroBalance(){
    if(GameState.balance<=0) startZeroBalanceFlash(); else stopZeroBalanceFlash();
  }

  function init() {
    var cb=document.getElementById('cashout-btn');   if(cb)  cb.addEventListener('click',doCashOut);
    var ib=document.getElementById('insertcash-btn');if(ib)  ib.addEventListener('click',doInsertCash);
    var eb=document.getElementById('exit-btn');      if(eb)  eb.addEventListener('click',doExit);
    /* v8.4.1: 'voucher-modal' and 'wallet-modal' dropped — the pre-Supabase
       voucher-machine markup they referred to has been removed. */
    ['jackpot-overlay','pick-screen','op-overlay','pin-overlay','log-screen'].forEach(function(id){
      var el=document.getElementById(id); if(el) el.classList.remove('active');
    });
  }

  function clearAllVouchers(){
    try { localStorage.removeItem('turrelleSisters_vouchers_v1'); } catch(e){}
  }

  /* loadVouchers: legacy API kept for game.js compatibility.
     Vouchers are now in Supabase — return [] so the startup balance
     restore logic works correctly (no localStorage vouchers = restore balance). */
  function loadVouchers() { return []; }

  return {
    init:init, doCashOut:doCashOut, doInsertCash:doInsertCash, doExit:doExit,
    doCashOutAmount:doCashOutAmount, checkZeroBalance:checkZeroBalance,
    startZeroBalanceFlash:startZeroBalanceFlash, stopZeroBalanceFlash:stopZeroBalanceFlash,
    clearAllVouchers:clearAllVouchers,
    loadVouchers:loadVouchers,
  };
}());
