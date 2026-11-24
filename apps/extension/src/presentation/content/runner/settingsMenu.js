/* Menu de configuracoes (engrenagem) do cabecalho do runner: autopreenchimento, depurador CSS e encerrar sessao. */
import { setStorage } from '../shared/runtime.js';
import { S } from './state.js';
import { isAutofillEnabled, startAutofill, stopAutofill } from './autofill.js';
import { disableCssDebug, enableCssDebug, isCssDebugEnabled } from './cssDebug.js';
import { SHORTCUTS } from './shortcuts.js';
import { showShortcutsDialog } from './shortcutsDialog.js';
import { isPaused, resetCtTimer } from './timers.js';
import { renderExecutionUI } from './executionView.js';
import { startProbe } from './probeClient.js';
import { endSession } from './session.js';
import { toggleUiToolbar, isUiToolbarOpen } from './uiToolbar.js';

const MENU_ID = 'qualiflow-runner-menu';

function runActive() {
    const st = S.runnerState;
    return !!(st && st.runId && st.currentTcIndex < st.testCases.length);
}

function switchItem(id, label, hint, on) {
    return `<button type="button" role="menuitemcheckbox" aria-checked="${on ? 'true' : 'false'}" class="qualiflow-run-menu-item" data-menu="${id}">
        <span class="qualiflow-run-menu-text"><span>${label}</span><small>${hint}</small></span>
        <span class="qualiflow-run-switch${on ? ' is-on' : ''}" aria-hidden="true"></span>
    </button>`;
}

function renderMenu(menu, ctx) {
    const active = runActive();
    menu.innerHTML = `
        ${switchItem('autofill', 'Autopreencher campos', 'CPF, CNPJ, RG, CEP, e-mail e telefone', isAutofillEnabled())}
        ${switchItem('cssdebug', 'Depurador CSS', 'Contorno vermelho nos elementos; Alt+clique copia o seletor', isCssDebugEnabled())}
        ${switchItem('uitools', 'Barra de ferramentas de UI/UX', 'Régua, conta-gotas, overlay, acessibilidade e desempenho', isUiToolbarOpen())}
        ${switchItem('probe', 'Capturar console e rede', 'Erros de JavaScript e requisições com falha, para os bugs', S.probeEnabled)}
        ${switchItem('alerts', 'Alertas de tempo', 'Passo demorado e teste pausado por muito tempo', S.alertsEnabled)}
        ${switchItem('dock', 'Ancorar à direita', 'Painel lateral que empurra a página', ctx.isDocked())}
        <div class="qualiflow-run-menu-sep" role="separator"></div>
        <button type="button" role="menuitem" class="qualiflow-run-menu-item" data-menu="shortcuts">
            <span class="qualiflow-run-menu-text"><span>Atalhos de teclado</span><small>${SHORTCUTS.length} atalhos disponíveis</small></span>
        </button>
        <button type="button" role="menuitem" class="qualiflow-run-menu-item" data-menu="reset-timer"${active && !isPaused() ? '' : ' disabled'}>
            <span class="qualiflow-run-menu-text"><span>Zerar cronômetro do CT</span></span>
        </button>
        <button type="button" role="menuitem" class="qualiflow-run-menu-item is-danger" data-menu="end-session"${S.activeSession ? '' : ' disabled'}>
            <span class="qualiflow-run-menu-text"><span>Encerrar sessão</span><small>Descarta a sessão ativa do runner</small></span>
        </button>`;
}

export function initSettingsMenu(windowEl, ctx) {
    const trigger = document.getElementById('qualiflow-runner-settings');
    const menu = document.createElement('div');
    menu.id = MENU_ID;
    menu.className = 'qualiflow-run-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'Configurações do runner');
    menu.hidden = true;
    windowEl.appendChild(menu);

    const close = () => {
        menu.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
    };
    const open = () => {
        renderMenu(menu, ctx);
        menu.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        menu.querySelector('button:not([disabled])')?.focus();
    };

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        if (menu.hidden) open(); else close();
    });
    windowEl.addEventListener('click', (e) => {
        if (!menu.hidden && !menu.contains(e.target) && !trigger.contains(e.target)) close();
    });
    windowEl.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !menu.hidden) { e.stopPropagation(); close(); trigger.focus(); }
    });

    menu.addEventListener('click', (e) => {
        const item = e.target.closest('[data-menu]');
        if (!item || item.disabled) return;
        switch (item.dataset.menu) {
            case 'autofill':
                if (isAutofillEnabled()) stopAutofill(); else startAutofill();
                setStorage({ runnerAutofill: isAutofillEnabled() });
                renderMenu(menu, ctx);
                menu.querySelector('[data-menu="autofill"]')?.focus();
                break;
            case 'cssdebug':
                if (isCssDebugEnabled()) disableCssDebug(); else enableCssDebug();
                setStorage({ runnerCssDebug: isCssDebugEnabled() });
                renderMenu(menu, ctx);
                menu.querySelector('[data-menu="cssdebug"]')?.focus();
                break;
            case 'uitools':
                toggleUiToolbar();
                renderMenu(menu, ctx);
                menu.querySelector('[data-menu="uitools"]')?.focus();
                break;
            case 'probe':
                S.probeEnabled = !S.probeEnabled;
                setStorage({ runnerProbe: S.probeEnabled });
                if (S.probeEnabled && runActive()) startProbe();
                renderMenu(menu, ctx);
                menu.querySelector('[data-menu="probe"]')?.focus();
                break;
            case 'alerts':
                S.alertsEnabled = !S.alertsEnabled;
                setStorage({ runnerAlerts: S.alertsEnabled });
                renderMenu(menu, ctx);
                menu.querySelector('[data-menu="alerts"]')?.focus();
                break;
            case 'dock':
                ctx.toggleDock();
                renderMenu(menu, ctx);
                menu.querySelector('[data-menu="dock"]')?.focus();
                break;
            case 'shortcuts':
                close();
                showShortcutsDialog();
                break;
            case 'reset-timer': {
                close();
                const tc = S.runnerState?.testCases?.[S.runnerState.currentTcIndex];
                if (tc && confirm('Zerar o cronômetro deste caso de teste?')) {
                    resetCtTimer(tc.id);
                    renderExecutionUI();
                }
                break;
            }
            case 'end-session':
                close();
                endSession();
                break;
        }
    });
}
