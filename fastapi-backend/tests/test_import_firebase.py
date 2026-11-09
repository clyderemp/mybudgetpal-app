"""Legacy Firebase import mapping (pure; no network, no DB)."""
import datetime as dt

from scripts.import_firebase import CadToAed, build_plan, map_category

U = "users/OWNER"


def _export():
    r = lambda i, **f: (f"{U}/receipts/R{i}", {"_fields": {"date": "2025-01-0%dT00:00:00.000Z" % i, **f}})
    return dict([
        (U, {"_fields": {"fname": "Clyde", "lname": "R", "savings": {"goal": "1000.50", "balance": "0"}}}),
        (f"{U}/coUsers/M", {"_fields": {"_id": "MEMBER", "fname": "Pat", "lname": "D"}}),
        ("users/STRANGER", {"_fields": {"email": "someone@else.com"}}),
        ("users/STRANGER/transactions/X", {"_fields": {"value": 5}}),
        r(1, type="expenses", currency="CAD", value="10", category="Gas", paymentMethod="debit", reportedBy="OWNER"),
        r(2, type="expenses", currency="AED", value=20.5, category="Custom", customCategory="Biscoff Stuff",
          paymentMethod="cash", reportedBy="MEMBER", items=[{"name": "Toy", "quantity": 1, "total": 20.5}]),
        r(3, type="savings", currency="AED", value=100, category="Joint Savings", paymentMethod="debit"),
        r(4, type="income", currency="AED", value=0, category="Job Paycheque"),
        r(5, type="income", currency="CAD", value=100, exchangeRate=2.7, category="Job Paycheque"),
        (f"{U}/budgetData/B", {"_fields": {"month": "2025-9", "type": "money-out", "categories": ["Dining Out"],
                                           "amount": "400.00"}}),
        (f"{U}/budgetData/S", {"_fields": {"month": "2025-9", "type": "savings", "categories": ["x"], "amount": "1"}}),
    ])


def test_build_plan_maps_and_converts():
    fx = CadToAed({"2024-12-31": 0.7, "2025-01-02": 0.8})
    plan = build_plan(_export(), fx, owner_uid="OWNER")
    t = {x["note"].split(" | ")[0] if x["note"] else x["type"]: x for x in plan["transactions"]}
    gas = next(x for x in plan["transactions"] if x["category"] == "Fuel")
    assert gas["amount_fils"] == round(10 * 0.7 * 3.6725 * 100)  # 2025-01-01 uses the last earlier fixing
    assert "Originally CAD 10.00" in gas["note"] and gas["by"] == "owner"
    pet = next(x for x in plan["transactions"] if x["category"] == "Pet care")
    assert pet["amount_fils"] == 2050 and pet["by"] == "member" and "Toy x1" in pet["note"]
    assert plan["accounts"][pet["account"]]["name"] == "UAE Cash"
    sav = next(x for x in plan["transactions"] if x["type"] == "transfer")
    assert plan["accounts"][sav["to"]]["type"] == "savings"
    salary = next(x for x in plan["transactions"] if x["category"] == "Salary")
    assert salary["amount_fils"] == 27000  # receipt's own recorded rate wins
    assert plan["stats"]["skipped"] == {"zero amount": 1} and plan["stats"]["imported"] == 4
    assert plan["stats"]["other_firebase_users_ignored"] == 1
    assert plan["budgets"] == {"2025-09": {"Dining": 40000}}
    assert plan["goal"] == {"name": "Savings goal", "target_fils": 100050, "saved_fils": 0}
    assert plan["accounts"]["CAD:bank"]["archived"] is True
    assert t  # notes present


def test_category_mapping():
    assert map_category("Custom", "Wedding Expense") == "Wedding"
    assert map_category("Custom", "random") == "Other"
    assert map_category("Phone Bill", None) == "Telecom"
    assert map_category("Something new", None) == "Other"
    assert CadToAed({"2025-01-01": 1.0}).rate(dt.date(2025, 1, 5)) == 3.6725


def test_savings_withdrawals_pots_and_split_budgets():
    ex = _export()
    r = lambda i, **f: (f"{U}/receipts/W{i}", {"_fields": {"date": "2025-01-1%dT00:00:00.000Z" % i, **f}})
    ex.update([
        r(1, type="savings", currency="AED", value=-40, category="Joint Savings", paymentMethod="debit"),
        r(2, type="expenses", currency="AED", value=-5, category="Gas", paymentMethod="debit"),
        r(3, type="expenses", currency="AED", value=30, category="Loan Payments", paymentMethod="debit"),
        (f"{U}/budgetData/M", {"_fields": {"month": "2025-1", "type": "money-out",
                                           "categories": ["Biscoff Stuff", "Tamara Installments"], "amount": "100"}}),
    ])
    ex[U]["_fields"]["budgetPlanData"] = {"budgetPlanArray": [
        {"category": "savings", "amount": 500, "currency": "AED"}, {"category": "savings", "amount": 100},
        {"category": "expenses", "amount": 4500}]}
    plan = build_plan(ex, CadToAed({"2024-12-31": 0.7}), owner_uid="OWNER")
    moves = [x for x in plan["transactions"] if x["type"] == "transfer"]
    deposit = next(x for x in moves if x["amount_fils"] == 10000)
    withdrawal = next(x for x in moves if x["amount_fils"] == 4000)
    pot = deposit["to"]
    assert plan["accounts"][pot]["name"] == "UAE Joint Savings" and plan["accounts"][pot]["type"] == "savings"
    assert (withdrawal["account"], withdrawal["to"]) == (pot, deposit["account"])  # money back out of the pot
    assert plan["stats"]["skipped"] == {"zero amount": 1, "negative non-savings": 1}
    # 100.00 split by January spend: Pet care 20.50, Debt payment 30.00
    assert plan["budgets"]["2025-01"] == {"Pet care": 4059, "Debt payment": 5941}
    assert plan["monthly_savings_fils"] == 60000
