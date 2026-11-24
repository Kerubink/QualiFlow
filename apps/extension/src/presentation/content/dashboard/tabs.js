import { dashboardState } from './state.js';
import { loadAnalyticsDashboardData, renderAnalyticsDashboard } from './analyticsView.js';
import { loadSupportCards, renderSupportCards } from './supportView.js';
import { renderDeployValidation, validateDeployCards } from './deployValidation.js';

export function initDashboardTabs() {
    const tabCards = document.getElementById('qualiflow-tab-cards');
    const tabAnalytics = document.getElementById('qualiflow-tab-analytics');
    const tabSupport = document.getElementById('qualiflow-tab-support');
    const tabDeploy = document.getElementById('qualiflow-tab-deploy');
    const contentCards = document.getElementById('qualiflow-dashboard-cards');
    const contentAnalytics = document.getElementById('qualiflow-dashboard-analytics');
    const contentSupport = document.getElementById('qualiflow-dashboard-support');
    const contentDeploy = document.getElementById('qualiflow-dashboard-deploy');

    if (!tabCards || !tabSupport || !tabDeploy || !contentCards || !contentSupport || !contentDeploy) return;

    const tabs = [tabCards, tabAnalytics, tabSupport, tabDeploy].filter(Boolean);
    const contents = [contentCards, contentAnalytics, contentSupport, contentDeploy].filter(Boolean);

    const activateTab = (activeTab, activeContent) => {
        tabs.forEach((tab) => {
            tab.classList.remove('qualiflow-tab-active');
            tab.setAttribute('aria-selected', 'false');
            tab.tabIndex = -1;
        });
        contents.forEach((content) => {
            if (content) content.classList.add('qualiflow-hidden');
        });

        activeTab.classList.add('qualiflow-tab-active');
        activeTab.setAttribute('aria-selected', 'true');
        activeTab.tabIndex = 0;
        activeTab.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
        if (activeContent) activeContent.classList.remove('qualiflow-hidden');
    };

    if (tabCards.dataset.bound === '1') {
        return;
    }
    tabCards.dataset.bound = '1';

    // Teclado (padrao WAI-ARIA de abas): setas, Home e End movem e ativam a aba.
    tabCards.parentElement?.addEventListener('keydown', (e) => {
        const keys = { ArrowRight: 1, ArrowLeft: -1, Home: 'first', End: 'last' };
        if (!(e.key in keys)) return;
        const current = tabs.indexOf(document.activeElement);
        if (current === -1) return;
        const step = keys[e.key];
        const next = step === 'first' ? 0 : step === 'last' ? tabs.length - 1 : (current + step + tabs.length) % tabs.length;
        e.preventDefault();
        tabs[next].focus();
        tabs[next].click();
    });

    tabCards.addEventListener('click', () => {
        activateTab(tabCards, contentCards);
    });

    if (tabAnalytics && contentAnalytics) {
        tabAnalytics.addEventListener('click', () => {
            activateTab(tabAnalytics, contentAnalytics);
            try {
                if (dashboardState.analyticsData && Array.isArray(dashboardState.analyticsData.items) && dashboardState.analyticsData.items.length > 0) {
                    renderAnalyticsDashboard(dashboardState.analyticsData);
                } else {
                    loadAnalyticsDashboardData();
                }
            } catch (err) {
                console.error('[QualiFlow] Erro ao renderizar Analytics Pro:', err);
                contentAnalytics.innerHTML = '<div class="qualiflow-error" role="alert">Falha ao carregar Analytics Pro. Verifique os dados e tente novamente.</div>';
            }
        });
    }

    tabSupport.addEventListener('click', () => {
        activateTab(tabSupport, contentSupport);

        if (dashboardState.supportCards === null) {
            loadSupportCards();
        } else {
            renderSupportCards(dashboardState.supportCards);
        }
    });

    tabDeploy.addEventListener('click', () => {
        activateTab(tabDeploy, contentDeploy);
        
        if (!contentDeploy.innerHTML.trim()) {
            renderDeployValidation();
            setTimeout(() => {
                const validateBtn = document.getElementById('qualiflow-deploy-validate-btn');
                if (validateBtn) {
                    validateBtn.addEventListener('click', validateDeployCards);
                }
            }, 50);
        }
    });

    if (tabAnalytics && contentAnalytics) {
        activateTab(tabAnalytics, contentAnalytics);
        if (dashboardState.analyticsData && Array.isArray(dashboardState.analyticsData.items) && dashboardState.analyticsData.items.length > 0) {
            renderAnalyticsDashboard(dashboardState.analyticsData);
        } else {
            loadAnalyticsDashboardData();
        }
    } else {
        activateTab(tabCards, contentCards);
    }
}
