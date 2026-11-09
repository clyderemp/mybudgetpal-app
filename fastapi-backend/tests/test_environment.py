"""Dev/prod database separation: only a marked production host reaches `production`."""
from __future__ import annotations

import pytest

from app.config import Settings, check_environment, database_for
from scripts.seed_demo import target_development

URI = "mongodb+srv://u:p@mybudgetpal.nilbypg.mongodb.net/?retryWrites=true"
PROD = dict(app_env="production", cookie_secure=True, app_origin="https://budget.example.com")


def settings(**kw) -> Settings:
    base = dict(_env_file=None, mongodb_uri=URI, jwt_secret="s" * 48)
    base.update(kw)
    return Settings(**base)


@pytest.mark.parametrize(("app_env", "host", "db"), [
    ("development", {}, "development"),
    ("production", {}, "development"),  # no marker never means production
    ("production", {"MYBUDGETPAL_PRODUCTION_HOST": "true"}, "production"),
    ("production", {"VERCEL": "1", "VERCEL_ENV": "preview"}, "development"),
    ("production", {"VERCEL": "1", "VERCEL_ENV": "production"}, "production"),
])
def test_routing(app_env, host, db):
    assert database_for(app_env, host) == db


def test_local_dev_routes_to_development():
    assert check_environment(settings(), {}, {"MONGODB_URI", "MONGODB_DB"}).mongodb_db == "development"


def test_marked_production_host_routes_to_production():
    s = check_environment(settings(**PROD), {"MYBUDGETPAL_PRODUCTION_HOST": "true"}, set())
    assert s.mongodb_db == "production"


@pytest.mark.parametrize(("kw", "host", "file_keys", "msg"), [
    ({"mongodb_db": "production"}, {}, set(), "requires MONGODB_DB=development"),
    ({"mongodb_db": "mybudgetpal"}, {}, set(), "requires MONGODB_DB=development"),
    (PROD, {}, set(), "refusing to guess"),
    ({}, {"MYBUDGETPAL_PRODUCTION_HOST": "true"}, set(), None),  # marker without APP_ENV=production: dev
    ({}, {"VERCEL": "1", "VERCEL_ENV": "production"}, set(), "refusing to mix"),
    (PROD, {"VERCEL_ENV": "production"}, set(), "VERCEL=1 missing"),
    (PROD, {"VERCEL_ENV": "prod"}, set(), "VERCEL_ENV must be"),
    (PROD, {"MYBUDGETPAL_PRODUCTION_HOST": "true"}, {"MONGODB_URI"}, "must not use the repo .env"),
    (PROD, {"MYBUDGETPAL_PRODUCTION_HOST": "true"}, {"APP_ENV"}, "must not use the repo .env"),
    ({**PROD, "cookie_secure": False}, {"MYBUDGETPAL_PRODUCTION_HOST": "true"}, set(), "COOKIE_SECURE"),
    ({**PROD, "app_origin": "http://x"}, {"MYBUDGETPAL_PRODUCTION_HOST": "true"}, set(), "https"),
    ({**PROD, "mongodb_uri": "mongomock://x"}, {"MYBUDGETPAL_PRODUCTION_HOST": "true"}, set(), "mongomock"),
    ({**PROD, "allow_registration": True}, {"MYBUDGETPAL_PRODUCTION_HOST": "true"}, set(), "ALLOW_REGISTRATION"),
    ({"app_env": "staging"}, {}, set(), "APP_ENV must be"),
    ({"mongodb_uri": ""}, {}, set(), "Set MONGODB_URI"),
    ({"mongodb_uri": "mongodb+srv://u:<db_password>@h/"}, {}, set(), "complete MongoDB"),
])
def test_guards(kw, host, file_keys, msg):
    if msg is None:
        assert check_environment(settings(**kw), host, file_keys).mongodb_db == "development"
        return
    with pytest.raises(ValueError, match=msg):  # pydantic ValidationError is a ValueError
        check_environment(settings(**kw), host, file_keys)


def test_mongomock_keeps_its_own_db_name_in_dev():
    s = check_environment(settings(mongodb_uri="mongomock://t", mongodb_db="mbp_test"), {}, set())
    assert s.mongodb_db == "mbp_test"


def test_seed_only_targets_development():
    target_development(URI, "development", "development", {})
    target_development("mongomock://x", "anything", "production", {})
    for db, app_env, host in [
        ("production", "development", {}),
        ("mybudgetpal", "development", {}),
        ("development", "production", {"MYBUDGETPAL_PRODUCTION_HOST": "true"}),
        ("development", "production", {}),
    ]:
        with pytest.raises(ValueError):
            target_development(URI, db, app_env, host)
