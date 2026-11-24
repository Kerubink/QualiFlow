/* Ferramentas de inspecao: amostragem de fontes/cores da pagina e redimensionamento da janela (responsividade). */
import { sendRuntimeMessage } from '../shared/runtime.js';
import { RuntimeActions } from '../../../contracts/runtimeActions.js';
import { summarizeStyles } from '../../../domain/uiInsights.js';

const MAX_ELEMENTS = 1500;

/** Amostra o estilo computado dos elementos visiveis (fora da UI do QualiFlow) e resume fontes e cores. */
export function collectPageStyles() {
    const samples = [];
    const all = document.body.querySelectorAll('*');
    for (let i = 0; i < all.length && samples.length < MAX_ELEMENTS; i += 1) {
        const el = all[i];
        if (el.closest('.qualiflow-root') || ['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'PATH'].includes(el.tagName.toUpperCase())) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none') continue;
        // fonte e cor de texto so contam em elementos que tem texto proprio
        const hasText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.nodeValue.trim());
        samples.push({
            fontFamily: hasText ? cs.fontFamily : '',
            fontSize: hasText ? cs.fontSize : '',
            fontWeight: cs.fontWeight,
            color: hasText ? cs.color : 'transparent',
            background: cs.backgroundColor
        });
    }
    return { ...summarizeStyles(samples), sampled: samples.length };
}

export function viewportInfo() {
    return { width: window.innerWidth, height: window.innerHeight };
}

let emulating = false;

export function isEmulating() {
    return emulating;
}

function emulate(payload) {
    return new Promise((resolve, reject) => {
        sendRuntimeMessage({ action: RuntimeActions.EMULATE_VIEWPORT, ...payload }, (res) => {
            if (!res || res.error) reject(new Error(res?.error || 'Falha ao emular o tamanho de tela.'));
            else resolve(res);
        });
    });
}

/** Emula a area util do preset na aba atual (media queries reais, sem redimensionar a janela). */
export async function applyViewportPreset(preset) {
    const res = await emulate({ width: preset.width, height: preset.height, mobile: !!preset.mobile });
    emulating = true;
    return res;
}

export async function restoreViewport() {
    await emulate({ clear: true });
    emulating = false;
}
