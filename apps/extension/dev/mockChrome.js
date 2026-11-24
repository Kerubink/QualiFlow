/*
 * Simula chrome.storage e chrome.runtime.sendMessage (background) para o playground.
 * O runner real roda por cima; so o Azure e simulado. Importe este modulo ANTES dos modulos do runner.
 */
import { installPageProbe } from '../src/infrastructure/browser/pageProbe.js';

const STORE_PREFIX = 'qf-dev:';
const CONFIG_KEY = 'qf-dev-config';

export const DEFAULT_CONFIG = {
    latencyMs: 400,
    attachmentMode: 'success', // success | error | slow
    saveFails: false,
    bugFails: false,
    tcCount: 4
};

export const devConfig = { ...DEFAULT_CONFIG, ...readJson(CONFIG_KEY, {}) };
export const messageLog = [];
const subscribers = new Set();

function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

export function saveConfig() {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(devConfig));
}
export function subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); }
const notify = () => subscribers.forEach((fn) => fn());

export function resetDevState() {
    Object.keys(localStorage).filter((k) => k.startsWith(STORE_PREFIX)).forEach((k) => localStorage.removeItem(k));
}

// ---------------------------------------------------------------- storage
function storageGet(keys, cb) {
    const list = keys == null ? Object.keys(localStorage).filter((k) => k.startsWith(STORE_PREFIX)).map((k) => k.slice(STORE_PREFIX.length))
        : Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : Object.keys(keys);
    const out = {};
    list.forEach((k) => {
        const raw = localStorage.getItem(STORE_PREFIX + k);
        if (raw !== null) out[k] = JSON.parse(raw);
    });
    setTimeout(() => cb && cb(out), 0);
}
function storageSet(payload, cb) {
    Object.entries(payload).forEach(([k, v]) => localStorage.setItem(STORE_PREFIX + k, JSON.stringify(v)));
    setTimeout(() => cb && cb(), 0);
}
function storageRemove(keys, cb) {
    [].concat(keys).forEach((k) => localStorage.removeItem(STORE_PREFIX + k));
    setTimeout(() => cb && cb(), 0);
}

// ------------------------------------------------------------ dados falsos
export function buildTestCases(count) {
    const base = [
        {
            title: 'Cadastrar cliente com CPF válido',
            steps: [
                ['Abrir o formulário de cadastro', 'O formulário é exibido com todos os campos'],
                ['Preencher CPF, e-mail e telefone com dados válidos', 'Nenhum campo mostra mensagem de erro'],
                ['Clicar em Salvar', 'O cliente é gravado e uma confirmação é exibida']
            ]
        },
        {
            title: 'Validar CNPJ e CEP no cadastro de empresa',
            steps: [
                ['Informar um CNPJ válido', 'O campo aceita o valor e preenche a razão social'],
                ['Informar um CEP existente', 'O endereço é preenchido automaticamente']
            ]
        },
        {
            title: 'Rejeitar e-mail em formato inválido',
            steps: [
                ['Digitar "abc" no campo e-mail', 'É exibida a mensagem "E-mail inválido"'],
                ['Corrigir para um e-mail válido', 'A mensagem de erro desaparece'],
                ['Enviar o formulário', 'O envio é concluído']
            ]
        },
        {
            title: 'Exibir erro amigável quando o serviço está indisponível',
            steps: [
                ['Simular indisponibilidade do serviço', ''],
                ['Tentar salvar o cadastro', 'Uma mensagem clara é exibida, sem detalhes técnicos']
            ]
        }
    ];
    return Array.from({ length: count }, (_, i) => {
        const t = base[i % base.length];
        return {
            id: 18001 + i,
            title: i < base.length ? t.title : `${t.title} (variação ${Math.floor(i / base.length) + 1})`,
            steps: t.steps.map(([action, expected], idx) => ({ order: idx + 1, stepId: idx + 1, action, expected }))
        };
    });
}

/** "Print" falso de um sistema, com dados sensiveis para testar a ferramenta Ocultar. */
export function mockScreenshot() {
    const c = document.createElement('canvas');
    c.width = 1280; c.height = 720;
    const x = c.getContext('2d');
    x.fillStyle = '#eef1f6'; x.fillRect(0, 0, 1280, 720);
    x.fillStyle = '#1f3a5f'; x.fillRect(0, 0, 1280, 64);
    x.fillStyle = '#fff'; x.font = '600 22px sans-serif'; x.fillText('Sistema Fictício - Cadastro de clientes', 24, 40);
    x.fillStyle = '#fff'; x.fillRect(160, 120, 960, 480);
    x.strokeStyle = '#d5dbe5'; x.strokeRect(160, 120, 960, 480);
    x.fillStyle = '#111'; x.font = '600 20px sans-serif'; x.fillText('Dados do cliente', 190, 165);
    x.font = '16px sans-serif';
    [['Nome', 'Maria Souza Lima'], ['CPF', '123.456.789-09'], ['Cartão', '4111 1111 1111 1111'], ['E-mail', 'maria.lima@empresa.com'], ['Telefone', '(11) 98765-4321']]
        .forEach(([k, v], i) => {
            x.fillStyle = '#667'; x.fillText(k, 190, 215 + i * 52);
            x.fillStyle = '#111'; x.fillRect(300, 195 + i * 52, 420, 32); x.fillStyle = '#fff'; x.fillRect(301, 196 + i * 52, 418, 30);
            x.fillStyle = '#111'; x.fillText(v, 312, 217 + i * 52);
        });
    x.fillStyle = '#fdecea'; x.fillRect(190, 480, 900, 56);
    x.fillStyle = '#b3261e'; x.fillRect(190, 480, 6, 56);
    x.font = '600 16px sans-serif'; x.fillText('Erro 500: não foi possível salvar o cliente. Tente novamente.', 212, 514);
    return c.toDataURL('image/png');
}

// ---------------------------------------------------------- background fake
let attachmentSeq = 0;

function handle(msg) {
    switch (msg.action) {
        case 'GET_TEST_CASES_FOR_WORKITEM':
            return { data: buildTestCases(devConfig.tcCount) };
        case 'GET_WORK_ITEM_CRITERIA':
            return { data: {
                id: msg.workItemId, title: 'PBI de demonstração do playground', type: 'Product Backlog Item', url: '',
                acceptanceCriteria: '<div><b>Cenário 1:</b> cadastro válido</div><ul><li>Dado que o usuário preencheu todos os campos obrigatórios</li><li>Quando clicar em <i>Salvar</i></li><li>Então o cliente deve ser cadastrado e a mensagem "Cliente salvo" exibida</li></ul><div><b>Cenário 2:</b> CPF inválido</div><ol><li>O sistema deve bloquear o salvamento</li><li>A mensagem de erro deve aparecer abaixo do campo</li></ol><script>alert(1)</script>',
                description: '<p>Permitir cadastrar clientes pelo formulário.</p>'
            } };
        case 'GET_TEST_POINTS_FOR_TEST_CASES':
            return { data: [] }; // forca o caminho ad-hoc
        case 'CREATE_TEST_RUN':
            return { runId: 9001 };
        case 'ADD_ADHOC_RESULTS':
            return { data: (msg.testCaseIds || []).map((id, i) => ({ id: 5000 + i, testCaseId: id })) };
        case 'GET_RUN_RESULTS':
            return { data: [] };
        case 'UPDATE_TEST_RESULT':
            return devConfig.saveFails ? { error: 'Falha simulada ao salvar o resultado.' } : { success: true };
        case 'COMPLETE_TEST_RUN':
            return { success: true };
        case 'CREATE_BUG':
            return devConfig.bugFails ? { error: 'Falha simulada ao criar o bug.' } : { bugId: 7001, attachmentErrors: [] };
        case 'INSTALL_PAGE_PROBE':
            installPageProbe(); // a pagina do playground ja roda no contexto principal (MAIN world)
            return { ok: true };
        case 'ADD_ATTACHMENT':
            attachmentSeq += 1;
            return devConfig.attachmentMode === 'error'
                ? { error: 'Falha simulada no upload do anexo.' }
                : { ok: true, result: { id: `att-${attachmentSeq}` } };
        case 'EMULATE_VIEWPORT':
            return { ok: true };
        case 'CAPTURE_SCREENSHOT':
            return { dataUrl: mockScreenshot() };
        default:
            return { error: `Action sem mock no playground: ${msg.action}` };
    }
}

function delayFor(msg) {
    if (msg.action === 'ADD_ATTACHMENT' && devConfig.attachmentMode === 'slow') return 4000;
    return Number(devConfig.latencyMs) || 0;
}

function summarize(value) {
    return JSON.parse(JSON.stringify(value, (k, v) => {
        if (k === 'base64Content' && typeof v === 'string') return `<base64 ${v.length} caracteres>`;
        if (typeof v === 'string' && v.startsWith('data:image')) return `<imagem ${v.length} caracteres>`;
        return v;
    }));
}

const runtime = {
    id: 'qualiflow-playground',
    lastError: undefined,
    sendMessage(msg, cb) {
        const entry = { time: new Date(), action: msg.action, request: summarize(msg), response: null };
        messageLog.unshift(entry);
        if (messageLog.length > 100) messageLog.pop();
        notify();
        setTimeout(() => {
            const res = handle(msg);
            entry.response = summarize(res);
            notify();
            if (cb) cb(res);
        }, delayFor(msg));
    }
};

window.chrome = {
    runtime,
    storage: { local: { get: storageGet, set: storageSet, remove: storageRemove } }
};
