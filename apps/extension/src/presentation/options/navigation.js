import { DEV_BACKEND_URL } from '../../domain/constants.js';

export function setupNavigation() {
    const navItems = Array.from(document.querySelectorAll('.nav-item'));
    const tabContents = document.querySelectorAll('.tab-content');

    const activate = (item, { focus = false } = {}) => {
        // Remove active from all tabs
        navItems.forEach(n => {
            const isActive = n === item;
            n.classList.toggle('active', isActive);
            n.setAttribute('aria-selected', String(isActive));
            n.tabIndex = isActive ? 0 : -1;
        });
        tabContents.forEach(t => t.classList.remove('active'));

        // Add active to clicked tab
        const targetId = item.getAttribute('data-target');
        document.getElementById(targetId).classList.add('active');
        if (focus) item.focus();
    };

    navItems.forEach(item => {
        item.addEventListener('click', () => activate(item));
    });

    // Navegacao por teclado (padrao WAI-ARIA tabs): setas, Home e End.
    navItems.forEach((item, index) => {
        item.addEventListener('keydown', (e) => {
            let next = null;
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (index + 1) % navItems.length;
            else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (index - 1 + navItems.length) % navItems.length;
            else if (e.key === 'Home') next = 0;
            else if (e.key === 'End') next = navItems.length - 1;
            if (next === null) return;
            e.preventDefault();
            activate(navItems[next], { focus: true });
        });
    });
}

export function setupDynamicGroups() {
    const boardSelect = document.getElementById('board-select');
    const aiSelect = document.getElementById('ai-select');

    const applyBoardGroupState = (provider) => {
        document.querySelectorAll('#board .dynamic-group').forEach((el) => {
            const isTarget = el.id === `board-${provider}`;
            el.classList.toggle('active-group', isTarget);

            // Guarantee fields from active provider are editable.
            el.querySelectorAll('input, select, textarea, button').forEach((field) => {
                if (field.id === 'board-select') return;
                field.disabled = !isTarget;
            });
        });
    };

    const applyAiGroupState = (provider) => {
        document.querySelectorAll('#ai .dynamic-group').forEach((el) => {
            const isTarget = el.id === `ai-${provider}`;
            el.classList.toggle('active-group', isTarget);
        });
    };

    boardSelect.addEventListener('change', (e) => {
        applyBoardGroupState(e.target.value);
    });

    aiSelect.addEventListener('change', (e) => {
        applyAiGroupState(e.target.value);
    });

    applyBoardGroupState(boardSelect.value);
    applyAiGroupState(aiSelect.value);
}

export function setupDevModeToggle() {
    const toggle = document.getElementById('dev-mode-toggle');
    const urlInput = document.getElementById('copilot-backend-url');
    if (!toggle || !urlInput) return;

    toggle.addEventListener('change', () => {
        if (toggle.checked) {
            urlInput.value = DEV_BACKEND_URL;
        } else if (urlInput.value.trim() === DEV_BACKEND_URL) {
            urlInput.value = '';
        }
    });
}
