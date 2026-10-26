"""Progresso das geracoes em memoria, consultavel por polling.

O progresso tambem sai no stream NDJSON, mas antivirus/proxies corporativos podem acumular a resposta em streaming
ate o fim, deixando a UI parada. Cada evento de progresso e guardado aqui (com um numero sequencial `seq`) para o
cliente conseguir le-lo por requisicoes curtas, que nao sofrem esse buffer. Como o `progressId` e gerado pelo
cliente (aleatorio e nao adivinhavel) e os eventos so trazem mensagens genericas de andamento, a consulta nao exige
sessao. Dados vivem apenas na memoria do processo e expiram sozinhos.
"""
import re
import threading
import time

_PROGRESS_ID_RE = re.compile(r"^[A-Za-z0-9_-]{16,64}$")
_TTL_SECONDS = 15 * 60
_MAX_ENTRIES = 200

_lock = threading.Lock()
_entries = {}


def normalize_progress_id(value):
    value = str(value or "").strip()
    return value if _PROGRESS_ID_RE.match(value) else None


def _cleanup(now):
    for key in [k for k, v in _entries.items() if now - v["updatedAt"] > _TTL_SECONDS]:
        del _entries[key]
    while len(_entries) > _MAX_ENTRIES:
        del _entries[min(_entries, key=lambda k: _entries[k]["updatedAt"])]


def append(progress_id, event):
    with _lock:
        now = time.time()
        _cleanup(now)
        entry = _entries.setdefault(progress_id, {"events": [], "finished": False, "updatedAt": now})
        entry["events"].append(event)
        entry["updatedAt"] = now


def finish(progress_id):
    with _lock:
        entry = _entries.setdefault(progress_id, {"events": [], "finished": False, "updatedAt": time.time()})
        entry["finished"] = True
        entry["updatedAt"] = time.time()


def read(progress_id, after=0):
    """Eventos com seq > after, e se a geracao ja terminou."""
    with _lock:
        entry = _entries.get(progress_id)
        if not entry:
            return [], False
        return [e for e in entry["events"] if e.get("seq", 0) > after], entry["finished"]
