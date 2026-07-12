"""
Turns Google Maps place data into three-point assumptions for the market model.

Every derived value carries a `rationale` explaining the chain from data to
number — the point is to give a defensible starting range, not false precision.
The user reviews and edits everything before simulating.

Heuristics used (all deliberately wide):
- Opening hours/days come straight from the place's schedule (the hard data).
- Peak hours: 2h per meal service (lunch/dinner) the schedule covers.
- Price: Google's price level (€..€€€€) mapped to average-ticket bands.
- Demand: review-velocity method. Only a small fraction of customers leave a
  Google review (industry estimates ~1.5-10%). reviews/year ÷ review rate
  ≈ customers/year, spread across peak (≈65%) and off-peak hours.
"""

from dataclasses import dataclass
from typing import Dict, Optional

from places import is_open_at, weekly_open_hours

# (low, mode, high) average ticket in EUR by Google price level
PRICE_BANDS = {
    "PRICE_LEVEL_INEXPENSIVE": (6.0, 10.0, 15.0),
    "PRICE_LEVEL_MODERATE": (12.0, 20.0, 30.0),
    "PRICE_LEVEL_EXPENSIVE": (25.0, 40.0, 60.0),
    "PRICE_LEVEL_VERY_EXPENSIVE": (50.0, 80.0, 120.0),
}

# Fraction of customers who leave a Google review. Low rate -> high traffic
# estimate and vice versa, so the pessimistic customer count uses the HIGH rate.
REVIEW_RATE_LOW, REVIEW_RATE_MODE, REVIEW_RATE_HIGH = 0.015, 0.04, 0.10
PEAK_TRAFFIC_SHARE = 0.65  # share of a day's customers served during peak hours


@dataclass
class Derived:
    low: float
    mode: float
    high: float
    rationale: str
    from_data: bool  # False when we fell back to generic defaults


def derive_assumptions(place: Dict, age_years: float) -> Dict[str, Derived]:
    """Map one Google Maps place + the restaurant's age to model assumptions."""
    out: Dict[str, Derived] = {}
    name = place.get("displayName", {}).get("text", "this place")

    # --- opening hours per day ------------------------------------------------
    weekly = weekly_open_hours(place)
    if weekly:
        per_day = sorted(weekly.values())
        h_low, h_high = per_day[0], per_day[-1]
        h_mode = round(sum(per_day) / len(per_day))
        if h_low == h_high:
            h_low = max(1.0, h_low - 1)  # keep a sliver of uncertainty
        out["hours_day"] = Derived(
            round(h_low), h_mode, round(h_high), from_data=True,
            rationale=f"Google Maps schedule: between {per_day[0]:.0f} and {per_day[-1]:.0f} "
                      f"hours open per day, depending on the weekday.",
        )
    else:
        out["hours_day"] = Derived(10, 12, 13, False, "No schedule on Google Maps — generic default.")

    # --- days open per year ---------------------------------------------------
    if weekly:
        dpw = len(weekly)
        out["days_year"] = Derived(
            dpw * 46, dpw * 50, dpw * 52, from_data=True,
            rationale=f"Open {dpw} days/week per the schedule → {dpw * 52}/year at most, "
                      f"minus 0-6 weeks of closures.",
        )
    else:
        out["days_year"] = Derived(330, 350, 360, False, "No schedule — generic default.")

    # --- peak hours per day ---------------------------------------------------
    services = int(is_open_at(place, 13.5)) + int(is_open_at(place, 20.5))
    if weekly and services:
        p_mode = 2 * services
        p_high = min(p_mode + 2, out["hours_day"].low)  # never exceeds shortest day
        out["peak_hours"] = Derived(
            max(1, p_mode - 1), p_mode, p_high, from_data=True,
            rationale=f"Schedule covers {services} meal service(s) (lunch/dinner) — "
                      f"~2 rush hours each.",
        )
    else:
        out["peak_hours"] = Derived(2, 4, 6, False, "Could not infer services — generic default.")

    # --- price ------------------------------------------------------------
    band = PRICE_BANDS.get(place.get("priceLevel", ""))
    if band:
        symbol = "€" * (list(PRICE_BANDS).index(place["priceLevel"]) + 1)
        out["price"] = Derived(
            *band, from_data=True,
            rationale=f"Google rates {name} as '{symbol}' — typical average ticket "
                      f"{band[0]:.0f}-{band[2]:.0f} EUR. Menu prices aren't in the public "
                      f"API; refine this from the actual menu if you can.",
        )
    else:
        out["price"] = Derived(3, 4, 6, False, "No price level on Google Maps — generic default.")

    # --- demand from review velocity -------------------------------------
    reviews = place.get("userRatingCount")
    if reviews and age_years > 0:
        reviews_per_year = reviews / age_years
        cust_year = {
            "low": reviews_per_year / REVIEW_RATE_HIGH,
            "mode": reviews_per_year / REVIEW_RATE_MODE,
            "high": reviews_per_year / REVIEW_RATE_LOW,
        }
        days = out["days_year"].mode
        peak_h = out["peak_hours"].mode
        offpeak_h = max(1.0, out["hours_day"].mode - peak_h)

        def per_hour(cyear: float, share: float, hours: float) -> float:
            return max(1.0, round(cyear / days * share / hours))

        rationale = (
            f"{reviews:,} Google reviews in ~{age_years:.0f} years ≈ {reviews_per_year:,.0f}/year. "
            f"Assuming {REVIEW_RATE_LOW:.1%}-{REVIEW_RATE_HIGH:.0%} of customers leave a review "
            f"→ roughly {cust_year['low']:,.0f}-{cust_year['high']:,.0f} orders/year, "
            f"with ~{PEAK_TRAFFIC_SHARE:.0%} served during rush hours."
        )
        out["peak_units_hour"] = Derived(
            per_hour(cust_year["low"], PEAK_TRAFFIC_SHARE, peak_h),
            per_hour(cust_year["mode"], PEAK_TRAFFIC_SHARE, peak_h),
            per_hour(cust_year["high"], PEAK_TRAFFIC_SHARE, peak_h),
            from_data=True, rationale=rationale,
        )
        out["offpeak_units_hour"] = Derived(
            per_hour(cust_year["low"], 1 - PEAK_TRAFFIC_SHARE, offpeak_h),
            per_hour(cust_year["mode"], 1 - PEAK_TRAFFIC_SHARE, offpeak_h),
            per_hour(cust_year["high"], 1 - PEAK_TRAFFIC_SHARE, offpeak_h),
            from_data=True, rationale="Same review-velocity estimate, spread over off-peak hours.",
        )
    else:
        why = "No review count on Google Maps" if not reviews else "Unknown restaurant age"
        out["peak_units_hour"] = Derived(30, 40, 50, False, f"{why} — generic default.")
        out["offpeak_units_hour"] = Derived(10, 15, 20, False, f"{why} — generic default.")

    return out


def place_summary(place: Dict) -> str:
    """One-line description of a search result for pickers and captions."""
    name = place.get("displayName", {}).get("text", "Unknown")
    addr = place.get("formattedAddress", "")
    rating = place.get("rating")
    count = place.get("userRatingCount")
    bits = [name]
    if rating:
        bits.append(f"★{rating} ({count:,} reviews)" if count else f"★{rating}")
    if addr:
        bits.append(addr)
    return " · ".join(bits)
