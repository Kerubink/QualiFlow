const DEFAULT_COPILOT_BACKEND_URL = 'https://qualiflow-gerador-de-cts.onrender.com';
const DEV_BACKEND_URL = 'http://localhost:3000';
const VALID_COPILOT_MODELS = ['claude-sonnet-4.5', 'gpt-5-mini', 'claude-opus-4.5'];
const qualiflowBridgeUi = window.qualiflowBridge;

function parseCopilotBackendUrl(rawValue) {
    const value = String(rawValue || '').trim();
    if (!value) {
        return { ok: true, url: DEFAULT_COPILOT_BACKEND_URL };
    }

    let parsed;
    try {
        parsed = new URL(value);
    } catch {
        return { ok: false, error: 'URL da API Copilot invalida. Inclua http:// ou https://.' };
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { ok: false, error: 'A URL da API Copilot deve usar HTTP ou HTTPS.' };
    }

    return {
        ok: true,
        url: `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '')
    };
}

function getStorage(keys, callback) {
    if (qualiflowBridgeUi && typeof qualiflowBridgeUi.getStorage === 'function') {
        qualiflowBridgeUi.getStorage(keys, callback);
        return;
    }
    chrome.storage.local.get(keys, callback);
}

function setStorage(payload, callback) {
    if (qualiflowBridgeUi && typeof qualiflowBridgeUi.setStorage === 'function') {
        qualiflowBridgeUi.setStorage(payload, callback);
        return;
    }
    chrome.storage.local.set(payload, callback);
}

function normalizeCopilotModel(model) {
    const value = (model || '').trim();
    return VALID_COPILOT_MODELS.includes(value) ? value : 'claude-sonnet-4.5';
}

function resolveBoardProvider() {
    if (typeof globalThis.detectBoardProvider === 'function') {
        return globalThis.detectBoardProvider();
    }

    const host = (window.location.hostname || '').toLowerCase();
    if (host.includes('atlassian.net')) return 'jira';
    if (host.includes('dev.azure.com') || host.includes('visualstudio.com')) return 'azure';
    return 'azure';
}

function injectFAB() {
    if (document.getElementById('qualiflow-fab-container')) return;

    const boardProvider = resolveBoardProvider();
    const isAzureBoard = boardProvider === 'azure';

    const fabContainer = document.createElement('div');
    fabContainer.id = 'qualiflow-fab-container';

    const mainFabIcon = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3v18h18M18 17V9M13 17V5M8 17v-3"></path></svg>`;
    const generateIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"></path></svg>`;

    const dashIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3v18h18M18 17V9M13 17V5M8 17v-3"></path></svg>`;
    const runIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347c-.75.412-1.667-.13-1.667-.986V5.653z"></path></svg>`;

        fabContainer.innerHTML = `
            ${isAzureBoard ? `<div id="qualiflow-fab-dash" class="qualiflow-fab-sub" title="Dashboard QA">${dashIcon}</div>` : ''}
      <div id="qualiflow-fab-gen" class="qualiflow-fab-sub" title="Gerar Casos de Teste">
        ${generateIcon}
      </div>
            ${isAzureBoard ? `<div id="qualiflow-fab-run" class="qualiflow-fab-sub" title="Executar Testes">${runIcon}</div>` : ''}
      <div id="qualiflow-fab-settings" class="qualiflow-fab-sub" title="Configurações">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"></path></svg>
      </div>
      <div id="qualiflow-fab-main" title="QualiFlow Tools">
                ${mainFabIcon}
      </div>
    `;

    document.body.appendChild(fabContainer);
    if (isAzureBoard) {
        document.getElementById('qualiflow-fab-dash').addEventListener('click', () => {
            openModal('dashboard');
        });
    }
    document.getElementById('qualiflow-fab-gen').addEventListener('click', () => {
        openModal('generator');
    });
    if (isAzureBoard) {
        document.getElementById('qualiflow-fab-run').addEventListener('click', () => {
            openModal('runner');
        });
    }
    document.getElementById('qualiflow-fab-settings').addEventListener('click', () => {
        openModal('settings');
    });
}

globalThis.injectFAB = injectFAB;

function injectModal() {
    if (document.getElementById('qualiflow-modal-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'qualiflow-modal-overlay';
    overlay.className = 'qualiflow-hidden';

    const modal = document.createElement('div');
    modal.id = 'qualiflow-modal';

    modal.innerHTML = `
    <div class="qualiflow-header">
      <h2 style="display:flex; align-items:center;"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="margin-right: 8px;"><path stroke-linecap="round" stroke-linejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg> QualiFlow - Gerador de Casos de Teste</h2>
      <span class="qualiflow-close" id="qualiflow-close">&times;</span>
    </div>
        <div id="qualiflow-page-generator" style="height:100%; flex:1; display:flex; flex-direction:column; overflow:hidden;">
            <div class="qualiflow-generation-layout" id="qualiflow-generation-layout">
                <div class="qualiflow-step-col qualiflow-col-context">
                    <div id="qualiflow-status" class="qualiflow-info" style="margin: 0 0 16px 0; display: none;">Aguardando...</div>
                    <div id="qualiflow-local-sessions-area" style="display:none; margin-bottom:16px;"></div>
                    <div id="qualiflow-context-area" class="qualiflow-hidden">
                        <h3 id="qualiflow-wi-title"></h3>
                        <p class="qualiflow-wi-meta" id="qualiflow-wi-meta"></p>
 
                        <div class="qualiflow-section-header">
                            <h4>Configuração da Geração</h4>
                        </div>
                       
                        <div class="qualiflow-select-row">
                            <div class="qualiflow-select-group">
                                <label>Objetivo do Cenário:</label>
                                <select id="qualiflow-select-objective" class="qualiflow-select-input">
                                    <option value="All Objectives">Todas as Opções Acima</option>
                                    <option value="Happy Path">Fluxo Principal (Caminho Feliz)</option>
                                    <option value="Negative Scenarios">Exceção / Erro / Negativos</option>
                                    <option value="Edge Cases">Casos de Borda (Limites)</option>
                                    <option value="Complex Business Rules">Regras de Negócio Complexas</option>
                                </select>
                            </div>
                            <div class="qualiflow-select-group">
                                <label>Tipo de Validação:</label>
                                <select id="qualiflow-select-type" class="qualiflow-select-input">
                                    <option value="Functional">Funcionalidade (Regra)</option>
                                    <option value="UI/UX">Interface / UX / Visual</option>
                                    <option value="Security">Segurança / Permissões</option>
                                    <option value="API">API / Integrações</option>
                                    <option value="Performance/Load">Performance / Carga</option>
                                    <option value="Accessibility">Acessibilidade</option>
                                    <option value="Regression">Regressão</option>
                                </select>
                            </div>
                        </div>
 
                        <div class="qualiflow-select-row">
                            <div class="qualiflow-select-group">
                                <label>Estilo dos Passos:</label>
                                <select id="qualiflow-select-granularity" class="qualiflow-select-input">
                                    <option value="Short and Direct">Curtos e Diretos</option>
                                    <option value="Detailed and Granular">Detalhados / Granulados</option>
                                    <option value="Business Language">Linguagem de Negócio (Gherkin-heavy)</option>
                                    <option value="Evidence Focused">Foco em Evidências</option>
                                </select>
                            </div>
                            <div class="qualiflow-select-group">
                                <label>Nível de Dados:</label>
                                <select id="qualiflow-select-data" class="qualiflow-select-input">
                                    <option value="Simple Data">Dados Simples</option>
                                    <option value="Varied and Real Data">Massa de Dados Real / Variada</option>
                                    <option value="Negative Data Input">Entrada de Massa Negativa</option>
                                    <option value="Robust Parameterization">Parametrização Robusta (@params)</option>
                                </select>
                            </div>
                        </div>
 
                        <div class="qualiflow-section-header" style="margin-top:12px;">
                            <h4>Detalhamento Técnico (Opcional)</h4>
                        </div>
                        <textarea id="qualiflow-technical-detail" placeholder="Info técnica: tabelas, endpoints, regras de cálculo..."></textarea>
 
                        <div class="qualiflow-section-header">
                            <h4>Foco Específico (Opcional)</h4>
                        </div>
                        <textarea id="qualiflow-user-focus" placeholder="Descreva algo muito pontual onde a IA deve focar..."></textarea>
 
                        <div class="qualiflow-section-header" style="margin-top:12px;">
                            <h4>Critérios de Aceite (editáveis)</h4>
                        </div>
                        <textarea id="qualiflow-acceptance-criteria" placeholder="Critérios de Aceite extraídos do card. Você pode editar ou adicionar novos critérios aqui."></textarea>
 
                        <div id="qualiflow-eval-container" class="qualiflow-hidden">
                            <button id="btn-eval" class="qualiflow-btn qualiflow-btn-secondary"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="vertical-align:text-bottom;margin-right:4px"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"></path></svg> Avaliar Cobertura</button>
                            <div id="qualiflow-eval-result" class="qualiflow-hidden"></div>
                        </div>
 
                        <button id="btn-generate" class="qualiflow-btn qualiflow-btn-primary"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="vertical-align:text-bottom;margin-right:4px"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"></path></svg> Gerar Cenários</button>
                        <button id="btn-copy-from-card" class="qualiflow-btn qualiflow-btn-secondary" style="margin-top:8px;"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="vertical-align:text-bottom;margin-right:4px"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 10h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg> Reaproveitar CTs de Outro Card</button>
                    </div>
                </div>
 
                <div id="qualiflow-col-rtm" class="qualiflow-step-col qualiflow-col-rtm qualiflow-hidden">
                    <div id="qualiflow-rtm-content"></div>
                </div>
 
                <div id="qualiflow-col-scenarios" class="qualiflow-step-col qualiflow-col-scenarios qualiflow-hidden">
                    <div class="qualiflow-scenarios-header">
                        <h3>Cenários Gerados</h3>
                        <div style="display:flex; align-items:center;">
                            <button id="btn-copy-auto-adjust" class="qualiflow-btn-inline qualiflow-btn-secondary qualiflow-hidden" style="margin-right:8px;"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="vertical-align:text-bottom;margin-right:4px"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"></path></svg> Ajustes Automáticos</button>
                            <span id="save-local-feedback" class="qualiflow-hidden" style="color:#10b981; font-size:0.8rem; margin-right:8px; font-weight:600;">✔ Salvo</span>
                            <button id="btn-save-local" class="qualiflow-btn-inline qualiflow-btn-secondary" style="margin-right:8px;"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="vertical-align:text-bottom;margin-right:4px"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg> Salvar Localmente</button>
                            <button id="btn-save" class="qualiflow-btn-inline qualiflow-btn-success"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="vertical-align:text-bottom;margin-right:4px"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 3.75V16.5L12 14.25 7.5 16.5V3.75m9 0H18A2.25 2.25 0 0120.25 6v12A2.25 2.25 0 0118 20.25H6A2.25 2.25 0 013.75 18V6A2.25 2.25 0 016 3.75h1.5m9 0h-9"></path></svg> Salvar no Board</button>
                        </div>
                    </div>
                    <div id="qualiflow-scenarios-list"></div>
                </div>
            </div>
            <div id="qualiflow-dashboard-container" class="qualiflow-step-col qualiflow-hidden qualiflow-dashboard-resizable" style="background-color:#1e293b; padding:20px; overflow-y:auto; overflow-x:auto;">
                <div id="qualiflow-dashboard-tabs" style="display:flex; gap:8px; margin-bottom:20px; border-bottom:1px solid #334155;">
                    <button id="qualiflow-tab-analytics" class="qualiflow-tab-btn qualiflow-tab-active" style="padding:8px 16px; border:none; background:none; color:#e2e8f0; cursor:pointer; border-bottom:2px solid #3b82f6; font-weight:600;">Analytics Pro</button>
                    <button id="qualiflow-tab-cards" class="qualiflow-tab-btn" style="padding:8px 16px; border:none; background:none; color:#94a3b8; cursor:pointer; border-bottom:2px solid transparent; font-weight:600;">Meus Cards</button>
                    <button id="qualiflow-tab-support" class="qualiflow-tab-btn" style="padding:8px 16px; border:none; background:none; color:#94a3b8; cursor:pointer; border-bottom:2px solid transparent; font-weight:600;">Suportes</button>
                    <button id="qualiflow-tab-deploy" class="qualiflow-tab-btn" style="padding:8px 16px; border:none; background:none; color:#94a3b8; cursor:pointer; border-bottom:2px solid transparent; font-weight:600;">Validar Deploy</button>
                </div>
                <div id="qualiflow-dashboard-analytics" class="qualiflow-tab-content"></div>
                <div id="qualiflow-dashboard-cards" class="qualiflow-tab-content qualiflow-hidden"></div>
                <div id="qualiflow-dashboard-support" class="qualiflow-tab-content qualiflow-hidden"></div>
                <div id="qualiflow-dashboard-deploy" class="qualiflow-tab-content qualiflow-hidden"></div>
            </div>
        </div>

        <div id="qualiflow-page-runner" class="qualiflow-hidden" style="height:100%; flex:1; display:flex; flex-direction:column; overflow:hidden; background:#0f172a;">
            <div style="width:640px; min-width:360px; max-width:90vw; background-color:#1e293b; padding:20px; overflow-y:auto; overflow-x:hidden; border-right:1px solid #334155;">
                <div style="margin-bottom:12px; display:flex; gap:8px;">
                    <input type="text" id="qualiflow-runner-search" class="qualiflow-input-edit" placeholder="Buscar PBI / CT por título ou ID..." style="flex:1;">
                    <button id="qualiflow-runner-search-btn" class="qualiflow-btn qualiflow-btn-primary" style="padding:6px 12px; width:auto;">Buscar</button>
                </div>
                <div style="margin-bottom:12px;">
                    <select id="qualiflow-runner-filter" class="qualiflow-select-input" style="width:100%;">
                        <option value="All">Todas as Iterations</option>
                    </select>
                </div>
                <div id="qualiflow-runner-body" style="padding:0; color:#94a3b8; font-size:13px; background:transparent; position:relative;">
                    <div id="qualiflow-runner-cards-list" style="display:flex; flex-direction:column; gap:8px;"></div>
                </div>
            </div>
        </div>
 
        <div id="qualiflow-page-settings" class="qualiflow-hidden" style="flex:1; background-color:#0f172a; display:flex;">
            <!-- Sidebar -->
            <div style="width:250px; border-right:1px solid #334155; padding:20px 0; background-color:#1e293b; display:flex; flex-direction:column;">
                <h3 style="padding:0 20px 16px 20px; border-bottom:1px solid #334155; margin-bottom:16px;">Configurações</h3>
                <ul id="qualiflow-settings-nav" style="list-style:none; padding:0; margin:0;">
                    <li data-target="qualiflow-tab-geral" class="qualiflow-tab-active" style="padding:12px 20px; cursor:pointer; color:#f8fafc; font-weight:500; background-color:rgba(99, 102, 241, 0.1); border-left:3px solid #6366f1;">Geral</li>
                    <li data-target="qualiflow-tab-board" style="padding:12px 20px; cursor:pointer; color:#94a3b8; border-left:3px solid transparent;">Plataforma (Board)</li>
                    <li data-target="qualiflow-tab-ai" style="padding:12px 20px; cursor:pointer; color:#94a3b8; border-left:3px solid transparent;">Integrações de IA</li>
                    <li data-target="qualiflow-tab-runner" style="padding:12px 20px; cursor:pointer; color:#94a3b8; border-left:3px solid transparent;">Test Runner (URLs)</li>
                </ul>
            </div>
            
            <!-- Content -->
            <div style="flex:1; padding:30px; overflow-y:auto;">
                <!-- Geral -->
                <div id="qualiflow-tab-geral" class="qualiflow-tab-pane">
                    <h3 style="margin-bottom:20px;">Configurações Gerais</h3>
                    <div class="qualiflow-form-group">
                        <label>Email do QA (opcional):</label>
                        <input type="email" id="qualiflow-settings-qa-email" class="qualiflow-input-edit" placeholder="seu.email@empresa.com" />
                        <div class="qualiflow-description">Se informado, será usado como responsável padrão nos casos de teste criados.</div>
                    </div>
                    <div class="qualiflow-form-group">
                        <label>Tag QA (opcional):</label>
                        <input type="text" id="qualiflow-settings-qa-tag" class="qualiflow-input-edit" placeholder="Ex: QA-Kerubyn" />
                        <div class="qualiflow-description">Tag utilizada para listar seus cards no dashboard inicial.</div>
                    </div>
                    <div class="qualiflow-form-group">
                        <label>Webhook de notificações (Teams/Power Automate):</label>
                        <input type="url" id="qualiflow-settings-support-webhook-url" class="qualiflow-input-edit" placeholder="https://.../triggers/manual/paths/invoke?..." />
                        <div class="qualiflow-description">URL usada para enviar notificações automáticas quando um suporte muda de status.</div>
                    </div>
                    <div class="qualiflow-form-group">
                        <label>Backend QualiFlow:</label>
                        <div class="qualiflow-toggle-row">
                            <label class="qualiflow-toggle">
                                <input type="checkbox" id="qualiflow-dev-mode-toggle" />
                                <span class="qualiflow-toggle-slider"></span>
                            </label>
                            <span class="qualiflow-toggle-label">Modo Desenvolvedor (usar backend local)</span>
                        </div>
                        <input type="url" id="qualiflow-settings-copilot-backend-url" class="qualiflow-input-edit" placeholder="http://localhost:3000" />
                        <div class="qualiflow-description">Usado por todos os provedores de IA e por Azure DevOps/Jira. Ative o Modo Desenvolvedor para apontar automaticamente para http://localhost:3000 sem depender do backend hospedado no Render.</div>
                    </div>
                </div>

                <!-- Board -->
                <div id="qualiflow-tab-board" class="qualiflow-tab-pane qualiflow-hidden">
                    <h3 style="margin-bottom:20px;">Plataforma de Gestão</h3>
                    <div class="qualiflow-form-group" style="padding:12px; background:rgba(255,255,255,0.02); border:1px dashed #334155; border-radius:8px;">
                        <label>Provedor do Board:</label>
                        <select id="qualiflow-settings-board-select" class="qualiflow-input-edit" style="margin-top:6px;">
                            <option value="azure">Azure DevOps</option>
                            <option value="jira">Jira</option>
                            <option value="asana">Asana (Em Breve)</option>
                        </select>
                    </div>
                    <div id="qualiflow-group-azure" style="margin-top:20px;">
                        <div class="qualiflow-form-group">
                            <label>Autenticacao Microsoft:</label>
                            <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
                                <button id="qualiflow-azure-login-btn" class="qualiflow-btn-inline qualiflow-btn-secondary" style="white-space:nowrap;">Entrar com Microsoft</button>
                                <span id="qualiflow-azure-auth-status" style="font-size:0.75rem; color:#94a3b8;">Nao autenticado.</span>
                            </div>
                        </div>
                        <div class="qualiflow-form-group">
                            <label>Azure Organization URL:</label>
                            <input type="text" id="qualiflow-settings-org" class="qualiflow-input-edit" placeholder="Ex: https://dev.azure.com/SuaEmpresa" />
                        </div>
                        <div class="qualiflow-form-group">
                            <label>Azure Project Name:</label>
                            <input type="text" id="qualiflow-settings-proj" class="qualiflow-input-edit" placeholder="Ex: MeuProjeto" />
                        </div>
                    </div>
                    <div id="qualiflow-group-jira" class="qualiflow-hidden" style="margin-top:20px;">
                        <div class="qualiflow-form-group">
                            <label>Autenticacao Atlassian:</label>
                            <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
                                <button id="qualiflow-jira-login-btn" class="qualiflow-btn-inline qualiflow-btn-secondary" style="white-space:nowrap;">Entrar com Atlassian</button>
                                <span id="qualiflow-jira-auth-status" style="font-size:0.75rem; color:#94a3b8;">Nao autenticado.</span>
                            </div>
                        </div>
                        <div class="qualiflow-form-group">
                            <label>Jira Domain:</label>
                            <input type="text" id="qualiflow-settings-jira-domain" class="qualiflow-input-edit" placeholder="Ex: minhaempresa ou minhaempresa.atlassian.net" />
                        </div>
                        <div class="qualiflow-form-group">
                            <label>Jira Project Key:</label>
                            <input type="text" id="qualiflow-settings-jira-project" class="qualiflow-input-edit" placeholder="Ex: QA" />
                        </div>
                        <div class="qualiflow-form-group">
                            <label>Issue Type para Teste:</label>
                            <input type="text" id="qualiflow-settings-jira-test-type" class="qualiflow-input-edit" placeholder="Ex: Task" />
                        </div>
                        <div class="qualiflow-form-group">
                            <label>Tipo de Link Jira:</label>
                            <input type="text" id="qualiflow-settings-jira-link-type" class="qualiflow-input-edit" placeholder="Ex: Relates" />
                        </div>
                        <div class="qualiflow-form-group">
                            <label>Campo de Critérios (opcional):</label>
                            <input type="text" id="qualiflow-settings-jira-ac-field" class="qualiflow-input-edit" placeholder="Ex: customfield_10015" />
                        </div>
                    </div>
                    <div id="qualiflow-group-asana" class="qualiflow-hidden" style="margin-top:20px;">
                        <p style="color:#94a3b8; font-size:13px;">O conector Asana estará disponível futuramente.</p>
                    </div>
                </div>

                <!-- IA -->
                <div id="qualiflow-tab-ai" class="qualiflow-tab-pane qualiflow-hidden">
                    <h3 style="margin-bottom:20px;">Inteligências Artificiais</h3>
                    <div class="qualiflow-form-group" style="padding:12px; background:rgba(255,255,255,0.02); border:1px dashed #334155; border-radius:8px;">
                        <label>Provedor IA:</label>
                        <select id="qualiflow-settings-ai-select" class="qualiflow-input-edit" style="margin-top:6px;">
                            <option value="gemini">Google Gemini</option>
                            <option value="copilot">GitHub Copilot</option>
                            <option value="groq">Groq Cloud</option>
                        </select>
                    </div>
                    <div id="qualiflow-group-gemini" style="margin-top:20px;">
                        <div class="qualiflow-form-group">
                            <label>Google Gemini API Key:</label>
                            <input type="password" id="qualiflow-settings-gemini-key" class="qualiflow-input-edit" placeholder="Chave de Acesso Gemini" />
                        </div>
                        <div class="qualiflow-form-group">
                            <label style="display:block; font-size:0.8rem; color:#94a3b8; margin-bottom:4px;">Modelo Gemini:</label>
                            <div style="display:flex; gap:8px; align-items:center;">
                                <select id="qualiflow-settings-gemini-model" class="qualiflow-input-edit" style="flex:1;">
                                    <option value="gemini-2.5-flash">gemini-2.5-flash (padrão)</option>
                                    <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                                    <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                                </select>
                                <button id="qualiflow-load-gemini-models" class="qualiflow-btn-inline qualiflow-btn-secondary" style="white-space:nowrap; padding:6px 10px; font-size:0.75rem;">🔄 Carregar Modelos</button>
                            </div>
                            <span id="qualiflow-gemini-models-status" style="font-size:0.75rem; color:#94a3b8; margin-top:4px; display:block;"></span>
                        </div>
                    </div>
                    <!-- COPILOT -->
                    <div id="qualiflow-group-copilot" class="qualiflow-hidden" style="margin-top:20px;">
                        <div style="margin-bottom:12px;">
                            <label style="display:block; font-size:0.8rem; color:#94a3b8; margin-bottom:4px;">Autenticacao GitHub</label>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <button id="qualiflow-copilot-login-btn" class="qualiflow-btn-inline qualiflow-btn-secondary" style="white-space:nowrap;">Entrar com GitHub</button>
                                <span id="qualiflow-copilot-auth-status" style="font-size:0.75rem; color:#94a3b8;">Nao autenticado.</span>
                            </div>
                            <span style="font-size:0.75rem; color:#94a3b8; margin-top:4px; display:block;">A URL do backend usado no login e configurada na aba "Geral".</span>
                        </div>
                        <div>
                            <label style="display:block; font-size:0.8rem; color:#94a3b8; margin-bottom:4px;">Modelo Copilot:</label>
                            <div style="display:flex; gap:8px; align-items:center;">
                                <select id="qualiflow-settings-copilot-model" class="qualiflow-input-edit" style="flex:1;">
                                    <option value="claude-sonnet-4.5">claude-sonnet-4.5 (padrao)</option>
                                    <option value="gpt-5-mini">gpt-5-mini</option>
                                    <option value="claude-opus-4.5">claude-opus-4.5</option>
                                </select>
                                <button id="qualiflow-load-copilot-models" class="qualiflow-btn-inline qualiflow-btn-secondary" style="white-space:nowrap; padding:6px 10px; font-size:0.75rem;">🔄 Carregar Modelos</button>
                            </div>
                            <span id="qualiflow-copilot-models-status" style="font-size:0.75rem; color:#94a3b8; margin-top:4px; display:block;"></span>
                        </div>
                    </div>
                    <!-- GROQ -->
                    <div id="qualiflow-group-groq" class="qualiflow-hidden" style="margin-top:20px;">
                        <div style="margin-bottom:12px;">
                            <label style="display:block; font-size:0.8rem; color:#94a3b8; margin-bottom:4px;">Groq API Key:</label>
                            <input type="password" id="qualiflow-settings-groq-key" class="qualiflow-input-edit" placeholder="gsk_..." />
                        </div>
                        <div>
                            <label style="display:block; font-size:0.8rem; color:#94a3b8; margin-bottom:4px;">Modelo Groq:</label>
                            <div style="display:flex; gap:8px; align-items:center;">
                                <select id="qualiflow-settings-groq-model" class="qualiflow-input-edit" style="flex:1;">
                                    <option value="llama3-70b-8192">llama3-70b-8192 (padrão)</option>
                                    <option value="mixtral-8x7b-32768">mixtral-8x7b-32768</option>
                                    <option value="gemma2-9b-it">gemma2-9b-it</option>
                                </select>
                                <button id="qualiflow-load-groq-models" class="qualiflow-btn-inline qualiflow-btn-secondary" style="white-space:nowrap; padding:6px 10px; font-size:0.75rem;">🔄 Carregar Modelos</button>
                            </div>
                            <span id="qualiflow-groq-models-status" style="font-size:0.75rem; color:#94a3b8; margin-top:4px; display:block;"></span>
                        </div>
                    </div>
                </div>

                <!-- RUNNER -->
                <div id="qualiflow-tab-runner" class="qualiflow-tab-pane qualiflow-hidden">
                    <h3 style="margin-bottom:20px;">Test Runner & Projetos Alvo</h3>
                    <p style="color:#94a3b8; font-size:13px; margin-bottom:20px;">Cadastre os projetos e URLs base onde os testes manuais serão executados.</p>
                    <div style="background:rgba(255,255,255,0.02); padding:16px; border:1px solid #334155; border-radius:8px; margin-bottom:20px;">
                        <h4 style="margin:0 0 12px 0; font-size:0.95rem; color:#f8fafc;">Adicionar Novo Projeto</h4>
                        <div style="display:flex; gap:12px; margin-bottom:12px;">
                            <div style="flex:1;">
                                <label style="display:block; font-size:0.8rem; color:#94a3b8; margin-bottom:4px;">Nome do Projeto</label>
                                <input type="text" id="ui-runner-new-name" class="qualiflow-input-edit" placeholder="Ex: Portal Web">
                            </div>
                            <div style="flex:2;">
                                <label style="display:block; font-size:0.8rem; color:#94a3b8; margin-bottom:4px;">URL Alvo</label>
                                <input type="url" id="ui-runner-new-url" class="qualiflow-input-edit" placeholder="Ex: http://localhost:3000">
                            </div>
                        </div>
                        <button type="button" id="ui-btn-add-runner-project" class="qualiflow-btn qualiflow-btn-primary" style="padding:6px 16px; font-size:0.85rem; display:inline-block; width:auto;">+ Adicionar</button>
                    </div>
                    <div class="qualiflow-section-header" style="margin-top:24px; margin-bottom:12px;">
                        <h4 style="font-size:0.95rem; color:#f8fafc;">Projetos Configurados</h4>
                    </div>
                    <ul id="ui-runner-projects-list" style="list-style:none; padding:0; margin:0;"></ul>
                </div>

                <div style="margin-top:30px; border-top:1px solid #334155; padding-top:20px; display:flex; align-items:center;">
                    <button id="qualiflow-settings-save-btn" class="qualiflow-btn qualiflow-btn-primary">Salvar Configurações</button>
                    <div id="qualiflow-settings-feedback" style="margin-left:16px; font-size:0.85rem;" class="qualiflow-hidden"></div>
                </div>
            </div>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const editOverlay = document.createElement('div');
    editOverlay.id = 'qualiflow-edit-modal-overlay';
    editOverlay.className = 'qualiflow-hidden';
    editOverlay.innerHTML = `
        <div id="qualiflow-edit-modal">
            <div class="qualiflow-header">
                <h2>✏️ Editar Cenário</h2>
                <span class="qualiflow-close" id="qualiflow-edit-close">&times;</span>
            </div>
            <div class="qualiflow-edit-modal-body" id="qualiflow-edit-body"></div>
            <div class="qualiflow-edit-modal-footer">
                <button id="qualiflow-edit-cancel" class="qualiflow-btn-inline qualiflow-btn-secondary">Cancelar</button>
                <button id="qualiflow-edit-save" class="qualiflow-btn-inline qualiflow-btn-primary">Salvar Edições</button>
            </div>
        </div>
    `;
    document.body.appendChild(editOverlay);

    const testModalOverlay = document.createElement('div');
    testModalOverlay.id = 'qualiflow-tests-modal-overlay';
    testModalOverlay.className = 'qualiflow-hidden';
    testModalOverlay.style.position = 'fixed';
    testModalOverlay.style.top = '0';
    testModalOverlay.style.left = '0';
    testModalOverlay.style.width = '100vw';
    testModalOverlay.style.height = '100vh';
    testModalOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.4)';
    testModalOverlay.style.zIndex = '2147483647';
    testModalOverlay.innerHTML = `
        <div id="qualiflow-tests-modal" style="position:absolute; right:0; top:0; height:100vh; width:500px; max-width:90vw; background-color:#1e293b; border-left:1px solid #334155; display:flex; flex-direction:column; box-shadow:-4px 0 25px rgba(0,0,0,0.5); transition:transform 0.3s; transform:translateX(0); z-index:2147483647;">
            <div class="qualiflow-header">
                <h2 id="tests-modal-title">Casos de Teste do PBI</h2>
                <span class="qualiflow-close" id="qualiflow-tests-close">&times;</span>
            </div>
            <div class="qualiflow-edit-modal-body" id="qualiflow-tests-body" style="padding:20px; overflow-y:auto; flex:1;"></div>
        </div>
    `;
    document.body.appendChild(testModalOverlay);

    document.getElementById('qualiflow-close').addEventListener('click', closeModal);
    document.getElementById('qualiflow-edit-close').addEventListener('click', closeEditModal);
    document.getElementById('qualiflow-edit-cancel').addEventListener('click', closeEditModal);
    document.getElementById('qualiflow-tests-close').addEventListener('click', () => {
        document.getElementById('qualiflow-tests-modal-overlay').classList.add('qualiflow-hidden');
    });
    document.getElementById('btn-generate').addEventListener('click', onGenerateScenarios);
    document.getElementById('btn-copy-from-card')?.addEventListener('click', () => {
        if (typeof globalThis.startCopyFromCardFlow === 'function') {
            globalThis.startCopyFromCardFlow();
        }
    });
    document.getElementById('btn-copy-auto-adjust')?.addEventListener('click', () => {
        if (typeof globalThis.onAutoAdjustCopiedScenarios === 'function') {
            globalThis.onAutoAdjustCopiedScenarios();
        }
    });
    document.getElementById('btn-eval').addEventListener('click', onEvaluateCoverage);
    document.getElementById('btn-save').addEventListener('click', onSaveScenarios);
    document.getElementById('btn-save-local').addEventListener('click', onSaveLocal);
    document.getElementById('qualiflow-runner-search-btn')?.addEventListener('click', () => {
        const searchEl = document.getElementById('qualiflow-runner-search');
        loadRunnerCards(searchEl ? searchEl.value.trim() : '');
    });
    document.getElementById('qualiflow-runner-search')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') loadRunnerCards(e.target.value.trim());
    });
}
function showStatus(msg, isError = false) {
    const el = safeGetElement('qualiflow-status');
    if (!el) return;
    el.textContent = msg;
    el.className = isError ? 'qualiflow-error' : 'qualiflow-info';
    el.style.display = 'block';
}
function hideStatus() {
    const el = safeGetElement('qualiflow-status');
    if (!el) return;
    el.style.display = 'none';
}
function setCopilotAuthStatusUI(message, type = 'info') {
    const el = document.getElementById('qualiflow-copilot-auth-status');
    if (!el) return;

    el.textContent = message;
    if (type === 'error') {
        el.style.color = '#ef4444';
    } else if (type === 'success') {
        el.style.color = '#10b981';
    } else {
        el.style.color = '#94a3b8';
    }
}
async function startCopilotOAuthLoginUI() {
    const loginBtn = document.getElementById('qualiflow-copilot-login-btn');
    if (!loginBtn) return;

    loginBtn.disabled = true;
    setCopilotAuthStatusUI('Iniciando login...');

    try {
        const parsedCopilotBackend = parseCopilotBackendUrl(document.getElementById('qualiflow-settings-copilot-backend-url')?.value);
        if (!parsedCopilotBackend.ok) {
            throw new Error(parsedCopilotBackend.error);
        }

        const startBody = await new Promise((resolve, reject) => {
            sendRuntimeMessage({ action: 'COPILOT_AUTH_START', backendUrl: parsedCopilotBackend.url }, (response) => {
                if (!response?.success) {
                    reject(new Error(response?.error || 'Falha ao iniciar autenticacao OAuth.'));
                    return;
                }
                resolve(response);
            });
        });

        setCopilotAuthStatusUI('Finalize o login na aba aberta...');

        const maxAttempts = 120;
        const delayMs = 2500;

        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));

            const pollBody = await new Promise((resolve, reject) => {
                sendRuntimeMessage({ action: 'COPILOT_AUTH_POLL', pollPath: startBody.pollPath, backendUrl: startBody.backendUrl }, (response) => {
                    if (!response?.success) {
                        reject(new Error(response?.error || 'Falha ao concluir login OAuth.'));
                        return;
                    }
                    resolve(response);
                });
            });

            if (pollBody?.status === 'pending') {
                continue;
            }

            if (pollBody?.status === 'completed' && pollBody?.sessionToken) {
                const login = pollBody?.user?.login;
                setCopilotAuthStatusUI(login ? `Autenticado como @${login}` : 'Autenticado com sucesso.', 'success');
                showStatus('Login GitHub concluido. Sessao salva automaticamente.');
                return;
            }
        }

        throw new Error('Tempo de login esgotado. Tente novamente.');
    } catch (error) {
        setCopilotAuthStatusUI(`Erro: ${error.message || 'falha no login'}`, 'error');
        showStatus(`Falha no login Copilot: ${error.message || 'erro desconhecido'}`, true);
    } finally {
        loginBtn.disabled = false;
    }
}
function setBoardAuthStatusUI(provider, message, type = 'info') {
    const statusEl = document.getElementById(`qualiflow-${provider}-auth-status`);
    if (!statusEl) return;

    statusEl.textContent = message;
    if (type === 'error') {
        statusEl.style.color = '#ef4444';
    } else if (type === 'success') {
        statusEl.style.color = '#10b981';
    } else {
        statusEl.style.color = '#94a3b8';
    }
}
async function startBoardOAuthLoginUI(provider) {
    const loginBtn = document.getElementById(`qualiflow-${provider}-login-btn`);
    if (!loginBtn) return;

    const startAction = provider === 'jira' ? 'JIRA_AUTH_START' : 'AZURE_AUTH_START';
    const pollAction = provider === 'jira' ? 'JIRA_AUTH_POLL' : 'AZURE_AUTH_POLL';
    const providerLabel = provider === 'jira' ? 'Atlassian' : 'Microsoft';

    loginBtn.disabled = true;
    setBoardAuthStatusUI(provider, 'Iniciando login...');

    try {
        const parsedBackend = parseCopilotBackendUrl(document.getElementById('qualiflow-settings-copilot-backend-url')?.value);
        if (!parsedBackend.ok) {
            throw new Error(parsedBackend.error);
        }

        const jiraDomain = provider === 'jira' ? (document.getElementById('qualiflow-settings-jira-domain')?.value.trim() || '') : undefined;

        const startBody = await new Promise((resolve, reject) => {
            sendRuntimeMessage({ action: startAction, backendUrl: parsedBackend.url, jiraDomain }, (response) => {
                if (!response?.success) {
                    reject(new Error(response?.error || 'Falha ao iniciar autenticacao OAuth.'));
                    return;
                }
                resolve(response);
            });
        });

        setBoardAuthStatusUI(provider, 'Finalize o login na aba aberta...');

        const maxAttempts = 120;
        const delayMs = 2500;

        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));

            const pollBody = await new Promise((resolve, reject) => {
                sendRuntimeMessage({ action: pollAction, pollPath: startBody.pollPath, backendUrl: startBody.backendUrl }, (response) => {
                    if (!response?.success) {
                        reject(new Error(response?.error || 'Falha ao concluir login OAuth.'));
                        return;
                    }
                    resolve(response);
                });
            });

            if (pollBody?.status === 'pending') {
                continue;
            }

            if (pollBody?.status === 'completed' && pollBody?.sessionToken) {
                const label = pollBody?.user?.displayName || pollBody?.user?.name || pollBody?.user?.email || pollBody?.user?.emailAddress;
                setBoardAuthStatusUI(provider, label ? `Autenticado como ${label}` : 'Autenticado com sucesso.', 'success');
                showStatus(`Login ${providerLabel} concluido. Sessao salva automaticamente.`);
                return;
            }
        }

        throw new Error('Tempo de login esgotado. Tente novamente.');
    } catch (error) {
        setBoardAuthStatusUI(provider, `Erro: ${error.message || 'falha no login'}`, 'error');
        showStatus(`Falha no login ${providerLabel}: ${error.message || 'erro desconhecido'}`, true);
    } finally {
        loginBtn.disabled = false;
    }
}
function hideSection(id) {
    const el = safeGetElement(id);
    if (!el) return;
    el.classList.add('qualiflow-hidden');
}
function showSection(id) {
    const el = safeGetElement(id);
    if (!el) return;
    el.classList.remove('qualiflow-hidden');
}
function openModal(page = 'generator') {
    injectModal();

    const pageGeneratorEl = safeGetElement('qualiflow-page-generator');
    const pageRunnerEl = safeGetElement('qualiflow-page-runner');
    const pageSettingsEl = safeGetElement('qualiflow-page-settings');
    const overlay = safeGetElement('qualiflow-modal-overlay');
    const modalHeader = safeGetElement('qualiflow-modal')?.querySelector('h2');

    if (page === 'dashboard' || page === 'generator') {
        if (pageGeneratorEl) pageGeneratorEl.classList.remove('qualiflow-hidden');
        if (pageRunnerEl) pageRunnerEl.classList.add('qualiflow-hidden');
        if (pageSettingsEl) pageSettingsEl.classList.add('qualiflow-hidden');
        if (page === 'dashboard') {
            if (modalHeader) modalHeader.innerHTML = `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="margin-right: 8px;"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3v18h18M18 17V9M13 17V5M8 17v-3"></path></svg> QualiFlow - Dashboard QA`;
        } else {
            if (modalHeader) modalHeader.innerHTML = `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="margin-right: 8px;"><path stroke-linecap="round" stroke-linejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg> QualiFlow - Gerador de Casos de Teste`;
        }
    } else if (page === 'runner') {
        if (pageGeneratorEl) pageGeneratorEl.classList.add('qualiflow-hidden');
        if (pageRunnerEl) pageRunnerEl.classList.remove('qualiflow-hidden');
        if (pageSettingsEl) pageSettingsEl.classList.add('qualiflow-hidden');
        if (modalHeader) modalHeader.innerHTML = `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="margin-right: 8px;"><path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347c-.75.412-1.667-.13-1.667-.986V5.653z"></path></svg> QualiFlow - Test Runner`;
    } else {
        if (pageGeneratorEl) pageGeneratorEl.classList.add('qualiflow-hidden');
        if (pageRunnerEl) pageRunnerEl.classList.add('qualiflow-hidden');
        if (pageSettingsEl) pageSettingsEl.classList.remove('qualiflow-hidden');
        if (modalHeader) modalHeader.innerHTML = `⚙️ QualiFlow - Configurações`;
        loadSettingsToUI();
    }

    if (overlay) {
        overlay.classList.remove('qualiflow-hidden');
        setTimeout(() => {
            overlay.classList.add('qualiflow-open');
        }, 10);
    }

    if (page === 'settings') return;

    if (page === 'runner') {
        loadRunnerCards('');
        return;
    }

    const layoutEl = document.getElementById('qualiflow-generation-layout');
    const dashEl = document.getElementById('qualiflow-dashboard-container');
    const localSessArea = document.getElementById('qualiflow-local-sessions-area');
    if (localSessArea) localSessArea.style.display = 'none';

    if (page === 'dashboard') {
        if (layoutEl) layoutEl.style.display = 'none';
        if (dashEl) dashEl.classList.remove('qualiflow-hidden');

        // Habilita navegacao das abas imediatamente, mesmo antes da resposta async.
        initDashboardTabs();

        const renderDashboardWithData = (rawData, sourceLabel, meta = null) => {
            const list = Array.isArray(rawData)
                ? rawData
                : (Array.isArray(rawData?.items) ? rawData.items : []);
            const normalized = list.map((item) => ({
                id: item.id,
                title: item.title || `Sem título (${item.id || 'N/A'})`,
                type: item.type || '',
                state: item.state || '',
                tags: item.tags || '',
                iterationPath: item.iterationPath || 'Desconhecido',
                url: item.url || '#',
                testCases: Array.isArray(item.testCases) ? item.testCases : []
            }));

            hideStatus();
            renderDashboard(normalized);

            const resolvedMeta = meta || rawData?.meta || null;
            const metaText = resolvedMeta
                ? ` | pais: ${resolvedMeta.parentCardsLoaded ?? '-'}, testes vinculados: ${resolvedMeta.linkedTestsLoaded ?? '-'}, testes standalone: ${resolvedMeta.standaloneTestsLoaded ?? '-'}`
                : '';
            showStatus(`Dashboard carregado com ${normalized.length} item(ns) [fonte: ${sourceLabel}]${metaText}.`, false);

            window.qualiflowDashboardMeta = resolvedMeta || null;
        };

        const loadDashboardFallback = () => {
            sendRuntimeMessage({ action: 'GET_TEST_RUNNER_CARDS', query: '' }, (fallbackResponse) => {
                if (fallbackResponse?.error) {
                    showStatus(`Erro ao carregar fallback do dashboard: ${fallbackResponse.error}`, true);
                    renderDashboard([]);
                    return;
                }
                renderDashboardWithData(fallbackResponse?.data || [], 'runner-fallback', null);
            });
        };

        showStatus('Buscando cards do board para o dashboard geral...', false);
        sendRuntimeMessage({ action: "GET_DASHBOARD_DATA" }, (response) => {
            if (!response) {
                showStatus('Sem resposta do serviço principal. Usando fallback...', true);
                loadDashboardFallback();
                return;
            }

            if (response.error) {
                showStatus(`Aviso: ${response.error}. Usando fallback...`, true);
                loadDashboardFallback();
                return;
            }

            try {
                const mainPayload = response.data;
                const mainData = Array.isArray(mainPayload)
                    ? mainPayload
                    : (Array.isArray(mainPayload?.items) ? mainPayload.items : []);
                if (mainData.length === 0) {
                    showStatus('Fonte principal retornou 0 itens. Usando fallback...', true);
                    loadDashboardFallback();
                    return;
                }

                renderDashboardWithData(mainPayload, 'principal', mainPayload?.meta || null);

                setTimeout(() => {
                    initDashboardTabs();
                }, 100);
            } catch (err) {
                console.error('[QualiFlow] Erro ao abrir dashboard:', err);
                showStatus(`Erro ao renderizar dashboard principal: ${err?.message || 'falha desconhecida'}. Usando fallback...`, true);
                loadDashboardFallback();
            }
        });
        return;
    }

    // Otherwise, we are in 'generator' mode
    if (layoutEl) layoutEl.style.display = 'flex';
    if (dashEl) dashEl.classList.add('qualiflow-hidden');

    // Hide context area and RTM/scenarios by default when re-opening modal
    hideSection('qualiflow-context-area');
    hideSection('qualiflow-col-rtm');
    hideSection('qualiflow-col-scenarios');

    const wiId = extractWorkItemId();
    if (!wiId) {
        showStatus('Erro: Você deve abrir um PBI ou Bug no Azure Boards primeiro.', true);
        renderLocalSessions();
        return;
    }

    showStatus(`Buscando dados do Work Item ${wiId}...`);
    sendRuntimeMessage({ action: "GET_DATA", workId: wiId, provider: resolveBoardProvider() }, (response) => {
        if (response && response.error) {
            showStatus(`Erro: ${response.error} `, true);
            return;
        }

        hideStatus();
        currentWorkItemData = response.data;
        currentCopyContext = null;
        if (typeof globalThis.syncCopyFlowButtons === 'function') {
            globalThis.syncCopyFlowButtons();
        }

        const titleEl = safeGetElement('qualiflow-wi-title');
        if (titleEl) titleEl.textContent = `${currentWorkItemData.title} (#${currentWorkItemData.id})`;
        const metaEl = safeGetElement('qualiflow-wi-meta');
        if (metaEl) metaEl.textContent = `Tipo: ${currentWorkItemData.type} | Tags: ${currentWorkItemData.tags || 'Nenhuma'} `;

        showSection('qualiflow-context-area');

        // Prefill editable acceptance criteria in the UI (sanitized from HTML)
        const acEl = document.getElementById('qualiflow-acceptance-criteria');
        if (acEl) acEl.value = htmlToPlainText(currentWorkItemData.acceptance_criteria || '');

        if (currentWorkItemData.existing_tests && currentWorkItemData.existing_tests.length > 0) {
            document.getElementById('qualiflow-eval-container').classList.remove('qualiflow-hidden');
        } else {
            document.getElementById('qualiflow-eval-container').classList.add('qualiflow-hidden');
        }
    });
}
function loadSettingsToUI() {
    getStorage([
        'azureSessionToken', 'azureOrg', 'azureProject', 'geminiKey', 'geminiModel',
        'supportWebhookUrl',
        'qaEmail', 'qaTag', 'selectedBoard', 'selectedAi', 'runnerProjects',
        'copilotToken', 'copilotSessionToken', 'copilotBackendUrl', 'devModeEnabled', 'copilotModel', 'groqKey', 'groqModel',
        'jiraSessionToken', 'jiraDomain', 'jiraProjectKey', 'jiraTestIssueType', 'jiraAcceptanceFieldId', 'jiraLinkType'
    ], (data) => {
        document.getElementById('qualiflow-settings-org').value = data.azureOrg || '';
        document.getElementById('qualiflow-settings-proj').value = data.azureProject || '';
        setBoardAuthStatusUI('azure', data.azureSessionToken ? 'Sessao OAuth carregada.' : 'Nao autenticado.', data.azureSessionToken ? 'success' : 'info');
        document.getElementById('qualiflow-settings-gemini-key').value = data.geminiKey || '';
        const geminiModelEl = document.getElementById('qualiflow-settings-gemini-model');
        if (geminiModelEl && data.geminiModel) {
            let found = Array.from(geminiModelEl.options).some(o => o.value === data.geminiModel);
            if (!found) {
                const opt = document.createElement('option');
                opt.value = data.geminiModel;
                opt.textContent = data.geminiModel;
                geminiModelEl.appendChild(opt);
            }
            geminiModelEl.value = data.geminiModel;
        }

        const storedCopilotToken = data.copilotSessionToken || data.copilotToken || '';
        if (storedCopilotToken) {
            setCopilotAuthStatusUI('Sessao OAuth carregada.', 'success');
        } else {
            setCopilotAuthStatusUI('Nao autenticado.', 'info');
        }
        const copilotModEl = document.getElementById('qualiflow-settings-copilot-model');
        if (copilotModEl && data.copilotModel) {
            copilotModEl.value = normalizeCopilotModel(data.copilotModel);
        }
        const copilotBackendEl = document.getElementById('qualiflow-settings-copilot-backend-url');
        if (copilotBackendEl) {
            copilotBackendEl.value = data.copilotBackendUrl || DEFAULT_COPILOT_BACKEND_URL;
        }
        const devModeToggleEl = document.getElementById('qualiflow-dev-mode-toggle');
        if (devModeToggleEl) {
            devModeToggleEl.checked = Boolean(data.devModeEnabled);
        }

        const groqKeyEl = document.getElementById('qualiflow-settings-groq-key');
        if (groqKeyEl) groqKeyEl.value = data.groqKey || '';
        const groqModelEl = document.getElementById('qualiflow-settings-groq-model');
        if (groqModelEl && data.groqModel) {
            let found = Array.from(groqModelEl.options).some(o => o.value === data.groqModel);
            if (!found) {
                const opt = document.createElement('option');
                opt.value = data.groqModel;
                opt.textContent = data.groqModel;
                groqModelEl.appendChild(opt);
            }
            groqModelEl.value = data.groqModel;
        }

        document.getElementById('qualiflow-settings-qa-email').value = data.qaEmail || '';
        document.getElementById('qualiflow-settings-qa-tag').value = data.qaTag || '';
        const supportWebhookEl = document.getElementById('qualiflow-settings-support-webhook-url');
        if (supportWebhookEl) supportWebhookEl.value = data.supportWebhookUrl || '';

        const jiraDomainEl = document.getElementById('qualiflow-settings-jira-domain');
        if (jiraDomainEl) jiraDomainEl.value = data.jiraDomain || '';
        setBoardAuthStatusUI('jira', data.jiraSessionToken ? 'Sessao OAuth carregada.' : 'Nao autenticado.', data.jiraSessionToken ? 'success' : 'info');
        const jiraProjectEl = document.getElementById('qualiflow-settings-jira-project');
        if (jiraProjectEl) jiraProjectEl.value = data.jiraProjectKey || '';
        const jiraTestTypeEl = document.getElementById('qualiflow-settings-jira-test-type');
        if (jiraTestTypeEl) jiraTestTypeEl.value = data.jiraTestIssueType || 'Task';
        const jiraAcFieldEl = document.getElementById('qualiflow-settings-jira-ac-field');
        if (jiraAcFieldEl) jiraAcFieldEl.value = data.jiraAcceptanceFieldId || '';
        const jiraLinkTypeEl = document.getElementById('qualiflow-settings-jira-link-type');
        if (jiraLinkTypeEl) jiraLinkTypeEl.value = data.jiraLinkType || 'Relates';

        window.qualiflowRunnerProjects = data.runnerProjects || [];
        renderUIRunnerProjects();

        const boardSel = document.getElementById('qualiflow-settings-board-select');
        if (data.selectedBoard) boardSel.value = data.selectedBoard;

        const aiSel = document.getElementById('qualiflow-settings-ai-select');
        if (data.selectedAi) aiSel.value = ['gemini', 'copilot', 'groq'].includes(data.selectedAi) ? data.selectedAi : 'gemini';

        // Dispara o evento de "change" para renderizar correto as abas caso hajam defaults
        boardSel.dispatchEvent(new Event('change'));
        aiSel.dispatchEvent(new Event('change'));
    });

    // Lógica das Abas (Navegação Sidebar)
    const navItems = document.querySelectorAll('#qualiflow-settings-nav li');
    navItems.forEach(item => {
        item.onclick = () => {
            navItems.forEach(n => {
                n.style.color = '#94a3b8';
                n.style.backgroundColor = 'transparent';
                n.style.borderLeft = '3px solid transparent';
                n.classList.remove('qualiflow-tab-active');
            });
            item.style.color = '#f8fafc';
            item.style.backgroundColor = 'rgba(99, 102, 241, 0.1)';
            item.style.borderLeft = '3px solid #6366f1';
            item.classList.add('qualiflow-tab-active');

            document.querySelectorAll('.qualiflow-tab-pane').forEach(p => p.classList.add('qualiflow-hidden'));
            document.getElementById(item.getAttribute('data-target')).classList.remove('qualiflow-hidden');
        };
    });

    // Lógica dos Selects
    document.getElementById('qualiflow-settings-board-select').onchange = (e) => {
        ['azure', 'jira', 'asana'].forEach(b => {
            const g = document.getElementById('qualiflow-group-' + b);
            if (g) g.classList.add('qualiflow-hidden');
        });
        const t = document.getElementById('qualiflow-group-' + e.target.value);
        if (t) t.classList.remove('qualiflow-hidden');
    };

    document.getElementById('qualiflow-settings-ai-select').onchange = (e) => {
        ['gemini', 'copilot', 'groq'].forEach(a => {
            const g = document.getElementById('qualiflow-group-' + a);
            if (g) g.classList.add('qualiflow-hidden');
        });
        const t = document.getElementById('qualiflow-group-' + e.target.value);
        if (t) t.classList.remove('qualiflow-hidden');
    };

    document.getElementById('qualiflow-settings-save-btn').onclick = () => {
        const parsedCopilotBackend = parseCopilotBackendUrl(document.getElementById('qualiflow-settings-copilot-backend-url')?.value);
        if (!parsedCopilotBackend.ok) {
            const feed = document.getElementById('qualiflow-settings-feedback');
            feed.textContent = parsedCopilotBackend.error;
            feed.className = 'qualiflow-error';
            feed.classList.remove('qualiflow-hidden');
            return;
        }

        const payload = {
            selectedBoard: document.getElementById('qualiflow-settings-board-select').value,
            selectedAi: document.getElementById('qualiflow-settings-ai-select').value,
            azureOrg: document.getElementById('qualiflow-settings-org').value.replace(/\/$/, ''), // remove trailing slash
            azureProject: document.getElementById('qualiflow-settings-proj').value,
            geminiKey: document.getElementById('qualiflow-settings-gemini-key').value,
            geminiModel: document.getElementById('qualiflow-settings-gemini-model').value,
            copilotBackendUrl: parsedCopilotBackend.url,
            devModeEnabled: document.getElementById('qualiflow-dev-mode-toggle')?.checked || false,
            copilotModel: normalizeCopilotModel(document.getElementById('qualiflow-settings-copilot-model')?.value),
            groqKey: document.getElementById('qualiflow-settings-groq-key')?.value || '',
            groqModel: document.getElementById('qualiflow-settings-groq-model')?.value || 'llama3-70b-8192',
            jiraDomain: document.getElementById('qualiflow-settings-jira-domain')?.value.trim() || '',
            jiraProjectKey: document.getElementById('qualiflow-settings-jira-project')?.value.trim() || '',
            jiraTestIssueType: document.getElementById('qualiflow-settings-jira-test-type')?.value.trim() || 'Task',
            jiraAcceptanceFieldId: document.getElementById('qualiflow-settings-jira-ac-field')?.value.trim() || '',
            jiraLinkType: document.getElementById('qualiflow-settings-jira-link-type')?.value.trim() || 'Relates',
            qaEmail: document.getElementById('qualiflow-settings-qa-email').value.trim(),
            qaTag: document.getElementById('qualiflow-settings-qa-tag').value.trim(),
            supportWebhookUrl: document.getElementById('qualiflow-settings-support-webhook-url')?.value.trim() || '',
            runnerProjects: window.qualiflowRunnerProjects
        };
        setStorage(payload, () => {
            const feed = document.getElementById('qualiflow-settings-feedback');
            feed.textContent = "Configurações salvas localmente com sucesso!";
            feed.className = 'qualiflow-info';
            feed.classList.remove('qualiflow-hidden');
            setTimeout(() => { feed.classList.add('qualiflow-hidden') }, 5000);
        });
    };

    // Gemini - Carregar Modelos
    document.getElementById('qualiflow-load-gemini-models')?.addEventListener('click', () => {
        const keyEl = document.getElementById('qualiflow-settings-gemini-key');
        const statusEl = document.getElementById('qualiflow-gemini-models-status');
        const selectEl = document.getElementById('qualiflow-settings-gemini-model');
        if (!keyEl || !keyEl.value.trim()) {
            if (statusEl) { statusEl.textContent = 'Insira a API Key primeiro.'; statusEl.style.color = '#ef4444'; }
            return;
        }
        if (statusEl) { statusEl.textContent = 'Carregando...'; statusEl.style.color = '#94a3b8'; }
        setStorage({ geminiKey: keyEl.value.trim() }, () => {
            sendRuntimeMessage({ action: 'GET_GEMINI_MODELS' }, (response) => {
                if (response && response.error) {
                    if (statusEl) { statusEl.textContent = `Erro: ${response.error}`; statusEl.style.color = '#ef4444'; }
                    return;
                }
                const models = response?.models || [];
                if (!models.length) {
                    if (statusEl) { statusEl.textContent = 'Nenhum modelo encontrado.'; statusEl.style.color = '#f59e0b'; }
                    return;
                }
                const currentVal = selectEl.value;
                selectEl.innerHTML = models.map(m => `<option value="${m}">${m}</option>`).join('');
                if (models.includes(currentVal)) selectEl.value = currentVal;
                if (statusEl) { statusEl.textContent = `${models.length} modelo(s) carregado(s) com sucesso!`; statusEl.style.color = '#10b981'; }
            });
        });
    });

    // Copilot - Carregar Modelos
    document.getElementById('qualiflow-load-copilot-models')?.addEventListener('click', () => {
        const statusEl = document.getElementById('qualiflow-copilot-models-status');
        const selectEl = document.getElementById('qualiflow-settings-copilot-model');
        if (statusEl) { statusEl.textContent = 'Carregando...'; statusEl.style.color = '#94a3b8'; }
        sendRuntimeMessage({ action: 'GET_COPILOT_MODELS' }, (response) => {
            if (response && response.error) {
                if (statusEl) { statusEl.textContent = `Erro: ${response.error}`; statusEl.style.color = '#ef4444'; }
                return;
            }
            const models = response?.models || [];
            if (!models.length) {
                if (statusEl) { statusEl.textContent = 'Nenhum modelo encontrado.'; statusEl.style.color = '#f59e0b'; }
                return;
            }
            const currentVal = selectEl.value;
            const allowedModels = models.filter((m) => VALID_COPILOT_MODELS.includes(m));
            if (!allowedModels.length) {
                if (statusEl) { statusEl.textContent = 'Nenhum modelo permitido foi retornado.'; statusEl.style.color = '#f59e0b'; }
                return;
            }

            selectEl.innerHTML = allowedModels.map(m => `<option value="${m}">${m}</option>`).join('');
            selectEl.value = normalizeCopilotModel(currentVal);
            if (statusEl) { statusEl.textContent = `${allowedModels.length} modelo(s) permitido(s) carregado(s)!`; statusEl.style.color = '#10b981'; }
        });
    });

    // Groq - Carregar Modelos
    document.getElementById('qualiflow-load-groq-models')?.addEventListener('click', () => {
        const keyEl = document.getElementById('qualiflow-settings-groq-key');
        const statusEl = document.getElementById('qualiflow-groq-models-status');
        const selectEl = document.getElementById('qualiflow-settings-groq-model');
        if (!keyEl || !keyEl.value.trim()) {
            if (statusEl) { statusEl.textContent = 'Insira a API Key primeiro.'; statusEl.style.color = '#ef4444'; }
            return;
        }
        if (statusEl) { statusEl.textContent = 'Carregando...'; statusEl.style.color = '#94a3b8'; }
        setStorage({ groqKey: keyEl.value.trim() }, () => {
            sendRuntimeMessage({ action: 'GET_GROQ_MODELS' }, (response) => {
                if (response && response.error) {
                    if (statusEl) { statusEl.textContent = `Erro: ${response.error}`; statusEl.style.color = '#ef4444'; }
                    return;
                }
                const models = response?.models || [];
                if (!models.length) {
                    if (statusEl) { statusEl.textContent = 'Nenhum modelo encontrado.'; statusEl.style.color = '#f59e0b'; }
                    return;
                }
                const currentVal = selectEl.value;
                selectEl.innerHTML = models.map(m => `<option value="${m}">${m}</option>`).join('');
                if (models.includes(currentVal)) selectEl.value = currentVal;
                if (statusEl) { statusEl.textContent = `${models.length} modelo(s) carregado(s) com sucesso!`; statusEl.style.color = '#10b981'; }
            });
        });
    });

    document.getElementById('ui-btn-add-runner-project').onclick = () => {
        const nameInput = document.getElementById('ui-runner-new-name');
        const urlInput = document.getElementById('ui-runner-new-url');
        const name = nameInput.value.trim();
        const url = urlInput.value.trim();

        if (!name || !url) return;
        window.qualiflowRunnerProjects.push({ name, url });
        nameInput.value = '';
        urlInput.value = '';
        renderUIRunnerProjects();
        setStorage({ runnerProjects: window.qualiflowRunnerProjects });
    };

    const loginBtn = document.getElementById('qualiflow-copilot-login-btn');
    if (loginBtn) {
        loginBtn.onclick = () => {
            void startCopilotOAuthLoginUI();
        };
    }

    const azureLoginBtn = document.getElementById('qualiflow-azure-login-btn');
    if (azureLoginBtn) {
        azureLoginBtn.onclick = () => {
            void startBoardOAuthLoginUI('azure');
        };
    }

    const jiraLoginBtn = document.getElementById('qualiflow-jira-login-btn');
    if (jiraLoginBtn) {
        jiraLoginBtn.onclick = () => {
            void startBoardOAuthLoginUI('jira');
        };
    }

    const devModeToggle = document.getElementById('qualiflow-dev-mode-toggle');
    const backendUrlInput = document.getElementById('qualiflow-settings-copilot-backend-url');
    if (devModeToggle && backendUrlInput) {
        devModeToggle.onchange = () => {
            if (devModeToggle.checked) {
                backendUrlInput.value = DEV_BACKEND_URL;
            } else if (backendUrlInput.value.trim() === DEV_BACKEND_URL) {
                backendUrlInput.value = '';
            }
        };
    }
}

function renderUIRunnerProjects() {
    const list = document.getElementById('ui-runner-projects-list');
    if (!list) return;
    list.innerHTML = '';
    if (!window.qualiflowRunnerProjects || window.qualiflowRunnerProjects.length === 0) {
        list.innerHTML = '<li style="color:#94a3b8; font-size:0.85rem; padding:12px; font-style:italic;">Nenhum projeto configurado.</li>';
        return;
    }
    window.qualiflowRunnerProjects.forEach((proj, index) => {
        const li = document.createElement('li');
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.alignItems = 'center';
        li.style.padding = '12px 16px';
        li.style.marginBottom = '8px';
        li.style.background = '#1e293b';
        li.style.border = '1px solid #334155';
        li.style.borderRadius = '6px';

        li.innerHTML = `
            <div>
                <strong style="color:#f8fafc; display:block; font-size:0.9rem;">${proj.name}</strong>
                <span style="color:#94a3b8; font-size:0.75rem;">${proj.url}</span>
            </div>
            <button class="ui-btn-del-proj" data-index="${index}" style="background:transparent; border:none; color:#ef4444; cursor:pointer;" title="Remover">
                <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
        `;
        list.appendChild(li);
    });

    document.querySelectorAll('.ui-btn-del-proj').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = e.currentTarget.getAttribute('data-index');
            window.qualiflowRunnerProjects.splice(idx, 1);
            renderUIRunnerProjects();
            setStorage({ runnerProjects: window.qualiflowRunnerProjects });
        });
    });
}
function closeModal() {
    const overlay = document.getElementById('qualiflow-modal-overlay');
    overlay.classList.remove('qualiflow-open');
    setTimeout(() => {
        overlay.classList.add('qualiflow-hidden');
    }, 300); // Matches CSS transition duration
}

globalThis.closeModal = closeModal;

function openRunnerWindow() {
    openModal('runner');
}

function loadRunnerCards(query = '') {
    const list = document.getElementById('qualiflow-runner-cards-list');
    if (!list) return;

    list.innerHTML = '<div style="color:#94a3b8; font-style:italic; padding:10px;">Buscando itens de trabalho associados a testes, aguarde...</div>';

    sendRuntimeMessage({ action: "GET_TEST_RUNNER_CARDS", query }, (response) => {
        if (!response || response.error) {
            list.innerHTML = `<div style="color:#ef4444; padding:10px;">Erro: ${response?.error || 'Desconhecido'}</div>`;
            return;
        }

        window.currentRunnerCardsData = response.data || [];
        setupRunnerFilters();
        drawRunnerCards('All');
    });
}

function setupRunnerFilters() {
    const filterEl = document.getElementById('qualiflow-runner-filter');
    if (!filterEl) return;
    const iterations = [...new Set(window.currentRunnerCardsData.map(d => d.iterationPath))].sort();

    filterEl.innerHTML = '<option value="All">Todas as Iterations</option>' +
        iterations.map(i => `<option value="${i}">${i}</option>`).join('');

    // Remove old listener if exists to prevent duplicates
    const newFilterEl = filterEl.cloneNode(true);
    filterEl.replaceWith(newFilterEl);

    newFilterEl.addEventListener('change', () => {
        drawRunnerCards(newFilterEl.value);
    });
}

function drawRunnerCards(iteration) {
    const list = document.getElementById('qualiflow-runner-cards-list');
    if (!list) return;

    const filtered = iteration === 'All'
        ? window.currentRunnerCardsData
        : window.currentRunnerCardsData.filter(d => d.iterationPath === iteration);

    if (filtered.length === 0) {
        list.innerHTML = '<div style="color:#94a3b8; font-style:italic; padding:10px;">Nenhum card com testes encontrado nesta visualização.</div>';
        return;
    }

    list.innerHTML = '';

    // Simple mock of getDashboardTypeStyle since we don't import dashboard.js here
    const getTypeStyle = (type) => {
        const t = (type || '').toLowerCase();
        if (t.includes('bug')) return { icon: '🐞', color: '#ef4444' };
        if (t.includes('story') || t.includes('pbi')) return { icon: '📘', color: '#3b82f6' };
        if (t.includes('task')) return { icon: '📋', color: '#f59e0b' };
        if (t.includes('feature')) return { icon: '🏆', color: '#10b981' };
        return { icon: '📄', color: '#94a3b8' };
    };

    filtered.forEach(card => {
        const itemBody = document.createElement('div');
        itemBody.className = 'qualiflow-acc-item';
        itemBody.style.padding = '12px';
        itemBody.style.display = 'flex';
        itemBody.style.flexDirection = 'column';
        itemBody.style.justifyContent = 'space-between';

        const typeStyle = getTypeStyle(card.type);

        itemBody.innerHTML = `
            <div>
                <div style="font-weight:600; color:#e2e8f0; margin-bottom:8px; line-height: 1.4;">#${card.id} - ${card.title}</div>
                <div style="font-size:0.8rem; color:#94a3b8; display:flex; flex-direction:column; gap:6px;">
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span style="background-color:${typeStyle.color}20; color:${typeStyle.color}; padding:2px 6px; border-radius:4px; font-weight:600; font-size:0.75rem; border: 1px solid ${typeStyle.color}40;">
                            ${typeStyle.icon} ${card.type}
                        </span>
                        <span>${card.state}</span>
                    </div>
                    <div title="${card.iterationPath}" style="margin-top:2px; font-size: 11px;"><strong>Sprint:</strong> ${card.iterationPath.split('\\').pop() || card.iterationPath}</div>
                </div>
            </div>
            <div style="margin-top:12px; display:flex; gap:8px;">
                <button class="qualiflow-btn-run-target qualiflow-btn qualiflow-btn-primary" style="font-size:0.75rem; flex:1; background:#4f46e5;">▶ Run (Target)</button>
            </div>
        `;

        const runBtn = itemBody.querySelector('.qualiflow-btn-run-target');
        runBtn.addEventListener('click', () => {
            promptTargetUrlForRun(card);
        });

        list.appendChild(itemBody);
    });
}

function promptTargetUrlForRun(card) {
    const body = document.getElementById('qualiflow-runner-body');
    // Save current content to restore if cancelled
    const backupHtml = body.innerHTML;

    body.innerHTML = `
        <div style="margin-bottom:15px; font-weight:600; color:#e2e8f0; border-bottom:1px solid #334155; padding-bottom:10px;">
            Selecionar Alvo para Execução
        </div>
        <div style="margin-bottom:15px; color:#94a3b8; font-size:12px;">
            Work Item: <strong>#${card.id} - ${card.title}</strong>
        </div>
        <div id="qualiflow-runner-target-list">
            <div style="font-style:italic; color:#94a3b8;">Carregando projetos...</div>
        </div>
        <div style="margin-top:20px; border-top:1px solid #334155; padding-top:15px; display:flex; justify-content:flex-end;">
            <button id="qualiflow-runner-cancel-target" class="qualiflow-btn qualiflow-btn-secondary" style="padding:6px 14px;">Voltar</button>
        </div>
    `;

    document.getElementById('qualiflow-runner-cancel-target').addEventListener('click', () => {
        body.innerHTML = backupHtml;
        // Re-attach listeners to search since we overrode innerHTML
        document.getElementById('qualiflow-runner-search-btn').addEventListener('click', () => {
            loadRunnerCards(document.getElementById('qualiflow-runner-search').value.trim());
        });
        document.getElementById('qualiflow-runner-search').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') loadRunnerCards(e.target.value.trim());
        });
        // We need to re-render the cards because we replaced the DOM
        loadRunnerCards(document.getElementById('qualiflow-runner-search').value.trim());
    });

    const targetList = document.getElementById('qualiflow-runner-target-list');
    getStorage(['runnerProjects'], (data) => {
        const projs = data.runnerProjects || [];
        targetList.innerHTML = '';

        if (projs.length === 0) {
            targetList.innerHTML = '<div style="color:#ef4444; font-size:12px;">Nenhum projeto alvo cadastrado. Vá em Configurações > Test Runner (URLs).</div>';
            return;
        }

        projs.forEach(p => {
            const btn = document.createElement('button');
            btn.style.width = '100%';
            btn.style.textAlign = 'left';
            btn.style.padding = '12px';
            btn.style.marginBottom = '8px';
            btn.style.background = '#1e293b';
            btn.style.border = '1px solid #475569';
            btn.style.borderRadius = '6px';
            btn.style.color = '#f8fafc';
            btn.style.cursor = 'pointer';
            btn.style.display = 'flex';
            btn.style.flexDirection = 'column';
            btn.style.gap = '4px';

            btn.innerHTML = `
                <span style="font-weight:600; font-size:13px;">${p.name}</span>
                <span style="color:#38bdf8; font-size:11px;">${p.url}</span>
            `;

            btn.onmouseover = () => btn.style.borderColor = '#6366f1';
            btn.onmouseout = () => btn.style.borderColor = '#475569';

            btn.addEventListener('click', () => {
                // Save the active runner session to chrome.storage so runner.js on the target page can read it
                const session = {
                    workItemId: card.id,
                    workItemTitle: card.title,
                    workItemType: card.type,
                    projectName: p.name,
                    targetUrl: p.url,
                    timestamp: Date.now()
                };
                setStorage({ runnerActiveSession: session }, () => {
                    window.open(p.url, '_blank');
                });
            });

            targetList.appendChild(btn);
        });
    });
}
