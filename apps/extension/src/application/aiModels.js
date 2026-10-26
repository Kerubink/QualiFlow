// Lista os modelos disponiveis no provedor (a chave/sessao vem das configuracoes salvas).
export async function listModels(provider, { getSettings, ai }) {
    const settings = await getSettings();
    const fetchers = {
        gemini: ai.fetchGeminiModels,
        groq: ai.fetchGroqModels,
        copilot: ai.fetchCopilotModels
    };
    return fetchers[provider](settings);
}
