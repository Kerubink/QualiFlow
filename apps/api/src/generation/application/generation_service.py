"""
Orquestracao de geracao de cenarios de teste (decomposicao -> lotes -> RTM) e adaptacao de cenarios
copiados para outro card.

Portado do frontend (services/orchestration/testGeneration.js + postProcessor.js) para centralizar no
backend toda a logica de prompt engineering e regras de negocio. Depende apenas de domain e das portas
(AiGateway, PromptCatalog); provedores e templates sao injetados pela composicao.
"""
import threading
import time

from ...shared.log import log
from ..domain.criteria import parse_acceptance_criteria
from ..domain.deduplication import remove_duplicate_scenarios
from ..domain.errors import classify_ai_error
from ..domain.planning import fallback_test_plan, prefix_for_type, resolve_chunk_size, split_in_chunks
from ..domain.post_processing import post_process_generated_scenarios
from ..domain.rtm import select_coverage


def _card_label(card_data):
    card = card_data if isinstance(card_data, dict) else {}
    return f"{card.get('id') or card.get('work_item_id') or card.get('key') or '?'} {card.get('title') or ''}".strip()


HEARTBEAT_SECONDS = 8


def _elapsed(started_at):
    return f"{round(time.time() - started_at, 1)}s"


class GenerationService:
    def __init__(self, ai, prompts):
        """`ai`: porta AiGateway; `prompts`: porta PromptCatalog."""
        self._ai = ai
        self._prompts = prompts

    # --- Modelos disponiveis por provedor ---

    def list_gemini_models(self, gemini_key):
        return self._ai.list_gemini_models(gemini_key)

    def list_groq_models(self, groq_key):
        return self._ai.list_groq_models(groq_key)

    # --- Pipelines (generators de eventos internos) ---

    def orchestrate_scenario_generation(
        self, selected_ai, ai_settings, card_data, user_focus, technical_detail, generation_settings, github_token=None
    ):
        """Generator: yields ('progress', dict) durante o processo e ('result', dict) ao final."""
        yield "progress", {"stage": "analyzing", "message": "Analisando regras e decompondo os cenarios..."}
        criteria_list = parse_acceptance_criteria((card_data or {}).get("acceptance_criteria") or "")
        log(
            "geracao",
            "iniciada",
            ia=selected_ai,
            card=_card_label(card_data),
            criterios=len(criteria_list),
            tipo=(generation_settings or {}).get("type"),
        )

        decomposition_prompt = self._prompts.build_decomposition_prompt(
            card_data, user_focus, technical_detail, generation_settings, criteria_list
        )

        try:
            decomposition = yield from self._await_ai(
                lambda: self._ai.json_prompt(selected_ai, ai_settings, decomposition_prompt, 0.1, github_token),
                {"stage": "analyzing", "message": "Analisando regras e decompondo os cenarios..."},
            )
        except Exception as error:
            log("geracao", "decomposicao FALHOU, usando plano de fallback", erro=f"{type(error).__name__}: {error}")
            decomposition = None

        rules = (decomposition or {}).get("rules") if isinstance(decomposition, dict) else None
        rules = rules if isinstance(rules, list) else []

        test_plan = (decomposition or {}).get("test_plan") if isinstance(decomposition, dict) else None
        if not isinstance(test_plan, list) or not test_plan:
            test_plan = fallback_test_plan(criteria_list, generation_settings)

        chunk_size = resolve_chunk_size((ai_settings or {}).get("generationChunkSize"))

        batches = split_in_chunks(test_plan, chunk_size)
        generated_tests = []
        log("geracao", "plano definido", cenarios_planejados=len(test_plan), lotes=len(batches), tamanho_lote=chunk_size)

        yield "progress", {
            "stage": "batch-start",
            "message": "Gerando cenarios de teste em lotes...",
            "totalBatches": len(batches),
        }

        for batch_index, batch_plan in enumerate(batches):
            yield "progress", {
                "stage": "batch-progress",
                "message": f"Gerando lote {batch_index + 1} de {len(batches)}...",
                "batchIndex": batch_index + 1,
                "totalBatches": len(batches),
            }

            batch_prompt = self._prompts.build_batch_prompt(
                card_data,
                criteria_list,
                rules,
                batch_plan,
                generation_settings,
                user_focus,
                technical_detail,
                already_generated=generated_tests,
            )
            try:
                batch_result = yield from self._await_ai(
                    lambda: self._ai.json_prompt(selected_ai, ai_settings, batch_prompt, 0.2, github_token),
                    {
                        "stage": "batch-progress",
                        "message": f"Gerando lote {batch_index + 1} de {len(batches)}...",
                        "batchIndex": batch_index + 1,
                        "totalBatches": len(batches),
                    },
                )
            except Exception as error:
                # Nao deixa UM lote com falha (timeout, JSON malformado, rate limit) derrubar os
                # demais lotes ja gerados com sucesso -- sem isso, uma unica falha jogava fora tudo
                # e caia no fallback legado (single-shot, sem decomposicao), que tende a gerar bem
                # menos casos de teste do que a geracao em lote completa.
                log(
                    "geracao",
                    f"lote {batch_index + 1}/{len(batches)} FALHOU, pulando (demais lotes seguem)",
                    erro=f"{type(error).__name__}: {error}",
                )
                continue
            batch_cases = batch_result.get("test_cases") if isinstance(batch_result, dict) else None
            batch_cases = batch_cases if isinstance(batch_cases, list) else []
            # Remove na hora o que o modelo repetiu em relacao aos lotes anteriores (e dentro do proprio lote), para
            # que os proximos lotes ja recebam a lista sem repeticoes em `already_generated`.
            unique_cases, duplicates = remove_duplicate_scenarios([*generated_tests, *batch_cases])
            added = len(unique_cases) - len(generated_tests)
            generated_tests = unique_cases
            log(
                "geracao",
                f"lote {batch_index + 1}/{len(batches)} ok",
                cts=added,
                repetidos_removidos=len(duplicates) or None,
            )

        if not generated_tests:
            raise RuntimeError("Nao foi possivel gerar casos de teste no lote.")

        yield "progress", {"stage": "rtm", "message": "Montando matriz RTM e analise de cobertura..."}
        final_coverage = yield from self._build_coverage(
            selected_ai, ai_settings, criteria_list, generated_tests, github_token
        )

        log("geracao", "RTM montada", cobertura=(final_coverage or {}).get("coverage_score"), total_cts=len(generated_tests))
        yield "progress", {"stage": "done", "message": "Geracao concluida com sucesso."}

        yield "result", {
            "total_criterios": len(criteria_list) or len(final_coverage["rtm_matrix"]),
            "total_tests": len(generated_tests),
            "coverage_analysis": final_coverage,
            "test_cases": generated_tests,
        }

    def orchestrate_scenario_adaptation(
        self,
        selected_ai,
        ai_settings,
        target_card_data,
        source_work_item,
        copied_scenarios,
        user_focus,
        technical_detail,
        generation_settings,
        github_token=None,
    ):
        criteria_list = parse_acceptance_criteria((target_card_data or {}).get("acceptance_criteria") or "")
        log(
            "adaptacao",
            "iniciada",
            ia=selected_ai,
            card_alvo=_card_label(target_card_data),
            origem=(source_work_item or {}).get("id"),
            cts_copiados=len(copied_scenarios) if isinstance(copied_scenarios, list) else 0,
        )
        normalized_copied = copied_scenarios if isinstance(copied_scenarios, list) else []

        if not normalized_copied:
            raise RuntimeError("Nao ha cenarios copiados para ajustar.")

        yield "progress", {"stage": "analyzing", "message": "Analisando CTs copiados e criterios do card alvo..."}

        adaptation_prompt = self._prompts.build_adaptation_prompt(
            target_card_data,
            source_work_item,
            normalized_copied,
            criteria_list,
            generation_settings,
            user_focus,
            technical_detail,
        )

        adaptation_result = yield from self._await_ai(
            lambda: self._ai.json_prompt(selected_ai, ai_settings, adaptation_prompt, 0.2, github_token),
            {"stage": "analyzing", "message": "Analisando CTs copiados e criterios do card alvo..."},
        )
        adapted_cases = adaptation_result.get("test_cases") if isinstance(adaptation_result, dict) else None
        adapted_cases = adapted_cases if isinstance(adapted_cases, list) else []

        if not adapted_cases:
            raise RuntimeError("A IA nao retornou cenarios ajustados para o card alvo.")

        yield "progress", {"stage": "rtm", "message": "Montando matriz RTM para validar cobertura apos ajustes..."}

        final_coverage = yield from self._build_coverage(
            selected_ai, ai_settings, criteria_list, adapted_cases, github_token
        )

        log("adaptacao", "RTM atualizada", total_cts=len(adapted_cases))
        yield "progress", {"stage": "done", "message": "Ajuste concluido com RTM atualizado."}

        yield "result", {
            "total_criterios": len(criteria_list) or len(final_coverage["rtm_matrix"]),
            "total_tests": len(adapted_cases),
            "coverage_analysis": final_coverage,
            "test_cases": adapted_cases,
        }

    @staticmethod
    def _await_ai(call, progress):
        """Generator: executa `call` (chamada bloqueante ao modelo) em uma thread e, enquanto espera, emite um evento
        `progress` periodico (mesmo stage, com `waitingSeconds`). Assim o stream NDJSON nunca fica minutos em
        silencio durante uma chamada lenta de IA: a UI continua mostrando o andamento e a conexao se mantem ativa.
        Devolve o resultado de `call` (via `yield from`) ou relanca a excecao dele."""
        outcome = {}

        def run():
            try:
                outcome["value"] = call()
            except BaseException as error:  # repassada ao chamador abaixo
                outcome["error"] = error

        worker = threading.Thread(target=run, daemon=True, name="ai-call")
        worker.start()
        started_at = time.time()
        while True:
            worker.join(HEARTBEAT_SECONDS)
            if not worker.is_alive():
                break
            waited = round(time.time() - started_at)
            yield "progress", {
                **progress,
                "message": f"{progress['message']} (aguardando a IA ha {waited}s)",
                "waitingSeconds": waited,
            }
        if "error" in outcome:
            raise outcome["error"]
        return outcome.get("value")

    def _build_coverage(self, selected_ai, ai_settings, criteria_list, test_cases, github_token):
        """Generator: RTM via IA; se falhar ou vier mal formada, usa a cobertura heuristica de fallback."""
        coverage_analysis = None
        try:
            rtm_prompt = self._prompts.build_rtm_prompt(criteria_list, test_cases)
            rtm_result = yield from self._await_ai(
                lambda: self._ai.json_prompt(selected_ai, ai_settings, rtm_prompt, 0.1, github_token),
                {"stage": "rtm", "message": "Montando matriz RTM e analise de cobertura..."},
            )
            coverage_analysis = rtm_result.get("coverage_analysis") if isinstance(rtm_result, dict) else None
        except Exception as error:
            log("geracao", "RTM via IA FALHOU, usando cobertura heuristica", erro=f"{type(error).__name__}: {error}")
            coverage_analysis = None

        return select_coverage(coverage_analysis, criteria_list, test_cases)

    def legacy_generate_scenarios(
        self, selected_ai, ai_settings, card_data, user_focus, technical_detail, generation_settings, github_token=None
    ):
        """Fallback single-shot (sem decomposicao em lotes), usado quando a orquestracao completa falha.

        Reutiliza build_qa_generation_prompt (o mesmo prompt do endpoint dedicado do Copilot) para
        nao manter uma segunda copia divergente das regras de geracao de teste.
        """
        prompt = self._prompts.build_qa_generation_prompt(card_data, user_focus, technical_detail, generation_settings)
        return self._ai.json_prompt(selected_ai, ai_settings, prompt, 0.2, github_token)

    def evaluate_coverage(self, selected_ai, card_data, ai_settings, github_token=None):
        card_data = card_data or {}
        log("cobertura", "avaliacao iniciada", ia=selected_ai, card=_card_label(card_data))
        if not card_data.get("existing_tests"):
            log("cobertura", "sem testes existentes, nada a avaliar")
            return "Nao ha testes existentes para avaliar."

        prompt = self._prompts.build_qa_evaluation_prompt(card_data)
        result = self._ai.text_prompt(selected_ai, ai_settings, prompt, 0.3, github_token)
        log("cobertura", "avaliacao concluida")
        return result

    # --- Eventos de streaming (a interface serializa cada evento como uma linha NDJSON) ---

    def stream_generation(
        self, selected_ai, ai_settings, card_data, user_focus, technical_detail, generation_settings, github_token=None
    ):
        """Generator de eventos: {"type": "progress", ...} | {"type": "result", "data": ...} |
        {"type": "error", "error": {code, message}, "cause": Exception}."""
        started_at = time.time()
        try:
            final_result = None
            for kind, payload in self.orchestrate_scenario_generation(
                selected_ai,
                ai_settings,
                card_data,
                user_focus,
                technical_detail,
                generation_settings,
                github_token=github_token,
            ):
                if kind == "progress":
                    yield {"type": "progress", **payload}
                else:
                    final_result = payload

            if final_result is None:
                raise RuntimeError("Orquestracao nao retornou resultado.")

            processed = post_process_generated_scenarios(
                final_result, card_data, prefix_for_type((generation_settings or {}).get("type"))
            )
            log("geracao", "CONCLUIDA", cts=len(processed.get("test_cases") or []), duracao=_elapsed(started_at))
            yield {"type": "result", "data": processed}
        except Exception as error:
            try:
                log(
                    "geracao",
                    "orquestracao completa FALHOU, caindo para o fallback legado (single-shot)",
                    erro=f"{type(error).__name__}: {error}",
                )
                yield {"type": "progress", "stage": "fallback", "message": "Executando fluxo legado de geracao..."}
                raw = self.legacy_generate_scenarios(
                    selected_ai,
                    ai_settings,
                    card_data,
                    user_focus,
                    technical_detail,
                    generation_settings,
                    github_token=github_token,
                )
                processed = post_process_generated_scenarios(
                    raw, card_data, prefix_for_type((generation_settings or {}).get("type"))
                )
                log("geracao", "CONCLUIDA via fallback legado", cts=len(processed.get("test_cases") or []), duracao=_elapsed(started_at))
                yield {"type": "result", "data": processed}
            except Exception as fallback_error:
                yield self._error_event(selected_ai, fallback_error)

    def stream_adaptation(
        self,
        selected_ai,
        ai_settings,
        target_card_data,
        source_work_item,
        copied_scenarios,
        user_focus,
        technical_detail,
        generation_settings,
        github_token=None,
    ):
        """Mesmo formato de eventos de stream_generation, sem fallback legado."""
        started_at = time.time()
        try:
            final_result = None
            for kind, payload in self.orchestrate_scenario_adaptation(
                selected_ai,
                ai_settings,
                target_card_data,
                source_work_item,
                copied_scenarios,
                user_focus,
                technical_detail,
                generation_settings,
                github_token=github_token,
            ):
                if kind == "progress":
                    yield {"type": "progress", **payload}
                else:
                    final_result = payload

            if final_result is None:
                raise RuntimeError("Orquestracao de adaptacao nao retornou resultado.")

            processed = post_process_generated_scenarios(final_result, target_card_data)
            log("adaptacao", "CONCLUIDA", cts=len(processed.get("test_cases") or []), duracao=_elapsed(started_at))
            yield {"type": "result", "data": processed}
        except Exception as error:
            yield self._error_event(selected_ai, error)

    @staticmethod
    def _error_event(selected_ai, error):
        classified = classify_ai_error(selected_ai, error)
        log(
            "erro",
            "operacao de IA falhou",
            ia=selected_ai,
            codigo=classified["code"],
            http=classified["httpStatus"],
            detalhe=f"{type(error).__name__}: {error}",
        )
        return {"type": "error", "error": classify_ai_error(selected_ai, error), "cause": error}
