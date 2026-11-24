/*
 * Fontes de captura de evidencia (todas devolvem um data URL PNG ou lancam Error):
 *  - aba atual            -> captureVisibleTab via background (so o conteudo do navegador)
 *  - tela / janela / aba  -> getDisplayMedia (qualquer aplicativo do sistema)
 *  - area de transferencia -> imagem colada (Ctrl+V) ou lida pela Clipboard API
 *  - arquivo de imagem    -> seletor de arquivos
 */
import { sendRuntimeMessage } from '../shared/runtime.js';
import { RuntimeActions } from '../../../contracts/runtimeActions.js';
import { hideQualiFlowUiForCapture, showQualiFlowUiAfterCapture, waitForUiHidden } from './screenCapture.js';

export function captureBrowserTab() {
    return new Promise((resolve, reject) => {
        hideQualiFlowUiForCapture();
        waitForUiHidden().then(() => {
            sendRuntimeMessage({ action: RuntimeActions.CAPTURE_SCREENSHOT }, (res) => {
                if (!res || res.error || !res.dataUrl) {
                    showQualiFlowUiAfterCapture();
                    reject(new Error(res?.error || 'Sem resposta do navegador.'));
                    return;
                }
                resolve(res.dataUrl);
            });
        });
    });
}

function waitForVideoFrame(video) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Tempo esgotado ao obter a imagem da tela.')), 8000);
        const done = () => { clearTimeout(timeout); resolve(); };
        if (typeof video.requestVideoFrameCallback === 'function') video.requestVideoFrameCallback(done);
        else setTimeout(done, 300);
    });
}

/**
 * Abre o seletor nativo do navegador (tela inteira, janela de outro aplicativo ou aba),
 * captura UM quadro e encerra o compartilhamento.
 */
export async function captureDisplay() {
    if (!navigator.mediaDevices?.getDisplayMedia) {
        throw new Error('Este navegador não permite capturar telas ou janelas.');
    }
    let stream;
    try {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 5 }, audio: false });
    } catch (e) {
        if (e && (e.name === 'NotAllowedError' || e.name === 'AbortError')) {
            const err = new Error('Captura cancelada.');
            err.cancelled = true;
            throw err;
        }
        throw e;
    }

    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    try {
        // Esconde os paineis do QualiFlow para que nao aparecam se a fonte for esta aba/tela.
        hideQualiFlowUiForCapture();
        await video.play();
        await waitForUiHidden();
        await waitForVideoFrame(video);
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (!w || !h) throw new Error('A fonte escolhida não retornou imagem.');
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(video, 0, 0, w, h);
        return canvas.toDataURL('image/png');
    } catch (e) {
        showQualiFlowUiAfterCapture();
        throw e;
    } finally {
        stream.getTracks().forEach((t) => t.stop());
        video.srcObject = null;
    }
}

function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('Falha ao ler a imagem.'));
        reader.readAsDataURL(blob);
    });
}

/** Extrai a primeira imagem de um evento `paste`; retorna null se nao houver. */
export async function imageFromPasteEvent(event) {
    const items = event.clipboardData?.items || [];
    for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
            const blob = item.getAsFile();
            if (blob) return blobToDataUrl(blob);
        }
    }
    return null;
}

/** Le a imagem da area de transferencia pelo botao (pode exigir permissao do navegador). */
export async function readClipboardImage() {
    if (!navigator.clipboard?.read) throw new Error('Use Ctrl+V para colar a imagem.');
    let entries;
    try {
        entries = await navigator.clipboard.read();
    } catch {
        throw new Error('Permissão negada. Use Ctrl+V para colar a imagem.');
    }
    for (const entry of entries) {
        const type = entry.types.find((t) => t.startsWith('image/'));
        if (type) return blobToDataUrl(await entry.getType(type));
    }
    throw new Error('Nenhuma imagem na área de transferência. Copie um print e tente novamente.');
}

export function pickImageFile() {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.style.display = 'none';
        input.addEventListener('change', async () => {
            const file = input.files && input.files[0];
            input.remove();
            resolve(file ? await blobToDataUrl(file) : null);
        });
        input.addEventListener('cancel', () => { input.remove(); resolve(null); });
        document.body.appendChild(input);
        input.click();
    });
}
