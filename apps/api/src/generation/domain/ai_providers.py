"""Provedores de IA suportados e normalizacao da escolha enviada pela extensao. Puro (sem I/O)."""

SUPPORTED_PROVIDERS = {"gemini", "groq", "copilot"}


def normalize_selected_ai(value):
    value = (value or "").strip().lower()
    return value if value in SUPPORTED_PROVIDERS else "gemini"
