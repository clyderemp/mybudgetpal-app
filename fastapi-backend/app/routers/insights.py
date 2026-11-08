from __future__ import annotations

import datetime as dt
from typing import Any

from fastapi import APIRouter, Depends, Query

from app.analytics import detect_anomalies, forecast_next_month, monthly_series
from app.security.deps import CurrentUser, get_current_user
from app.services.insights import get_today, health_for, load_months, month_str, shift_month, summary_with_previous
from app.services.months import parse_month

router = APIRouter(prefix="/insights", tags=["insights"])

FORECAST_HISTORY_MONTHS = 6
ANOMALY_LOOKBACK_MONTHS = 6


@router.get("/summary")
async def summary(
    month: str | None = Query(None),
    current: CurrentUser = Depends(get_current_user),
    today: dt.date = Depends(get_today),
) -> dict[str, Any]:
    """monthly_summary for ``month`` (default: current month) + previous month + deltas."""
    m = parse_month(month) if month else month_str(today)
    txns = await load_months(current.household_id, shift_month(m, -1), m)
    return summary_with_previous(txns, m)


@router.get("/trends")
async def trends(
    months: int = Query(12, ge=1, le=60),
    current: CurrentUser = Depends(get_current_user),
    today: dt.date = Depends(get_today),
) -> dict[str, Any]:
    end = month_str(today)
    txns = await load_months(current.household_id, shift_month(end, -(months - 1)), end)
    items = monthly_series(txns, end, months)
    return {"items": items, "total": len(items)}


@router.get("/forecast")
async def forecast(
    current: CurrentUser = Depends(get_current_user),
    today: dt.date = Depends(get_today),
) -> dict[str, Any]:
    cur = month_str(today)
    txns = await load_months(current.household_id, shift_month(cur, -FORECAST_HISTORY_MONTHS), cur)
    return forecast_next_month(txns, today, FORECAST_HISTORY_MONTHS)


@router.get("/anomalies")
async def anomalies(
    month: str | None = Query(None),
    current: CurrentUser = Depends(get_current_user),
    today: dt.date = Depends(get_today),
) -> dict[str, Any]:
    m = parse_month(month) if month else month_str(today)
    txns = await load_months(current.household_id, shift_month(m, -ANOMALY_LOOKBACK_MONTHS), m)
    items = detect_anomalies(txns, m, ANOMALY_LOOKBACK_MONTHS)
    return {"items": items, "total": len(items)}


@router.get("/health")
async def health(
    current: CurrentUser = Depends(get_current_user),
    today: dt.date = Depends(get_today),
) -> dict[str, Any]:
    return await health_for(current.household_id, today)
