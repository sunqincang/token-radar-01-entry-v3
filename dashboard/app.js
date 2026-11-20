// Token Launch Radar: renders window.RADAR (written beside this page by main.ts).
// A sortable, filterable board of pre-token protocols ranked by implied value, a detail
// view per protocol with the model's own arithmetic and the farm plan board.json carries,
// and the live-token set the model was priced from. No network: all data is in data.js.
(function () {
  'use strict';
  var D = window.RADAR;
  if (!D) return;
  var top = document.getElementById('top');
  var app = document.getElementById('app');
  var foot = document.getElementById('foot');
  var state = { view: 'board', q: '', category: 'all', chain: 'all', wl: false, sort: 'rank', dir: 1, slug: null };

  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(1) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.round(days) + 'd';
  }
  function fmtMult(n) { return 'x' + Number(n).toFixed(2); }

  function renderHead() {
    top.className = state.slug ? 'compact' : '';
    top.innerHTML =
      '<div class="wrap masthead">' +
      '<div class="kicker">Token Launch Radar &middot; model ' + esc(D.model_version) + '</div>' +
      '<h1>Protocols that have not launched a token yet, ranked by what one would be worth</h1>' +
      '<p class="tagline">Every protocol on the snapshot watchlist is ranked, plus the strongest pre-token ' +
      'protocols below the watchlist floor &mdash; the early finds a radar exists for. Protocols whose token ' +
      'already trades are never ranked: they are the comparables this board is priced from.</p>' +
      '<div class="stats">' +
      '<div class="stat"><b>' + D.board_size + '</b><span>protocols ranked</span></div>' +
      '<div class="stat"><b>' + D.watchlist_size + ' / ' + D.watchlist_size + '</b><span>watchlist covered</span></div>' +
      '<div class="stat"><b>' + D.early_size + '</b><span>early finds below the floor</span></div>' +
      '<div class="stat"><b>' + D.live_size + '</b><span>live tokens set aside</span></div>' +
      '<div class="stat"><b>' + esc(D.as_of) + '</b><span>snapshot date</span></div>' +
      '</div>' +
      '<div class="model-note"><b>The model, fitted not hand-set:</b> implied value = TVL &times; <b>fitted multiple</b> ' +
      '&times; growth &times; maturity. The multiple is fitted on this snapshot&rsquo;s ' + D.fit.pool_size +
      ' token-bearing protocols in two stages: each category&rsquo;s median log market-cap/TVL, shrunk toward the ' +
      'global median (' + fmtMult(D.global_multiple) + ') when a category has few priced peers, then a size term &mdash; ' +
      'slope ' + D.fit.slope.toFixed(2) + ' of log-multiple per decade of TVL (correlation ' + D.fit.correlation.toFixed(2) +
      '), because bigger protocols price lower. Growth (<code>1 + clamp(7d TVL change, -60%, +120%) / 4</code>) and ' +
      'maturity (<code>0.80 to 1.00</code> over three tracked years) enter as priors at half of radar-3&rsquo;s strength. ' +
      'Every value carries the model&rsquo;s walk-forward holdout range: fitted on the earlier-listed half of the pool, ' +
      'its median miss on the later half was a factor of x' + Math.pow(10, D.fit.holdout_median_abs_log_error).toFixed(1) +
      '. No name is special-cased: open any row and check its arithmetic.</div>' +
      '<div class="viewtabs">' +
      '<button data-view="board" class="' + (state.view !== 'live' ? 'on' : '') + '">Pre-token board</button>' +
      '<button data-view="live" class="' + (state.view === 'live' ? 'on' : '') + '">Already trading (priced peers)</button>' +
      '</div></div>';
    var btns = top.querySelectorAll('.viewtabs button');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () {
        state.view = this.getAttribute('data-view');
        state.slug = null;
        render();
      });
    }
  }

  function categories() {
    var seen = {};
    D.rows.forEach(function (r) { if (r.category) seen[r.category] = 1; });
    return Object.keys(seen).sort();
  }
  function chains() {
    var seen = {};
    D.rows.forEach(function (r) { r.chains.forEach(function (c) { seen[c] = 1; }); });
    return Object.keys(seen).sort();
  }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    return D.rows.filter(function (r) {
      if (state.wl && !r.watchlist) return false;
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && r.chains.indexOf(state.chain) < 0) return false;
      if (q && (r.name + ' ' + r.slug).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }

  var SORTS = {
    rank: function (r) { return r.rank; },
    name: function (r) { return r.name.toLowerCase(); },
    tvl: function (r) { return r.tvl_usd; },
    change: function (r) { return r.change_7d === null ? -Infinity : r.change_7d; },
    age: function (r) { return r.age_days === null ? -1 : r.age_days; },
    multiple: function (r) { return r.multiple; },
    implied: function (r) { return r.implied_value_usd; }
  };

  function renderBoard() {
    var rows = filtered().slice();
    var key = SORTS[state.sort] || SORTS.rank;
    rows.sort(function (a, b) {
      var x = key(a), y = key(b);
      if (x < y) return -1 * state.dir;
      if (x > y) return 1 * state.dir;
      return a.rank - b.rank;
    });
    function th(label, sort, extra) {
      var cls = state.sort === sort ? 'sorted' : '';
      return '<th class="' + cls + '" data-sort="' + sort + '">' + label + (extra || '') + '</th>';
    }
    var html = '<div class="wrap">' +
      '<div class="controls">' +
      '<input type="search" id="q" placeholder="Search name or slug" value="' + esc(state.q) + '">' +
      '<select id="cat"><option value="all">All categories</option>' +
      categories().map(function (c) { return '<option value="' + esc(c) + '"' + (state.category === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') +
      '</select>' +
      '<select id="chain"><option value="all">All chains</option>' +
      chains().map(function (c) { return '<option value="' + esc(c) + '"' + (state.chain === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') +
      '</select>' +
      '<label class="check"><input type="checkbox" id="wl"' + (state.wl ? ' checked' : '') + '> Watchlist only</label>' +
      '<span class="count">' + rows.length + ' of ' + D.rows.length + ' shown</span>' +
      '</div>' +
      '<table><thead><tr>' +
      th('#', 'rank') + th('Protocol', 'name') + '<th>Category</th><th>Chains</th>' +
      th('TVL', 'tvl') + th('7d', 'change') + th('Age', 'age') + th('Multiple', 'multiple') + th('Implied value', 'implied') +
      '</tr></thead><tbody>';
    if (rows.length === 0) {
      html += '</tbody></table><p class="empty">No protocol matches these filters. Loosen one and the radar sweeps again.</p></div>';
    } else {
      html += rows.map(function (r) {
        var chg = r.change_7d === null ? 'n/a' : '<span class="' + (r.change_7d >= 0 ? 'up' : 'down') + '">' + fmtPct(r.change_7d) + '</span>';
        return '<tr data-slug="' + esc(r.slug) + '">' +
          '<td>' + r.rank + '</td>' +
          '<td class="name">' + esc(r.name) + (r.watchlist ? '<span class="badge">WATCHLIST</span>' : '') + '<span class="slug">' + esc(r.slug) + '</span></td>' +
          '<td class="cat">' + esc(r.category || 'Uncategorised') + '</td>' +
          '<td class="chains">' + esc(r.chains.slice(0, 3).join(', ')) + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '') + '</td>' +
          '<td>' + fmtUsd(r.tvl_usd) + '</td>' +
          '<td>' + chg + '</td>' +
          '<td>' + fmtAge(r.age_days) + '</td>' +
          '<td>' + fmtMult(r.multiple) + '</td>' +
          '<td class="implied">' + fmtUsd(r.implied_value_usd) + '<span class="range">' + fmtUsd(r.implied_low_usd) + '&ndash;' + fmtUsd(r.implied_high_usd) + '</span></td></tr>';
      }).join('') + '</tbody></table></div>';
    }
    app.innerHTML = html;
    bindBoard();
  }

  function bindBoard() {
    var q = document.getElementById('q');
    q.addEventListener('input', function () {
      state.q = this.value;
      var pos = this.selectionStart;
      renderBoard();
      var nq = document.getElementById('q');
      nq.focus();
      nq.setSelectionRange(pos, pos);
    });
    document.getElementById('cat').addEventListener('change', function () { state.category = this.value; renderBoard(); });
    document.getElementById('chain').addEventListener('change', function () { state.chain = this.value; renderBoard(); });
    document.getElementById('wl').addEventListener('change', function () { state.wl = this.checked; renderBoard(); });
    var heads = app.querySelectorAll('th[data-sort]');
    for (var i = 0; i < heads.length; i++) {
      heads[i].addEventListener('click', function () {
        var s = this.getAttribute('data-sort');
        if (state.sort === s) state.dir = -state.dir;
        else { state.sort = s; state.dir = (s === 'name') ? 1 : -1; }
        renderBoard();
      });
    }
    var trs = app.querySelectorAll('tr[data-slug]');
    for (var j = 0; j < trs.length; j++) {
      trs[j].addEventListener('click', function () {
        state.slug = this.getAttribute('data-slug');
        render();
        window.scrollTo(0, 0);
      });
    }
  }

  function renderDetail() {
    var r = null;
    D.rows.forEach(function (x) { if (x.slug === state.slug) r = x; });
    if (!r) { state.slug = null; renderBoard(); return; }
    var peers = r.category_peers > 0
      ? 'priced from ' + r.category_peers + ' token-bearing ' + esc(r.category || '') + ' peer' + (r.category_peers === 1 ? '' : 's') + ' in this snapshot'
      : 'no priced peer in its category: the global median is used';
    app.innerHTML = '<div class="wrap"><div class="detail">' +
      '<button class="back" id="back">&larr; Back to the board</button>' +
      '<div class="dhead"><h2>' + esc(r.name) + (r.watchlist ? '<span class="badge">WATCHLIST</span>' : '') + '</h2>' +
      '<div class="dimplied"><span>Implied value</span><b>' + fmtUsd(r.implied_value_usd) + '</b></div></div>' +
      '<p class="sub">' + esc(r.slug) + ' &middot; ' + esc(r.category || 'Uncategorised') + ' &middot; rank #' + r.rank +
      ' of ' + D.board_size + ' &middot; token status: <b>pre-token</b> (no token recorded in the snapshot)</p>' +
      '<div class="formula">implied &asymp; ' + fmtUsd(r.tvl_usd) + ' TVL &times; ' + fmtMult(r.multiple) + ' fitted multiple ' +
      '(category ' + fmtMult(r.category_multiple) + ' &times; size ' + fmtMult(r.size_multiplier) + ') &times; x' +
      r.growth_multiplier.toFixed(2) + ' growth &times; x' + r.maturity_multiplier.toFixed(2) + ' maturity = ' + fmtUsd(r.implied_value_usd) +
      '<span class="finenote">Holdout range ' + fmtUsd(r.implied_low_usd) + ' &ndash; ' + fmtUsd(r.implied_high_usd) +
      ': this value scaled by the fitted model&rsquo;s walk-forward residuals (p25&ndash;p75). Factors rounded for display; ' +
      'the full-precision arithmetic for this row is in z-model-evidence.md, shipped with this dashboard.</span></div>' +
      '<div class="chips">' +
      '<span class="chip">Multiple <b>' + fmtMult(r.multiple) + '</b></span>' +
      '<span class="chip">Category base <b>' + fmtMult(r.category_multiple) + '</b></span>' +
      '<span class="chip">Size effect <b>' + fmtMult(r.size_multiplier) + '</b></span>' +
      '<span class="chip">Priced peers <b>' + r.category_peers + '</b></span>' +
      '<span class="chip">Growth <b>x' + r.growth_multiplier.toFixed(2) + '</b> (7d ' + fmtPct(r.change_7d) + ')</span>' +
      '<span class="chip">Maturity <b>x' + r.maturity_multiplier.toFixed(2) + '</b></span>' +
      '<span class="chip">Age <b>' + fmtAge(r.age_days) + '</b> (listed ' + esc(r.listed_at || 'unrecorded') + ')</span>' +
      '<span class="chip">TVL <b>' + fmtUsd(r.tvl_usd) + '</b></span>' +
      '<span class="chip">Holdout range <b>' + fmtUsd(r.implied_low_usd) + ' &ndash; ' + fmtUsd(r.implied_high_usd) + '</b></span>' +
      '<span class="chip">Chains <b>' + r.chains.length + '</b> ' + esc(r.chains.slice(0, 3).join(', ')) + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '') + '</span>' +
      '</div>' +
      '<p class="peers-note">The multiple is fitted, not looked up: the median log market-cap/TVL of its category, ' + peers + ', then adjusted for this protocol&rsquo;s size by the fitted slope.</p>' +
      '<h3>How to farm it</h3>' +
      '<ol class="farm">' + r.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
      '<p class="live-note">Farming is a claim on a token that may never exist: size every position so that its total loss is acceptable, and re-check the protocol&rsquo;s own pages before acting.</p>' +
      '</div></div>';
    document.getElementById('back').addEventListener('click', function () { state.slug = null; render(); });
  }

  function renderLive() {
    var html = '<div class="wrap"><p class="live-note" style="padding-top:16px">These protocols already have a token: the radar never ranks them. ' +
      'Their market caps over their TVL are the multiples the pre-token board above is priced from &mdash; the market&rsquo;s own answer, ' +
      'shown at the values the snapshot records.</p><table><thead><tr><th>#</th><th>Protocol</th><th>Category</th><th>Chains</th><th>TVL</th><th>7d</th><th>Market cap</th><th>Mcap / TVL</th></tr></thead><tbody>';
    html += D.live.map(function (r, i) {
      var ratio = r.mcap_usd && r.tvl_usd ? 'x' + (r.mcap_usd / r.tvl_usd).toFixed(2) : 'n/a';
      var chg = r.change_7d === null ? 'n/a' : '<span class="' + (r.change_7d >= 0 ? 'up' : 'down') + '">' + fmtPct(r.change_7d) + '</span>';
      return '<tr><td>' + (i + 1) + '</td>' +
        '<td class="name">' + esc(r.name) + '<span class="slug">' + esc(r.slug) + '</span></td>' +
        '<td class="cat">' + esc(r.category || 'Uncategorised') + '</td>' +
        '<td class="chains">' + esc(r.chains.slice(0, 3).join(', ')) + '</td>' +
        '<td>' + fmtUsd(r.tvl_usd) + '</td><td>' + chg + '</td>' +
        '<td>' + fmtUsd(r.mcap_usd) + '</td><td>' + ratio + '</td></tr>';
    }).join('') + '</tbody></table></div>';
    app.innerHTML = html;
  }

  function render() {
    renderHead();
    if (state.slug) renderDetail();
    else if (state.view === 'live') renderLive();
    else renderBoard();
  }

  foot.innerHTML = '<div class="wrap">Data: ' + esc(D.source) + ' &middot; snapshot of ' + esc(D.as_of) +
    ' &middot; model ' + esc(D.model_version) + ', computed from the snapshot alone; nothing on this page is fetched or live. ' +
    'An implied value is this board&rsquo;s own claim about a hypothetical token, never a prediction that one will be issued.</div>';

  render();
})();
