// Markup estatico do modal principal do QualiFlow (gerador, dashboard, runner e configuracoes).

export const MODAL_HTML = `    <nav class="qualiflow-rail" aria-label="Navegação QualiFlow">
      <div class="qualiflow-rail-logo" aria-hidden="true">Q</div>
      <button type="button" class="qualiflow-rail-btn" data-qf-nav="generator" title="Gerador" aria-label="Gerador"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"></path></svg><span>Gerar</span></button>
      <button type="button" class="qualiflow-rail-btn" data-qf-nav="dashboard" data-qf-azure-only title="Dashboard" aria-label="Dashboard"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3v18h18M18 17V9M13 17V5M8 17v-3"></path></svg><span>Painel</span></button>
      <button type="button" class="qualiflow-rail-btn" data-qf-nav="runner" data-qf-azure-only title="Test Runner" aria-label="Test Runner"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347c-.75.412-1.667-.13-1.667-.986V5.653z"></path></svg><span>Runner</span></button>
      <button type="button" class="qualiflow-rail-btn qualiflow-rail-btn-end" data-qf-nav="settings" title="Configurações" aria-label="Configurações"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z"></path></svg><span>Config</span></button>
    </nav>
    <div class="qualiflow-header">
      <h2 id="qualiflow-modal-title"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg> QualiFlow - Gerador de Casos de Teste</h2>
      <button type="button" class="qualiflow-close" id="qualiflow-close" aria-label="Fechar">&times;</button>
    </div>
        <div id="qualiflow-page-generator">
            <div class="qualiflow-generation-layout" id="qualiflow-generation-layout">
                <div class="qualiflow-step-col qualiflow-col-context">
                    <div id="qualiflow-status" class="qualiflow-info qualiflow-ui-status" role="status" aria-live="polite" style="display: none;">Aguardando...</div>
                    <div id="qualiflow-local-sessions-area" class="qualiflow-ui-sessions-area" style="display:none;"></div>
                    <div id="qualiflow-context-area" class="qualiflow-hidden">
                        <div class="qualiflow-card-hero">
                            <span class="qualiflow-eyebrow">Work item</span>
                            <h3 id="qualiflow-wi-title"></h3>
                            <p class="qualiflow-wi-meta" id="qualiflow-wi-meta"></p>
                        </div>
 
                        <section class="qualiflow-panel">
                        <div class="qualiflow-panel-head"><span class="qualiflow-panel-step">1</span><h4>Configuração da geração</h4></div>
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
 
                        </section>

                        <section class="qualiflow-panel">
                        <div class="qualiflow-panel-head"><span class="qualiflow-panel-step">2</span><h4>Contexto adicional</h4><span class="qualiflow-panel-opt">opcional</span></div>
                        <label class="qualiflow-field-label" for="qualiflow-technical-detail">Detalhamento técnico</label>
                        <textarea id="qualiflow-technical-detail" placeholder="Info técnica: tabelas, endpoints, regras de cálculo..."></textarea>
 
                        <label class="qualiflow-field-label" for="qualiflow-user-focus">Foco específico</label>
                        <textarea id="qualiflow-user-focus" placeholder="Descreva algo muito pontual onde a IA deve focar..."></textarea>
 
                        </section>

                        <section class="qualiflow-panel">
                        <div class="qualiflow-panel-head"><span class="qualiflow-panel-step">3</span><h4>Critérios de aceite</h4><span class="qualiflow-panel-opt">editáveis</span></div>
                        <textarea id="qualiflow-acceptance-criteria" placeholder="Critérios de Aceite extraídos do card. Você pode editar ou adicionar novos critérios aqui."></textarea>
 
                        </section>

                        <div class="qualiflow-action-dock">
                        <div id="qualiflow-eval-container" class="qualiflow-hidden">
                            <button id="btn-eval" class="qualiflow-btn qualiflow-btn-secondary"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"></path></svg> Avaliar Cobertura</button>
                            <div id="qualiflow-eval-result" class="qualiflow-hidden"></div>
                        </div>
 
                        <button id="btn-generate" class="qualiflow-btn qualiflow-btn-primary"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"></path></svg> Gerar Cenários</button>
                        <button id="btn-copy-from-card" class="qualiflow-btn qualiflow-btn-secondary qualiflow-u-mt-2"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 10h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg> Reaproveitar CTs de Outro Card</button>
                        </div>
                    </div>
                </div>
 
                <div id="qualiflow-col-rtm" class="qualiflow-step-col qualiflow-col-rtm qualiflow-hidden">
                    <div id="qualiflow-rtm-content"></div>
                </div>
 
                <div id="qualiflow-col-scenarios" class="qualiflow-step-col qualiflow-col-scenarios qualiflow-hidden">
                    <div class="qualiflow-scenarios-header">
                        <h3>Cenários Gerados</h3>
                        <div class="qualiflow-u-flex qualiflow-u-items-center qualiflow-u-wrap qualiflow-u-gap-2">
                            <button id="btn-copy-auto-adjust" class="qualiflow-btn-inline qualiflow-btn-secondary qualiflow-hidden"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"></path></svg> Ajustes Automáticos</button>
                            <span id="save-local-feedback" class="qualiflow-hidden qualiflow-u-success qualiflow-u-text-xs qualiflow-u-semibold" role="status">✔ Salvo</span>
                            <button id="btn-save-local" class="qualiflow-btn-inline qualiflow-btn-secondary"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg> Salvar Localmente</button>
                            <button id="btn-save" class="qualiflow-btn-inline qualiflow-btn-success"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 3.75V16.5L12 14.25 7.5 16.5V3.75m9 0H18A2.25 2.25 0 0120.25 6v12A2.25 2.25 0 0118 20.25H6A2.25 2.25 0 013.75 18V6A2.25 2.25 0 016 3.75h1.5m9 0h-9"></path></svg> Salvar no Board</button>
                        </div>
                    </div>
                    <div id="qualiflow-scenarios-list"></div>
                </div>
            </div>
            <div id="qualiflow-dashboard-container" class="qualiflow-step-col qualiflow-hidden qualiflow-dashboard-resizable">
                <div id="qualiflow-dashboard-tabs" class="qualiflow-tabs" role="tablist">
                    <button id="qualiflow-tab-analytics" type="button" role="tab" aria-selected="true" class="qualiflow-tab-btn qualiflow-tab-active">Analytics Pro</button>
                    <button id="qualiflow-tab-cards" type="button" role="tab" aria-selected="false" class="qualiflow-tab-btn">Meus Cards</button>
                    <button id="qualiflow-tab-support" type="button" role="tab" aria-selected="false" class="qualiflow-tab-btn">Suportes</button>
                    <button id="qualiflow-tab-deploy" type="button" role="tab" aria-selected="false" class="qualiflow-tab-btn">Validar Deploy</button>
                </div>
                <div id="qualiflow-dashboard-analytics" class="qualiflow-tab-content"></div>
                <div id="qualiflow-dashboard-cards" class="qualiflow-tab-content qualiflow-hidden"></div>
                <div id="qualiflow-dashboard-support" class="qualiflow-tab-content qualiflow-hidden"></div>
                <div id="qualiflow-dashboard-deploy" class="qualiflow-tab-content qualiflow-hidden"></div>
            </div>
        </div>

        <div id="qualiflow-page-runner" class="qualiflow-hidden">
            <div class="qualiflow-ui-runner-panel">
                <div class="qualiflow-ui-runner-search">
                    <input type="text" id="qualiflow-runner-search" class="qualiflow-input-edit qualiflow-u-grow" aria-label="Buscar PBI ou CT por título ou ID" placeholder="Buscar PBI / CT por título ou ID...">
                    <button id="qualiflow-runner-search-btn" type="button" class="qualiflow-btn-inline qualiflow-btn-primary">Buscar</button>
                </div>
                <div class="qualiflow-u-mb-3">
                    <select id="qualiflow-runner-filter" class="qualiflow-select-input qualiflow-u-w-full" aria-label="Filtrar por iteration">
                        <option value="All">Todas as Iterations</option>
                    </select>
                </div>
                <div id="qualiflow-runner-body" class="qualiflow-ui-runner-body">
                    <div id="qualiflow-runner-cards-list" class="qualiflow-u-flex qualiflow-u-col qualiflow-u-gap-2"></div>
                </div>
            </div>
        </div>
 
        <div id="qualiflow-page-settings" class="qualiflow-hidden">
            <!-- Sidebar -->
            <div class="qualiflow-ui-settings-sidebar">
                <h3 class="qualiflow-ui-settings-sidebar-title">Configurações</h3>
                <ul id="qualiflow-settings-nav" class="qualiflow-settings-nav" role="tablist" aria-label="Configurações">
                    <li data-target="qualiflow-tab-geral" class="qualiflow-settings-nav-item qualiflow-tab-active" role="tab" tabindex="0" aria-selected="true">Geral</li>
                    <li data-target="qualiflow-tab-board" class="qualiflow-settings-nav-item" role="tab" tabindex="-1" aria-selected="false">Plataforma (Board)</li>
                    <li data-target="qualiflow-tab-ai" class="qualiflow-settings-nav-item" role="tab" tabindex="-1" aria-selected="false">Integrações de IA</li>
                    <li data-target="qualiflow-tab-runner" class="qualiflow-settings-nav-item" role="tab" tabindex="-1" aria-selected="false">Test Runner (URLs)</li>
                </ul>
            </div>
            
            <!-- Content -->
            <div class="qualiflow-ui-settings-content">
                <!-- Geral -->
                <div id="qualiflow-tab-geral" class="qualiflow-tab-pane">
                    <h3 class="qualiflow-ui-settings-heading">Configurações Gerais</h3>
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
                    <h3 class="qualiflow-ui-settings-heading">Plataforma de Gestão</h3>
                    <div class="qualiflow-form-group qualiflow-ui-settings-provider">
                        <label>Provedor do Board:</label>
                        <select id="qualiflow-settings-board-select" class="qualiflow-select-input qualiflow-u-mt-1">
                            <option value="azure">Azure DevOps</option>
                            <option value="jira">Jira</option>
                            <option value="asana">Asana (Em Breve)</option>
                        </select>
                    </div>
                    <div id="qualiflow-group-azure" class="qualiflow-u-mt-5">
                        <div class="qualiflow-form-group">
                            <label>Autenticacao Microsoft:</label>
                            <div class="qualiflow-u-flex qualiflow-u-items-center qualiflow-u-wrap qualiflow-u-gap-2 qualiflow-u-mb-2">
                                <button id="qualiflow-azure-login-btn" class="qualiflow-btn-inline qualiflow-btn-secondary">Entrar com Microsoft</button>
                                <span id="qualiflow-azure-auth-status" class="qualiflow-ui-hint" role="status" aria-live="polite">Nao autenticado.</span>
                            </div>
                        </div>
                        <div class="qualiflow-form-group">
                            <label for="qualiflow-settings-azure-pat">Ou use um Personal Access Token (PAT):</label>
                            <input type="password" id="qualiflow-settings-azure-pat" class="qualiflow-input-edit" autocomplete="off" placeholder="Cole o PAT do Azure DevOps" />
                            <div class="qualiflow-description">Se preenchido, o PAT é usado no lugar do login Microsoft. Ele fica salvo só neste navegador e é enviado apenas ao backend QualiFlow. Escopos: Work Items (leitura e escrita) e Test Management (leitura e escrita).</div>
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
                    <div id="qualiflow-group-jira" class="qualiflow-hidden qualiflow-u-mt-5">
                        <div class="qualiflow-form-group">
                            <label>Autenticacao Atlassian:</label>
                            <div class="qualiflow-u-flex qualiflow-u-items-center qualiflow-u-wrap qualiflow-u-gap-2 qualiflow-u-mb-2">
                                <button id="qualiflow-jira-login-btn" class="qualiflow-btn-inline qualiflow-btn-secondary">Entrar com Atlassian</button>
                                <span id="qualiflow-jira-auth-status" class="qualiflow-ui-hint" role="status" aria-live="polite">Nao autenticado.</span>
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
                    <div id="qualiflow-group-asana" class="qualiflow-hidden qualiflow-u-mt-5">
                        <p class="qualiflow-u-muted qualiflow-u-text-sm">O conector Asana estará disponível futuramente.</p>
                    </div>
                </div>

                <!-- IA -->
                <div id="qualiflow-tab-ai" class="qualiflow-tab-pane qualiflow-hidden">
                    <h3 class="qualiflow-ui-settings-heading">Inteligências Artificiais</h3>
                    <div class="qualiflow-form-group qualiflow-ui-settings-provider">
                        <label>Provedor IA:</label>
                        <select id="qualiflow-settings-ai-select" class="qualiflow-select-input qualiflow-u-mt-1">
                            <option value="gemini">Google Gemini</option>
                            <option value="copilot">GitHub Copilot</option>
                            <option value="groq">Groq Cloud</option>
                        </select>
                    </div>
                    <div id="qualiflow-group-gemini" class="qualiflow-u-mt-5">
                        <div class="qualiflow-form-group">
                            <label>Google Gemini API Key:</label>
                            <input type="password" id="qualiflow-settings-gemini-key" class="qualiflow-input-edit" placeholder="Chave de Acesso Gemini" />
                        </div>
                        <div class="qualiflow-form-group">
                            <label class="qualiflow-field-label">Modelo Gemini:</label>
                            <div class="qualiflow-u-flex qualiflow-u-items-center qualiflow-u-wrap qualiflow-u-gap-2">
                                <select id="qualiflow-settings-gemini-model" class="qualiflow-select-input qualiflow-u-grow">
                                    <option value="gemini-2.5-flash">gemini-2.5-flash (padrão)</option>
                                    <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                                    <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                                </select>
                                <button id="qualiflow-load-gemini-models" class="qualiflow-btn-inline qualiflow-btn-secondary">🔄 Carregar Modelos</button>
                            </div>
                            <span id="qualiflow-gemini-models-status" class="qualiflow-ui-hint qualiflow-ui-hint-block" role="status" aria-live="polite"></span>
                        </div>
                    </div>
                    <!-- COPILOT -->
                    <div id="qualiflow-group-copilot" class="qualiflow-hidden qualiflow-u-mt-5">
                        <div class="qualiflow-u-mb-3">
                            <label class="qualiflow-field-label">Autenticacao GitHub</label>
                            <div class="qualiflow-u-flex qualiflow-u-items-center qualiflow-u-wrap qualiflow-u-gap-2">
                                <button id="qualiflow-copilot-login-btn" class="qualiflow-btn-inline qualiflow-btn-secondary">Entrar com GitHub</button>
                                <span id="qualiflow-copilot-auth-status" class="qualiflow-ui-hint" role="status" aria-live="polite">Nao autenticado.</span>
                            </div>
                            <span class="qualiflow-ui-hint qualiflow-ui-hint-block">A URL do backend usado no login e configurada na aba "Geral".</span>
                        </div>
                        <div>
                            <label class="qualiflow-field-label">Modelo Copilot:</label>
                            <div class="qualiflow-u-flex qualiflow-u-items-center qualiflow-u-wrap qualiflow-u-gap-2">
                                <select id="qualiflow-settings-copilot-model" class="qualiflow-select-input qualiflow-u-grow">
                                    <option value="claude-sonnet-4.5">claude-sonnet-4.5 (padrao)</option>
                                    <option value="gpt-5-mini">gpt-5-mini</option>
                                    <option value="claude-opus-4.5">claude-opus-4.5</option>
                                </select>
                                <button id="qualiflow-load-copilot-models" class="qualiflow-btn-inline qualiflow-btn-secondary">🔄 Carregar Modelos</button>
                            </div>
                            <span id="qualiflow-copilot-models-status" class="qualiflow-ui-hint qualiflow-ui-hint-block" role="status" aria-live="polite"></span>
                        </div>
                    </div>
                    <!-- GROQ -->
                    <div id="qualiflow-group-groq" class="qualiflow-hidden qualiflow-u-mt-5">
                        <div class="qualiflow-u-mb-3">
                            <label class="qualiflow-field-label">Groq API Key:</label>
                            <input type="password" id="qualiflow-settings-groq-key" class="qualiflow-input-edit" placeholder="gsk_..." />
                        </div>
                        <div>
                            <label class="qualiflow-field-label">Modelo Groq:</label>
                            <div class="qualiflow-u-flex qualiflow-u-items-center qualiflow-u-wrap qualiflow-u-gap-2">
                                <select id="qualiflow-settings-groq-model" class="qualiflow-select-input qualiflow-u-grow">
                                    <option value="llama3-70b-8192">llama3-70b-8192 (padrão)</option>
                                    <option value="mixtral-8x7b-32768">mixtral-8x7b-32768</option>
                                    <option value="gemma2-9b-it">gemma2-9b-it</option>
                                </select>
                                <button id="qualiflow-load-groq-models" class="qualiflow-btn-inline qualiflow-btn-secondary">🔄 Carregar Modelos</button>
                            </div>
                            <span id="qualiflow-groq-models-status" class="qualiflow-ui-hint qualiflow-ui-hint-block" role="status" aria-live="polite"></span>
                        </div>
                    </div>
                </div>

                <!-- RUNNER -->
                <div id="qualiflow-tab-runner" class="qualiflow-tab-pane qualiflow-hidden">
                    <h3 class="qualiflow-ui-settings-heading">Test Runner & Projetos Alvo</h3>
                    <p class="qualiflow-u-muted qualiflow-u-text-sm qualiflow-u-mb-5">Cadastre os projetos e URLs base onde os testes manuais serão executados.</p>
                    <div class="qualiflow-ui-settings-card">
                        <h4 class="qualiflow-ui-settings-card-title">Adicionar Novo Projeto</h4>
                        <div class="qualiflow-ui-settings-row">
                            <div class="qualiflow-ui-col-1">
                                <label class="qualiflow-field-label">Nome do Projeto</label>
                                <input type="text" id="ui-runner-new-name" class="qualiflow-input-edit" placeholder="Ex: Portal Web">
                            </div>
                            <div class="qualiflow-ui-col-2">
                                <label class="qualiflow-field-label">URL Alvo</label>
                                <input type="url" id="ui-runner-new-url" class="qualiflow-input-edit" placeholder="Ex: http://localhost:3000">
                            </div>
                        </div>
                        <button type="button" id="ui-btn-add-runner-project" class="qualiflow-btn-inline qualiflow-btn-primary">+ Adicionar</button>
                    </div>
                    <div class="qualiflow-section-header qualiflow-ui-settings-subhead">
                        <h4>Projetos Configurados</h4>
                    </div>
                    <ul id="ui-runner-projects-list" class="qualiflow-ui-plain-list"></ul>
                </div>

                <div class="qualiflow-ui-settings-footer">
                    <button id="qualiflow-settings-save-btn" class="qualiflow-btn qualiflow-btn-primary">Salvar Configurações</button>
                    <div id="qualiflow-settings-feedback" class="qualiflow-hidden qualiflow-ui-settings-feedback" role="status" aria-live="polite"></div>
                </div>
            </div>
        </div>
`;
