"""Log estruturado simples para o terminal: `[timestamp] [escopo] mensagem chave=valor ...`.

Nunca registra segredos: campos com nomes sensiveis viram `<oculto>` e valores com formato de token
(GitHub, Bearer, chaves Google/Groq) sao mascarados em qualquer mensagem.
"""
import functools
import inspect
import re
import time

from .clock import now_iso

_SENSITIVE_FIELD_RE = re.compile(r"token|secret|key|password|authorization|cookie|chave|segredo|senha|^code$|^pat$", re.IGNORECASE)
_SECRET_VALUE_RE = re.compile(
    r"(gh[pousr]_[A-Za-z0-9]{10,}|github_pat_[A-Za-z0-9_]{10,}|Bearer\s+[A-Za-z0-9._~+/=-]{10,}"
    r"|AIza[0-9A-Za-z_-]{20,}|gsk_[A-Za-z0-9]{10,})"
)
_MAX_VALUE_LEN = 120


def _clean(value):
    text = _SECRET_VALUE_RE.sub("<oculto>", str(value)).replace("\n", " ").replace("\r", " ")
    return text if len(text) <= _MAX_VALUE_LEN else text[: _MAX_VALUE_LEN - 3] + "..."


def short_id(value):
    """Prefixo curto de um identificador (ex.: requestId) para correlacionar linhas sem expor o valor inteiro."""
    return (str(value or ""))[:8]


def log(scope, message, **fields):
    parts = [f"[{now_iso()}]", f"[{scope}]", _clean(message)]
    for name, value in fields.items():
        if value is None:
            continue
        parts.append(f"{name}={'<oculto>' if _SENSITIVE_FIELD_RE.search(name) else _clean(value)}")
    print(" ".join(parts), flush=True)


_SKIPPED_ARGS = {"self", "item", "parent_data", "attachment", "file_data", "content", "body"}


def _describe_args(bound_arguments):
    described = {}
    for name, value in bound_arguments.items():
        if name in _SKIPPED_ARGS or _SENSITIVE_FIELD_RE.search(name):
            continue
        if isinstance(value, (list, tuple, set, dict)):
            described[name] = f"{len(value)} itens"
        elif isinstance(value, (str, int, float, bool)):
            described[name] = value
    return described


def log_calls(scope):
    """Decorador de classe: registra cada metodo publico (inicio, duracao e erro) sem expor tokens ou conteudo."""

    def decorate(cls):
        for name, method in list(vars(cls).items()):
            if name.startswith("_") or not inspect.isfunction(method):
                continue
            signature = inspect.signature(method)

            def make_wrapper(method_name, method_fn, method_signature):
                @functools.wraps(method_fn)
                def wrapper(*args, **kwargs):
                    try:
                        bound = method_signature.bind(*args, **kwargs)
                        context = _describe_args(bound.arguments)
                    except TypeError:
                        context = {}
                    started = time.time()
                    try:
                        result = method_fn(*args, **kwargs)
                    except Exception as error:
                        log(scope, f"{method_name} FALHOU", erro=f"{type(error).__name__}: {error}", **context)
                        raise
                    log(scope, f"{method_name} ok", duracao=f"{round((time.time() - started) * 1000)}ms", **context)
                    return result

                return wrapper

            setattr(cls, name, make_wrapper(name, method, signature))
        return cls

    return decorate
