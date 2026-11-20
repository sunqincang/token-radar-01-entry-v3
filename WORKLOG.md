# token-radar-01 v3 — work log

Started 2026-11-19, per RADAR-V3-PLAN.md and R's decision to push for a prize. Scope:
develop, test and evaluate ONLY. No submission to make.fun, no push to GitHub. v1 repo
(`../radar-repo`) and v2 repo (`../radar-repo-v2`) untouched — this build is a copy of
v2, evolved. Model version: radar-3 → **radar-4**.

Baseline (before any edit):
- Copied `radar-repo-v2` → `radar-repo-v3` (plain recursive copy; `cp -a` failed on
  ownership preservation, content identical).
- Snapshot pre-research (from the plan, re-verified at runtime by the fit itself):
  758 protocols, fitting pool 128 (mcap_usd > 0 and tvl_usd > 0), log10(mcap/TVL)
  median ≈ −0.670, corr(logTVL, log multiple) ≈ −0.409.

## Log

- 2026-11-19: replaced the hand-set multiple with a two-stage FITTED model in
  lib/model.ts, all fitted at runtime from the snapshot's own pool:
  - Stage 1: per-category median of log10(mcap/TVL), shrunk toward the pool's global
    median with the same weight (6) v1–v3 used in ratio space.
  - Stage 2: one least-squares slope of the stage-1 residuals on centred log10(TVL).
    Fitted slope on this snapshot: **−0.3890** per decade of TVL (correlation −0.4093).
  - Predictions clamped to the pool's observed log-multiple range [−3.5987, 2.6023]:
    the fit never extrapolates past its own market. The ×3.00 cap is gone.
  - Growth and maturity kept as priors at HALF of radar-3's strength (growth weight
    0.5 → 0.25; maturity 0.6–1.0 → 0.8–1.0), documented in code as priors, not fit.
- Validation, computed at runtime into the evidence file (never hand-written):
  - Time fold (walk-forward): fit on the earlier-listed half of the 95 dated pool
    members (48 train), tested on the later half (47). The 33 undated members cannot
    be time-ordered and are excluded from this fold — stated in the evidence itself.
  - Parity fold: slug order, even indices train (64), odd test (64) — covers all 128.
  - Time fold, median |log10 error|: **fitted 0.5088** vs category-only 0.7167 vs
    global-median 0.7251; within-2x 27.7% / 19.1% / 21.3%; within-3x 46.8% / 34.0% /
    31.9%. Parity fold tells the same story (0.5582 vs 0.7087 / 0.7086).
  - Interval: time-fold residual p25 −0.5109 / p75 +0.4787 → every board row carries
    implied_low = round(implied × 0.3084), implied_high = round(implied × 3.0112),
    derived from the printed implied so the interval recomputes from printed figures.
- Board/data schema: additive only — rows gained implied_low_usd / implied_high_usd
  and model.category_multiple / model.size_multiplier (the fitted decomposition);
  RadarData gained a fit summary (pool size, slope, correlation, holdout error,
  residual percentiles). Farm plans unchanged from v2 (1,493 steps, 292 with Risk).
- Evidence file (z-model-evidence.md) rewritten around the fit: model statement, fit
  summary, per-category stage-1 table in log space (34 categories), the full
  validation section, and the 53 detail lines now carrying category_log, size_adj and
  the interval. 29,747 bytes; dossier text 51,863 of the 65,536 cap with the evidence
  verbatim and untruncated.
- Dashboard: masthead note rewritten ("fitted not hand-set", with the fit's real
  numbers); board's implied cell shows the holdout range under each value; detail
  formula decomposes the multiple (category × size) and states the holdout range;
  chips gained Category base, Size effect and Holdout range. app.css gained one rule
  (.implied .range).
- Screenshots regenerated with shoot-v3.py (shoot-v2.py with v3 paths; the system
  python had no playwright, so it ran under a throwaway venv against the pre-cached
  Chromium — same 1440×900 viewport and the same three captures): 1-board 216,960 B,
  2-detail 220,481 B (scroll 0: name, decomposed formula, chips incl. holdout range,
  farm steps), 3-filtered 218,319 B (watchlist-only + Ethereum, 26 of 198).
- Acceptance (full record in ACCEPTANCE.md): two fresh pipeline runs sha256-identical
  across all 10 output files; 27/27 independent scripted checks pass (second
  implementation in ../check-v3.mjs, no repo imports — full-board recompute exact on
  all 198 rows, evidence parse-back exact, validation metrics matched to 1e-9);
  official kit check mirrors v2's runs (see ACCEPTANCE.md for the one honest caveat
  about the stale v1 transcript bundle).
- v2 → v3 board diff: 198 rows in both; **all 198 implied values changed** (a new
  model, not a restatement); top-10 overlap 8 of 10 — v3: steakhouse-financial,
  sentora-curator, gauntlet, polymarket-international, usdd, nonce-capital,
  bitfi-basis, bittensor-dtao, rockawayx, veda.
- v1 and v2 repos verified untouched at the end (v1 git status clean; v2 file
  timestamps still its own build's). Nothing submitted, nothing pushed. Stops here
  for the submission decision, which needs the v3 build sessions bundled.
