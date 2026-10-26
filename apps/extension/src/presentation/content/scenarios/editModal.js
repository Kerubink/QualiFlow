import { state } from '../state.js';
import { getStorage } from '../shared/runtime.js';
import { ensureScenarioParamsDefault, extractScenarioParams } from '../../../domain/scenario.js';

export function closeEditModal() {
    document.getElementById('qualiflow-edit-modal-overlay').classList.add('qualiflow-hidden');
}
export function openEditModal(idx) {
    const sc = state.currentScenarios[idx];
    const overlay = document.getElementById('qualiflow-edit-modal-overlay');
    const body = document.getElementById('qualiflow-edit-body');
    const esc = (text) => (text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const scTags = state.currentWorkItemData.tags || "";
    const scAssignee = sc.assignedTo?.trim() || "";

    body.innerHTML = `
        <div class="qualiflow-form-group">
            <label>Título:</label>
            <input type="text" id="edit-modal-title" value="${esc(sc.title)}" class="qualiflow-input-edit" />
        </div>
        <div class="qualiflow-step-row">
            <div class="qualiflow-form-group qualiflow-sc-grow-field">
                <label>Tags do PBI (herdadas automaticamente):</label>
                <input type="text" id="edit-modal-tags" value="${esc(scTags)}" class="qualiflow-input-edit" placeholder="Tags herdadas do PBI" readonly />
            </div>
            <div class="qualiflow-form-group qualiflow-sc-grow-field">
                <label>Responsável (opcional):</label>
                <input type="text" id="edit-modal-assignee" value="${esc(scAssignee)}" class="qualiflow-input-edit" placeholder="nome@empresa.com ou DOMÍNIO\\usuario" />
            </div>
        </div>
        <div class="qualiflow-form-group">
            <label>Contexto BDD (Dado / Quando / Então):</label>
            <textarea id="edit-modal-bdd" class="qualiflow-textarea-edit">${esc(sc.bdd_description)}</textarea>
        </div>
        <div class="qualiflow-form-group">
            <div class="qualiflow-sc-steps-head">
                <label>Passos de Execução:</label>
                <button type="button" id="edit-modal-add-step" class="qualiflow-btn-inline qualiflow-btn-secondary qualiflow-sc-add-step">+ Adicionar Passo</button>
            </div>
            <div id="edit-modal-steps-container" class="qualiflow-sc-steps-container"></div>
        </div>
 
        <div class="qualiflow-form-group" id="params-section">
            <label class="qualiflow-sc-params-label">Parâmetros (@data):</label>
            <div id="edit-modal-params-container"></div>
        </div>
        `;

    const stepsContainer = document.getElementById('edit-modal-steps-container');

    // Prefill assignee from scenario or QA email config (async)
    getStorage(['qaEmail'], (stored) => {
        try {
            const assigneeInput = document.getElementById('edit-modal-assignee');
            if (!assigneeInput) return;
            if (sc.assignedTo && sc.assignedTo.trim()) {
                assigneeInput.value = sc.assignedTo.trim();
            } else if (stored.qaEmail && stored.qaEmail.trim()) {
                assigneeInput.value = stored.qaEmail.trim();
            }
        } catch (e) {
            console.warn('Erro ao preencher assignee na modal:', e);
        }
    });

    const createStepRow = (action, expected, needsEvid, stepIndex) => {
        const row = document.createElement('div');
        row.className = 'qualiflow-step-row qualiflow-sc-step-row';
        row.draggable = true;

        // drag handle
        const handle = document.createElement('span');
        handle.title = 'Arrastar para reordenar';
        handle.className = 'qualiflow-sc-step-handle';
        handle.setAttribute('aria-hidden', 'true');
        handle.textContent = '⋮⋮';
        handle.addEventListener('mousedown', () => { row.draggable = true; });

        const actEl = document.createElement('textarea');
        actEl.className = 'qualiflow-step-input step-act';
        actEl.rows = 2;
        actEl.placeholder = 'Ação';
        actEl.value = action;
        actEl.addEventListener('mousedown', () => { row.draggable = false; });

        const expEl = document.createElement('textarea');
        expEl.className = 'qualiflow-step-input step-exp';
        expEl.rows = 2;
        expEl.placeholder = 'Resultado Esperado';
        expEl.value = expected;
        expEl.addEventListener('mousedown', () => { row.draggable = false; });

        const evidBtn = document.createElement('button');
        evidBtn.type = 'button';
        evidBtn.setAttribute('aria-label', 'Requer evidência');
        evidBtn.className = `qualiflow-evidence-toggle ${needsEvid ? 'active' : ''}`;
        evidBtn.title = 'Requer Evidência';
        evidBtn.textContent = '📸';
        evidBtn.addEventListener('click', (e) => { e.currentTarget.classList.toggle('active'); });

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.setAttribute('aria-label', 'Remover passo');
        delBtn.className = 'qualiflow-btn-inline qualiflow-btn-secondary step-del qualiflow-sc-step-del';
        delBtn.title = 'Remover Passo';
        delBtn.innerHTML = '&times;';
        delBtn.addEventListener('click', () => row.remove());

        row.appendChild(handle);
        row.appendChild(actEl);
        row.appendChild(expEl);
        row.appendChild(evidBtn);
        row.appendChild(delBtn);

        // Drag-and-drop logic
        row.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'move';
            row.classList.add('dragging');
        });
        row.addEventListener('dragend', () => {
            row.classList.remove('dragging');
            stepsContainer.querySelectorAll('.qualiflow-step-row').forEach(r => r.classList.remove('drag-over'));
        });
        row.addEventListener('dragover', (e) => {
            e.preventDefault();
            const dragging = stepsContainer.querySelector('.dragging');
            if (!dragging || dragging === row) return;
            const rect = row.getBoundingClientRect();
            const mid = rect.top + rect.height / 2;
            stepsContainer.querySelectorAll('.qualiflow-step-row').forEach(r => r.classList.remove('drag-over'));
            row.classList.add('drag-over');
            if (e.clientY < mid) {
                stepsContainer.insertBefore(dragging, row);
            } else {
                stepsContainer.insertBefore(dragging, row.nextSibling);
            }
        });

        return row;
    };

    sc.steps.forEach((st, i) => {
        stepsContainer.appendChild(createStepRow(st.action, st.expected, st.needs_evidence, i));
    });

    document.getElementById('edit-modal-add-step').addEventListener('click', () => {
        stepsContainer.appendChild(createStepRow('', '', false, stepsContainer.children.length));
    });

    const saveBtn = document.getElementById('qualiflow-edit-save');
    saveBtn.onclick = () => {
        sc.title = document.getElementById('edit-modal-title').value;
        const enteredAssignee = document.getElementById('edit-modal-assignee').value.trim();
        sc.bdd_description = document.getElementById('edit-modal-bdd').value;

        const newSteps = [];
        stepsContainer.querySelectorAll('.qualiflow-step-row').forEach(row => {
            newSteps.push({
                action: row.querySelector('.step-act').value,
                expected: row.querySelector('.step-exp').value,
                needs_evidence: row.querySelector('.qualiflow-evidence-toggle').classList.contains('active')
            });
        });
        sc.steps = newSteps;

        // Parâmetros
        const paramInputs = document.querySelectorAll('.qualiflow-input-param');
        sc.parameters = {};
        paramInputs.forEach(inp => {
            sc.parameters[inp.dataset.pname] = inp.value;
        });

        const applyEditSave = (resolvedAssignee) => {
            if (resolvedAssignee) {
                sc.assignedTo = resolvedAssignee;
            } else {
                delete sc.assignedTo;
            }

            // Scope selector to the scenarios list to avoid being offset by local session cards
            const scenariosList = document.getElementById('qualiflow-scenarios-list');
            const allItems = scenariosList ? scenariosList.querySelectorAll('.qualiflow-acc-item') : document.querySelectorAll('.qualiflow-acc-item');
            const item = allItems[idx];
            if (!item) return;
            item.renderViewAndEdit();
            item.querySelector('.qualiflow-acc-title').textContent = sc.title + (sc.id_original ? ` [ID ${sc.id_original}]` : ' [Novo]');
            if (item.checkParams) item.checkParams();
            closeEditModal();
        };

        if (enteredAssignee) {
            applyEditSave(enteredAssignee);
        } else {
            getStorage(['qaEmail'], (stored) => {
                if (stored.qaEmail?.trim()) {
                    applyEditSave(stored.qaEmail.trim());
                } else {
                    applyEditSave('');
                }
            });
        }
    };

    // Render Params Table Logic
    const renderParamsTable = () => {
        const pContainer = document.getElementById('edit-modal-params-container');
        ensureScenarioParamsDefault(sc);
        // Extract params from text
        const foundParams = extractScenarioParams(sc);

        if (foundParams.length === 0) {
            pContainer.innerHTML = '<p class="qualiflow-sc-param-empty">Nenhum parâmetro detectado automaticamente.</p>';
            return;
        }

        let tableHtml = `<table class="qualiflow-params-table"><thead><tr><th>Parâmetro</th><th>Valor Sugerido/Fixo</th></tr></thead><tbody>`;
        foundParams.forEach(pName => {
            sc.parameters = sc.parameters || {};
            if (!sc.parameters[pName] || sc.parameters[pName].trim() === '') {
                sc.parameters[pName] = '###';
            }
            tableHtml += `<tr>
                <td class="qualiflow-sc-param-name">${pName}</td>
                <td><input type="text" class="qualiflow-input-param" data-pname="${pName}" value="${esc(sc.parameters[pName])}" placeholder="Ex: 'Admin', '1234'..." /></td>
            </tr>`;
        });
        tableHtml += `</tbody></table>`;
        pContainer.innerHTML = tableHtml;
    };
    renderParamsTable();


    overlay.classList.remove('qualiflow-hidden');
}
