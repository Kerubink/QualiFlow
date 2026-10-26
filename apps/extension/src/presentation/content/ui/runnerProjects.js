import { setStorage } from '../shared/runtime.js';
import { uiState } from './uiState.js';
import { escapeHtml } from '../shared/dom.js';

export function renderUIRunnerProjects() {
    const list = document.getElementById('ui-runner-projects-list');
    if (!list) return;
    list.innerHTML = '';
    if (!uiState.runnerProjects || uiState.runnerProjects.length === 0) {
        list.innerHTML = '<li class="qualiflow-empty">Nenhum projeto configurado.</li>';
        return;
    }
    uiState.runnerProjects.forEach((proj, index) => {
        const li = document.createElement('li');
        li.className = 'qualiflow-card qualiflow-card-raised qualiflow-run-proj-item';

        li.innerHTML = `
            <div class="qualiflow-run-proj-info">
                <strong class="qualiflow-run-proj-name">${escapeHtml(proj.name)}</strong>
                <span class="qualiflow-run-proj-url">${escapeHtml(proj.url)}</span>
            </div>
            <button type="button" class="ui-btn-del-proj qualiflow-btn-icon qualiflow-run-del-btn" data-index="${index}" title="Remover" aria-label="Remover projeto">
                <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
        `;
        list.appendChild(li);
    });

    document.querySelectorAll('.ui-btn-del-proj').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = e.currentTarget.getAttribute('data-index');
            uiState.runnerProjects.splice(idx, 1);
            renderUIRunnerProjects();
            setStorage({ runnerProjects: uiState.runnerProjects });
        });
    });
}
