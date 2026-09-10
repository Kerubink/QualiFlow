"""Armazenamento temporario em memoria para OAuth state, sessoes e auth requests."""
import os
import secrets
import threading
from datetime import datetime, timedelta, timezone


def _now_ms():
    return int(datetime.now(timezone.utc).timestamp() * 1000)


def _iso_now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _iso_from_ms(ms):
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).isoformat().replace("+00:00", "Z")


def _ms_from_iso(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp() * 1000


def _normalize_ttl(value, fallback):
    return value if isinstance(value, int) and value > 0 else fallback


def _int_env(name, fallback):
    try:
        return int(os.environ.get(name, str(fallback)))
    except ValueError:
        return fallback


_AUTH_STATE_TTL_MS = _normalize_ttl(_int_env("AUTH_STATE_TTL_MS", 600000), 600000)
_SESSION_TTL_MS = _normalize_ttl(_int_env("AUTH_SESSION_TTL_MS", 28800000), 28800000)
_AUTH_REQUEST_TTL_MS = _normalize_ttl(_int_env("AUTH_REQUEST_TTL_MS", 900000), 900000)

_lock = threading.Lock()
_pending_auth_states = {}
_user_sessions = {}
_auth_requests = {}


def create_pending_auth_state():
    state = secrets.token_hex(24)
    with _lock:
        _pending_auth_states[state] = {"expiresAt": _now_ms() + _AUTH_STATE_TTL_MS}
    return state


def consume_pending_auth_state(state):
    with _lock:
        entry = _pending_auth_states.pop(state, None)

    if not entry:
        return False

    return entry["expiresAt"] >= _now_ms()


def create_user_session(access_token, user):
    session_token = secrets.token_hex(32)
    expires_at_ms = _now_ms() + _SESSION_TTL_MS
    session = {
        "sessionToken": session_token,
        "accessToken": access_token,
        "user": user,
        "createdAt": _iso_now(),
        "expiresAt": _iso_from_ms(expires_at_ms),
    }

    with _lock:
        _user_sessions[session_token] = session

    return session


def create_auth_request():
    request_id = secrets.token_hex(18)
    with _lock:
        _auth_requests[request_id] = {
            "requestId": request_id,
            "status": "pending",
            "createdAt": _iso_now(),
            "expiresAt": _iso_from_ms(_now_ms() + _AUTH_REQUEST_TTL_MS),
            "session": None,
            "error": None,
        }
    return request_id


def get_auth_request(request_id):
    with _lock:
        request = _auth_requests.get(request_id)
        if not request:
            return None

        if _ms_from_iso(request["expiresAt"]) < _now_ms():
            del _auth_requests[request_id]
            return None

        return request


def complete_auth_request(request_id, session):
    request = get_auth_request(request_id)
    if not request:
        return False

    request["status"] = "completed"
    request["session"] = {
        "sessionToken": session["sessionToken"],
        "user": session["user"],
        "expiresAt": session["expiresAt"],
    }
    request["error"] = None
    return True


def fail_auth_request(request_id, message):
    request = get_auth_request(request_id)
    if not request:
        return False

    request["status"] = "error"
    request["error"] = message
    return True


def get_user_session(session_token):
    with _lock:
        session = _user_sessions.get(session_token)
        if not session:
            return None

        if _ms_from_iso(session["expiresAt"]) < _now_ms():
            del _user_sessions[session_token]
            return None

        return session


def revoke_user_session(session_token):
    with _lock:
        return _user_sessions.pop(session_token, None) is not None


def cleanup_expired():
    now = _now_ms()

    with _lock:
        for state, entry in list(_pending_auth_states.items()):
            if entry["expiresAt"] < now:
                del _pending_auth_states[state]

        for token, session in list(_user_sessions.items()):
            if _ms_from_iso(session["expiresAt"]) < now:
                del _user_sessions[token]

        for request_id, request in list(_auth_requests.items()):
            if _ms_from_iso(request["expiresAt"]) < now:
                del _auth_requests[request_id]


def get_session_store_stats():
    cleanup_expired()
    with _lock:
        return {
            "pendingAuthStates": len(_pending_auth_states),
            "activeSessions": len(_user_sessions),
            "authRequests": len(_auth_requests),
            "authStateTtlMs": _AUTH_STATE_TTL_MS,
            "sessionTtlMs": _SESSION_TTL_MS,
            "authRequestTtlMs": _AUTH_REQUEST_TTL_MS,
        }
