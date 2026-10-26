"""Casos de uso dos endpoints dedicados do Copilot (/api/copilot/*)."""
from ...shared.json_utils import parse_json_loosely


class CopilotService:
    def __init__(self, copilot, prompts):
        self._copilot = copilot
        self._prompts = prompts

    def get_model_candidates(self):
        return self._copilot.get_model_candidates()

    def get_status(self):
        return self._copilot.get_status()

    def test_prompt(self, user_prompt, github_token):
        """Executa um prompt de QA de depuracao e devolve o texto bruto do modelo."""
        qa_prompt = self._prompts.build_qa_prompt(user_prompt)
        return self._copilot.send_prompt(qa_prompt, github_token=github_token)

    def generate_scenarios(
        self, card_data, user_focus, technical_detail, generation_settings, github_token=None, preferred_model=None
    ):
        prompt = self._prompts.build_qa_generation_prompt(card_data, user_focus, technical_detail, generation_settings)

        raw_response = self._copilot.send_prompt(prompt, github_token=github_token, preferred_model=preferred_model)
        parsed_response = parse_json_loosely(raw_response)
        self._prompts.validate_generated_test_cases(parsed_response)
        return parsed_response

    def evaluate_coverage(self, card_data, github_token=None, preferred_model=None):
        card_data = card_data or {}
        if not card_data.get("existing_tests"):
            return "Nao ha testes existentes para avaliar."

        prompt = self._prompts.build_qa_evaluation_prompt(card_data)
        return self._copilot.send_prompt(prompt, github_token=github_token, preferred_model=preferred_model)
