import { VALID_COPILOT_MODELS } from './constants.js';

// Normaliza a URL de organizacao Azure: remove espacos e barras finais.
export function normalizeAzureOrgUrl(value) {
    return String(value || '').trim().replace(/\/+$/, '');
}

// Mantem apenas modelos Copilot permitidos pela extensao.
export function filterAllowedCopilotModels(models) {
    return (models || []).filter((m) => VALID_COPILOT_MODELS.includes(m));
}

// Rotulo amigavel do usuario autenticado em um board (Azure/Jira).
export function resolveBoardUserLabel(user) {
    return user?.displayName || user?.name || user?.email || user?.emailAddress;
}
