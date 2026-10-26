// Regras puras sobre as configuracoes salvas (pre-requisitos de cada fluxo).

export function isRunnerDisabled(settings) {
    return settings?.runnerEnabled === false;
}

export function hasAzureConfig(settings) {
    return !!((settings?.azureSessionToken || settings?.azurePat) && settings?.azureOrg && settings?.azureProject);
}

export function hasJiraConfig(settings) {
    return !!(settings?.jiraDomain && settings?.jiraSessionToken && settings?.jiraProjectKey);
}

export function hasCopilotSession(settings) {
    return !!(settings?.copilotSessionToken || settings?.copilotToken);
}

// O provedor de IA selecionado tem credencial configurada?
export function hasAiConfig(settings, selectedAi) {
    if (selectedAi === 'copilot') return hasCopilotSession(settings);
    if (selectedAi === 'groq') return !!settings?.groqKey;
    return !!settings?.geminiKey;
}
