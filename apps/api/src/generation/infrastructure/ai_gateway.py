"""Gateway de IA: despacha prompts para Gemini, Groq ou Copilot conforme o provedor escolhido.

Implementa a porta AiGateway (application/ports.py). Gemini/Groq usam a API key enviada na requisicao
(nunca persistida); Copilot usa o token da sessao GitHub.
"""
from ...shared.json_utils import parse_json_loosely
from .providers import gemini, groq


class ProviderAiGateway:
    def __init__(self, copilot):
        self._copilot = copilot

    def json_prompt(self, selected_ai, ai_settings, prompt, temperature=0.2, github_token=None):
        ai_settings = ai_settings or {}

        if selected_ai == "groq":
            return groq.groq_json_prompt(prompt, ai_settings.get("groqKey"), ai_settings.get("groqModel"), temperature)

        if selected_ai == "copilot":
            # Copilot nao tem modo JSON nativo: uma resposta fora do formato e transitoria, tenta de novo.
            for attempt in range(2):
                raw = self._copilot.send_prompt(
                    prompt, github_token=github_token, preferred_model=ai_settings.get("copilotModel")
                )
                try:
                    return parse_json_loosely(raw)
                except RuntimeError as error:
                    if attempt == 1 or "INVALID_JSON_RESPONSE" not in str(error):
                        raise

        return gemini.gemini_json_prompt(
            prompt, ai_settings.get("geminiKey"), ai_settings.get("geminiModel"), temperature
        )

    def text_prompt(self, selected_ai, ai_settings, prompt, temperature=0.3, github_token=None):
        ai_settings = ai_settings or {}

        if selected_ai == "groq":
            return groq.groq_text_prompt(prompt, ai_settings.get("groqKey"), ai_settings.get("groqModel"), temperature)

        if selected_ai == "copilot":
            return self._copilot.send_prompt(
                prompt, github_token=github_token, preferred_model=ai_settings.get("copilotModel")
            )

        return gemini.gemini_text_prompt(
            prompt, ai_settings.get("geminiKey"), ai_settings.get("geminiModel"), temperature
        )

    def list_gemini_models(self, gemini_key):
        return gemini.fetch_gemini_models(gemini_key)

    def list_groq_models(self, groq_key):
        return groq.fetch_groq_models(groq_key)
