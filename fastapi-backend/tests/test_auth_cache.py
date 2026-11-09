"""Auth cache must never re-cache a session that was revoked while its DB read was in flight."""

from app.security.auth_cache import AuthCache


def test_put_after_concurrent_session_revocation_is_refused():
    cache = AuthCache(ttl_seconds=10)
    token = cache.begin()  # request A starts reading the (still live) session
    cache.invalidate_session("s1")  # logout lands mid-read
    cache.put("s1", "u1", "stale-current-user", token)  # A finishes with its stale result
    assert cache.get("s1") is None


def test_put_after_concurrent_user_revoke_all_is_refused():
    cache = AuthCache(ttl_seconds=10)
    token = cache.begin()
    cache.invalidate_user("u1")  # refresh-reuse theft detection revokes every session
    cache.put("s9", "u1", "stale", token)
    assert cache.get("s9") is None


def test_revocation_of_other_keys_does_not_block_caching():
    cache = AuthCache(ttl_seconds=10)
    token = cache.begin()
    cache.invalidate_session("other-session")
    cache.invalidate_user("other-user")
    cache.put("s1", "u1", "fresh", token)
    assert cache.get("s1") == "fresh"


def test_read_started_after_revocation_can_cache():
    # A read that begins after the revocation reads the revoked row from the DB and never calls
    # put() with a live result; but a new, unrelated login reusing nothing must still cache.
    cache = AuthCache(ttl_seconds=10)
    cache.invalidate_session("s1")
    token = cache.begin()
    cache.put("s2", "u1", "new-session", token)
    assert cache.get("s2") == "new-session"


def test_ttl_zero_disables_cache():
    cache = AuthCache(ttl_seconds=0)
    cache.put("s1", "u1", "x", cache.begin())
    assert cache.get("s1") is None
