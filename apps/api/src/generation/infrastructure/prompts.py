"""Catalogo de prompts: monta as variaveis de cada template Jinja2 (prompts/system/*.j2) e renderiza
via prompt_registry. Implementa a porta PromptCatalog (application/ports.py).

O texto dos prompts vive nos .j2; aqui so ha preparacao de dados. Mantem um unico lugar definindo o
que "gerar casos de teste" e "avaliar cobertura" significam, independente do provedor de IA.
"""
import json

from ..domain.cards import detect_track_from_tags
from ..domain.criteria import strip_html
from ..domain.rtm import summarize_tests_for_rtm
from ..domain.scenarios import compact_scenarios_for_adaptation
from . import prompt_registry


class PromptCatalog:
    def build_qa_prompt(self, user_prompt):
        return prompt_registry.render(
            "system/qa_test_debug.j2",
            user_prompt=user_prompt.strip(),
            expected_json_structure=prompt_registry.schema_example("qa_test_debug.schema.json"),
        )

    def build_qa_generation_prompt(self, card_data, user_focus, technical_detail, generation_settings):
        """Prompt de geracao single-shot de cenarios a partir de um card e das configuracoes de geracao.

        Usado tanto pelo endpoint dedicado do Copilot quanto pelo fallback legado da orquestracao.
        """
        card_data = card_data or {}
        generation_settings = generation_settings or {}

        track = detect_track_from_tags(card_data.get("tags"))
        objective = generation_settings.get("objective") or "All Objectives"
        test_type = generation_settings.get("type") or "Funcional"
        granularity = generation_settings.get("granularity") or "Detalhado"
        data_level = generation_settings.get("dataLevel") or "Massa de dados basica"

        existing_tests = card_data.get("existing_tests")
        legacy_tests_for_upgrade = json.dumps(existing_tests, ensure_ascii=False) if existing_tests else "Nenhum"

        return prompt_registry.render(
            "system/qa_generator.j2",
            track=track,
            objective=objective,
            test_type=test_type,
            granularity=granularity,
            data_level=data_level,
            work_item={
                "id": card_data.get("id"),
                "title": card_data.get("title"),
                "description": card_data.get("description"),
                "acceptance_criteria": card_data.get("acceptance_criteria"),
                "tags": card_data.get("tags"),
            },
            user_technical_context=user_focus or "Nao informado pelo usuario.",
            deep_technical_detail=technical_detail or "Nao informado.",
            legacy_tests_for_upgrade=legacy_tests_for_upgrade,
            expected_json_structure=prompt_registry.schema_example("qa_test_case.schema.json"),
        )

    def build_qa_evaluation_prompt(self, card_data):
        card_data = card_data or {}
        return prompt_registry.render(
            "system/qa_evaluator.j2",
            acceptance_criteria=card_data.get("acceptance_criteria"),
            existing_tests=card_data.get("existing_tests"),
        )

    def build_decomposition_prompt(self, card_data, user_focus, technical_detail, generation_settings, criteria_list):
        card_data = card_data or {}
        return prompt_registry.render(
            "system/decomposition.j2",
            generation_settings=generation_settings,
            work_item={
                "id": card_data.get("id"),
                "title": card_data.get("title"),
                "description": strip_html(card_data.get("description") or ""),
                "acceptance_criteria": criteria_list,
                "tags": card_data.get("tags") or "",
            },
            user_focus=user_focus or "",
            technical_detail=technical_detail or "",
        )

    def build_batch_prompt(
        self,
        card_data,
        criteria_list,
        rules,
        batch_plan,
        generation_settings,
        user_focus,
        technical_detail,
        already_generated=None,
    ):
        card_data = card_data or {}
        return prompt_registry.render(
            "system/batch_generation.j2",
            rules=rules,
            generation_settings=generation_settings,
            work_item={
                "id": card_data.get("id"),
                "title": card_data.get("title"),
                "description": strip_html(card_data.get("description") or ""),
                "acceptance_criteria": criteria_list,
                "tags": card_data.get("tags") or "",
            },
            user_focus=user_focus or "",
            technical_detail=technical_detail or "",
            batch_plan=batch_plan,
            already_generated=[
                {"id": test.get("id"), "title": test.get("title")}
                for test in (already_generated or [])
                if isinstance(test, dict)
            ],
        )

    def build_rtm_prompt(self, criteria_list, generated_tests):
        return prompt_registry.render(
            "system/rtm.j2",
            criteria_list=criteria_list,
            generated_tests=summarize_tests_for_rtm(generated_tests),
        )

    def build_adaptation_prompt(
        self,
        target_card_data,
        source_work_item,
        copied_scenarios,
        criteria_list,
        generation_settings,
        user_focus,
        technical_detail,
    ):
        target_card_data = target_card_data or {}
        source_work_item = source_work_item or {}

        return prompt_registry.render(
            "system/adaptation.j2",
            generation_settings=generation_settings,
            source_work_item_id=source_work_item.get("id"),
            source_work_item_title=source_work_item.get("title") or "",
            compact_scenarios=compact_scenarios_for_adaptation(copied_scenarios),
            target_context={
                "id": target_card_data.get("id"),
                "title": target_card_data.get("title"),
                "description": strip_html(target_card_data.get("description") or ""),
                "acceptance_criteria": criteria_list,
                "tags": target_card_data.get("tags") or "",
            },
            user_focus=user_focus or "",
            technical_detail=technical_detail or "",
        )

    def validate_generated_test_cases(self, parsed_response):
        """Valida a resposta do modelo contra o JSON Schema (levanta RuntimeError 'invalid_json_response...')."""
        prompt_registry.validate_against_schema("qa_test_case.schema.json", parsed_response)
