// Leitura dos campos do formulario de geracao (compartilhado por geracao e adaptacao).

export function readAcceptanceCriteria() {
    return (document.getElementById('qualiflow-acceptance-criteria') && document.getElementById('qualiflow-acceptance-criteria').value) || '';
}

export function readGenerationForm() {
    return {
        userFocus: document.getElementById('qualiflow-user-focus').value,
        technicalDetail: document.getElementById('qualiflow-technical-detail').value,
        generationSettings: {
            objective: document.getElementById('qualiflow-select-objective').value,
            type: document.getElementById('qualiflow-select-type').value,
            granularity: document.getElementById('qualiflow-select-granularity').value,
            dataLevel: document.getElementById('qualiflow-select-data').value
        }
    };
}
