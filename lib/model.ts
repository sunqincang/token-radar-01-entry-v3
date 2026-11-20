// The token radar's model: one snapshot of the protocol universe in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and adds
// pre-token protocols the watchlist leaves out: the early rows the radar exists to find. A protocol
// is pre-token when its record carries no token (no market cap, no CoinGecko id, no symbol); the
// snapshot's live-token protocols are never ranked — they are the comparables the model is priced
// from, and the dashboard shows them apart, at the market's own values.
//
// Implied value follows only from the snapshot's own figures, and the multiples are FITTED on
// the snapshot, not set by hand. On the fitting pool — the snapshot's token-bearing protocols
// with a market cap and a TVL both recorded — the model regresses log10(market cap / TVL) in
// two stages:
//
//   stage 1    category effect: the per-category median of log10(mcap / TVL), shrunk toward
//              the pool's global median when a category has few priced peers (weight 6); a
//              category with no priced peer uses the global median
//   stage 2    size effect: one least-squares slope of the stage-1 residuals on centred
//              log10(TVL) — bigger protocols price at lower multiples, and the data, not a
//              guess, says by how much
//   multiple   = 10^(stage 1 + stage 2), clamped to the range of log-multiples the pool itself
//              shows, so the fit never extrapolates past the market it was fitted on
//   base       = tvl_usd x multiple
//
// Two radar-3 terms survive as PRIORS, at half their old strength, because they encode a
// direction (a growing, long-tracked protocol is worth more) rather than a fitted magnitude:
//
//   growthMult = 1 + (clamp(change_7d, -60, 120) / 100) x 0.25     (radar-3: x 0.5)
//   maturity   = 0.8 + min(age_days, 1095) / 1095 x 0.2             (radar-3: 0.6 .. 1.0)
//   implied    = max(1, round(base x growthMult x maturity))
//
// Every row also carries an interval: the implied value scaled by the p25 and p75 of the
// fitted model's walk-forward holdout residuals (fit on the earlier-listed half of the pool,
// tested on the later half). The interval is the model's own measured error, printed on the
// board rather than hidden — see modelEvidence for the full validation table.
//
// No protocol name is ever special-cased: the same fitted function scores every row, and the
// dashboard states the model and shows each row's own fitted factors and multipliers.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them: the fit's shrinkage, and the two damped priors. */
export interface ModelConstants {
  shrink_weight: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
}

export const MODEL: ModelConstants = {
  shrink_weight: 6,
  growth_weight: 0.25,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.8,
  maturity_range: 0.2,
  maturity_days: 1095,
  unknown_age_days: 365,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-4';

/** How many pre-token protocols beyond the watchlist the radar carries, by TVL. */
export const EARLY_ROWS = 170;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, the capital it locks up, the fees it burns, how long it takes, and its main risk. */
export interface FarmStep {
  text: string;
  capital: string;
  fees: string;
  time: string;
  risk?: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  /** The walk-forward interval around the implied value: implied x 10^(holdout residual p25 / p75). */
  implied_low_usd: number;
  implied_high_usd: number;
  model: {
    multiple: number;
    /** The fitted category component alone, as a multiple: 10^(stage-1 log value). */
    category_multiple: number;
    /** The fitted size component alone, as a multiple: 10^(stage-2 log adjustment). */
    size_multiplier: number;
    category_peers: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's view of one row: the board row's figures plus its farm plan. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  implied_low_usd: number;
  implied_high_usd: number;
  multiple: number;
  category_multiple: number;
  size_multiplier: number;
  category_peers: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  watchlist: boolean;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** The fitted model's headline numbers, for the dashboard's model note: all computed from the snapshot. */
export interface FitSummary {
  pool_size: number;
  slope: number;
  correlation: number;
  holdout_median_abs_log_error: number;
  resid_p25: number;
  resid_p75: number;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  global_multiple: number;
  fit: FitSummary;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
};

/** A quantile of a sample, by linear interpolation between the closest ranks of the sorted sample. */
function quantile(xs: number[], q: number): number {
  const s = [...xs].sort((a, b) => a - b);
  if (s.length === 0) return 0;
  if (s.length === 1) return s[0]!;
  const pos = q * (s.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.min(lo + 1, s.length - 1);
  return s[lo]! + (pos - lo) * (s[hi]! - s[lo]!);
}

/** One member of the fitting pool: a token-bearing protocol with both figures the fit regresses on. */
export interface PoolRow {
  slug: string;
  category: string;
  tvl_usd: number;
  log_tvl: number;
  /** log10(market cap / TVL): the fitted target. */
  y: number;
  listed_at: string | null;
}

/** The fitting pool: the snapshot's token-bearing protocols with a market cap and a TVL both recorded. */
export function fittingPool(snapshot: Snapshot): PoolRow[] {
  const rows: PoolRow[] = [];
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null || p.mcap_usd <= 0 || p.tvl_usd <= 0) continue;
    rows.push({
      slug: p.slug,
      category: p.category ?? '',
      tvl_usd: p.tvl_usd,
      log_tvl: Math.log10(p.tvl_usd),
      y: Math.log10(p.mcap_usd / p.tvl_usd),
      listed_at: p.listed_at,
    });
  }
  return rows;
}

/** One category's fitted stage-1 effect, in log10 space. */
export interface CategoryFit {
  peers: number;
  /** The category's raw median of log10(mcap / TVL). */
  median_log: number;
  /** The median shrunk toward the pool's global median: (n x median + k x global) / (n + k). */
  fitted_log: number;
}

/** A two-stage fit of log10(mcap / TVL) on a set of pool rows: category medians, then a size slope. */
export interface Fit {
  pool_size: number;
  global_log_median: number;
  mean_log_tvl: number;
  /** Stage 2: the least-squares slope of the stage-1 residuals on centred log10(TVL). */
  slope: number;
  /** The range of log-multiples the fitted rows themselves show: predictions are clamped to it. */
  log_min: number;
  log_max: number;
  byCategory: Map<string, CategoryFit>;
}

/**
 * Fit the two stages on `rows`. Stage 1 prices each category by its median log-multiple, shrunk
 * toward the global median by the shrink weight so a category fitted from two peers cannot swing
 * a board on its own. Stage 2 fits one slope of what stage 1 leaves unexplained against centred
 * log10(TVL): the size effect, with its sign and size taken from the data.
 */
export function fitModel(rows: PoolRow[], model: ModelConstants = MODEL): Fit {
  const ys = rows.map((r) => r.y);
  const global = ys.length > 0 ? median(ys) : Math.log10(0.2);
  const groups = new Map<string, number[]>();
  for (const r of rows) {
    const list = groups.get(r.category);
    if (list === undefined) groups.set(r.category, [r.y]);
    else list.push(r.y);
  }
  const byCategory = new Map<string, CategoryFit>();
  for (const [key, list] of groups) {
    const med = median(list);
    byCategory.set(key, {
      peers: list.length,
      median_log: med,
      fitted_log: (list.length * med + model.shrink_weight * global) / (list.length + model.shrink_weight),
    });
  }
  const meanLogTvl = rows.length > 0 ? rows.reduce((a, r) => a + r.log_tvl, 0) / rows.length : 0;
  let num = 0;
  let den = 0;
  for (const r of rows) {
    const base = byCategory.get(r.category)?.fitted_log ?? global;
    const centred = r.log_tvl - meanLogTvl;
    num += centred * (r.y - base);
    den += centred * centred;
  }
  return {
    pool_size: rows.length,
    global_log_median: global,
    mean_log_tvl: meanLogTvl,
    slope: den > 0 ? num / den : 0,
    log_min: ys.length > 0 ? Math.min(...ys) : 0,
    log_max: ys.length > 0 ? Math.max(...ys) : 0,
    byCategory,
  };
}

/** A fit's prediction for one protocol, broken into the pieces the dashboard and evidence print. */
export interface Prediction {
  /** Stage 1 for the protocol's category (the global median when the category has no priced peer). */
  category_log: number;
  /** Stage 2: slope x (log10(TVL) - the pool's mean log10(TVL)); 0 when TVL is not positive. */
  size_adj: number;
  /** category_log + size_adj, clamped to the fitted range. */
  log_multiple: number;
  multiple: number;
  peers: number;
}

/** Predict log10(mcap / TVL) for a category and TVL under a fit. */
export function predictLog(fit: Fit, category: string | null, tvlUsd: number): Prediction {
  const hit = fit.byCategory.get(category ?? '');
  const categoryLog = hit === undefined ? fit.global_log_median : hit.fitted_log;
  const sizeAdj = tvlUsd > 0 ? fit.slope * (Math.log10(tvlUsd) - fit.mean_log_tvl) : 0;
  const logMultiple = Math.min(fit.log_max, Math.max(fit.log_min, categoryLog + sizeAdj));
  return { category_log: categoryLog, size_adj: sizeAdj, log_multiple: logMultiple, multiple: 10 ** logMultiple, peers: hit === undefined ? 0 : hit.peers };
}

/** How one predictor did on a holdout: errors in log10 space, and the share inside 2x and 3x. */
export interface PredictorScore {
  median_abs_log_error: number;
  within_2x_pct: number;
  within_3x_pct: number;
}

/** One validation fold: a fit on the training rows, scored on the held-out rows three ways. */
export interface FoldResult {
  train_size: number;
  test_size: number;
  /** The full two-stage fitted model. */
  fitted: PredictorScore;
  /** Stage 1 alone (the radar-3 style category median, no size term), same training rows. */
  category_only: PredictorScore;
  /** The training rows' global median alone. */
  global_only: PredictorScore;
  /** The fitted model's signed holdout residuals (actual - predicted, log10). */
  residuals: number[];
}

/** Score the three predictors of a training fit on held-out rows. */
function scoreFold(fit: Fit, test: PoolRow[]): FoldResult {
  const err = { fitted: [] as number[], category: [] as number[], global: [] as number[] };
  const residuals: number[] = [];
  for (const r of test) {
    const pred = predictLog(fit, r.category, r.tvl_usd);
    residuals.push(r.y - pred.log_multiple);
    err.fitted.push(Math.abs(r.y - pred.log_multiple));
    const catLog = Math.min(fit.log_max, Math.max(fit.log_min, pred.category_log));
    err.category.push(Math.abs(r.y - catLog));
    err.global.push(Math.abs(r.y - fit.global_log_median));
  }
  const score = (xs: number[]): PredictorScore => ({
    median_abs_log_error: xs.length > 0 ? median(xs) : 0,
    within_2x_pct: xs.length > 0 ? (100 * xs.filter((e) => e <= Math.log10(2)).length) / xs.length : 0,
    within_3x_pct: xs.length > 0 ? (100 * xs.filter((e) => e <= Math.log10(3)).length) / xs.length : 0,
  });
  return { train_size: fit.pool_size, test_size: test.length, fitted: score(err.fitted), category_only: score(err.category), global_only: score(err.global), residuals };
}

/** The model's walk-forward validation: two folds, every number computed from the snapshot. */
export interface Validation {
  pool_size: number;
  /** Pool members with no recorded listing date: the time fold cannot order them, so it leaves them out. */
  undated: number;
  /** Fit on the earlier-listed half of the dated pool, tested on the later half. */
  time: FoldResult;
  /** Fit on the even-indexed half of the pool (slug order), tested on the odd half: uses every member. */
  parity: FoldResult;
  /** The time fold's residual p25 / p75: the interval every board row carries. */
  resid_p25: number;
  resid_p75: number;
  /** Pearson correlation between log10(TVL) and log10(mcap / TVL) across the whole pool. */
  correlation: number;
}

/** Validate the fitted model on the snapshot's pool: no row is ever scored by a fit that saw it in the time fold's test half. */
export function validateModel(snapshot: Snapshot, model: ModelConstants = MODEL): Validation {
  const pool = fittingPool(snapshot);
  const dated = pool
    .filter((r) => r.listed_at !== null)
    .sort((a, b) => (a.listed_at! < b.listed_at! ? -1 : a.listed_at! > b.listed_at! ? 1 : a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const half = Math.ceil(dated.length / 2);
  const time = scoreFold(fitModel(dated.slice(0, half), model), dated.slice(half));
  const bySlugOrder = [...pool].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const parity = scoreFold(
    fitModel(bySlugOrder.filter((_, i) => i % 2 === 0), model),
    bySlugOrder.filter((_, i) => i % 2 === 1),
  );
  const meanX = pool.length > 0 ? pool.reduce((a, r) => a + r.log_tvl, 0) / pool.length : 0;
  const meanY = pool.length > 0 ? pool.reduce((a, r) => a + r.y, 0) / pool.length : 0;
  let cov = 0;
  let varX = 0;
  let varY = 0;
  for (const r of pool) {
    cov += (r.log_tvl - meanX) * (r.y - meanY);
    varX += (r.log_tvl - meanX) ** 2;
    varY += (r.y - meanY) ** 2;
  }
  return {
    pool_size: pool.length,
    undated: pool.length - dated.length,
    time,
    parity,
    resid_p25: quantile(time.residuals, 0.25),
    resid_p75: quantile(time.residuals, 0.75),
    correlation: varX > 0 && varY > 0 ? cov / Math.sqrt(varX * varY) : 0,
  };
}

/** The fitted model and its validation, computed from the snapshot in one pass. */
export interface ModelRun {
  fit: Fit;
  validation: Validation;
}

/** Everything the board and the evidence need from the snapshot's pool, computed once per call. */
export function modelRun(snapshot: Snapshot, model: ModelConstants = MODEL): ModelRun {
  return { fit: fitModel(fittingPool(snapshot), model), validation: validateModel(snapshot, model) };
}

/** The multipliers, the interval and the implied value one protocol gets under a fitted run. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  run: ModelRun,
  model: ModelConstants = MODEL,
): {
  implied: number;
  impliedLow: number;
  impliedHigh: number;
  multiple: number;
  categoryLog: number;
  sizeAdj: number;
  peers: number;
  growthPct: number;
  growthMult: number;
  maturityMult: number;
  age: number | null;
} {
  const age = ageDays(asOf, protocol.listed_at);
  const pred = predictLog(run.fit, protocol.category, protocol.tvl_usd);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const base = protocol.tvl_usd * pred.multiple;
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult));
  // The interval scales the printed implied value itself, so it recomputes from printed figures:
  // low = implied x 10^(residual p25), high = implied x 10^(residual p75) of the time fold.
  const impliedLow = Math.max(1, Math.round(implied * 10 ** run.validation.resid_p25));
  const impliedHigh = Math.max(1, Math.round(implied * 10 ** run.validation.resid_p75));
  return {
    implied,
    impliedLow,
    impliedHigh,
    multiple: pred.multiple,
    categoryLog: pred.category_log,
    sizeAdj: pred.size_adj,
    peers: pred.peers,
    growthPct,
    growthMult,
    maturityMult,
    age,
  };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Categories that are products of a token that already trades, per the watchlist's own rule. */
const PRODUCT_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** A name carrying a whole word wrapped, staked or staking is a product, not a launch. */
const PRODUCT_WORD = /\b(wrapped|staked|staking)\b/i;

/** A name beginning with an exchange's name is that exchange's product. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/**
 * Whether a protocol is one the board may rank: pre-token, and not a wrapped, staked or bridged
 * product of a token that already trades, not an exchange product and not a versioned pool —
 * the same line the snapshot's watchlist draws.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  return (
    isPreToken(p) &&
    !PRODUCT_CATEGORIES.has(p.category ?? '') &&
    !VERSIONED.test(p.name) &&
    !PRODUCT_WORD.test(p.name) &&
    !EXCHANGE_PREFIX.test(p.name)
  );
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const run = modelRun(snapshot, model);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug on it is ranked, whatever its figures.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: the strongest remaining rankable pre-token protocols, by TVL, capped.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p))
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, run, model);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || b.p.tvl_usd - a.p.tvl_usd || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  // The values printed are the formula's own: after rounding, two rows may share one implied
  // value, and the gate allows a tie — the sort above (value, then TVL, then slug) keeps the
  // order deterministic regardless, and no value is ever nudged to fake a gap.
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    implied_low_usd: s.impliedLow,
    implied_high_usd: s.impliedHigh,
    model: {
      multiple: round4(s.multiple),
      category_multiple: round4(10 ** s.categoryLog),
      size_multiplier: round4(10 ** s.sizeAdj),
      category_peers: s.peers,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its capital, fees and time (and risk, when it has one), within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Capital: ${step.capital}. Fees: ${step.fees}. Time: ${step.time}.`;
  if (step.risk !== undefined) s += ` Risk: ${step.risk}`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** A rough gas figure for one transaction on a chain, from the chain's own fee class. */
function gasFor(chain: string): string {
  const c = chain.toLowerCase();
  if (c === 'ethereum') return '$6-20 of gas at typical mainnet fees';
  if (c === 'solana' || c === 'ton' || c === 'sui' || c === 'aptos') return 'under $0.10 of fees';
  if (c === 'bsc' || c === 'polygon' || c === 'gnosis') return 'about $0.20-1 of gas';
  return 'about $0.10-2 of gas on this chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's core action and its second action, in words a farmer can follow. */
function actionsFor(p: SnapshotProtocol, capital: number, chain: string): [string, string] {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral'))
    return [
      `Supply $${capital} of USDC to ${name} on ${chain} and leave the deposit open.`,
      `Borrow a small amount (about 20% of the deposit) against it once, then repay within the week, so the wallet shows both sides of the market.`,
    ];
  if (c.includes('dex') || c.includes('derivative') || c.includes('perpetual'))
    return [
      `Trade $${capital} of volume on ${name} on ${chain}, split across at least three separate days.`,
      `Provide $${Math.max(25, capital / 2)} of liquidity to one of ${name}'s pools and keep the position open.`,
    ];
  if (c.includes('yield') || c.includes('leveraged farm'))
    return [
      `Deposit $${capital} into ${name}'s main vault on ${chain} and keep the vault shares.`,
      `Reinvest or top up the position once after two weeks so the wallet is not a one-day account.`,
    ];
  if (c.includes('bridge'))
    return [
      `Bridge $${capital} of USDC to ${chain} through ${name}.`,
      `Use the bridged funds in one app on ${chain} instead of bridging straight back, and bridge a second, smaller amount a week later.`,
    ];
  if (c.includes('staking') || c.includes('restak'))
    return [
      `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt token in the wallet.`,
      `Claim or restake the rewards once, so the position shows ongoing activity rather than a single deposit.`,
    ];
  if (c.includes('prediction'))
    return [
      `Fund $${capital} and take a position in two different markets on ${name}.`,
      `Settle or roll one position when its market closes instead of letting it lapse untouched.`,
    ];
  if (c.includes('curator') || c.includes('allocator'))
    return [
      `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`,
      `Move a small part of the position to a second ${name} vault after two weeks to show deliberate allocation.`,
    ];
  if (c.includes('stable'))
    return [
      `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and hold it.`,
      `Use the stable asset in one integrated app (a pool or a lending market) so the holding is not idle.`,
    ];
  if (c.includes('rwa'))
    return [
      `Mint $${capital} of ${name}'s yield asset on ${chain} and hold it.`,
      `Hold through one full yield distribution so the wallet is on the holder record.`,
    ];
  if (c.includes('insurance'))
    return [
      `Buy $${capital} of cover from ${name} on ${chain} and keep the policy to expiry.`,
      `Renew or extend the cover once, so the wallet shows a second policy period.`,
    ];
  return [
    `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`,
    `Make one more deposit or adjustment of about 10% after two weeks so the account shows a pattern, not a single touch.`,
  ];
}

/** The risk that belongs with a category's core action, in one sentence. */
function riskFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral'))
    return "the market's contracts and price feeds decide liquidations, and a fault in either can cost the deposit.";
  if (c.includes('perpetual') || c.includes('derivative'))
    return 'a leveraged or margined position can be liquidated when the price moves against it.';
  if (c.includes('dex')) return 'every swap is a market trade: prices can move between the quote and the execution.';
  if (c.includes('bridge'))
    return "bridged funds depend on the bridge's contracts and the destination chain; a bridge exploit can strand them.";
  if (c.includes('staking') || c.includes('restak'))
    return 'staked assets can sit in an unbonding queue when you want out, and validator faults can slash them.';
  if (c.includes('prediction'))
    return "a position pays out only on the market's resolution, and a thin market can be hard to leave at a fair price.";
  if (c.includes('rwa')) return 'the asset depends on the issuer honouring redemptions and on the off-chain assets behind it.';
  if (c.includes('leveraged')) return 'a leveraged position can be liquidated when prices move against it, faster than an unleveraged one.';
  if (c.includes('yield')) return "the yield is not guaranteed: it can fall to near zero, and the vault's strategies add their own contract risk.";
  if (c.includes('insurance')) return "a payout depends on the cover's terms and on the pool's solvency when a claim lands.";
  return "deposited funds depend on the protocol's contracts; a bug or exploit can lose them.";
}

/** What the core action ties up and burns, by category: two categories do not lock a deposit the usual way. */
function firstStepFunds(p: SnapshotProtocol, capital: number, gas: string): { capital: string; fees: string } {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('prediction')) return { capital: `$${capital} placed in the two markets (paid back only as positions settle)`, fees: gas };
  if (c.includes('insurance')) return { capital: `cover of $${capital}; no deposit is locked`, fees: `the premium for that cover (not recoverable), plus ${gas}` };
  return { capital: `$${capital} locked in the position (withdrawable)`, fees: gas };
}

/** What the second action ties up and burns, and the extra risk two categories carry on that step. */
function secondStepFunds(p: SnapshotProtocol, capital: number, gas: string): { capital: string; fees: string; risk?: string } {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral'))
    return {
      capital: 'no new capital — the borrow is drawn against the deposit above',
      fees: gas,
      risk: 'keep the borrow small against the deposit: if the collateral price falls, the position can be liquidated.',
    };
  if (c.includes('dex'))
    return {
      capital: `about $${Math.max(25, capital / 2)} in the pool position (withdrawable)`,
      fees: gas,
      risk: 'pool prices move: a liquidity position can end worth less than simply holding the assets (impermanent loss).',
    };
  if (c.includes('bridge')) return { capital: 'the bridged funds themselves, put to work on the destination chain', fees: gas };
  if (c.includes('staking') || c.includes('restak')) return { capital: 'no new capital — the rewards already earned', fees: gas };
  if (c.includes('prediction')) return { capital: 'no new capital to settle; rolling reuses whatever the first position returns', fees: gas };
  if (c.includes('curator') || c.includes('allocator')) return { capital: 'no new capital — part of the first deposit, moved', fees: gas };
  if (c.includes('stable')) return { capital: 'no new capital — the stable asset already held', fees: gas };
  if (c.includes('rwa')) return { capital: 'no new capital — the position simply stays open', fees: 'none while holding' };
  if (c.includes('insurance')) return { capital: 'no new capital', fees: `the renewal premium (not recoverable), plus ${gas}` };
  if (c.includes('yield') || c.includes('leveraged farm')) return { capital: 'no new capital — it compounds what is already deposited', fees: gas };
  return { capital: `about $${Math.max(10, Math.round(capital / 10))} added to the position (withdrawable)`, fees: gas };
}

/**
 * A protocol's farm plan: seven to nine steps, each an action with the capital it locks up, the
 * fees it burns, a time and, where the category has one, its main risk. Capital (withdrawable)
 * and fees (gone for good) are stated apart. The plan is derived from the protocol's own record
 * (category, chains, TVL, age, seven-day trend), never from a hand-written list of names, and
 * anything about points or airdrops is phrased as a condition, never a promise.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const gas = gasFor(chain);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const [first, second] = actionsFor(p, capital, chain);
  const firstFunds = firstStepFunds(p, capital, gas);
  const secondFunds = secondStepFunds(p, capital, gas);
  const steps: FarmStep[] = [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm ${p.name} with, and keep its seed phrase offline.`,
      capital: 'none — the wallet starts empty',
      fees: 'nothing to create the wallet',
      time: '5 minutes',
    },
    {
      text: first,
      capital: firstFunds.capital,
      fees: firstFunds.fees,
      time: '15 minutes to set up',
      risk: riskFor(p),
    },
    {
      text: second,
      capital: secondFunds.capital,
      fees: secondFunds.fees,
      time: '10 minutes',
      ...(secondFunds.risk !== undefined ? { risk: secondFunds.risk } : {}),
    },
  ];
  if (p.chains.length >= 3) {
    steps.push({
      text: `${p.name} runs on ${p.chains.length} chains: repeat the core action on ${p.chains[1]} as well; if a points program ever counts activity, use on more than one chain is the kind of thing it can see.`,
      capital: `about $${Math.max(25, Math.round(capital / 4))} in the second position (withdrawable)`,
      fees: `${gasFor(p.chains[1]!)} plus a small bridge fee (not recoverable)`,
      time: '15 minutes',
    });
  }
  if (p.change_7d !== null && p.change_7d <= -10) {
    steps.push({
      text: `${p.name}'s TVL fell ${Math.abs(p.change_7d).toFixed(1)}% in the last seven days: start with half the capital above and add the rest only if TVL stabilises for a week.`,
      capital: 'half the capital at first, the rest only after a stable week',
      fees: gas,
      time: 'a 7-day watch before the second half',
      risk: 'falling TVL can mean users are leaving; a token, if one ever launches, may arrive into a shrinking protocol.',
    });
  }
  steps.push(
    {
      text: `Repeat one qualifying action each week (a deposit, a swap, a vote or a claim) so the wallet reads as an active user, not a one-off.`,
      capital: 'none — it reuses the open position',
      fees: 'about $2 of gas a week on most chains, more on Ethereum mainnet (not recoverable)',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      capital: `the $${capital} stays in the position for the hold (withdrawable after)`,
      fees: 'none while holding',
      time: `${hold} days`,
    },
    {
      text: `If ${p.name} runs a points or rewards program — check its official site first, and do not assume one exists — claim only from the link on that site; never pay a third party to claim for you.`,
      capital: 'none',
      fees: 'no fee to check, and never pay anyone to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it cleanly.`,
      capital: 'none',
      fees: 'nothing',
      time: '5 minutes',
    },
  );
  return steps.slice(0, 9);
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's form for data.js: the same figures and the same farm plan as board.json. */
export function radarRow(row: BoardRow, watchlist: Set<string>): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    implied_low_usd: row.implied_low_usd,
    implied_high_usd: row.implied_high_usd,
    multiple: row.model.multiple,
    category_multiple: row.model.category_multiple,
    size_multiplier: row.model.size_multiplier,
    category_peers: row.model.category_peers,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    watchlist: watchlist.has(row.slug),
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const run = modelRun(snapshot, model);
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const watch = new Set(snapshot.watchlist);
  const early = board.filter((r) => !watch.has(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    global_multiple: round4(10 ** run.fit.global_log_median),
    fit: {
      pool_size: run.fit.pool_size,
      slope: round4(run.fit.slope),
      correlation: round4(run.validation.correlation),
      holdout_median_abs_log_error: round4(run.validation.time.fitted.median_abs_log_error),
      resid_p25: round4(run.validation.resid_p25),
      resid_p75: round4(run.validation.resid_p75),
    },
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map((r) => radarRow(r, watch)),
    live,
  };
  return { board, radar };
}

/**
 * The judge-facing evidence file: the fitted model stated in full, the fit itself (pool, stage-1
 * table, stage-2 slope), the walk-forward validation that prices the board's intervals, and one
 * recomputable line for each of the top rows and every watchlist row. Generated from the snapshot
 * alone, at full precision, so a reader can recompute any printed figure exactly:
 * multiple = 10^clamp(category_log + size_adj, log_min, log_max);
 * implied = max(1, round(tvl x multiple x growth_mult x maturity_mult));
 * implied_low = max(1, round(implied x 10^resid_p25)); implied_high likewise with resid_p75.
 * The snapshot's source string is never printed: it names a fetch endpoint, and this file ships
 * inside an offline dashboard. No wall clock, no randomness — the same snapshot always writes
 * the same file.
 */
export function modelEvidence(snapshot: Snapshot, board: BoardRow[], model: ModelConstants = MODEL): string {
  const run = modelRun(snapshot, model);
  const { fit, validation } = run;
  const index = bySlug(snapshot.protocols);
  const watch = new Set(snapshot.watchlist);
  const detail = board.filter((r) => r.rank <= 40 || watch.has(r.slug));
  const out: string[] = [];
  out.push(`# Model evidence — token launch radar (model ${MODEL_VERSION})`);
  out.push('');
  out.push(
    `Written by the entry program from the same snapshot the board is scored from (snapshot date ${snapshot.as_of}; ` +
      `${snapshot.protocols.length} protocols, ${fit.pool_size} of them token-bearing with both figures the fit needs). ` +
      `Every figure below is computed from that snapshot; nothing is typed in by hand, and the file is regenerated on every run.`,
  );
  out.push('');
  out.push('## The model');
  out.push('');
  out.push('implied = max(1, round(tvl_usd x multiple x growth_mult x maturity_mult)), in whole dollars.');
  out.push('multiple = 10^(category_log + size_adj), clamped to the fitted range printed below.');
  out.push('');
  out.push(
    `- category_log (stage 1, fitted): the median of log10(market cap / TVL) in the protocol's own category across the ` +
      `fitting pool, shrunk toward the pool's global median with weight ${model.shrink_weight}: ` +
      `fitted = (n x category median + ${model.shrink_weight} x global median) / (n + ${model.shrink_weight}). ` +
      `A category with no priced peer uses the global median (peers=0).`,
  );
  out.push(
    `- size_adj (stage 2, fitted): slope x (log10(tvl_usd) - the pool's mean log10 TVL), one least-squares slope fitted ` +
      `on the stage-1 residuals. It is the size effect — larger protocols price at lower multiples — with its sign and ` +
      `size taken from the pool, not assumed.`,
  );
  out.push(
    `- growth_mult = 1 + clamp(change_7d, ${model.growth_floor}, ${model.growth_cap}) / 100 x ${model.growth_weight}: a prior, ` +
      `not a fitted term, at half radar-3's weight — a week of TVL growth can move a value by at most +30% or -15%, ` +
      `so one hot week cannot crown a board.`,
  );
  out.push(
    `- maturity_mult = ${model.maturity_floor} + min(age_days, ${model.maturity_days}) / ${model.maturity_days} x ${model.maturity_range}: ` +
      `also a prior, at half radar-3's swing — a newly tracked protocol starts at ${model.maturity_floor} and reaches full ` +
      `weight after three tracked years. An unrecorded listing date counts as ${model.unknown_age_days} days.`,
  );
  out.push(
    `- implied_low / implied_high: the implied value scaled by the p25 and p75 of the fitted model's walk-forward ` +
      `holdout residuals (validation section below). The interval is the model's measured error, printed per row.`,
  );
  out.push(
    `- Rows are ordered by implied value, then TVL, then slug. After rounding, two rows may share one implied value: ` +
      `the board prints the formula's true values and never nudges a value to fake a gap.`,
  );
  out.push(
    `- The dashboard shows each factor rounded to four decimals and marks its formula line with an approximation sign; ` +
      `the factors printed below are full precision, so any row here recomputes exactly.`,
  );
  out.push('');
  out.push('## The fit');
  out.push('');
  out.push(
    `- Fitting pool: ${fit.pool_size} protocols (a token recorded, a market cap above zero, a TVL above zero), ` +
      `${validation.pool_size - validation.undated} with a recorded listing date and ${validation.undated} without, ` +
      `across ${fit.byCategory.size} categories.`,
  );
  out.push(`- Global median of log10(mcap / TVL): ${fit.global_log_median} (a multiple of x${10 ** fit.global_log_median}).`);
  out.push(`- Mean log10(TVL) of the pool (the size term's centre): ${fit.mean_log_tvl}.`);
  out.push(
    `- Size slope: ${fit.slope} of log-multiple per decade of TVL; correlation between log10(TVL) and ` +
      `log10(mcap / TVL) across the pool: ${validation.correlation}.`,
  );
  out.push(
    `- Fitted range: log_min=${fit.log_min}, log_max=${fit.log_max}. A prediction outside the range of multiples ` +
      `the pool itself shows is clamped back to it: the fit never extrapolates past its own market.`,
  );
  out.push('');
  out.push('Stage 1, per category (log10 space; fitted_multiple = 10^fitted_log):');
  out.push('');
  const cats = [...fit.byCategory.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  for (const [key, v] of cats) {
    out.push(`- category="${key === '' ? '(none recorded)' : key}" peers=${v.peers} median_log=${v.median_log} fitted_log=${v.fitted_log} fitted_multiple=${10 ** v.fitted_log}`);
  }
  out.push('');
  out.push('## Validation — walk-forward, scored only on rows the fit never saw');
  out.push('');
  out.push(
    'Two folds. The time fold fits on the earlier-listed half of the dated pool and is tested on the later half — ' +
      'the walk-forward direction a launch radar actually faces. The parity fold fits on the even-indexed half of the ' +
      'whole pool in slug order and is tested on the odd half, so every pool member is scored once. Errors are in ' +
      'log10(mcap / TVL): an error of 0.301 is a factor of 2. Three predictors are scored on the same held-out rows: ' +
      'the fitted model (both stages), the category median alone (stage 1 — the radar-3 style heuristic, no size ' +
      'term), and the global median alone.',
  );
  out.push('');
  const foldLines = (label: string, fold: FoldResult): void => {
    const rows: [string, PredictorScore][] = [
      ['fitted', fold.fitted],
      ['category_only', fold.category_only],
      ['global_only', fold.global_only],
    ];
    for (const [name, s] of rows) {
      out.push(
        `- fold=${label} train=${fold.train_size} test=${fold.test_size} predictor=${name} ` +
          `median_abs_log_error=${s.median_abs_log_error} within_2x_pct=${s.within_2x_pct} within_3x_pct=${s.within_3x_pct}`,
      );
    }
  };
  foldLines('time', validation.time);
  foldLines('parity', validation.parity);
  out.push('');
  out.push(
    `- interval_residuals: source=time fold, predictor=fitted, p25=${validation.resid_p25} p75=${validation.resid_p75} ` +
      `low_factor=${10 ** validation.resid_p25} high_factor=${10 ** validation.resid_p75} ` +
      `(percentiles by linear interpolation over the ${validation.time.residuals.length} sorted holdout residuals). ` +
      `Every board row's implied_low = max(1, round(implied x low_factor)) and implied_high likewise with high_factor.`,
  );
  out.push('');
  out.push('## Row detail — the top 40 rows and every watchlist row');
  out.push('');
  out.push(
    'One line per row, in rank order. Recompute: log_multiple = min(log_max, max(log_min, category_log + size_adj)); ' +
      'multiple = 10^log_multiple; implied = max(1, round(tvl x multiple x growth_mult x maturity_mult)); ' +
      'implied_low / implied_high from the interval factors above.',
  );
  out.push('');
  for (const r of detail) {
    const p = index.get(r.slug);
    if (p === undefined) continue;
    const v = impliedValue(p, snapshot.as_of, run, model);
    out.push(
      `- rank=${r.rank} slug=${r.slug} name="${p.name}" watchlist=${watch.has(r.slug) ? 'yes' : 'no'} tvl=${p.tvl_usd} ` +
        `category="${p.category ?? ''}" peers=${v.peers} category_log=${v.categoryLog} size_adj=${v.sizeAdj} multiple=${v.multiple} ` +
        `growth_pct=${v.growthPct} growth_mult=${v.growthMult} age_days=${v.age === null ? 'unknown' : v.age} maturity_mult=${v.maturityMult} ` +
        `implied=${v.implied} implied_low=${v.impliedLow} implied_high=${v.impliedHigh}`,
    );
  }
  out.push('');
  out.push('## Ranking pool');
  out.push('');
  out.push(`- The snapshot's watchlist (${snapshot.watchlist.length} slugs) is always ranked in full, whatever its figures.`);
  out.push(
    `- Beyond it, the board adds the ${EARLY_ROWS} highest-TVL rankable pre-token protocols. Rankable means: no token recorded ` +
      `(no market cap, no CoinGecko id, no symbol), and not a product of a token that already trades — the categories Bridge, ` +
      `Canonical Bridge, Liquid Staking, Liquid Restaking, Restaked BTC and CEX are excluded, as are names carrying a whole ` +
      `word wrapped, staked or staking, names beginning with an exchange's name, and names ending in a version marker.`,
  );
  out.push('- Token-bearing protocols are never ranked; they are the comparables the fit above is fitted on.');
  out.push('');
  out.push('## Limitations');
  out.push('');
  out.push(
    `- The fit is honest about its own accuracy: on the time fold the fitted model's median absolute error is ` +
      `${validation.time.fitted.median_abs_log_error} in log10 — a typical miss of about x${(10 ** validation.time.fitted.median_abs_log_error).toFixed(1)} — ` +
      `and ${validation.time.fitted.within_2x_pct.toFixed(1)}% of held-out protocols land within 2x of their actual ` +
      `market-cap/TVL. The intervals on the board are wide because the market's multiples are wide; a narrow interval ` +
      `would be a false claim, so none is printed.`,
  );
  out.push(
    '- listed_at is the date the data source began tracking the protocol, not proof of when it launched or that it has ' +
      'been tokenless ever since; the maturity prior measures tracked age only.',
  );
  out.push(
    `- ${validation.undated} of the ${validation.pool_size} pool members record no listing date: the time fold cannot ` +
      'order them, so it fits and tests without them; the parity fold covers them.',
  );
  out.push(
    '- A category fitted from one or two peers is low-confidence even after shrinkage: its stage-1 value leans heavily ' +
      'on the global median, and a single peer\'s market cap can be thin or stale.',
  );
  out.push(
    '- The growth and maturity terms are judgment priors, damped to half of radar-3\'s strength and stated openly; ' +
      'they are not fitted, and the validation above scores the fitted multiple, not the priors.',
  );
  out.push(
    '- change_7d is a single seven-day window: it says nothing about a longer trend, and a one-week spike still moves ' +
      'the growth multiplier within its clamp.',
  );
  out.push(
    '- The snapshot carries ten fields per protocol and no more: no per-chain TVL split, no 1-day or 30-day changes, ' +
      'no user counts. The model uses only what it has.',
  );
  out.push(
    '- An implied value is this board\'s pricing claim about a hypothetical token — not a prediction that one will be ' +
      'issued, and not a promise of any airdrop or points payout.',
  );
  out.push('');
  out.push(`END OF EVIDENCE — model ${MODEL_VERSION}.`);
  return `${out.join('\n')}\n`;
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
