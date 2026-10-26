// Constantes de dominio compartilhadas por background, content scripts e options page.

export const SUPPORTED_AI_PROVIDERS = ['gemini', 'copilot', 'groq'];
export const DEFAULT_AI_PROVIDER = 'gemini';

export const VALID_COPILOT_MODELS = ['claude-sonnet-4.5', 'gpt-5-mini', 'claude-opus-4.5'];
export const DEFAULT_COPILOT_MODEL = 'claude-sonnet-4.5';

// Os QAs rodam a API localmente; o backend hospedado continua disponivel informando a URL nas configuracoes.
export const DEFAULT_BACKEND_URL = 'http://localhost:3000';
export const DEV_BACKEND_URL = 'http://localhost:3000';

// Provedores de IA invalidos/legados (ex.: Grok removido) caem no padrao.
export function normalizeSelectedAi(selectedAi) {
    return SUPPORTED_AI_PROVIDERS.includes(selectedAi) ? selectedAi : DEFAULT_AI_PROVIDER;
}

export function normalizeCopilotModel(model) {
    const value = (model || '').trim();
    return VALID_COPILOT_MODELS.includes(value) ? value : DEFAULT_COPILOT_MODEL;
}
