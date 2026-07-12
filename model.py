"""
Monte Carlo market-sizing engine for restaurants.

This is a rewrite of the original arepa-notebook logic with the following fixes:

1. PERT (Beta-PERT) distributions instead of a hand-calibrated skew-normal.
   The user supplies (pessimistic, most likely, optimistic) and the distribution
   hits those bounds by construction — no truncation, no oversampling, no shuffle.
2. Fully vectorized NumPy sampling (no Python-level list comprehensions).
3. Reproducible: a single seeded Generator drives every draw.
4. Optional correlation between inputs (Gaussian copula), e.g. price vs demand.
5. Structural constraint peak_hours <= hours_day enforced per scenario.
6. Feature importance computed from the simulation itself (Spearman rank
   correlation) plus a classic deterministic tornado — no re-simulation loops.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from scipy import stats


@dataclass
class Assumption:
    """A three-point estimate for one model input."""
    name: str
    label: str
    low: float          # pessimistic (treated as the distribution's minimum)
    mode: float         # most likely value
    high: float         # optimistic (treated as the distribution's maximum)
    discrete: bool = False

    def validate(self) -> Optional[str]:
        if not (self.low <= self.mode <= self.high):
            return f"{self.label}: values must satisfy pessimistic <= most likely <= optimistic"
        if self.low < 0:
            return f"{self.label}: values cannot be negative"
        return None


def pert_ppf(u: np.ndarray, low: float, mode: float, high: float, lam: float = 4.0) -> np.ndarray:
    """Inverse CDF of a Beta-PERT distribution, applied to uniforms `u`.

    Going through the ppf (rather than .rvs) lets the same function serve both
    independent sampling and copula-based correlated sampling.
    """
    if high == low:  # degenerate: user is certain
        return np.full_like(u, mode, dtype=float)
    alpha = 1 + lam * (mode - low) / (high - low)
    beta = 1 + lam * (high - mode) / (high - low)
    return low + (high - low) * stats.beta(alpha, beta).ppf(u)


def _nearest_psd(matrix: np.ndarray) -> np.ndarray:
    """Clip negative eigenvalues so the correlation matrix is usable by a copula."""
    vals, vecs = np.linalg.eigh(matrix)
    if vals.min() >= 1e-10:
        return matrix
    vals = np.clip(vals, 1e-10, None)
    fixed = vecs @ np.diag(vals) @ vecs.T
    d = np.sqrt(np.diag(fixed))
    fixed = fixed / np.outer(d, d)
    np.fill_diagonal(fixed, 1.0)
    return fixed


def sample_inputs(
    assumptions: List[Assumption],
    n: int,
    seed: int = 42,
    correlations: Optional[Dict[Tuple[str, str], float]] = None,
) -> pd.DataFrame:
    """Draw n scenarios for every assumption.

    correlations: optional {(name_a, name_b): rho} pairs, imposed with a
    Gaussian copula (sample correlated normals -> uniforms -> PERT ppf).
    """
    rng = np.random.default_rng(seed)
    names = [a.name for a in assumptions]
    k = len(assumptions)

    corr = np.eye(k)
    for (a, b), rho in (correlations or {}).items():
        i, j = names.index(a), names.index(b)
        corr[i, j] = corr[j, i] = rho
    corr = _nearest_psd(corr)

    normals = rng.multivariate_normal(np.zeros(k), corr, size=n)
    uniforms = stats.norm.cdf(normals)

    data = {}
    for idx, a in enumerate(assumptions):
        samples = pert_ppf(uniforms[:, idx], a.low, a.mode, a.high)
        if a.discrete:
            samples = np.round(samples)
        data[a.name] = samples
    return pd.DataFrame(data)


def market_sizing(
    peak_units_hour, offpeak_units_hour, hours_day, peak_hours, days_year, price
):
    """Annual revenue. Works on scalars and on full simulation columns alike."""
    peak_hours = np.minimum(peak_hours, hours_day)  # structural constraint
    offpeak_hours = hours_day - peak_hours
    units_day = peak_hours * peak_units_hour + offpeak_hours * offpeak_units_hour
    return days_year * units_day * price


MODEL_INPUT_ORDER = [
    "peak_units_hour", "offpeak_units_hour", "hours_day",
    "peak_hours", "days_year", "price",
]


def run_simulation(
    assumptions: List[Assumption],
    n: int = 50_000,
    seed: int = 42,
    correlations: Optional[Dict[Tuple[str, str], float]] = None,
) -> pd.DataFrame:
    """Sample all inputs and evaluate the revenue model for every scenario."""
    sims = sample_inputs(assumptions, n=n, seed=seed, correlations=correlations)
    sims["revenue"] = market_sizing(*[sims[c] for c in MODEL_INPUT_ORDER])
    return sims


def deterministic_cases(assumptions: List[Assumption]) -> pd.DataFrame:
    """Base / pessimistic / optimistic cases straight through the formula.

    Note: 'all pessimistic at once' is deliberately extreme — the Monte Carlo
    percentiles are the realistic range; these bracket the theoretical one.
    """
    by_name = {a.name: a for a in assumptions}
    rows = {}
    for case, attr in [("Pessimistic", "low"), ("Base", "mode"), ("Optimistic", "high")]:
        vals = [getattr(by_name[c], attr) for c in MODEL_INPUT_ORDER]
        rows[case] = market_sizing(*vals)
    return pd.DataFrame.from_dict(rows, orient="index", columns=["revenue"])


def tornado_data(assumptions: List[Assumption]) -> pd.DataFrame:
    """Classic one-at-a-time tornado: swing each input low->high, others at mode."""
    by_name = {a.name: a for a in assumptions}
    base_vals = {c: by_name[c].mode for c in MODEL_INPUT_ORDER}
    base = market_sizing(*[base_vals[c] for c in MODEL_INPUT_ORDER])

    rows = []
    for a in assumptions:
        lo_vals = dict(base_vals, **{a.name: a.low})
        hi_vals = dict(base_vals, **{a.name: a.high})
        rev_lo = market_sizing(*[lo_vals[c] for c in MODEL_INPUT_ORDER])
        rev_hi = market_sizing(*[hi_vals[c] for c in MODEL_INPUT_ORDER])
        rows.append({
            "input": a.label,
            "low_case": min(rev_lo, rev_hi),
            "high_case": max(rev_lo, rev_hi),
            "swing": abs(rev_hi - rev_lo),
        })
    df = pd.DataFrame(rows).sort_values("swing", ascending=True)
    df.attrs["base"] = base
    return df


def spearman_importance(sims: pd.DataFrame) -> pd.Series:
    """Rank-correlation of each input with revenue, measured inside the actual
    simulated joint distribution (captures interactions and correlations)."""
    inputs = [c for c in sims.columns if c != "revenue"]
    rho = {c: stats.spearmanr(sims[c], sims["revenue"]).statistic for c in inputs}
    return pd.Series(rho).sort_values(key=np.abs)


def summary_stats(sims: pd.DataFrame) -> Dict[str, float]:
    rev = sims["revenue"]
    return {
        "p10": float(np.percentile(rev, 10)),
        "p50": float(np.percentile(rev, 50)),
        "p90": float(np.percentile(rev, 90)),
        "mean": float(rev.mean()),
        "std": float(rev.std()),
    }
