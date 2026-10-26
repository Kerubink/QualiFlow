// Entrypoint do modulo de dashboard: registra os hooks consumidos pela UI/scenarios.
import { hooks } from '../hooks.js';
import { renderDashboard } from './dashboardView.js';
import { initDashboardTabs } from './tabs.js';

hooks.renderDashboard = renderDashboard;
hooks.initDashboardTabs = initDashboardTabs;
