"""
Restaurant Market Sizer — Streamlit app.

A guided questionnaire that collects three-point estimates for a restaurant's
unit economics, asks follow-up questions where the answers need them, then runs
a Monte Carlo simulation and renders a full report (distribution, scenarios,
tornado chart, feature importance, sanity checks).

Run with:  streamlit run app.py

State-handling note: canonical answers live in st.session_state.data (a plain
dict). Widgets get explicit value=/index= and write back via on_change. This
sidesteps two Streamlit pitfalls in multi-step apps: widget state is deleted
when a widget isn't rendered on a step, and (in 1.50) a keyed number_input
seeded only via session state renders 0 in the browser.
"""

from functools import partial
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from model import (
    Assumption,
    deterministic_cases,
    run_simulation,
    spearman_importance,
    summary_stats,
    tornado_data,
)

st.set_page_config(page_title="Restaurant Market Sizer", page_icon="🍽️", layout="wide")

ACCENT = "#2563eb"
ACCENT_LIGHT = "#93c5fd"
GRAY = "#6b7280"

QUESTIONS = {
    # name: (question template, help text, low, mode, high)
    "peak_units_hour": ("{U} sold per hour at peak times", "Think of your busiest lunch/dinner rush.", 30, 40, 50),
    "offpeak_units_hour": ("{U} sold per hour off-peak", "The quiet mid-afternoon hours.", 10, 15, 20),
    "hours_day": ("Opening hours per day", "Total hours the restaurant is open.", 10, 12, 13),
    "peak_hours": ("Peak (rush) hours per day", "How many of those hours are rush hours.", 2, 4, 6),
    "days_year": ("Days open per year", "365 minus closures and holidays.", 330, 350, 360),
    "price": ("Average price per unit ({C})", "What one unit sells for, on average.", 3.0, 4.0, 6.0),
}


# ------------------------------------------------------------------- state

def init_state():
    ss = st.session_state
    ss.setdefault("step", 1)
    if "data" not in ss:
        d = {"concept": "Arepa restaurant in Barcelona", "unit_name": "arepas",
             "currency": "EUR", "price_sensitivity": "Moderate", "demand_linked": True,
             "n_sims": 50_000, "seed": 42}
        for name, (_, _, lo, md, hi) in QUESTIONS.items():
            d[f"{name}_low"], d[f"{name}_mode"], d[f"{name}_high"] = float(lo), float(md), float(hi)
        ss.data = d


def save(key: str):
    """on_change callback: copy the widget's value into the canonical dict."""
    st.session_state.data[key] = st.session_state[f"w_{key}"]


def goto(step: int):
    st.session_state.step = step


def money(v: float, currency: str) -> str:
    sym = {"EUR": "€", "USD": "$", "GBP": "£"}.get(currency, currency + " ")
    return f"{sym}{v:,.0f}"


def gather_assumptions() -> List[Assumption]:
    d = st.session_state.data
    out = []
    for name, (template, _, *_rest) in QUESTIONS.items():
        label = template.format(U=d["unit_name"].capitalize(), C=d["currency"])
        out.append(Assumption(
            name=name, label=label,
            low=d[f"{name}_low"], mode=d[f"{name}_mode"], high=d[f"{name}_high"],
            discrete=(name != "price"),
        ))
    return out


def build_correlations() -> Dict[Tuple[str, str], float]:
    d = st.session_state.data
    corr: Dict[Tuple[str, str], float] = {}
    rho = {"None": 0.0, "Moderate": -0.35, "Strong": -0.6}[d["price_sensitivity"]]
    if rho != 0.0:
        corr[("price", "peak_units_hour")] = rho
        corr[("price", "offpeak_units_hour")] = rho
    if d["demand_linked"]:
        corr[("peak_units_hour", "offpeak_units_hour")] = 0.5
    return corr


# ------------------------------------------------------------------ widgets

def num_field(container, label: str, key: str, is_price: bool, help_text: str = None):
    step, fmt = (0.5, "%.2f") if is_price else (1.0, "%.0f")
    container.number_input(
        label, value=st.session_state.data[key], key=f"w_{key}",
        on_change=partial(save, key), min_value=0.0, step=step, format=fmt, help=help_text,
    )


def three_point_row(name: str, label: str, help_text: str):
    st.markdown(f"**{label}**  \n:gray[{help_text}]")
    c1, c2, c3 = st.columns(3)
    is_price = name == "price"
    num_field(c1, "Pessimistic", f"{name}_low", is_price,
              "A bad-but-plausible value. The simulation treats this as the floor.")
    num_field(c2, "Most likely", f"{name}_mode", is_price)
    num_field(c3, "Optimistic", f"{name}_high", is_price,
              "A great-but-plausible value. The simulation treats this as the ceiling.")


# ------------------------------------------------------------------- charts

def fig_distribution(sims: pd.DataFrame, stats_: Dict[str, float], currency: str) -> go.Figure:
    fig = go.Figure(go.Histogram(x=sims["revenue"], nbinsx=80, marker_color=ACCENT_LIGHT,
                                 marker_line_color="white", marker_line_width=0.5))
    for key, dash, label in [("p10", "dot", "P10"), ("p50", "solid", "Median"), ("p90", "dot", "P90")]:
        fig.add_vline(x=stats_[key], line_dash=dash, line_color=ACCENT,
                      annotation_text=f"{label}: {money(stats_[key], currency)}",
                      annotation_position="top")
    fig.update_layout(title="Simulated annual revenue (all scenarios)",
                      xaxis_title=f"Annual revenue ({currency})", yaxis_title="Scenarios",
                      showlegend=False, height=420, margin=dict(t=80))
    return fig


def fig_exceedance(sims: pd.DataFrame, currency: str) -> go.Figure:
    rev = np.sort(sims["revenue"].to_numpy())
    prob = 1 - np.arange(1, len(rev) + 1) / len(rev)
    fig = go.Figure(go.Scatter(x=rev, y=prob * 100, mode="lines", line=dict(color=ACCENT, width=3)))
    fig.update_layout(title="Chance of exceeding a revenue level",
                      xaxis_title=f"Annual revenue ({currency})",
                      yaxis_title="Probability of exceeding (%)", height=420)
    return fig


def fig_tornado(tor: pd.DataFrame, currency: str) -> go.Figure:
    base = tor.attrs["base"]
    fig = go.Figure(go.Bar(
        y=tor["input"], x=tor["high_case"] - tor["low_case"], base=tor["low_case"],
        orientation="h", marker_color=ACCENT_LIGHT, marker_line_color=ACCENT, marker_line_width=1,
        customdata=np.stack([tor["low_case"], tor["high_case"]], axis=-1),
        hovertemplate="%{y}<br>Low: %{customdata[0]:,.0f}<br>High: %{customdata[1]:,.0f}<extra></extra>",
    ))
    fig.add_vline(x=base, line_color="#dc2626",
                  annotation_text=f"Base case: {money(base, currency)}")
    fig.update_layout(title="Tornado chart — swing each input alone (others at base)",
                      xaxis_title=f"Annual revenue ({currency})", height=420)
    return fig


def fig_importance(imp: pd.Series, labels: Dict[str, str]) -> go.Figure:
    fig = go.Figure(go.Bar(
        y=[labels.get(n, n) for n in imp.index], x=imp.values, orientation="h",
        marker_color=[ACCENT if v >= 0 else "#f59e0b" for v in imp.values],
    ))
    fig.update_layout(title="Feature importance — rank correlation with revenue inside the simulation",
                      xaxis_title="Spearman correlation with revenue", height=420,
                      xaxis_range=[-1, 1])
    return fig


def fig_scenarios(cases: pd.DataFrame, stats_: Dict[str, float], currency: str) -> go.Figure:
    names = ["All pessimistic", "P10 (simulated)", "Median (simulated)",
             "Base case", "P90 (simulated)", "All optimistic"]
    vals = [cases.loc["Pessimistic", "revenue"], stats_["p10"], stats_["p50"],
            cases.loc["Base", "revenue"], stats_["p90"], cases.loc["Optimistic", "revenue"]]
    colors = [GRAY, ACCENT_LIGHT, ACCENT, "#1e40af", ACCENT_LIGHT, GRAY]
    fig = go.Figure(go.Bar(x=names, y=vals, marker_color=colors,
                           text=[money(v, currency) for v in vals], textposition="outside"))
    fig.update_layout(title="Scenarios — deterministic extremes vs realistic simulated range",
                      yaxis_title=f"Annual revenue ({currency})", height=440,
                      margin=dict(t=60))
    return fig


# ------------------------------------------------------------------- report

def build_html_report(figs: List[go.Figure], concept: str, narrative_md: str) -> str:
    parts = [
        "<html><head><meta charset='utf-8'><title>Market Sizing Report</title></head>",
        "<body style='font-family:sans-serif;max-width:1000px;margin:2rem auto;'>",
        f"<h1>Market Sizing Report — {concept}</h1>",
        f"<div style='white-space:pre-wrap'>{narrative_md}</div>",
    ]
    for i, f in enumerate(figs):
        parts.append(f.to_html(full_html=False, include_plotlyjs=(i == 0)))
    parts.append("</body></html>")
    return "".join(parts)


# ----------------------------------------------------------------------- UI

init_state()
ss = st.session_state
d = ss.data

st.title("🍽️ Restaurant Market Sizer")
st.caption("Answer a few questions about your restaurant, and a Monte Carlo simulation "
           "estimates your realistic annual revenue range — and what drives it most.")

steps = ["1 · Your restaurant", "2 · Your numbers", "3 · Follow-ups", "4 · Report"]
st.progress((ss.step - 1) / 3, text=steps[ss.step - 1])

if ss.step == 1:
    st.subheader("Tell us about the restaurant")
    st.text_input("What's the concept?", value=d["concept"], key="w_concept",
                  on_change=partial(save, "concept"),
                  placeholder="e.g. Arepa restaurant in Barcelona")
    st.text_input("What do you sell? (plural, e.g. arepas, pizzas, covers)",
                  value=d["unit_name"], key="w_unit_name", on_change=partial(save, "unit_name"))
    currencies = ["EUR", "USD", "GBP"]
    st.selectbox("Currency", currencies, index=currencies.index(d["currency"]),
                 key="w_currency", on_change=partial(save, "currency"))
    st.button("Next →", type="primary", on_click=goto, args=(2,))

elif ss.step == 2:
    st.subheader("Give three estimates for each number")
    st.markdown(":gray[**Pessimistic** = bad but plausible · **Most likely** = your best guess · "
                "**Optimistic** = great but plausible. The simulation explores everything in between.]")
    for name, (template, help_text, *_rest) in QUESTIONS.items():
        label = template.format(U=d["unit_name"].capitalize(), C=d["currency"])
        three_point_row(name, label, help_text)
        st.divider()
    c1, c2 = st.columns([1, 5])
    c1.button("← Back", on_click=goto, args=(1,))
    c2.button("Next →", type="primary", on_click=goto, args=(3,))

elif ss.step == 3:
    st.subheader("A couple of follow-up questions")

    problems = [p for a in gather_assumptions() if (p := a.validate())]
    if d["peak_hours_high"] > d["hours_day_low"]:
        st.warning(f"Your optimistic peak hours ({d['peak_hours_high']:.0f}) can exceed your "
                   f"pessimistic opening hours ({d['hours_day_low']:.0f}). The model caps peak hours "
                   "at opening hours in each scenario, but consider revisiting these estimates.")
    for p in problems:
        st.error(p)

    sens_options = ["None", "Moderate", "Strong"]
    st.radio(
        "If you raised prices, would you sell noticeably fewer units?",
        sens_options, index=sens_options.index(d["price_sensitivity"]),
        key="w_price_sensitivity", on_change=partial(save, "price_sensitivity"), horizontal=True,
        help="This links price and demand negatively in the simulation, so "
             "'high price AND high volume' scenarios become appropriately rare.",
    )
    st.checkbox(
        "Peak and off-peak demand tend to move together (a popular place is busy all day)",
        value=d["demand_linked"], key="w_demand_linked", on_change=partial(save, "demand_linked"),
    )
    with st.expander("Advanced settings"):
        st.select_slider("Number of simulated scenarios", [10_000, 25_000, 50_000, 100_000],
                         value=d["n_sims"], key="w_n_sims", on_change=partial(save, "n_sims"))
        st.number_input("Random seed (for reproducible results)", value=d["seed"],
                        key="w_seed", on_change=partial(save, "seed"), min_value=0, step=1)

    c1, c2 = st.columns([1, 5])
    c1.button("← Back", on_click=goto, args=(2,))
    c2.button("Run simulation 🎲", type="primary", disabled=bool(problems),
              on_click=goto, args=(4,))

elif ss.step == 4:
    assumptions = gather_assumptions()
    with st.spinner(f"Simulating {d['n_sims']:,} scenarios..."):
        sims = run_simulation(assumptions, n=d["n_sims"], seed=d["seed"],
                              correlations=build_correlations())
    stats_ = summary_stats(sims)
    cases = deterministic_cases(assumptions)
    tor = tornado_data(assumptions)
    imp = spearman_importance(sims)
    labels = {a.name: a.label for a in assumptions}
    cur = d["currency"]

    st.subheader(f"Report — {d['concept']}")

    k1, k2, k3, k4 = st.columns(4)
    k1.metric("Realistic floor (P10)", money(stats_["p10"], cur))
    k2.metric("Median revenue", money(stats_["p50"], cur))
    k3.metric("Realistic ceiling (P90)", money(stats_["p90"], cur))
    k4.metric("Mean", money(stats_["mean"], cur))

    top_driver = imp.abs().idxmax()
    narrative = (
        f"**Headline:** the most likely annual revenue is **{money(stats_['p50'], cur)}**, and there is an "
        f"80% chance it lands between **{money(stats_['p10'], cur)}** and **{money(stats_['p90'], cur)}**.\n\n"
        f"**Biggest driver:** *{labels.get(top_driver, top_driver)}* — improving your knowledge (or the reality) "
        f"of this input moves the estimate more than anything else. "
        f"The tornado chart below shows each input's individual swing."
    )
    st.markdown(narrative)

    f1 = fig_distribution(sims, stats_, cur)
    f2 = fig_scenarios(cases, stats_, cur)
    f3 = fig_tornado(tor, cur)
    f4 = fig_importance(imp, labels)
    f5 = fig_exceedance(sims, cur)

    c1, c2 = st.columns(2)
    c1.plotly_chart(f1, use_container_width=True)
    c2.plotly_chart(f2, use_container_width=True)
    c3, c4 = st.columns(2)
    c3.plotly_chart(f3, use_container_width=True)
    c4.plotly_chart(f4, use_container_width=True)
    st.plotly_chart(f5, use_container_width=True)

    st.subheader("Sanity check — do these implied numbers feel right?")
    per_day_units = (sims["revenue"] / (sims["days_year"] * sims["price"])).median()
    per_day_rev = (sims["revenue"] / sims["days_year"]).median()
    per_hour_rev = (sims["revenue"] / (sims["days_year"] * sims["hours_day"])).median()
    s1, s2, s3 = st.columns(3)
    s1.metric(f"{d['unit_name'].capitalize()} per day (median)", f"{per_day_units:,.0f}")
    s2.metric("Revenue per open day (median)", money(per_day_rev, cur))
    s3.metric("Revenue per open hour (median)", money(per_hour_rev, cur))
    st.caption("If any of these feel off compared to restaurants you know, revisit the assumptions — "
               "that's the fastest way to catch a broken model.")

    html = build_html_report([f1, f2, f3, f4, f5], d["concept"], narrative.replace("**", ""))
    c1, c2 = st.columns([1, 3])
    c1.button("← Edit assumptions", on_click=goto, args=(3,))
    c2.download_button("⬇️ Download full report (HTML)", data=html,
                       file_name="market_sizing_report.html", mime="text/html")
