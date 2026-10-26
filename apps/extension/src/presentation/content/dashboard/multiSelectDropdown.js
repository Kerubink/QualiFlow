export function initMultiSelectDropdown(rootEl, { placeholder, onChange }) {
    if (!rootEl) return null;

    const trigger = rootEl.querySelector('.qualiflow-multi-select-trigger');
    const labelEl = rootEl.querySelector('.qualiflow-multi-select-label');
    const panelEl = rootEl.querySelector('.qualiflow-multi-select-panel');
    if (!trigger || !labelEl || !panelEl) return null;

    let options = [];
    let selected = new Set();

    const updateLabel = () => {
        if (selected.size === 0) {
            labelEl.textContent = `${placeholder}: Todos`;
            return;
        }
        if (selected.size === 1) {
            labelEl.textContent = `${placeholder}: ${Array.from(selected)[0]}`;
            return;
        }
        labelEl.textContent = `${placeholder}: ${selected.size} selecionados`;
    };

    const renderOptions = () => {
        panelEl.innerHTML = '';
        options.forEach((value) => {
            const optionEl = document.createElement('label');
            optionEl.className = 'qualiflow-multi-select-option';

            const checkboxEl = document.createElement('input');
            checkboxEl.type = 'checkbox';
            checkboxEl.value = value;
            checkboxEl.checked = selected.has(value);

            checkboxEl.addEventListener('change', () => {
                if (checkboxEl.checked) selected.add(value);
                else selected.delete(value);
                updateLabel();
                onChange?.();
            });

            const textEl = document.createElement('span');
            textEl.textContent = value;

            optionEl.appendChild(checkboxEl);
            optionEl.appendChild(textEl);
            panelEl.appendChild(optionEl);
        });
        updateLabel();
    };

    trigger.setAttribute('aria-haspopup', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    const syncExpanded = () => trigger.setAttribute('aria-expanded', rootEl.classList.contains('is-open') ? 'true' : 'false');
    const close = () => {
        rootEl.classList.remove('is-open');
        syncExpanded();
    };
    const toggle = () => {
        const isOpen = rootEl.classList.contains('is-open');
        document.querySelectorAll('.qualiflow-multi-select.is-open').forEach((el) => {
            if (el !== rootEl) {
                el.classList.remove('is-open');
                el.querySelector('.qualiflow-multi-select-trigger')?.setAttribute('aria-expanded', 'false');
            }
        });
        rootEl.classList.toggle('is-open', !isOpen);
        syncExpanded();
    };

    trigger.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggle();
    });

    panelEl.addEventListener('click', (event) => event.stopPropagation());

    const onDocumentClick = (event) => {
        if (!rootEl.contains(event.target)) close();
    };
    document.addEventListener('click', onDocumentClick);

    return {
        setOptions: (nextOptions) => {
            options = [...new Set((nextOptions || []).filter(Boolean))];
            selected = new Set([...selected].filter((v) => options.includes(v)));
            renderOptions();
        },
        getSelectedValues: () => [...selected],
        setSelectedValues: (values) => {
            const next = new Set((values || []).filter((v) => options.includes(v)));
            selected = next;
            renderOptions();
        },
        destroy: () => {
            document.removeEventListener('click', onDocumentClick);
        }
    };
}
