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


def test_progress_is_numbered_and_available_by_polling(monkeypatch):
    monkeypatch.setattr(
        routes.generation_service,
        "stream_generation",
        lambda *args, **kwargs: iter(
            [
                {"type": "progress", "stage": "analyzing", "message": "a"},
                {"type": "progress", "stage": "batch-progress", "message": "b", "batchIndex": 1},
                {"type": "result", "data": {"ok": True}},
            ]
        ),
    )
    client = create_app().test_client()
    progress_id = "abcdefghijklmnop1234"
    response = client.post(
        "/api/scenarios/generate",
        json={"selectedAi": "gemini", "cardData": {"id": 1}, "progressId": progress_id},
    )
    streamed = [json.loads(line) for line in response.get_data(as_text=True).splitlines() if line.strip()]
    assert [e["seq"] for e in streamed if e["type"] == "progress"] == [1, 2]

    polled = client.get(f"/api/scenarios/progress/{progress_id}?after=1").get_json()
    assert polled["finished"] is True
    assert [e["seq"] for e in polled["events"]] == [2]


def test_progress_endpoint_rejects_invalid_id_and_unknown_is_empty():
    client = create_app().test_client()
    assert client.get("/api/scenarios/progress/curto").status_code == 400
    unknown = client.get("/api/scenarios/progress/zzzzzzzzzzzzzzzzzzzz").get_json()
    assert unknown["events"] == [] and unknown["finished"] is False
