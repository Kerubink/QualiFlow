import { buildDeployExportHtml, buildDeployExportText, copyRichTeamsExport, getDeployExportColumns, matchesDeployExportFilters } from './deployExport.js';
import { initMultiSelectDropdown } from './multiSelectDropdown.js';

export function openDeployExportModal(context) {
    const existing = document.getElementById('qualiflow-export-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'qualiflow-export-modal-overlay';
    overlay.className = 'qualiflow-root qualiflow-dialog-overlay';
    overlay.innerHTML = `
        <div class="qualiflow-dialog qualiflow-dialog-lg qualiflow-dialog-surface" role="dialog" aria-modal="true" aria-labelledby="qualiflow-export-title">
            <div class="qualiflow-dialog-head">
                <div>
                    <h3 id="qualiflow-export-title" class="qualiflow-dialog-title">Exportar lista</h3>
                    <p class="qualiflow-dialog-subtitle">Ajuste os filtros e copie uma tabela pronta para o Teams.</p>
                </div>
                <button type="button" id="qualiflow-export-close" class="qualiflow-btn-inline qualiflow-btn-secondary">Fechar</button>
            </div>
            <div class="qualiflow-dialog-body">
                <div class="qualiflow-dep-export-grid">
                    <select id="qualiflow-export-groupby" class="qualiflow-select-input" aria-label="Agrupamento">
                        <option value="none">Sem agrupamento</option>
                        <option value="responsible">Agrupar por responsável</option>
                        <option value="type">Agrupar por tipo</option>
                        <option value="area">Agrupar por área</option>
                        <option value="stack">Agrupar por stack</option>
                    </select>
                    <select id="qualiflow-export-release" class="qualiflow-select-input" aria-label="Filtro de liberação">
                        <option value="all">Todas as liberações</option>
                        <option value="yes">Somente liberados</option>
                        <option value="pending">Somente pendentes</option>
                        <option value="no">Somente com problema</option>
                    </select>
                    <div id="qualiflow-export-responsibles" class="qualiflow-multi-select">
                        <button type="button" class="qualiflow-select-input qualiflow-multi-select-trigger" title="Selecione responsáveis">
                            <span class="qualiflow-multi-select-label">Responsáveis: Todos</span>
                            <span class="qualiflow-multi-select-arrow">▼</span>
                        </button>
                        <div class="qualiflow-multi-select-panel"></div>
                    </div>
                    <div id="qualiflow-export-types" class="qualiflow-multi-select">
                        <button type="button" class="qualiflow-select-input qualiflow-multi-select-trigger" title="Selecione tipos">
                            <span class="qualiflow-multi-select-label">Tipos: Todos</span>
                            <span class="qualiflow-multi-select-arrow">▼</span>
                        </button>
                        <div class="qualiflow-multi-select-panel"></div>
                    </div>
                </div>
                <div class="qualiflow-dep-export-cols">
                    <label class="qualiflow-dep-col-label"><input type="checkbox" class="qualiflow-chk" id="qualiflow-export-col-id" checked /> ID</label>
                    <label class="qualiflow-dep-col-label"><input type="checkbox" class="qualiflow-chk" id="qualiflow-export-col-title" checked /> Card</label>
                    <label class="qualiflow-dep-col-label"><input type="checkbox" class="qualiflow-chk" id="qualiflow-export-col-type" checked /> Tipo</label>
                    <label class="qualiflow-dep-col-label"><input type="checkbox" class="qualiflow-chk" id="qualiflow-export-col-state" /> Estado</label>
                    <label class="qualiflow-dep-col-label"><input type="checkbox" class="qualiflow-chk" id="qualiflow-export-col-stack" /> Stack</label>
                    <label class="qualiflow-dep-col-label"><input type="checkbox" class="qualiflow-chk" id="qualiflow-export-col-qa" checked /> QA</label>
                    <label class="qualiflow-dep-col-label"><input type="checkbox" class="qualiflow-chk" id="qualiflow-export-col-tags" /> Tags</label>
                    <label class="qualiflow-dep-col-label"><input type="checkbox" class="qualiflow-chk" id="qualiflow-export-col-release" checked /> Liberação</label>
                    <label class="qualiflow-dep-col-label"><input type="checkbox" class="qualiflow-chk" id="qualiflow-export-col-issues" /> Problemas</label>
                    <label class="qualiflow-dep-col-label"><input type="checkbox" class="qualiflow-chk" id="qualiflow-export-col-area" /> Área</label>
                </div>
                <div class="qualiflow-dep-export-actions">
                    <button type="button" id="qualiflow-export-copy" class="qualiflow-btn-inline qualiflow-btn-primary">Copiar para Teams</button>
                    <button type="button" id="qualiflow-export-refresh" class="qualiflow-btn-inline qualiflow-btn-secondary">Atualizar preview</button>
                </div>
                <div class="qualiflow-dep-export-previews">
                    <div>
                        <div class="qualiflow-dep-preview-label">Prévia texto</div>
                        <textarea id="qualiflow-export-output" class="qualiflow-textarea-edit qualiflow-dep-export-output" readonly spellcheck="false" aria-label="Prévia texto"></textarea>
                    </div>
                    <div>
                        <div class="qualiflow-dep-preview-label">Prévia HTML para Teams</div>
                        <div id="qualiflow-export-html-preview" class="qualiflow-dep-export-preview"></div>
                    </div>
                </div>
                <div id="qualiflow-export-feedback" class="qualiflow-dep-export-feedback" aria-live="polite"></div>
            </div>
        </div>
    `;

    const previousFocus = document.activeElement;
    document.body.appendChild(overlay);

    const modal = {
        overlay,
        responsiblesSelect: overlay.querySelector('#qualiflow-export-responsibles'),
        typesSelect: overlay.querySelector('#qualiflow-export-types'),
        groupBySelect: overlay.querySelector('#qualiflow-export-groupby'),
        exportReleaseSelect: overlay.querySelector('#qualiflow-export-release'),
        outputEl: overlay.querySelector('#qualiflow-export-output'),
        htmlPreviewEl: overlay.querySelector('#qualiflow-export-html-preview'),
        feedbackEl: overlay.querySelector('#qualiflow-export-feedback'),
        closeBtn: overlay.querySelector('#qualiflow-export-close'),
        copyBtn: overlay.querySelector('#qualiflow-export-copy'),
        refreshBtn: overlay.querySelector('#qualiflow-export-refresh')
    };

    const uniqueResponsibles = [...new Set(context.rows.flatMap(({ node }) => node.qaResponsibles || []))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const uniqueTypes = [...new Set(context.rows.map(({ node }) => node.type || 'Sem tipo'))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const responsiblesMulti = initMultiSelectDropdown(modal.responsiblesSelect, {
        placeholder: 'Responsáveis',
        onChange: () => refresh()
    });
    const typesMulti = initMultiSelectDropdown(modal.typesSelect, {
        placeholder: 'Tipos',
        onChange: () => refresh()
    });

    responsiblesMulti?.setOptions(uniqueResponsibles);
    typesMulti?.setOptions(uniqueTypes);

    const exportState = {
        groupBy: 'none',
        release: 'all',
        responsibles: uniqueResponsibles,
        types: uniqueTypes,
        columns: getDeployExportColumns()
    };

    const refresh = () => {
        exportState.groupBy = modal.groupBySelect.value;
        exportState.release = modal.exportReleaseSelect.value;
        exportState.responsibles = responsiblesMulti?.getSelectedValues?.() || [];
        exportState.types = typesMulti?.getSelectedValues?.() || [];
        exportState.columns = getDeployExportColumns();

        const exportRows = context.rows.filter(({ node }) => matchesDeployExportFilters(node, exportState));

        const plain = buildDeployExportText(exportRows, {
            iterationPath: context.iterationPath,
            groupBy: exportState.groupBy,
            release: exportState.release,
            responsibles: exportState.responsibles,
            types: exportState.types,
            columns: exportState.columns
        });
        const html = buildDeployExportHtml(exportRows, {
            iterationPath: context.iterationPath,
            groupBy: exportState.groupBy,
            release: exportState.release,
            responsibles: exportState.responsibles,
            types: exportState.types,
            columns: exportState.columns
        });

        modal.outputEl.value = plain;
        modal.htmlPreviewEl.innerHTML = html;
        modal.feedbackEl.textContent = `${exportRows.length} item(ns) prontos para exportação.`;
        context.exportState = exportState;
        context.exportRows = exportRows;
        context.exportPlain = plain;
        context.exportHtml = html;
    };

    [modal.responsiblesSelect, modal.typesSelect, modal.groupBySelect, modal.exportReleaseSelect].forEach(el => {
        el.addEventListener('change', refresh);
    });
    modal.refreshBtn.addEventListener('click', refresh);
    modal.copyBtn.addEventListener('click', async () => {
        try {
            await copyRichTeamsExport(context.exportHtml || '', context.exportPlain || '');
            modal.feedbackEl.textContent = 'Exportação copiada. Cole diretamente no Teams.';
        } catch (err) {
            modal.feedbackEl.textContent = `Falha ao copiar: ${err.message}`;
        }
    });
    const destroyMulti = () => {
        responsiblesMulti?.destroy?.();
        typesMulti?.destroy?.();
    };
    const closeModal = () => {
        if (!overlay.isConnected) return;
        overlay.remove();
        destroyMulti();
        if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
    };
    modal.closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });
    overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.stopPropagation();
            closeModal();
        }
    });
    modal.closeBtn.focus();
    refresh();
}
