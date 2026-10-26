import json

from src.generation.interface import routes
from src.server import create_app


def test_generate_stream_disables_mime_sniffing_buffer_and_ignorable_padding(monkeypatch):
    """Regressao: sem `nosniff` o Chrome segura ~1 KB do stream NDJSON e o progresso so chega ao front no fim."""
    monkeypatch.setattr(
        routes.generation_service,
        "stream_generation",
        lambda *args, **kwargs: iter(
            [{"type": "progress", "stage": "analyzing", "message": "x"}, {"type": "result", "data": {"ok": True}}]
        ),
    )
    response = create_app().test_client().post(
        "/api/scenarios/generate", json={"selectedAi": "gemini", "cardData": {"id": 1}}
    )

    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.mimetype == "application/x-ndjson"
    lines = [json.loads(line) for line in response.get_data(as_text=True).splitlines() if line.strip()]
    assert lines[0]["type"] == "padding" and len(lines[0]["data"]) >= 1024
    assert [line["type"] for line in lines[1:]] == ["progress", "result"]
