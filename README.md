# token-radar-01-entry-v3

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/sunqincang/token-radar-01-entry-v3/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/sunqincang/token-radar-01-entry-v3/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: it reads the sealed DefiLlama snapshot, ranks every
pre-token protocol by an implied value from a model fitted on the
snapshot's own token-bearing protocols (each category's median log
market-cap/TVL, shrunk toward the global median, plus a fitted size term —
larger protocols price at lower multiples), with seven-day TVL growth and
tracked age entering as damped priors, and a walk-forward holdout range on
every value — and writes a self-contained dashboard (sortable, filterable,
one detail view per protocol with the model's arithmetic and a concrete
farm plan) plus the ranked board.

## Run it

```sh
node main.ts --input <snapshot.json|directory>
# writes board.json, data.js, dashboard/, screenshots/ and dossier.json
# to /output (or $MAKEFUN_OUTPUT_DIR)
```
