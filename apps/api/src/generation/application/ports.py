"""Portas (contratos) que a camada de aplicacao de geracao exige da infraestrutura.

Implementacoes: infrastructure/ai_gateway.py (AiGateway), infrastructure/prompts.py (PromptCatalog)
e infrastructure/providers/copilot.py (CopilotGateway).
"""
from typing import Protocol


class AiGateway(Protocol):
    def json_prompt(self, selected_ai, ai_settings, prompt, temperature=0.2, github_token=None):
        """Envia o prompt ao provedor e devolve a resposta ja parseada como JSON."""

    def text_prompt(self, selected_ai, ai_settings, prompt, temperature=0.3, github_token=None):
        """Envia o prompt ao provedor e devolve o texto bruto."""

    def list_gemini_models(self, gemini_key): ...

    def list_groq_models(self, groq_key): ...


class CopilotGateway(Protocol):
    def send_prompt(self, prompt, github_token=None, preferred_model=None): ...

    def get_model_candidates(self, preferred_model=None): ...

    def get_status(self): ...


class PromptCatalog(Protocol):
    def build_qa_prompt(self, user_prompt): ...

    def build_qa_generation_prompt(self, card_data, user_focus, technical_detail, generation_settings): ...

    def build_qa_evaluation_prompt(self, card_data): ...

    def build_decomposition_prompt(
        self, card_data, user_focus, technical_detail, generation_settings, criteria_list
    ): ...

    def build_batch_prompt(
        self, card_data, criteria_list, rules, batch_plan, generation_settings, user_focus, technical_detail
    ): ...

    def build_rtm_prompt(self, criteria_list, generated_tests): ...

    def build_adaptation_prompt(
        self,
        target_card_data,
        source_work_item,
        copied_scenarios,
        criteria_list,
        generation_settings,
        user_focus,
        technical_detail,
    ): ...

    def validate_generated_test_cases(self, parsed_response): ...
