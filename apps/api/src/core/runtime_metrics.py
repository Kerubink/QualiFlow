"""Snapshot de metricas de runtime (CPU/memoria) do processo, com suporte a cgroup v2."""
import os
import threading
import time
from datetime import datetime, timezone

import psutil

METRIC_PREFIX = "[runtime-metrics]"

_host_cores = psutil.cpu_count(logical=True) or 1
_process = psutil.Process(os.getpid())
_process.cpu_percent(None)  # descarta a primeira leitura (sempre 0.0)

_timer = None
_timer_stop_event = threading.Event()


def _round(value, digits=2):
    factor = 10**digits
    return round(value * factor) / factor


def _to_mb(num_bytes):
    return _round(num_bytes / (1024 * 1024), 2)


def _read_file_if_exists(path):
    try:
        if not os.path.exists(path):
            return None
        with open(path, "r", encoding="utf-8") as handle:
            return handle.read().strip()
    except OSError:
        return None


def _get_cgroup_cpu_quota_cores():
    cpu_max = _read_file_if_exists("/sys/fs/cgroup/cpu.max")
    if not cpu_max:
        return None

    parts = cpu_max.split(" ")
    if len(parts) != 2 or parts[0] == "max":
        return None

    try:
        quota = float(parts[0])
        period = float(parts[1])
    except ValueError:
        return None

    if period <= 0:
        return None

    return _round(quota / period, 3)


def _get_cgroup_memory_limit_mb():
    memory_max = _read_file_if_exists("/sys/fs/cgroup/memory.max")
    if not memory_max or memory_max == "max":
        return None

    try:
        return _to_mb(int(memory_max))
    except ValueError:
        return None


def _get_cgroup_memory_current_mb():
    memory_current = _read_file_if_exists("/sys/fs/cgroup/memory.current")
    if not memory_current:
        return None

    try:
        return _to_mb(int(memory_current))
    except ValueError:
        return None


def get_runtime_metrics_snapshot():
    process_cpu_single_core_percent = _round(_process.cpu_percent(None), 2)

    quota_cores = _get_cgroup_cpu_quota_cores()
    process_cpu_host_percent = (
        _round(process_cpu_single_core_percent / _host_cores, 2) if _host_cores > 0 else process_cpu_single_core_percent
    )
    process_cpu_quota_percent = (
        _round(process_cpu_single_core_percent / quota_cores, 2) if quota_cores and quota_cores > 0 else None
    )

    memory_info = _process.memory_info()

    try:
        load1, load5, load15 = os.getloadavg()
    except (OSError, AttributeError):
        load1 = load5 = load15 = 0.0

    return {
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "pid": os.getpid(),
        "uptimeSeconds": _round(time.time() - _process.create_time(), 1),
        "cpu": {
            "processSingleCorePercent": process_cpu_single_core_percent,
            "processHostPercent": process_cpu_host_percent,
            "processQuotaPercent": process_cpu_quota_percent,
            "hostCores": _host_cores,
            "quotaCores": quota_cores,
        },
        "memory": {
            "rssMb": _to_mb(memory_info.rss),
            "vmsMb": _to_mb(memory_info.vms),
            "cgroupCurrentMb": _get_cgroup_memory_current_mb(),
            "cgroupLimitMb": _get_cgroup_memory_limit_mb(),
        },
        "loadAverage": {
            "oneMinute": _round(load1, 3),
            "fiveMinutes": _round(load5, 3),
            "fifteenMinutes": _round(load15, 3),
        },
    }


def _logger_loop(interval_seconds):
    while not _timer_stop_event.wait(interval_seconds):
        snapshot = get_runtime_metrics_snapshot()
        print(f"{METRIC_PREFIX} {snapshot}", flush=True)


def start_runtime_metrics_logger(enabled=True, interval_ms=60000):
    global _timer
    if not enabled or _timer:
        return

    interval_seconds = max(5000, interval_ms) / 1000
    _timer_stop_event.clear()
    _timer = threading.Thread(target=_logger_loop, args=(interval_seconds,), daemon=True)
    _timer.start()


def stop_runtime_metrics_logger():
    global _timer
    if not _timer:
        return

    _timer_stop_event.set()
    _timer = None
