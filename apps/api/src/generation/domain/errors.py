"""Classificacao de erros de IA em codigo/mensagem/status HTTP. Puro (sem I/O).

Preserve os prefixos/codigos usados pelas rotas, especialmente invalid_json_response e
COPILOT_INVALID_JSON_RESPONSE.
"""
import re

_PAT_RE = re.compile(r"\bpats?\b")


def classify_copilot_error(error):
    raw_message = str(error)
    message = raw_message or "Erro desconhecido."
    normalized = message.lower()

    if "copilot_auth_missing_token" in normalized:
        return {
            "httpStatus": 401,
            "code": "COPILOT_AUTH_MISSING_TOKEN",
            "message": "Nenhum token do GitHub disponivel para autenticar no Copilot.",
        }

    if "personal access tokens are not supported" in normalized or _PAT_RE.search(normalized):
        return {
            "httpStatus": 401,
            "code": "COPILOT_AUTH_UNSUPPORTED_TOKEN",
            "message": "Token nao suportado para este fluxo. Evite ghp_ (PAT classico). Use github_pat_ "
            "(fine-grained), gho_/ghu_ (OAuth/App user) ou ghs_ (installation token via COPILOT_GITHUB_TOKEN).",
        }

    if "copilot_sdk_not_installed" in normalized:
        return {
            "httpStatus": 503,
            "code": "COPILOT_SDK_NOT_INSTALLED",
            "message": "SDK do Copilot nao instalado no servidor. Rode "
            "`pip install -r requirements.txt` e reinicie a API.",
        }

    if "falha ao obter token do copilot" in normalized or "acesso negado pelo copilot" in normalized:
        return {
            "httpStatus": 401,
            "code": "COPILOT_AUTH_ERROR",
            "message": "O GitHub nao liberou o Copilot para esta conta. Confirme que ha uma assinatura ativa do "
            "Copilot e refaca o login no GitHub.",
        }

    if "401" in normalized or "403" in normalized or "bad credentials" in normalized:
        return {
            "httpStatus": 401,
            "code": "COPILOT_AUTH_ERROR",
            "message": "Falha de autenticacao no GitHub Copilot. Verifique token/login.",
        }

    if "timeout" in normalized:
        return {
            "httpStatus": 504,
            "code": "COPILOT_TIMEOUT",
            "message": "Tempo limite excedido na comunicacao com o Copilot.",
        }

    if "invalid_json_response" in normalized:
        return {
            "httpStatus": 502,
            "code": "COPILOT_INVALID_JSON_RESPONSE",
            "message": "Copilot respondeu fora do formato JSON esperado. Tente novamente.",
        }

    if "copilot_queue_timeout" in normalized:
        return {
            "httpStatus": 503,
            "code": "COPILOT_BUSY",
            "message": "Servico temporariamente ocupado. Tente novamente em alguns segundos.",
        }

    return {
        "httpStatus": 500,
        "code": "COPILOT_REQUEST_ERROR",
        "message": "Erro ao processar prompt com o Copilot.",
    }


def classify_ai_error(selected_ai, error):
    # Falta de API key e erro de configuracao do usuario: devolve a mensagem real (sem segredo)
    # em vez do generico "Erro ao processar prompt", que escondia a causa fora do modo development.
    if str(error).startswith("API Key do ") and str(error).endswith("nao configurada."):
        return {"code": "AI_KEY_MISSING", "message": f"{error} Informe a chave nas configuracoes da extensao.", "httpStatus": 400}

    normalized = classify_copilot_error(error)
    if selected_ai != "copilot" and normalized["code"] == "COPILOT_REQUEST_ERROR":
        normalized = {**normalized, "code": "AI_REQUEST_ERROR", "message": "Erro ao processar prompt com o provedor de IA."}
    return normalized
