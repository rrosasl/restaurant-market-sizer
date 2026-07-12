# Restaurant Market Sizer

A guided web app that estimates a restaurant's realistic annual revenue range with a
Monte Carlo simulation. Evolved from the original
[MarketSizing notebook](https://github.com/rrosasl/MarketSizing) — same core idea
(three-point estimates → simulated scenarios → sensitivity), rebuilt with the fixes below.

## Run it

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/streamlit run app.py
```

## What it does

1. **Questionnaire** — asks for the restaurant concept, what you sell, and
   pessimistic / most likely / optimistic estimates for six inputs (demand at
   peak and off-peak, opening hours, peak hours, days open, price).
   Or, **auto-fill from Google Maps**: search a real place (yours or a
   comparable one) and derive starting estimates from its public data —
   opening hours and days from the schedule, price from Google's €-€€€€
   price level, and demand from review velocity (reviews/year ÷ assumed
   review rate). Every derived number shows its reasoning and stays editable.
   Requires a Google Maps API key with "Places API (New)" enabled (there's a
   demo mode with sample data to try the flow without one). Menu prices and
   hour-by-hour busyness are not exposed by Google's public API, so those
   remain estimates.
2. **Follow-ups** — flags inconsistent answers (e.g. peak hours exceeding opening
   hours) and asks about price sensitivity to link price and demand in the simulation.
3. **Report** — simulated revenue distribution with P10/median/P90, deterministic
   vs simulated scenarios, tornado chart, in-simulation feature importance
   (Spearman), exceedance curve, implied-numbers sanity check, and a downloadable
   standalone HTML report.

## Fixes vs the original notebook

| Original | Here |
|---|---|
| Hand-calibrated skew-normal whose skew parameter was accidentally ~0 | Beta-PERT distribution that hits the three estimates by construction |
| Loc/scale not actually matching intended percentiles; truncation shifted them further | PERT is bounded by min/max natively — no truncation needed |
| Python list comprehensions over 150k samples, oversample + shuffle | Vectorized NumPy throughout |
| `np.int()` (removed in NumPy ≥ 1.24) | Plain `int` / modern APIs |
| No random seed | Seeded `default_rng`, reproducible |
| All inputs sampled independently | Optional price↔demand correlation via Gaussian copula |
| `peak_hours ≤ hours_day` only true by coincidence of bounds | Enforced per scenario + input validation |
| Sensitivity re-simulated 18× with frozen inputs | Deterministic tornado + Spearman importance from the existing simulation |

## Files

- `model.py` — simulation engine (pure functions, no UI). Start here to understand the math.
- `app.py` — Streamlit questionnaire, charts, and report.
- `places.py` — Google Places API (New) client + demo fixtures.
- `estimator.py` — turns place data into three-point assumptions, with rationales.

## Google Maps API key

For local use, paste the key into the app (it's only sent to Google, never stored).
For a deployed app, add it to Streamlit secrets as `GOOGLE_MAPS_API_KEY` and the
app will pick it up automatically.
