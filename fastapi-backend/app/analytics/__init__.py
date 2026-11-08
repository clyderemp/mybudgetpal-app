"""Pure analytics functions (spec §6). No DB, no I/O, no clock: inputs are injected."""

from .anomalies import detect_anomalies
from .debt import compare_strategies, monthly_interest, simulate_payoff
from .forecast import forecast_next_month
from .health import financial_health
from .summary import monthly_series, monthly_summary

__all__ = [
    "compare_strategies",
    "detect_anomalies",
    "financial_health",
    "forecast_next_month",
    "monthly_interest",
    "monthly_series",
    "monthly_summary",
    "simulate_payoff",
]
