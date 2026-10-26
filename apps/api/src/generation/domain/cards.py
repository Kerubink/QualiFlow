"""Regras sobre dados do card (work item). Puro (sem I/O).
"""


def detect_track_from_tags(tags):
    normalized = (tags or "").lower()
    if "frontend" in normalized and "backend" not in normalized:
        return "Frontend"
    if "backend" in normalized and "frontend" not in normalized:
        return "Backend"
    return "Geral (Frontend e Backend)"
