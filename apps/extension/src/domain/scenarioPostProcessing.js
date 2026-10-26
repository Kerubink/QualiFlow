// O pos-processamento (normalizacao de steps/BDD, calculo de RTM) agora roda inteiramente
// no backend Python (src/orchestration.py::post_process_generated_scenarios). O resultado
// que chega aqui ja vem pronto; apenas garantimos o formato minimo esperado pela UI.
function toArray(value) {
	return Array.isArray(value) ? value : [];
}

export function postProcessGeneratedScenarios(rawResponse, cardData, ensureParamsDefault) {
	const source = rawResponse && typeof rawResponse === 'object' ? rawResponse : { test_cases: [] };
	const testCases = toArray(source.test_cases);

	if (typeof ensureParamsDefault === 'function') {
		for (const scenario of testCases) {
			ensureParamsDefault(scenario);
		}
	}

	return {
		total_criterios: source.total_criterios || 0,
		total_tests: source.total_tests || testCases.length,
		coverage_analysis: source.coverage_analysis || { rtm_matrix: [], insights: '', coverage_score: '0%' },
		test_cases: testCases
	};
}

