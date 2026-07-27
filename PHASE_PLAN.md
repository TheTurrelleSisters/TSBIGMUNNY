# TSBIGMUNNY — Phase Plan

The Turrelle Sisters Big Munny (Class III slot machine, game_id 'turrelle').
Pays via reel symbols / payline patterns (not bingo patterns). Shares the
SAME Supabase project (gdmmoeggkqsvqnqyrubx) and progressive pot
infrastructure as the StrayPups Big Munny bingo games. No WABC/ball-call
integration (Class III, not bingo) -- wabc.js present in this repo is not
part of this game's active flow and is out of scope for the changes below.

This is the first PHASE_PLAN entry for this repo (created v8.2.2).

---

### v8.2.2 (cache turrelle-v8.1.65) — Player presence fix + friendly game name

- **Player presence fix (ported from straypups bingo games v5.84/v5.86)**:
  Progressive.registerPlayer() was DEFINED in progressive.js but NEVER
  CALLED from game.js -- this game never created a player_registry row at
  all, so it was completely invisible to Progressive Operator's and Floor
  Manager's "Connected/Inactive" player counts and player lists.
  Additionally, progressive.js had no updateLastSpin()/
  touch_player_last_seen at all (older architecture, pre-v5.84).
    - progressive.js: added _joinedAt/_lastSpinTime/_lastSpinTrackTime/
      _TRACK_THROTTLE_MS vars; _subscribePresence now records _joinedAt;
      new updateLastSpin() (throttled to 30s) calls the existing
      touch_player_last_seen(p_session_key) RPC (created for the bingo
      games in v5.84, same Supabase project -- no new SQL needed) and
      re-tracks presence with the latest lastSpin timestamp. Exported.
    - game.js: at spin-start (same place Progressive.contribute(totalBet)
      already runs), now also calls
      Progressive.registerPlayer(null, window._playerNickname||null) and
      Progressive.updateLastSpin().
  Progressive Operator's and Floor Manager's player_registry queries are
  unfiltered by game_id, so this game's players (game_id='turrelle') are
  now automatically included in the global Connected/Inactive counts --
  no operator-tool code changes were needed for the counts themselves.

- **Friendly game-name update**: PROG_GAME_TITLES['turrelle'] changed from
  'Turrelle Sisters' to 'The Turrelle Sisters Big Munny' (feeds
  game_title in progressive_hits/progressive_commands). Companion rename
  in progressive_operator (v3.21), floor_manager (v1.10 -- new GAMES
  entry for 'turrelle'), and both bingo games (v5.87, for
  straypups_1d/5d -> 'Stray Pups Big Munny $1'/'$5').

- Version bump: GAME_VERSION v8.2.1 -> v8.2.2 (splash badge), CACHE_NAME
  turrelle-v8.1.64 -> turrelle-v8.1.65 (service-worker.js).

---

### On the horizon
- Phase 5 (per casino-wide phase plan maintained by Sasha): convert
  TSBIGMUNNY from a Class III slot machine to a bingo game. Not started.

---

### v8.2.3 — Virtual Wallet (Supabase) + Exit Button wired

#### Files changed
| File | Change |
|---|---|
| `cashout.js` | Full rewrite — Supabase wallet integration |
| `index.html` | `GAME_VERSION` v8.2.2→v8.2.3; all `?v=` bumped |
| `service-worker.js` | `CACHE_NAME` turrelle-v8.1.65→turrelle-v8.2.3 |
| `PHASE_PLAN.md` | This entry |
| `GAME_DESIGN_MANUAL.md` | Wallet section updated |

#### What changed in cashout.js

**Exit button wired:** `exit-btn` now calls `doExit()` which navigates to
`theturrellesisters.github.io/turrelle_gold_coins_casino/` (uses
`document.referrer` if available, canonical URL as fallback).

**Virtual wallet — Supabase integration:**
- `doCashOut()`: creates voucher in Supabase `vouchers` table
  (`source_game: 'tsbigmunny'`), increments `wallet.balance`, shows
  existing `#voucher-modal` with updated casino name ("Gold Coins Casino").
  After player taps "SAVE TO WALLET" → toast 2s → `doExit()` → lobby.
  After player taps "CLOSE" → `doExit()` → lobby immediately.
- `doInsertCash()`: loads available vouchers from Supabase by nickname,
  displays in `#wallet-modal` with source game label and date. Shows
  wallet balance in subtitle. Falls back to localStorage if offline.
- `redeemVoucher(id, fromSupabase, amount)`: marks voucher `redeemed`
  in Supabase; adds amount to `GameState.balance`. Legacy single-arg
  call (localStorage path) preserved for backward compatibility.
- `doCreateVoucher()` / `confirmCreateVoucher()`: creates voucher in
  Supabase `source_game:'lobby'`, deducts from wallet balance (honor
  system, may go negative per owner direction). Falls back to
  localStorage if offline.
- `doCashOutAmount()` (jackpot cash out): creates Supabase voucher for
  jackpot amount, increments wallet balance.
- localStorage fallback preserved throughout — all paths degrade
  gracefully if no nickname or no network.
- `VOUCHER_KEY_LS` retained — existing offline vouchers in localStorage
  remain redeemable via the legacy path.

#### Crash prevention checklist results
- `node --check` all runtime JS files: PASS (tools/red_spin_original_design_v6l64.js
  is an ES6+ archive tool, not a runtime file, not loaded by index.html — SKIP)
- `wc -c` all .js files: no zero-byte files
- `DENOM_CREDIT_LOCK` defined in paytable.js: not applicable (Class III, no denom lock)
- Brace balance in bonuses.js: PASS
- Reel sums: unchanged (no reel changes this build)
- Critical element IDs: cashout-btn, insertcash-btn, exit-btn, voucher-modal,
  wallet-modal, create-voucher-modal all present in index.html DOM: PASS

---

### v8.3.6 (cache turrelle-v8.3.6) — Full audit, tap hardening, error surfacing

Follows the run of fixes v8.3.0 -> v8.3.5. Operator force-triggers are TEST
ONLY: every rule below describes independent gameplay with no operator input.

#### Standing rules reaffirmed
- CACHE BUST EVERY DELIVERY. Bump the version, then apply it to EVERY local
  asset (js, css, images, audio, manifest), `GAME_VERSION`, SW `CACHE_NAME`
  AND the SW `VER` const. Never reuse a shipped version. Verify all `?v=`
  resolve to one value before packaging.
- Class III. No bingo card, no ball caller.
- Balance is funded ONLY from the virtual wallet. The game never grants credits.
- `cashout.js` must keep exporting `loadVouchers` — `index.html` calls it and a
  missing export kills the init chain, rendering every reel cell empty.
- The `$()` helper lives in `index.html`. Do not rewrite `$()` call sites.

#### Changed this build
- `game.js` — Red Spin catch now shows the real error text
  (`Red Spin error: <message>`, 6s) instead of the generic "Red Spin ended",
  which hid the fault and made it look like an unexplained freeze.
- `index.html` — new `_bindTap(el, label, handler)` binds BOTH `click` and
  `pointerup` with a 350 ms de-dupe. SPIN, BET MAX and SELECT LINES all use it.
  Samsung Browser drops `click` on some builds; this makes a tap always
  register. Each binding and firing logs to console (`[tap] ...`) so a dead
  button can be diagnosed on-device.
- `index.html` — global `error` and `unhandledrejection` handlers. Both toast
  the message; the rejection handler also clears `spinInProgress` / `activeBonus`
  and re-enables controls, so an async throw can no longer leave the game frozen.

#### Audit results (this build)
- `node --check` every runtime .js: PASS (12 files)
- All 9 inline `<script>` blocks parse: PASS
- Every `UI.*` call resolves to a UI export: PASS (45 exports)
- Every `Audio.*` call resolves to an Audio export: PASS
- Every `CashOut.*` call resolves to a cashout.js export: PASS
- Natural 5-Lipstick L1 trigger verified by sandbox execution: fires correctly
- BET MAX handler body executed in sandbox: no throw
  (creditsPerLine 10, lines 20, total bet $10.00 at 5c)

#### Open findings — NOT changed, awaiting owner decision
- `Audio.play('credit_sweep')` in cashout.js: the key `credit_sweep` appears
  nowhere in audio.js. Silent no-op on cash out.
- `wabc.js` is still loaded by index.html. Per this plan's own header it is not
  part of the Class III flow. Dead weight on every load.
- Unreferenced media: `assets/videos/josie_dance.mp4`, `sasha_dance.mp4`,
  `sasha_alt.mp4`. Not referenced by any JS/CSS/HTML.
- Uncalled functions: `closeLogScreen` (operator.js); `_formatCoinAmt`,
  `startInsertCashTicker`, `stopInsertCashTicker` (ui.js).
- Orphan DOM ids referenced in JS but absent from the DOM (each is null-guarded,
  so they are silent no-ops rather than crashes): `lines-display`,
  `total-bet-val`, `rs-tier-banner`, `prog-meter-lbl`, `broadcast-toast`,
  `help-music-btn`, `help-sfx-btn`, `help-vol-slider`, and the `op-*` set
  (`op-bal`, `op-bfreq`, `op-close`, `op-hold`, `op-jpct`, `op-maxwin`,
  `op-rtp`, `op-theoretical-rtp`).
