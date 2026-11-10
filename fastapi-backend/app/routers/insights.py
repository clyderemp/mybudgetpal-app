from __future__ import annotations

import asyncio
import datetime as dt
from typing import Any

from fastapi import APIRouter, Depends, Query

from app.analytics.explore import GRANULARITIES, GROUP_BYS, apply_filters, auto_granularity, explore, period_start
from app.errors import AppError
from app.models import Account, Category, User
from app.services.analytics_data import BUSINESS_CATEGORY_PREFIX, is_business_category, load_analytics_txns

from app.analytics import detect_anomalies, forecast_next_month, monthly_series
from app.security.deps import CurrentUser, get_current_user
from app.services.insights import get_today, health_for, load_months, month_str, shift_month, summary_with_previous
from app.services.months import parse_month

router = APIRouter(prefix="/insights", tags=["insights"])

FORECAST_HISTORY_MONTHS = 6
ANOMALY_LOOKBACK_MONTHS = 6
EXPLORE_MAX_DAYS = 366 * 5
FORECAST_HISTORY_PERIODS = {"day": 60, "week": 26, "month": 12}


def _ids(raw: str | None) -> set[str] | None:
    vals = {v.strip() for v in (raw or "").split(",") if v.strip()}
    return vals or None


@router.get("/summary")
async def summary(
    month: str | None = Query(None),
    include_business: bool = Query(False, alias="includeBusiness"),
    current: CurrentUser = Depends(get_current_user),
    today: dt.date = Depends(get_today),
) -> dict[str, Any]:
    """monthly_summary for ``month`` (default: current month) + previous month + deltas."""
    m = parse_month(month) if month else month_str(today)
    txns = await load_months(
        current.household_id, shift_month(m, -1), m, include_business=include_business
    )
    return summary_with_previous(txns, m)


@router.get("/trends")
async def trends(
    months: int = Query(12, ge=1, le=60),
    end: str | None = Query(None, description="last month of the series (YYYY-MM); default: current month"),
    include_business: bool = Query(False, alias="includeBusiness"),
    current: CurrentUser = Depends(get_current_user),
    today: dt.date = Depends(get_today),
) -> dict[str, Any]:
    end = parse_month(end) if end else month_str(today)
    txns = await load_months(
        current.household_id, shift_month(end, -(months - 1)), end, include_business=include_business
    )
    items = monthly_series(txns, end, months)
    return {"items": items, "total": len(items)}


@router.get("/forecast")
async def forecast(
    include_business: bool = Query(False, alias="includeBusiness"),
    current: CurrentUser = Depends(get_current_user),
    today: dt.date = Depends(get_today),
) -> dict[str, Any]:
    cur = month_str(today)
    first = shift_month(cur, -FORECAST_HISTORY_MONTHS)
    txns = await load_months(current.household_id, first, cur, include_business=include_business)
    return forecast_next_month(txns, today, FORECAST_HISTORY_MONTHS)


@router.get("/anomalies")
async def anomalies(
    month: str | None = Query(None),
    include_business: bool = Query(False, alias="includeBusiness"),
    current: CurrentUser = Depends(get_current_user),
    today: dt.date = Depends(get_today),
) -> dict[str, Any]:
    m = parse_month(month) if month else month_str(today)
    txns = await load_months(
        current.household_id, shift_month(m, -ANOMALY_LOOKBACK_MONTHS), m, include_business=include_business
    )
    items = detect_anomalies(txns, m, ANOMALY_LOOKBACK_MONTHS)
    return {"items": items, "total": len(items)}


@router.get("/health")
async def health(
    include_business: bool = Query(False, alias="includeBusiness"),
    current: CurrentUser = Depends(get_current_user),
    today: dt.date = Depends(get_today),
) -> dict[str, Any]:
    return await health_for(current.household_id, today, include_business=include_business)


@router.get("/explore")
async def explore_endpoint(
    from_: dt.date | None = Query(None, alias="from"),
    to: dt.date | None = Query(None),
    flow: str = Query("expense", pattern="^(expense|income)$"),
    granularity: str | None = Query(None, description="day | week | month; default: by range length"),
    group_by: str = Query("category", alias="groupBy"),
    categories: str | None = Query(None, description="comma-separated category ids; 'none' = uncategorised"),
    accounts: str | None = Query(None),
    members: str | None = Query(None),
    merchant: str | None = Query(None, max_length=80),
    horizon: int = Query(3, ge=1, le=12),
    include_business: bool = Query(False, alias="includeBusiness"),
    current: CurrentUser = Depends(get_current_user),
    today: dt.date = Depends(get_today),
) -> dict[str, Any]:
    """Filtered totals, series, breakdowns and forecast for any date range (spec §6 explore)."""
    end = to or today
    if from_ is not None:
        start = from_
    else:  # default: the last 12 months, starting on the 1st
        y, m = (end.year, end.month - 11) if end.month > 11 else (end.year - 1, end.month + 1)
        start = dt.date(y, m, 1)
    if start > end:
        raise AppError(422, "invalid_range", "'from' must be on or before 'to'.")
    if (end - start).days > EXPLORE_MAX_DAYS:
        raise AppError(422, "range_too_long", "Choose a range of 5 years or less.")
    if granularity is not None and granularity not in GRANULARITIES:
        raise AppError(422, "invalid_granularity", "granularity must be day, week or month.")
    if group_by not in GROUP_BYS:
        raise AppError(422, "invalid_group_by", f"groupBy must be one of: {', '.join(GROUP_BYS)}.")

    gran = granularity or auto_granularity(start, end)
    days = (end - start).days + 1
    prev_start = start - dt.timedelta(days=days)
    cur = period_start(today, gran)
    hist_start = cur
    for _ in range(FORECAST_HISTORY_PERIODS[gran]):
        hist_start = period_start(hist_start - dt.timedelta(days=1), gran)
    load_from = min(prev_start, hist_start)
    load_to = max(end, cur - dt.timedelta(days=1))
    hid = current.household_id
    raw, cats, accts, users = await asyncio.gather(
        load_analytics_txns(hid, load_from, load_to, detail=True, include_business=include_business),
        Category.find({"household_id": hid}).to_list(),
        Account.find({"household_id": hid}).to_list(),
        User.find({"household_id": hid}).to_list(),
    )
    filtered = apply_filters(
        raw,
        category_ids=_ids(categories),
        account_ids=_ids(accounts),
        member_ids=_ids(members),
        merchant=merchant,
    )
    in_range = [t for t in filtered if start <= t["date"] <= end]
    prev = [t for t in filtered if prev_start <= t["date"] < start]
    history = [t for t in filtered if hist_start <= t["date"] < cur]

    cat_name = {str(c.id): c.name for c in cats}
    cat_group = {str(c.id): c.group for c in cats}
    acct_name = {str(a.id): a.name for a in accts}
    user_name = {str(u.id): u.name or u.username or "Member" for u in users}
    group_label = {
        "essentials": "Essentials", "lifestyle": "Lifestyle", "savings": "Savings", "debt": "Debt",
        "income": "Income", "other": "Other", "business": "Business",
    }
    # Money crossing the business boundary (see apply_business_boundary): "From/To <account>".
    biz_prefix = "From" if flow == "income" else "To"

    def category_label(k: str) -> str:
        if is_business_category(k):
            return f"{biz_prefix} {acct_name.get(k[len(BUSINESS_CATEGORY_PREFIX):], 'business account')}"
        return cat_name.get(k, "Uncategorised")

    labels = {
        "category": category_label,
        "category_group": lambda k: "business" if is_business_category(k) else cat_group.get(k, "other"),
        "group": lambda k: group_label.get(k, k.replace("_", " ").title()),
        "account": lambda k: acct_name.get(k, "Unknown account"),
        "member": lambda k: user_name.get(k, "Unknown"),
    }
    return explore(
        in_range, prev, start, end, today,
        granularity=gran, group_by=group_by, flow=flow, horizon=horizon, history=history, labels=labels,
    )
