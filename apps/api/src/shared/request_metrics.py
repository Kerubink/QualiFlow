"""Coleta de metricas de requisicoes HTTP (latencia, status, erros) em memoria."""
import math
import threading
from datetime import datetime, timezone

MAX_ROUTE_LATENCY_SAMPLES = 1000
MAX_GLOBAL_LATENCY_SAMPLES = 2000

_lock = threading.Lock()
_state = None


def _now_iso():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _create_route_bucket():
    return {
        "total": 0,
        "status": {"s2xx": 0, "s3xx": 0, "s4xx": 0, "s5xx": 0},
        "byStatusCode": {},
        "byErrorCode": {},
        "latencyMs": {"min": None, "max": 0, "sum": 0, "samples": []},
    }


def _percentile_from_sorted(sorted_values, percentile):
    if not sorted_values:
        return 0

    index = math.ceil((percentile / 100) * len(sorted_values)) - 1
    safe_index = min(len(sorted_values) - 1, max(0, index))
    return sorted_values[safe_index]


def _compute_latency_stats(latency_state):
    samples = latency_state["samples"]
    if not samples:
        return {"min": latency_state["min"], "max": latency_state["max"], "avg": 0, "p50": 0, "p95": 0}

    sorted_samples = sorted(samples)
    avg = latency_state["sum"] / len(samples)

    return {
        "min": latency_state["min"],
        "max": latency_state["max"],
        "avg": round(avg, 2),
        "p50": _percentile_from_sorted(sorted_samples, 50),
        "p95": _percentile_from_sorted(sorted_samples, 95),
    }


def _bucket_status(status_code):
    if status_code >= 500:
        return "s5xx"
    if status_code >= 400:
        return "s4xx"
    if status_code >= 300:
        return "s3xx"
    return "s2xx"


def _normalize_route_key(method, rule_or_path):
    return f"{method} {rule_or_path}"


def _initialize_state():
    global _state
    _state = {
        "startedAt": _now_iso(),
        "request": {
            "total": 0,
            "inFlight": 0,
            "peakInFlight": 0,
            "status": {"s2xx": 0, "s3xx": 0, "s4xx": 0, "s5xx": 0},
            "byStatusCode": {},
            "byErrorCode": {},
            "latencyMs": {"min": None, "max": 0, "sum": 0, "samples": []},
        },
        "routes": {},
    }


_initialize_state()


def begin_request_metric():
    import time

    with _lock:
        _state["request"]["inFlight"] += 1
        _state["request"]["peakInFlight"] = max(
            _state["request"]["peakInFlight"], _state["request"]["inFlight"]
        )

    return time.time() * 1000


def set_response_metric_error_code(error_code_holder, code):
    """error_code_holder deve ser um dict mutavel (ex.: flask.g) usado para propagar o codigo."""
    if error_code_holder is None or not code:
        return
    error_code_holder["metricErrorCode"] = code


def end_request_metric(method, route_path, status_code, error_code, duration_ms):
    with _lock:
        _state["request"]["inFlight"] = max(0, _state["request"]["inFlight"] - 1)
        _state["request"]["total"] += 1

        status_code = int(status_code or 0)
        status_bucket = _bucket_status(status_code)
        _state["request"]["status"][status_bucket] += 1
        _state["request"]["byStatusCode"][status_code] = (
            _state["request"]["byStatusCode"].get(status_code, 0) + 1
        )

        global_latency = _state["request"]["latencyMs"]
        global_latency["min"] = (
            duration_ms if global_latency["min"] is None else min(global_latency["min"], duration_ms)
        )
        global_latency["max"] = max(global_latency["max"], duration_ms)
        global_latency["sum"] += duration_ms
        global_latency["samples"].append(duration_ms)
        if len(global_latency["samples"]) > MAX_GLOBAL_LATENCY_SAMPLES:
            global_latency["samples"].pop(0)

        route_key = _normalize_route_key(method, route_path)
        if route_key not in _state["routes"]:
            _state["routes"][route_key] = _create_route_bucket()

        route_bucket = _state["routes"][route_key]
        route_bucket["total"] += 1
        route_bucket["status"][status_bucket] += 1
        route_bucket["byStatusCode"][status_code] = route_bucket["byStatusCode"].get(status_code, 0) + 1

        route_latency = route_bucket["latencyMs"]
        route_latency["min"] = (
            duration_ms if route_latency["min"] is None else min(route_latency["min"], duration_ms)
        )
        route_latency["max"] = max(route_latency["max"], duration_ms)
        route_latency["sum"] += duration_ms
        route_latency["samples"].append(duration_ms)
        if len(route_latency["samples"]) > MAX_ROUTE_LATENCY_SAMPLES:
            route_latency["samples"].pop(0)

        if error_code:
            _state["request"]["byErrorCode"][error_code] = (
                _state["request"]["byErrorCode"].get(error_code, 0) + 1
            )
            route_bucket["byErrorCode"][error_code] = route_bucket["byErrorCode"].get(error_code, 0) + 1


def get_request_metrics_report():
    with _lock:
        global_latency_stats = _compute_latency_stats(_state["request"]["latencyMs"])
        routes = []
        for route, bucket in _state["routes"].items():
            latency = _compute_latency_stats(bucket["latencyMs"])
            routes.append(
                {
                    "route": route,
                    "total": bucket["total"],
                    "status": bucket["status"],
                    "byStatusCode": bucket["byStatusCode"],
                    "byErrorCode": bucket["byErrorCode"],
                    "latencyMs": latency,
                }
            )

        routes.sort(key=lambda item: item["total"], reverse=True)

        return {
            "generatedAt": _now_iso(),
            "windowStartedAt": _state["startedAt"],
            "request": {
                "total": _state["request"]["total"],
                "inFlight": _state["request"]["inFlight"],
                "peakInFlight": _state["request"]["peakInFlight"],
                "status": _state["request"]["status"],
                "byStatusCode": _state["request"]["byStatusCode"],
                "byErrorCode": _state["request"]["byErrorCode"],
                "latencyMs": global_latency_stats,
            },
            "routes": routes,
        }


def reset_request_metrics():
    with _lock:
        _initialize_state()
