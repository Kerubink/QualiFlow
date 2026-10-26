import { normalizeSelectedAi } from '../domain/constants.js';

// Avalia a cobertura dos testes existentes do card com o provedor de IA selecionado.
export async function evaluateCoverage({ cardData }, { getSettings, ai }) {
    const settings = await getSettings();
    const selectedAi = normalizeSelectedAi(settings.selectedAi);
    const evaluator = selectedAi === 'copilot' ? ai.evaluateCoverageCopilot
        : selectedAi === 'groq' ? ai.evaluateCoverageGroq
            : ai.evaluateCoverageGemini;
    return evaluator(cardData, settings);
}
