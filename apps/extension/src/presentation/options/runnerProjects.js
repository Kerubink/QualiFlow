// Aba Runner: lista de projetos alvo (estado local da pagina, persistido em runnerProjects).
import { setStorage } from './messaging.js';
import { showStatus } from './ui.js';

// Objeto mutavel compartilhado com settingsForm (restore/save).
export const runnerState = { projects: [] };

export function setupRunnerTab() {
    document.getElementById('btn-add-runner-project')?.addEventListener('click', () => {
        const nameInput = document.getElementById('runner-new-name');
        const urlInput = document.getElementById('runner-new-url');
        const name = nameInput.value.trim();
        const url = urlInput.value.trim();

        if (!name || !url) {
            showStatus('Preencha o nome e a URL alvo', 'error');
            return;
        }

        runnerState.projects.push({ name, url });
        nameInput.value = '';
        urlInput.value = '';

        renderRunnerProjects();
        setStorage({ runnerProjects: runnerState.projects }, () => {
            showStatus('Projeto adicionado!', 'success');
        });
    });
}

export function renderRunnerProjects() {
    const list = document.getElementById('runner-projects-list');
    list.innerHTML = '';

    if (runnerState.projects.length === 0) {
        list.innerHTML = '<li class="project-empty">Nenhum projeto configurado.</li>';
        return;
    }

    runnerState.projects.forEach((proj, index) => {
        const li = document.createElement('li');
        li.className = 'project-item';

        li.innerHTML = `
            <div class="project-info">
                <strong class="project-name">${proj.name}</strong>
                <span class="project-url">${proj.url}</span>
            </div>
            <button type="button" class="btn btn-icon btn-ghost-danger btn-del-proj" data-index="${index}" title="Remover" aria-label="Remover projeto">
                <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
        `;
        list.appendChild(li);
    });

    document.querySelectorAll('.btn-del-proj').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = e.currentTarget.getAttribute('data-index');
            runnerState.projects.splice(idx, 1);
            renderRunnerProjects();
            setStorage({ runnerProjects: runnerState.projects });
        });
    });
}
