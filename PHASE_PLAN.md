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
