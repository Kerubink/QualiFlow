// Playground: instala o chrome falso, semeia uma sessao e carrega o runner real.
import { DEFAULT_CONFIG, devConfig, messageLog, resetDevState, saveConfig, subscribe } from './mockChrome.js';

const $ = (sel) => document.querySelector(sel);

// --- sessao fictica + projeto do runner (faz o main.js injetar FAB e autofill)
await new Promise((resolve) => chrome.storage.local.set({
    runnerEnabled: true,
    runnerProjects: [{ name: 'Playground', url: `${location.origin}/` }],
    runnerActiveSession: { workItemId: 12345, workItemTitle: 'PBI de demonstração do playground', timestamp: Date.now() }
}, resolve));

await import('../src/presentation/content/runner/main.js');
const { openRunnerWindow } = await import('../src/presentation/content/runner/runnerWindow.js');
$('#open-runner').addEventListener('click', openRunnerWindow);

// --- opcoes do mock
const bind = (sel, key, kind) => {
    const el = $(sel);
    if (kind === 'check') el.checked = !!devConfig[key]; else el.value = devConfig[key];
    el.addEventListener('change', () => {
        devConfig[key] = kind === 'check' ? el.checked : kind === 'number' ? Number(el.value) : el.value;
        saveConfig();
    });
};
bind('#o-tc', 'tcCount', 'number');
bind('#o-lat', 'latencyMs', 'number');
bind('#o-att', 'attachmentMode');
bind('#o-save', 'saveFails', 'check');
bind('#o-bug', 'bugFails', 'check');

$('#reset').addEventListener('click', () => {
    Object.assign(devConfig, DEFAULT_CONFIG);
    saveConfig();
    resetDevState();
    location.reload();
});

// --- log de mensagens
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
function renderLog() {
    $('#log-count').textContent = String(messageLog.length);
    $('#log').innerHTML = messageLog.map((m) => {
        const failed = m.response && m.response.error;
        const json = esc(JSON.stringify({ requisicao: m.request, resposta: m.response ?? 'aguardando...' }, null, 2))
            .replace(/(&quot;|")durationMs(&quot;|")/g, '<span class="dur">"durationMs"</span>');
        const t = m.time.toLocaleTimeString('pt-BR');
        return `<details><summary><span class="act${failed ? ' err' : ''}">${esc(m.action)}</span> <small>${t}${failed ? ' - erro' : ''}</small></summary><pre>${json}</pre></details>`;
    }).join('') || '<small>Nenhuma mensagem ainda.</small>';
}
subscribe(renderLog);
renderLog();

// --- campos de demonstracao
$('#add-dynamic').addEventListener('click', () => {
    const n = $('#dynamic-area').children.length + 1;
    const div = document.createElement('div');
    div.className = 'field';
    div.innerHTML = `<label>CPF dinâmico ${n}</label><input name="cpfDinamico${n}">`;
    $('#dynamic-area').appendChild(div);
});

// Mascara de CPF em JS: reformata a cada input e expoe os digitos ao lado.
const masked = $('#f-masked');
masked.addEventListener('input', () => {
    const d = masked.value.replace(/\D/g, '').slice(0, 11);
    const f = d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1-$2');
    if (masked.value !== f) masked.value = f;
    $('#f-masked-out').value = d;
});

// --- geradores de erro para a sonda de console/rede
$('#gen-console').addEventListener('click', () => console.error('Falha ao carregar o cliente (erro simulado do playground)'));
$('#gen-warn').addEventListener('click', () => console.warn('Campo obsoleto: usar "documento" (aviso simulado)'));
$('#gen-throw').addEventListener('click', () => { setTimeout(() => { throw new Error('Exceção não tratada simulada'); }, 0); });
$('#gen-404').addEventListener('click', () => { fetch('/dev/api/clientes?token=segredo123&page=2').catch(() => {}); });
$('#gen-net').addEventListener('click', () => { fetch('http://127.0.0.1:1/offline').catch(() => {}); });
