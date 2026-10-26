import { state } from '../state.js';
import { escapeHtml } from '../shared/dom.js';
import { isRtmRowCovered, stripCriteriaPrefix } from '../../../domain/rtm.js';
import { scenarioHasUnfilledParams, scenarioTitleLabel } from '../../../domain/scenario.js';
import { syncCopyFlowButtons } from './copyButtons.js';
import { openEditModal } from './editModal.js';

const esc = escapeHtml;

function setRtmVisibility(visible) {
    const rtmCol = document.getElementById('qualiflow-col-rtm');
    if (!rtmCol) return;
    if (visible) rtmCol.classList.remove('qualiflow-hidden');
    else rtmCol.classList.add('qualiflow-hidden');
}
function updateSelectionCount() {
    const selectedCount = document.querySelectorAll('.scenario-check:checked').length;
    const totalCount = document.querySelectorAll('.scenario-check').length;
    const countEl = document.getElementById('qualiflow-selection-count');
    if (countEl) countEl.textContent = selectedCount + " / " + totalCount + " selecionados";
}
function onSelectAllToggle(e) {
    const isChecked = e.target.checked;
    document.querySelectorAll('.scenario-check').forEach(chk => {
        chk.checked = isChecked;
    });
    updateSelectionCount();
}
export function renderScenarios(data, options = {}) {
    state.currentCoverageData = data;
    const scenarios = (Array.isArray(data) ? data : data?.test_cases) || [];
    state.currentScenarios = scenarios;
    const showRtm = options.showRtm !== false;
    const list = document.getElementById('qualiflow-scenarios-list');
    const rtmContent = document.getElementById('qualiflow-rtm-content');
    list.innerHTML = '';
    rtmContent.innerHTML = '';

    const scenariosCol = document.getElementById('qualiflow-col-scenarios');
    if (scenariosCol) scenariosCol.classList.remove('qualiflow-hidden');
    setRtmVisibility(showRtm);
    syncCopyFlowButtons();

    if (!showRtm) {
        rtmContent.innerHTML = `
            <div class="qualiflow-sc-rtm-hidden-note">
                RTM oculto neste modo de reaproveitamento manual. Use <strong>Ajustes Automáticos</strong> para adaptar os CTs ao card atual e gerar a matriz de cobertura.
            </div>
        `;
    }

    if (showRtm && data.coverage_analysis) {
        const rtmMatrix = Array.isArray(data.coverage_analysis.rtm_matrix) ? data.coverage_analysis.rtm_matrix : [];
        const rtmRows = rtmMatrix.map((row, idx) => {
            const scns = esc((row.covered_by_scenarios || []).join(', '));
            const isCovered = isRtmRowCovered(row);
            const statusBadge = isCovered
                ? '<span class="qualiflow-badge qualiflow-badge-success">✔ Coberto</span>'
                : '<span class="qualiflow-badge qualiflow-badge-danger">✖ Falta Teste</span>';
            return `<tr><td>CA${idx + 1}: ${esc(row.criteria)}</td><td class="qualiflow-sc-rtm-scn">${scns || '—'}</td><td>${statusBadge}</td></tr>`;
        }).join('');

        const criteriaList = rtmMatrix.map((row, idx) => {
            // Strip duplicate AC prefix from criteria if the AI already added it
            const cleanCriteria = esc(stripCriteriaPrefix(row.criteria));
            return `<li><strong>CA${idx + 1}:</strong> ${cleanCriteria}</li>`;
        }).join('');

        rtmContent.innerHTML = `
            <div class="qualiflow-scenarios-header">
                <h3>Critérios de Aceite</h3>
            </div>
            <div class="qualiflow-azure-html qualiflow-sc-crit-wrap">
                <ol class="qualiflow-sc-crit-list">
                    ${criteriaList || '<li>Nenhum critério detectado.</li>'}
                </ol>
            </div>
           
            <div class="qualiflow-scenarios-header qualiflow-sc-rtm-head">
                <h3>Matriz RTM & Inteligência</h3>
            </div>
            <p class="qualiflow-sc-score"><strong>Score:</strong> ${esc(data.coverage_analysis.coverage_score)} | <strong>Critérios:</strong> ${esc(data.total_criterios)} | <strong>Cenários:</strong> ${esc(data.total_tests)}</p>
            <table class="qualiflow-rtm-table qualiflow-sc-rtm-table">
                <thead><tr><th>Critério</th><th>Cenários</th><th>Status</th></tr></thead>
                <tbody>${rtmRows}</tbody>
            </table>
            <div class="qualiflow-cobertura-text qualiflow-sc-insights"><i>Insights: ${esc(data.coverage_analysis.insights)}</i></div>
        `;
    }

    const selHeader = document.createElement('div');
    selHeader.className = 'qualiflow-select-all-header';
    selHeader.innerHTML = `
        <input type="checkbox" id="qualiflow-select-all" class="qualiflow-chk qualiflow-chk-large" checked />
        <label for="qualiflow-select-all" class="qualiflow-sc-select-label">Selecionar Todos</label>
        <span id="qualiflow-selection-count" class="qualiflow-selection-count">${scenarios.length}/${scenarios.length} selecionados</span>
        `;
    list.appendChild(selHeader);
    selHeader.querySelector('#qualiflow-select-all').addEventListener('change', onSelectAllToggle);

    scenarios.forEach((sc, idx) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'qualiflow-acc-item';

        const header = document.createElement('div');
        header.className = 'qualiflow-acc-header';

        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.className = 'qualiflow-chk scenario-check';
        chk.checked = true;
        chk.dataset.idx = idx;
        chk.addEventListener('change', updateSelectionCount);

        const title = document.createElement('span');
        title.className = 'qualiflow-acc-title';
        title.textContent = scenarioTitleLabel(sc);

        const paramFlag = document.createElement('span');
        paramFlag.className = 'qualiflow-param-indicator qualiflow-hidden';
        paramFlag.innerHTML = '⚠️';
        paramFlag.title = 'Contém @parâmetros não preenchidos';

        const caret = document.createElement('span');
        caret.className = 'qualiflow-caret';
        caret.innerHTML = '▼';

        header.appendChild(chk);
        header.appendChild(title);
        header.appendChild(paramFlag);
        header.appendChild(caret);

        // Param Check Logic
        const checkParams = () => {
            const unfilled = scenarioHasUnfilledParams(sc);
            if (unfilled) {
                paramFlag.classList.remove('qualiflow-hidden');
            } else {
                paramFlag.classList.add('qualiflow-hidden');
            }
        };
        checkParams();
        itemEl.checkParams = checkParams;

        const body = document.createElement('div');
        body.className = 'qualiflow-acc-body qualiflow-hidden';

        const renderViewAndEdit = () => {
            const stepsTableHTML = (sc.steps || []).map(st => {
                const icon = st.needs_evidence ? ' 📸' : '';
                return `<tr><td>${icon}${esc(st.action)}</td><td>${esc(st.expected)}</td></tr>`;
            }).join('');

            body.innerHTML = `
            <div class="qualiflow-modes-container">
                <div class="qualiflow-view-mode">
                    <button class="qualiflow-btn-inline qualiflow-btn-secondary qualiflow-edit-btn qualiflow-sc-edit-btn" data-idx="${idx}"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.89 1.112l-2.83.94c-.407.136-.78-.238-.645-.645l.94-2.83a4.5 4.5 0 011.112-1.89l13.34-13.34z"></path></svg> Editar Cenário</button>
                    <h4 class="qualiflow-view-title qualiflow-sc-view-title">${esc(sc.title)}</h4>
                    <p class="qualiflow-view-bdd">${esc(sc.bdd_description).replace(/(\\n|\n|\r\n)/g, '<br/>')}</p>
                    <table class="qualiflow-steps-table">
                        <thead><tr><th>Ação (📸 => Evidência)</th><th>Esperado</th></tr></thead>
                        <tbody>${stepsTableHTML}</tbody>
                    </table>
                </div>
            </div>
            `;

            body.querySelector('.qualiflow-edit-btn').addEventListener('click', () => {
                openEditModal(idx);
            });
        };

        renderViewAndEdit();
        // Keep a reference to re-render later if edit changes it
        itemEl.renderViewAndEdit = renderViewAndEdit;

        header.addEventListener('click', (e) => {
            if (e.target.tagName.toLowerCase() === 'input' || e.target.tagName.toLowerCase() === 'button' || e.target.closest('button')) return;
            body.classList.toggle('qualiflow-hidden');
            caret.innerHTML = body.classList.contains('qualiflow-hidden') ? '▼' : '▲';
        });

        itemEl.appendChild(header);
        itemEl.appendChild(body);
        list.appendChild(itemEl);
    });
}
