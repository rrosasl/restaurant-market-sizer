"""
Thin client for the Google Places API (New) — text search with the fields the
estimator needs. The API key is sent only to places.googleapis.com.

Menu prices and Google's "popular times" charts are NOT available through the
official API, so the estimator works from what is: opening hours, price level,
and review counts. A bundled DEMO_PLACES fixture lets the app run with no key.
"""

from typing import Dict, List

import requests

SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
FIELD_MASK = ",".join([
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.priceLevel",
    "places.rating",
    "places.userRatingCount",
    "places.regularOpeningHours",
    "places.types",
])


def search_places(query: str, api_key: str, max_results: int = 5) -> List[Dict]:
    """Search Google Maps for restaurants matching `query`."""
    resp = requests.post(
        SEARCH_URL,
        headers={
            "Content-Type": "application/json",
            "X-Goog-Api-Key": api_key,
            "X-Goog-FieldMask": FIELD_MASK,
        },
        json={"textQuery": query, "maxResultCount": max_results},
        timeout=15,
    )
    if resp.status_code != 200:
        detail = resp.json().get("error", {}).get("message", resp.text[:200])
        raise RuntimeError(f"Google Places API error ({resp.status_code}): {detail}")
    return resp.json().get("places", [])


def weekly_open_hours(place: Dict) -> Dict[int, float]:
    """Hours open per weekday {0=Sun .. 6=Sat} from regularOpeningHours.periods.

    Handles overnight closings (close on the next day). A single period with no
    close means open 24/7.
    """
    periods = place.get("regularOpeningHours", {}).get("periods", [])
    if not periods:
        return {}
    if len(periods) == 1 and "close" not in periods[0]:
        return {d: 24.0 for d in range(7)}

    hours: Dict[int, float] = {}
    for p in periods:
        o, c = p.get("open"), p.get("close")
        if not o or not c:
            continue
        start = o.get("hour", 0) + o.get("minute", 0) / 60
        end = c.get("hour", 0) + c.get("minute", 0) / 60
        if c.get("day") != o.get("day"):  # overnight
            end += 24
        day = o.get("day", 0)
        hours[day] = hours.get(day, 0.0) + max(0.0, end - start)
    return hours


def is_open_at(place: Dict, hour: float) -> bool:
    """True if the place is open at `hour` (0-24) on at least half its open days."""
    periods = place.get("regularOpeningHours", {}).get("periods", [])
    if len(periods) == 1 and "close" not in periods[0]:
        return True
    open_days, hit_days = set(), set()
    for p in periods:
        o, c = p.get("open"), p.get("close")
        if not o or not c:
            continue
        day = o.get("day", 0)
        open_days.add(day)
        start = o.get("hour", 0) + o.get("minute", 0) / 60
        end = c.get("hour", 0) + c.get("minute", 0) / 60
        if c.get("day") != day:
            end += 24
        if start <= hour < end or start <= hour + 24 < end:
            hit_days.add(day)
    return bool(open_days) and len(hit_days) >= len(open_days) / 2


# A realistic fixture (modeled on a small Latin-food spot in Barcelona) so the
# auto-fill flow can be tried without an API key.
DEMO_PLACES: List[Dict] = [
    {
        "id": "demo-1",
        "displayName": {"text": "Arepera La Guapa (demo data)"},
        "formattedAddress": "Carrer del Torrent de l'Olla 42, 08012 Barcelona, Spain",
        "priceLevel": "PRICE_LEVEL_INEXPENSIVE",
        "rating": 4.6,
        "userRatingCount": 1240,
        "types": ["restaurant", "food"],
        "regularOpeningHours": {
            "periods": [
                # Closed Mondays; Tue-Sun lunch through dinner
                {"open": {"day": 2, "hour": 12, "minute": 0}, "close": {"day": 2, "hour": 23, "minute": 0}},
                {"open": {"day": 3, "hour": 12, "minute": 0}, "close": {"day": 3, "hour": 23, "minute": 0}},
                {"open": {"day": 4, "hour": 12, "minute": 0}, "close": {"day": 4, "hour": 23, "minute": 0}},
                {"open": {"day": 5, "hour": 12, "minute": 0}, "close": {"day": 5, "hour": 24, "minute": 0}},
                {"open": {"day": 6, "hour": 12, "minute": 0}, "close": {"day": 6, "hour": 24, "minute": 0}},
                {"open": {"day": 0, "hour": 12, "minute": 0}, "close": {"day": 0, "hour": 22, "minute": 0}},
            ]
        },
    },
    {
        "id": "demo-2",
        "displayName": {"text": "Casa Arepa Gòtic (demo data)"},
        "formattedAddress": "Carrer d'Avinyó 15, 08002 Barcelona, Spain",
        "priceLevel": "PRICE_LEVEL_MODERATE",
        "rating": 4.3,
        "userRatingCount": 480,
        "types": ["restaurant", "food"],
        "regularOpeningHours": {
            "periods": [
                {"open": {"day": d, "hour": 13, "minute": 0}, "close": {"day": d, "hour": 16, "minute": 30}}
                for d in range(1, 6)
            ] + [
                {"open": {"day": d, "hour": 19, "minute": 30}, "close": {"day": d, "hour": 23, "minute": 30}}
                for d in range(1, 6)
            ]
        },
    },
]
