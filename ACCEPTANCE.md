# token-radar-01 v3 — acceptance record

Run 2026-11-19 against the real sealed snapshot
(`../token-radar-01-kit/input/snapshot.json`, as_of 2026-11-14, 758 protocols,
40 watchlist). Pipeline: `MAKEFUN_OUTPUT_DIR=<out> node main.ts --input <snapshot>`
(Node v24.22.1), run twice into two fresh output dirs. Development and evaluation
only — nothing was submitted to make.fun and nothing was pushed to GitHub.

## The fitted model, as fitted on this snapshot (all figures computed at runtime)

- Fitting pool: **128** protocols (mcap_usd > 0 and tvl_usd > 0), 95 with a recorded
  listing date, 33 without, across 34 categories.
- Global median of log10(mcap/TVL): −0.6703621616651823 (×0.2136). Mean log10(TVL)
  7.691125221503014. Observed log-multiple range [−3.5986669953065786,
  2.602281939421006] — predictions are clamped to it.
- Stage-2 size slope: **−0.3889921028375828** per decade of TVL; correlation between
  log10(TVL) and log10(mcap/TVL): **−0.4093448874001501**.

## Validation — walk-forward (fit on train, scored only on held-out rows)

Time fold (fit on the earlier-listed 48 of the 95 dated pool members, tested on the
later 47):

| predictor | median \|log10 err\| | within 2x | within 3x |
|---|---|---|---|
| fitted (both stages) | **0.5087606404661573** | 27.66% | 46.81% |
| category median only (radar-3 style) | 0.7166653484782384 | 19.15% | 34.04% |
| global median only | 0.7250503024119935 | 21.28% | 31.91% |

Parity fold (slug order, 64 train / 64 test, all 128 pool members covered):
fitted 0.558217117478753 (29.69% / 42.19%) vs category-only 0.7086749669650801
(29.69% / 35.94%) vs global-only 0.7086165975524575 (25.00% / 34.38%).

Interval residuals (time fold, fitted): p25 **−0.5108518768629322**, p75
**+0.4787396756932556** → factors ×0.30842397005714156 / ×3.011200512708548 on every
row's implied value. A typical holdout miss is a factor of about ×3.2 — the model
beats both baselines clearly and is still, honestly, a wide-error model; the
intervals on the board say so.

## Automated checks (independent second implementation, ../check-v3.mjs)

All **27 scripted checks PASSED**, including:

- Determinism: two runs produce the same 10 output files, every file
  sha256-identical across runs (board.json, data.js, dossier.json, dashboard
  app.css/app.js/index.html/z-model-evidence.md, 3 screenshots).
- Board shape: 198 rows (within 100..4000); all 40 watchlist slugs covered; ranks
  exactly 1..N; implied values positive whole dollars, non-increasing, not all
  equal; every row's interval ordered (0 < low ≤ high).
- Farm steps: 1,493 steps total, 7–9 per row (gate 3..12), every step 163..428 chars
  (gate 20..600), every step carries Capital/Fees/Time; 292 steps carry a Risk;
  every watchlist row has at least one Risk-bearing step. (Unchanged from v2.)
- Independent recompute (constants restated from scratch, no model.ts import):
  the whole board — row set, order, implied / implied_low / implied_high — matches
  board.json **exactly on all 198 rows**; the round4 model factors (multiple,
  category_multiple, size_multiplier, growth, maturity, peer counts) all match.
- board.json vs data.js: agree row for row on slug order, rank, implied value,
  interval, model factors and farm_steps; data.js carries model_version `radar-4`
  and a fit summary that matches the recompute.
- Evidence file: 29,747 bytes; details exactly the 53-row union (top 40 + all
  watchlist), one parseable line per row; the printed full-precision factors
  (category_log, size_adj, growth_mult, maturity_mult) recompute to the printed
  multiple, implied, implied_low and implied_high **exactly**, and all three values
  match board.json; the 34-line category table and every validation figure in the
  file (both folds × three predictors, residual percentiles, slope, correlation,
  pool counts) match the independent recompute to 1e-9.
- Dossier: text 51,863 bytes (cap 65,536); total 927,674 bytes (cap 1.5 MiB); the
  evidence file appears **verbatim** in the dossier text, its final line
  (END OF EVIDENCE) is present, and there is no `[Cut at …]` truncation marker.
- Offline: no `http://` or `https://` substring in dashboard/index.html, app.css,
  app.js or the generated z-model-evidence.md.
- Screenshots: 3 PNGs, each 1440×900 and ≤512 KiB (216,960 / 220,481 / 218,319
  bytes); repo copies byte-identical to the pipeline output copies.
  Eyeball-verified: board shows model RADAR-4, the fitted-model note with the fit's
  own numbers, and a holdout range under every implied value; detail (scroll 0)
  shows the top protocol's name, implied value, the decomposed formula line
  (category × size), the holdout range, parameter chips and farm steps in one frame;
  filtered view shows watchlist-only + Ethereum with 26 of 198 rows.

## Official kit check (token-radar-01-kit, `check --repo radar-repo-v3 --worktree`)

- Without transcripts: **4 passed, 1 failed** (`transcripts_present` — no bundle
  was passed, as the site would also fail it), **14 skipped, 5 checked at
  submission** — the same headline as v2's run. Every repository-side check that
  ran passed (competition_open, snapshot, license_osi, entrypoint).
- With the v1 transcript bundle (`../transcript-radar.tar.gz`), mirroring the v2
  run exactly: **12 passed, 1 failed, 6 skipped, 5 checked at submission**.
- Caveat, recorded plainly: the one failure is `thinking_reproduces` at **21.4%**
  (380 of 1,772 counted lines), under the 30% floor — down from v2's 31.4% with the
  same bundle, because the v1 sessions authored neither the v2 nor the v3 changes
  and v3's model.ts is larger. This is a property of checking against a stale
  bundle, not of the entry: a real v3 submission must bundle the v3 build sessions
  (this work), which is what the gate measures. Every other transcript check the
  bundle feeds passed (present, recorded, wellformed, in_window, turns, priced,
  revised, run_record).

## v2 vs v3 diff summary

- Board: 198 rows in both; **all 198 implied values changed** — radar-4 is a new
  model, not a restatement. Top-10 overlap 8 of 10; v3 top 10: steakhouse-financial,
  sentora-curator, gauntlet, polymarket-international, usdd, nonce-capital,
  bitfi-basis, bittensor-dtao, rockawayx, veda (bitfi-basis and bittensor-dtao in;
  hive-protocol and hyperithm out). The size term is what moves the board: the
  largest-TVL rows are damped hardest (e.g. the top row's size multiplier is ×0.21).
- Multiples: hand-set category medians in ratio space with a ×3.00 cap (radar-3) →
  fitted log-space category medians plus a fitted size slope, clamped to the
  observed range (radar-4). Growth/maturity: same terms, half the strength, now
  labelled priors.
- Every row gained a walk-forward interval (implied_low_usd / implied_high_usd);
  the dashboard shows it on the board and in the detail view.
- Judge-facing: dossier text grows 39,954 B (v2) → 51,863 B and now carries, on top
  of v2's evidence, the fit itself and a full validation table whose numbers a
  reader can recompute from the snapshot — including the admission that a typical
  holdout miss is ×3.2.
- Model version: radar-3 → radar-4. Farm plans, pool rules and dashboard features
  otherwise unchanged from v2.

## Verification scope

Screenshots and board come from a local run of the entry program on the kit's
sealed snapshot — the same input the server scores — and the server rebuilds the
dossier from its own run of the same program; local dossier bytes are the
deterministic product of that program and input (two local runs are
byte-identical). No server-side v3 grade exists: nothing was submitted.
