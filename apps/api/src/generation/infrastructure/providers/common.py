"""Utilidades comuns aos provedores de IA que usam API key enviada pela extensao.

A key NUNCA e persistida no backend: trafega apenas na requisicao e e usada para a
chamada ao provedor, descartada ao final do processamento.
"""


def require_key(key, provider_label):
    value = (key or "").strip()
    if not value:
        raise RuntimeError(f"API Key do {provider_label} nao configurada.")
    return value
