/*
 * Barra de ferramentas de UI/UX: janela flutuante propria (fora do HUB) com regua, conta-gotas, overlay de design,
 * acessibilidade, desempenho e o depurador CSS. Os resultados aparecem abaixo da barra.
 */
import { escapeHtml } from '../dashboard/helpers.js';
import { copyText } from './envInfo.js';
import { showToast } from './toast.js';
import { setupDrag } from './helpers.js';
import { setStorage } from '../shared/runtime.js';
import { disableCssDebug, enableCssDebug, isCssDebugEnabled } from './cssDebug.js';
import {
    closeDesignOverlay, collectPerformance, highlightElement, isDesignOverlayOn, isRulerOn, openDesignOverlay,
    pickDesignImageFile, pickScreenColor, scanAccessibility, startRuler, stopRuler
} from './uiTools.js';
import { breakpointName, formatBytes, rateMetric } from '../../../domain/uiChecks.js';
import { VIEWPORT_PRESETS, summarizePerfLog } from '../../../domain/uiInsights.js';
import { applyViewportPreset, collectPageStyles, isEmulating, restoreViewport, viewportInfo } from './uiInspect.js';
import { clearPerfLog, readPerfLog, setPerfAuto } from './perfLog.js';
import { getStorage } from '../shared/runtime.js';

const RULE_LABELS = {
    'html-lang': 'Idioma do documento',
    'img-alt': 'Imagens sem alt',
    'input-label': 'Campos sem rótulo',
    'button-name': 'Botões sem nome',
    'link-name': 'Links sem nome',
    contrast: 'Contraste insuficiente'
};

let colorHex = null;
let a11y = null;
let perf = null;
let styles = null;
let responsive = false;
let perfLog = [];
let perfAuto = false;

// Secoes de resultado que o QA pode recolher/expandir (abrem ao rodar a ferramenta).
const folds = { a11y: true, perf: true, styles: true, responsive: true };
const fold = (key, title, summary, body) => `<div class="qualiflow-uifold">
    <button type="button" class="qualiflow-uifold-head" data-ui-fold="${key}" aria-expanded="${folds[key] ? 'true' : 'false'}">
        <span class="qualiflow-uifold-chevron" aria-hidden="true"></span><span class="qualiflow-uifold-title">${title}</span><span class="qualiflow-uifold-sum">${escapeHtml(summary)}</span>
    </button>
    <div class="qualiflow-uifold-body"${folds[key] ? '' : ' hidden'}>${body}</div></div>`;

const ms = (v) => (v === null || v === undefined ? '--' : `${Math.round(v)} ms`);
const rated = (name, v, text) => `<span class="qualiflow-hub-rate is-${rateMetric(name, v) || 'none'}">${text}</span>`;

function perfHistoryHtml() {
    const sum = summarizePerfLog(perfLog);
    const rows = perfLog.slice(0, 8).map((e) => `<tr><td>${new Date(e.at).toLocaleTimeString('pt-BR')}</td><td>${rated('LCP', e.lcp, ms(e.lcp))}</td><td>${ms(e.ttfb)}</td><td>${ms(e.load)}</td></tr>`).join('');
    return `<label class="qualiflow-uistyle-check"><input type="checkbox" data-ui-perfauto${perfAuto ? ' checked' : ''}> Registrar a cada carregamento de página</label>
        ${perfLog.length ? `<div class="qualiflow-hub-subhead">Histórico (${sum.count}) &middot; mediana LCP ${ms(sum.lcp)}, TTFB ${ms(sum.ttfb)} <button type="button" class="qualiflow-hub-link" data-ui-perfclear>Limpar</button></div>
        <table class="qualiflow-uistyle-table"><thead><tr><th>Hora</th><th>LCP</th><th>TTFB</th><th>Load</th></tr></thead><tbody>${rows}</tbody></table>` : ''}`;
}

function renderResults() {
    let html = '';
    if (colorHex) {
        html += `<div class="qualiflow-hub-color"><span class="qualiflow-hub-swatch" style="background:${escapeHtml(colorHex)}"></span><code>${escapeHtml(colorHex)}</code><button type="button" class="qualiflow-hub-link" data-ui-copy="${escapeHtml(colorHex)}">Copiar</button></div>`;
    }
    if (a11y) {
        const total = a11y.issues.length;
        let body = '<div class="qualiflow-hub-muted">Verificação básica (não considera imagens/gradientes de fundo).</div>';
        if (total) {
            body += `<ul class="qualiflow-hub-counts">${Object.entries(a11y.counts).map(([r, n]) => `<li>${escapeHtml(RULE_LABELS[r] || r)}: <b>${n}</b></li>`).join('')}</ul>`;
            body += `<ul class="qualiflow-hub-issues">${a11y.issues.slice(0, 15).map((i, idx) => `<li><button type="button" class="qualiflow-hub-link" data-ui-issue="${idx}">${escapeHtml(i.label)}</button><code>${escapeHtml(i.selector)}</code></li>`).join('')}</ul>`;
            if (total > 15) body += `<div class="qualiflow-hub-muted">... e mais ${total - 15}.</div>`;
        }
        html += fold('a11y', 'Acessibilidade', total === 0 ? 'nenhum problema' : `${total} problema(s)`, body);
    }
    if (perf) {
        const body = `<dl class="qualiflow-hub-grid">
            <div class="qualiflow-hub-kv"><dt>TTFB</dt><dd>${rated('TTFB', perf.ttfb, ms(perf.ttfb))}</dd></div>
            <div class="qualiflow-hub-kv"><dt>FCP</dt><dd>${rated('FCP', perf.fcp, ms(perf.fcp))}</dd></div>
            <div class="qualiflow-hub-kv"><dt>LCP</dt><dd>${rated('LCP', perf.lcp, ms(perf.lcp))}</dd></div>
            <div class="qualiflow-hub-kv"><dt>CLS</dt><dd>${rated('CLS', perf.cls, perf.cls.toFixed(3))}</dd></div>
            <div class="qualiflow-hub-kv"><dt>DOMContentLoaded</dt><dd>${ms(perf.domContentLoaded)}</dd></div>
            <div class="qualiflow-hub-kv"><dt>Load</dt><dd>${ms(perf.load)}</dd></div>
            <div class="qualiflow-hub-kv"><dt>Recursos</dt><dd>${perf.resources} (${formatBytes(perf.transfer)})</dd></div></dl>
            <div class="qualiflow-hub-muted">Mede o carregamento inicial desta página. Após recarregar, rode de novo.</div>
            ${perfHistoryHtml()}`;
        html += fold('perf', 'Desempenho', `LCP ${ms(perf.lcp)}`, body);
    }
    if (responsive) {
        const vp = viewportInfo();
        const body = `<div class="qualiflow-hub-muted">Área útil atual: <b>${vp.width} × ${vp.height}</b> (${escapeHtml(breakpointName(vp.width))}).</div>
            <div class="qualiflow-hub-actions-row">${VIEWPORT_PRESETS.map((p) => `<button type="button" class="qualiflow-hub-btn" data-ui-vp="${p.key}">${p.label} ${p.width}</button>`).join('')}
            <button type="button" class="qualiflow-hub-btn" data-ui-vp="restore"${isEmulating() ? '' : ' disabled'}>Restaurar</button></div>
            <div class="qualiflow-hub-muted">Emula o tamanho de tela nesta aba (as media queries do site reagem de verdade); celular e tablet também simulam toque. O Chrome mostra a faixa "depurando este navegador" enquanto estiver ativo; use Restaurar para encerrar. O runner também fica nessa área útil.</div>`;
        html += fold('responsive', 'Responsividade', `${vp.width} × ${vp.height}`, body);
    }
    if (styles) {
        const list = (items, swatch) => (items.length
            ? `<ul class="qualiflow-uistyle-list">${items.map((i) => `<li>${swatch ? `<span class="qualiflow-hub-swatch" style="background:${escapeHtml(i.value)}"></span>` : ''}<code>${escapeHtml(i.value)}</code><span class="qualiflow-hub-muted">${i.count}×</span>${swatch ? `<button type="button" class="qualiflow-hub-link" data-ui-copy="${escapeHtml(i.value)}">Copiar</button>` : ''}</li>`).join('')}</ul>`
            : '<div class="qualiflow-hub-muted">Nada encontrado.</div>');
        const body = `<div class="qualiflow-hub-subhead">Fontes</div>${list(styles.fonts, false)}
            <div class="qualiflow-hub-subhead">Tamanhos</div>${list(styles.sizes, false)}
            <div class="qualiflow-hub-subhead">Cores de texto</div>${list(styles.textColors, true)}
            <div class="qualiflow-hub-subhead">Cores de fundo</div>${list(styles.backgroundColors, true)}
            <div class="qualiflow-hub-muted">Amostra de ${styles.sampled} elementos visíveis.</div>`;
        html += fold('styles', 'Fontes e cores', `${styles.fonts.length} fontes, ${styles.textColors.length + styles.backgroundColors.length} cores`, body);
    }
    return html;
}

const PANEL_ID = 'qualiflow-uitoolbar';
const BTN_ID = 'qualiflow-runner-uitools';

const ICONS = {
    ruler: '<path d="M3 17L17 3l4 4L7 21z"></path><path d="M7 13l2 2M10 10l2 2M13 7l2 2"></path>',
    eyedropper: '<path d="M2 22l1-1h3l9-9-3-3-9 9v3z"></path><path d="M15 6l3-3 3 3-3 3"></path>',
    design: '<rect x="3" y="3" width="14" height="14" rx="2"></rect><rect x="9" y="9" width="12" height="12" rx="2"></rect>',
    a11y: '<circle cx="12" cy="4.5" r="1.8"></circle><path d="M4 8h16M12 8v6m0 0l-3 6m3-6l3 6"></path>',
    perf: '<path d="M12 14l4-6"></path><path d="M3.3 17a9 9 0 1117.4 0"></path>',
    css: '<path d="M8 6L3 12l5 6M16 6l5 6-5 6"></path>',
    styles: '<path d="M4 20l4-1 11-11-3-3L5 16z"></path><path d="M14 6l3 3"></path>',
    responsive: '<rect x="2" y="4" width="14" height="11" rx="1"></rect><rect x="14" y="9" width="8" height="12" rx="1"></rect>'
};
const icon = (k) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k]}</svg>`;
const tool = (key, label, title) => `<button type="button" class="qualiflow-uitool" data-ui-tool="${key}" aria-pressed="false" title="${title}">${icon(key)}<span>${label}</span></button>`;

export function isUiToolbarOpen() {
    return !!document.getElementById(PANEL_ID);
}

function syncButton() {
    document.getElementById(BTN_ID)?.setAttribute('aria-pressed', isUiToolbarOpen() ? 'true' : 'false');
}

export function toggleUiToolbar() {
    if (isUiToolbarOpen()) closeUiToolbar(); else openUiToolbar();
}

export function closeUiToolbar() {
    document.getElementById(PANEL_ID)?.remove();
    syncButton();
}

function openUiToolbar() {
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.className = 'qualiflow-root qualiflow-hub qualiflow-uitoolbar';
    panel.setAttribute('role', 'toolbar');
    panel.setAttribute('aria-label', 'Ferramentas de UI e UX');
    panel.innerHTML = `
        <div class="qualiflow-hub-head" id="qualiflow-uitoolbar-head">
            <span class="qualiflow-hub-title">Ferramentas de UI/UX</span>
            <button type="button" class="qualiflow-close" id="qualiflow-uitoolbar-close" aria-label="Fechar ferramentas" title="Fechar">&times;</button>
        </div>
        <div class="qualiflow-uitoolbar-bar">
            ${tool('ruler', 'Régua', 'Mede distâncias em pixels (arraste na página)')}
            ${tool('eyedropper', 'Conta-gotas', 'Captura a cor de qualquer pixel da tela')}
            ${tool('design', 'Overlay', 'Sobrepõe uma imagem de design à página')}
            ${tool('a11y', 'Acessibilidade', 'Verifica alt, rótulos, nomes e contraste')}
            ${tool('perf', 'Desempenho', 'Core Web Vitals e tempos de carregamento')}
            ${tool('css', 'Depurador CSS', 'Contorno nos elementos; Alt+clique copia o seletor')}
            ${tool('responsive', 'Responsivo', 'Redimensiona a janela para tamanhos de celular, tablet e desktop')}
            ${tool('styles', 'Fontes e cores', 'Lista as fontes, tamanhos e cores usados na página')}
        </div>
        <div class="qualiflow-hub-body"><div id="qualiflow-hub-tool-out"></div></div>`;
    document.body.appendChild(panel);
    panel.style.left = '24px';
    panel.style.top = '72px';
    setupDrag(panel, panel.querySelector('#qualiflow-uitoolbar-head'));
    panel.querySelector('#qualiflow-uitoolbar-close').addEventListener('click', closeUiToolbar);
    wireTools(panel);
    syncButton();
}

function wireTools(container) {
    const paint = () => {
        const out = container.querySelector('#qualiflow-hub-tool-out');
        if (out) out.innerHTML = renderResults();
        const press = (k, on) => container.querySelector(`[data-ui-tool="${k}"]`)?.setAttribute('aria-pressed', on ? 'true' : 'false');
        press('ruler', isRulerOn());
        press('design', isDesignOverlayOn());
        press('css', isCssDebugEnabled());
    };
    const loadPerf = () => {
        getStorage(['runnerPerfAuto'], (d) => { perfAuto = d.runnerPerfAuto === true; });
        readPerfLog((log) => { perfLog = log; if (container.isConnected && perf) paint(); });
    };
    loadPerf();
    paint();

    const onToolsChanged = () => { if (container.isConnected) { loadPerf(); paint(); } };
    document.addEventListener('qualiflow:tools-changed', onToolsChanged);

    container.addEventListener('change', (e) => {
        if (e.target.matches('[data-ui-perfauto]')) { perfAuto = e.target.checked; setPerfAuto(perfAuto); }
    });
    container.addEventListener('click', async (e) => {
        const vpBtn = e.target.closest('[data-ui-vp]');
        if (vpBtn) {
            const key = vpBtn.dataset.uiVp;
            try {
                if (key === 'restore') {
                    await restoreViewport();
                    showToast('Tamanho de tela restaurado.', { kind: 'success', timeout: 2000 });
                } else {
                    const preset = VIEWPORT_PRESETS.find((p) => p.key === key);
                    const res = await applyViewportPreset(preset);
                    await new Promise((r) => setTimeout(r, 400));
                    const vp = viewportInfo();
                    if (Math.abs(vp.width - preset.width) <= 2) {
                        showToast(`Área útil: ${vp.width} × ${vp.height}.`, { kind: 'success', timeout: 2500 });
                    } else {
                        showToast(`A emulação não mudou a página: ela segue com ${vp.width}px (depuração leu ${res?.innerWidth ?? 'nada'}px; etapas: ${JSON.stringify(res?.steps ?? 'sem retorno do background')}). Feche o DevTools desta aba, clique em Restaurar e tente de novo.`, { kind: 'warn', timeout: 15000 });
                    }
                }
            } catch (err) {
                showToast(err.message, { kind: 'warn', timeout: 6000 });
            }
            paint();
            return;
        }
        if (e.target.closest('[data-ui-perfclear]')) { clearPerfLog(() => { perfLog = []; paint(); }); return; }
        const foldBtn = e.target.closest('[data-ui-fold]');
        if (foldBtn) { folds[foldBtn.dataset.uiFold] = !folds[foldBtn.dataset.uiFold]; paint(); return; }
        const copyBtn = e.target.closest('[data-ui-copy]');
        if (copyBtn) { copyText(copyBtn.dataset.uiCopy).then(() => showToast('Copiado.', { kind: 'success', timeout: 2000 })); return; }
        const issueBtn = e.target.closest('[data-ui-issue]');
        if (issueBtn && a11y) { highlightElement(a11y.issues[Number(issueBtn.dataset.uiIssue)]?.el); return; }
        const btn = e.target.closest('[data-ui-tool]');
        if (!btn) return;
        switch (btn.dataset.uiTool) {
            case 'ruler':
                if (isRulerOn()) stopRuler(); else startRuler();
                break;
            case 'eyedropper':
                try {
                    const hex = await pickScreenColor();
                    if (hex) colorHex = hex;
                } catch (err) {
                    showToast(err.message, { kind: 'warn' });
                }
                break;
            case 'design':
                if (isDesignOverlayOn()) { closeDesignOverlay(); break; }
                {
                    const dataUrl = await pickDesignImageFile();
                    if (dataUrl) openDesignOverlay(dataUrl);
                }
                break;
            case 'css':
                if (isCssDebugEnabled()) disableCssDebug(); else enableCssDebug();
                setStorage({ runnerCssDebug: isCssDebugEnabled() });
                break;
            case 'responsive':
                responsive = true;
                folds.responsive = true;
                break;
            case 'styles':
                styles = collectPageStyles();
                folds.styles = true;
                break;
            case 'a11y':
                a11y = scanAccessibility();
                folds.a11y = true;
                break;
            case 'perf':
                perf = collectPerformance();
                folds.perf = true;
                break;
        }
        paint();
    });
}
