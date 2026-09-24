import pytest

from src.core import json_utils


def test_parse_json_loosely_parses_clean_json():
    result = json_utils.parse_json_loosely('{"total_criterios": 2}')
    assert result == {"total_criterios": 2}


def test_parse_json_loosely_strips_markdown_code_fence():
    text = '```json\n{"total_criterios": 2}\n```'
    result = json_utils.parse_json_loosely(text)
    assert result == {"total_criterios": 2}


def test_parse_json_loosely_tolerates_trailing_comma():
    text = '{"a": 1, "b": [1, 2,],}'
    result = json_utils.parse_json_loosely(text)
    assert result == {"a": 1, "b": [1, 2]}


def test_parse_json_loosely_normalizes_curly_quotes():
    text = "{“a”: “b”}"
    result = json_utils.parse_json_loosely(text)
    assert result == {"a": "b"}


def test_parse_json_loosely_raises_runtime_error_when_no_valid_json():
    with pytest.raises(RuntimeError, match="AI_INVALID_JSON_RESPONSE"):
        json_utils.parse_json_loosely("desculpe, nao consigo gerar isso agora.")


def test_strip_markdown_code_fence_removes_json_fence():
    text = '```json\n{"a": 1}\n```'
    assert json_utils.strip_markdown_code_fence(text) == '{"a": 1}'


def test_strip_markdown_code_fence_returns_empty_string_for_none():
    assert json_utils.strip_markdown_code_fence(None) == ""
