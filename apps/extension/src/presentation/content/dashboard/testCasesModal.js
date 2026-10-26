import { sendRuntimeMessage } from '../shared/runtime.js';
import { escapeHtml } from './helpers.js';
import { RuntimeActions } from '../../../contracts/runtimeActions.js';

export function openTestCasesModal(testCases, pbiTitle) {
    document.getElementById('tests-modal-title').textContent = `Testes: ${pbiTitle}`;
    const body = document.getElementById('qualiflow-tests-body');
    body.innerHTML = '';

    if (!testCases || testCases.length === 0) {
        body.innerHTML = '<div class="qualiflow-empty" role="status">Nenhum teste ligado a este card.</div>';
    } else {
        // TOP CONTROL BAR
        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'qualiflow-tests-controls qualiflow-dsh-tests-controls';

        controlsDiv.innerHTML = `
            <div class="qualiflow-dsh-tests-bar">
                <div class="qualiflow-dsh-tests-check">
                    <input type="checkbox" id="qualiflow-tests-checkall" class="qualiflow-chk qualiflow-chk-large" />
                    <label for="qualiflow-tests-checkall">Selecionar Todos</label>
                </div>
                <span id="tests-selected-count" class="qualiflow-dsh-tests-count" aria-live="polite">0 selecionados</span>
            </div>
            <div class="qualiflow-dsh-tests-update">
                <select id="tests-new-state" class="qualiflow-select-input" aria-label="Novo estado dos testes selecionados">
                    <option value="Novo">Novo</option>
                    <option value="Em teste">Em teste</option>
                    <option value="Done">Done</option>
                </select>
                <button type="button" id="tests-btn-update" class="qualiflow-btn-inline qualiflow-btn-primary">Atualizar Status</button>
            </div>
            <div id="tests-update-feedback" class="qualiflow-hidden qualiflow-dsh-tests-feedback" role="status" aria-live="polite"></div>
        `;
        body.appendChild(controlsDiv);

        const listDiv = document.createElement('div');
        listDiv.id = 'qualiflow-tests-list';
        body.appendChild(listDiv);

        testCases.forEach(tc => {
            const tcStateLower = (tc.state || '').toLowerCase();
            const stateVariant = (tcStateLower === 'done' || tcStateLower === 'closed') ? 'success' : 'warning';
            const tcEl = document.createElement('div');
            tcEl.className = 'qualiflow-card qualiflow-dsh-test-item test-item';
            tcEl.dataset.id = tc.id;

            tcEl.innerHTML = `
                <input type="checkbox" class="qualiflow-chk test-chk" value="${tc.id}" aria-label="Selecionar teste ${tc.id}" />
                <div class="qualiflow-dsh-test-body">
                    <div class="qualiflow-dsh-test-title">[ID ${tc.id}] ${escapeHtml(tc.title)}</div>
                    <div class="qualiflow-dsh-test-foot">
                        <span class="test-state-badge qualiflow-badge qualiflow-badge-${stateVariant}">Estado: <span class="state-val">${escapeHtml(tc.state)}</span></span>
                        <a href="${escapeHtml(tc.url)}" target="_blank" rel="noopener noreferrer" class="qualiflow-btn-inline qualiflow-btn-secondary qualiflow-btn-sm">Abrir Azure</a>
                    </div>
                </div>
            `;
            listDiv.appendChild(tcEl);
        });

        // Event Listeners for checkboxes
        const checkAll = document.getElementById('qualiflow-tests-checkall');
        const chks = listDiv.querySelectorAll('.test-chk');
        const countSpan = document.getElementById('tests-selected-count');
        const btnUpdate = document.getElementById('tests-btn-update');
        const newStateSel = document.getElementById('tests-new-state');
        const feedback = document.getElementById('tests-update-feedback');

        const updateCount = () => {
            const selected = listDiv.querySelectorAll('.test-chk:checked').length;
            countSpan.textContent = `${selected} selecionado(s)`;
        };

        checkAll.addEventListener('change', (e) => {
            chks.forEach(c => c.checked = e.target.checked);
            updateCount();
        });

        chks.forEach(c => c.addEventListener('change', () => {
            checkAll.checked = (listDiv.querySelectorAll('.test-chk:checked').length === chks.length);
            updateCount();
        }));

        btnUpdate.addEventListener('click', () => {
            const selectedIds = Array.from(listDiv.querySelectorAll('.test-chk:checked')).map(c => parseInt(c.value));
            if (selectedIds.length === 0) {
                feedback.textContent = 'Selecione pelo menos um teste.';
                feedback.className = 'qualiflow-error qualiflow-dsh-tests-feedback';
                feedback.classList.remove('qualiflow-hidden');
                return;
            }

            const stateVal = newStateSel.value;
            btnUpdate.disabled = true;
            btnUpdate.textContent = 'Aguarde...';
            feedback.classList.add('qualiflow-hidden');

            sendRuntimeMessage({
                action: RuntimeActions.UPDATE_WORK_ITEMS_STATE,
                ids: selectedIds,
                newState: stateVal
            }, (res) => {
                btnUpdate.disabled = false;
                btnUpdate.textContent = 'Atualizar Status';
                if (res && res.error) {
                    feedback.textContent = `Erro: ${res.error}`;
                    feedback.className = 'qualiflow-error qualiflow-dsh-tests-feedback';
                    feedback.classList.remove('qualiflow-hidden');
                } else {
                    feedback.textContent = 'Atualizado com sucesso!';
                    feedback.className = 'qualiflow-success qualiflow-dsh-tests-feedback';
                    feedback.classList.remove('qualiflow-hidden');

                    // Update DOM states immediately
                    selectedIds.forEach(id => {
                        const row = listDiv.querySelector(`.test-item[data-id="${id}"]`);
                        if (row) {
                            const badge = row.querySelector('.test-state-badge');
                            const isDone = stateVal.toLowerCase() === 'done' || stateVal.toLowerCase() === 'closed';
                            badge.classList.toggle('qualiflow-badge-success', isDone);
                            badge.classList.toggle('qualiflow-badge-warning', !isDone);
                            badge.querySelector('.state-val').textContent = stateVal;
                        }

                        // update the in-memory array too
                        const tcRef = testCases.find(t => t.id === id);
                        if (tcRef) tcRef.state = stateVal;
                    });
                }
            });
        });
    }

    const overlay = document.getElementById('qualiflow-tests-modal-overlay');
    overlay.classList.remove('qualiflow-hidden');
}
