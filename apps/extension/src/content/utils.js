function htmlToPlainText(html) {
    if (!html) return '';
    try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const root = doc.body;
        const isBlockLike = (name) => ['p', 'div', 'section', 'article', 'blockquote'].includes(name);

        function normalizeText(text) {
            return String(text || '').replace(/\u00A0/g, ' ');
        }

        function toAlpha(num) {
            let n = num;
            let s = '';
            while (n > 0) {
                n -= 1;
                s = String.fromCharCode(97 + (n % 26)) + s;
                n = Math.floor(n / 26);
            }
            return s || 'a';
        }

        function toRoman(num) {
            const romans = [
                ['m', 1000], ['cm', 900], ['d', 500], ['cd', 400],
                ['c', 100], ['xc', 90], ['l', 50], ['xl', 40],
                ['x', 10], ['ix', 9], ['v', 5], ['iv', 4], ['i', 1]
            ];
            let value = num;
            let result = '';
            for (const [roman, weight] of romans) {
                while (value >= weight) {
                    result += roman;
                    value -= weight;
                }
            }
            return result || 'i';
        }

        function getListKind(listEl, depth) {
            const styleAttr = `${listEl.getAttribute('style') || ''} ${listEl.style?.listStyleType || ''}`.toLowerCase();
            if (styleAttr.includes('lower-alpha') || styleAttr.includes('upper-alpha')) return 'alpha';
            if (styleAttr.includes('lower-roman') || styleAttr.includes('upper-roman')) return 'roman';
            if (styleAttr.includes('decimal')) return 'numeric';
            if (depth === 1) return 'alpha';
            if (depth === 2) return 'roman';
            return 'numeric';
        }

        function renderMarker(kind, index) {
            if (kind === 'alpha') return `${toAlpha(index)}.`;
            if (kind === 'roman') return `${toRoman(index)}.`;
            return `${index}.`;
        }

        function extractText(node) {
            let text = '';
            node.childNodes.forEach(child => {
                if (child.nodeType === Node.TEXT_NODE) {
                    text += normalizeText(child.textContent);
                    return;
                }
                if (child.nodeType !== Node.ELEMENT_NODE) return;

                const name = child.nodeName.toLowerCase();
                if (name === 'br') {
                    text += '\n';
                    return;
                }
                if (name === 'ol' || name === 'ul') {
                    return;
                }
                if (isBlockLike(name)) {
                    const nested = extractText(child);
                    if (nested.trim()) text += `${nested.trim()}\n`;
                    return;
                }
                text += extractText(child);
            });
            return text;
        }

        function serializeList(listEl, depth = 0) {
            const kind = getListKind(listEl, depth);
            const children = Array.from(listEl.childNodes);
            let out = '';
            let index = 0;

            for (let i = 0; i < children.length; i++) {
                const child = children[i];

                if (child.nodeType === Node.TEXT_NODE) {
                    if (child.textContent.trim()) {
                        out += `${'  '.repeat(depth)}${normalizeText(child.textContent).trim()}\n`;
                    }
                    continue;
                }

                if (child.nodeType !== Node.ELEMENT_NODE) continue;

                const name = child.nodeName.toLowerCase();

                if (name === 'li') {
                    index += 1;
                    const text = extractText(child).replace(/\s+\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
                    out += `${'  '.repeat(depth)}${renderMarker(kind, index)} ${text}\n`;

                    const nestedLists = Array.from(child.childNodes).filter(n => n.nodeType === Node.ELEMENT_NODE && ['ol', 'ul'].includes(n.nodeName.toLowerCase()));
                    for (const nested of nestedLists) {
                        out += serializeList(nested, depth + 1);
                    }
                    continue;
                }

                if (name === 'ol' || name === 'ul') {
                    out += serializeList(child, depth + 1);
                    continue;
                }

                if (isBlockLike(name)) {
                    const blockText = extractText(child).trim();
                    if (blockText) {
                        out += `${'  '.repeat(depth)}${blockText}\n`;
                    }
                    continue;
                }

                const otherText = extractText(child).trim();
                if (otherText) out += `${'  '.repeat(depth)}${otherText}\n`;
            }

            return out;
        }

        function serializeNode(node, depth = 0) {
            let out = '';
            node.childNodes.forEach(child => {
                if (child.nodeType === Node.TEXT_NODE) {
                    const text = normalizeText(child.textContent).trim();
                    if (text) out += `${'  '.repeat(depth)}${text}\n`;
                    return;
                }
                if (child.nodeType !== Node.ELEMENT_NODE) return;

                const name = child.nodeName.toLowerCase();
                if (name === 'br') {
                    out += '\n';
                    return;
                }
                if (name === 'ol' || name === 'ul') {
                    out += serializeList(child, depth);
                    return;
                }
                if (isBlockLike(name)) {
                    const block = serializeNode(child, depth).trim();
                    if (block) out += `${block}\n\n`;
                    return;
                }
                out += serializeNode(child, depth);
            });
            return out;
        }

        return serializeNode(root)
            .replace(/\r\n?/g, '\n')
            .replace(/[ \t]+$/gm, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    } catch (e) {
        return html.replace(/<[^>]+>/g, '').trim();
    }
}
function extractWorkItemId() {
    const provider = detectBoardProvider();

    if (provider === 'jira') {
        const jiraMatch = window.location.pathname.match(/\/browse\/([A-Z0-9]+-\d+)/i) ||
            window.location.search.match(/[?&]selectedIssue=([A-Z0-9]+-\d+)/i);
        if (jiraMatch && jiraMatch[1]) {
            return jiraMatch[1].toUpperCase();
        }
        return null;
    }

    // Azure DevOps URLs usually look like:
    // https://dev.azure.com/Org/Project/_workitems/edit/12345
    const azureMatch = window.location.href.match(/_workitems\/edit\/(\d+)/) ||
        window.location.href.match(/[?&]id=(\d+)/) ||
        window.location.href.match(/[?&]workitem=(\d+)/);
    if (azureMatch && azureMatch[1]) {
        return azureMatch[1];
    }
    return null;
}

function detectBoardProvider() {
    const host = (window.location.hostname || '').toLowerCase();
    if (host.includes('atlassian.net')) return 'jira';
    if (host.includes('dev.azure.com') || host.includes('visualstudio.com')) return 'azure';
    return 'azure';
}

globalThis.detectBoardProvider = detectBoardProvider;

function safeGetElement(id) {
    const el = document.getElementById(id);
    if (!el) {
        console.warn(`Elemento não encontrado: ${id}`);
    }
    return el;
}
function parseStepsFromText(text) {
    return text.split('\\n')
        .filter(line => line.trim() !== '')
        .map(line => {
            const parts = line.split('||');
            let actionText = parts[0] ? parts[0].trim() : '';
            const needsEvidence = actionText.includes('[EV]');
            if (needsEvidence) actionText = actionText.replace('[EV]', '').trim();

            return {
                action: actionText,
                expected: parts[1] ? parts[1].trim() : '',
                needs_evidence: needsEvidence
            };
        });
}
function extractScenarioParams(sc) {
    const textToScan = `${sc.title || ''} ${sc.bdd_description || ''} ${sc.steps.map(s => `${s.action || ''} ${s.expected || ''}`).join(' ')} `;
    return [...new Set((textToScan.match(/@\w+/g) || []).map(p => p.trim()))];
}
function ensureScenarioParamsDefault(sc) {
    const paramNames = extractScenarioParams(sc);
    if (paramNames.length === 0) return;

    sc.parameters = sc.parameters || {};
    for (const pName of paramNames) {
        if (!sc.parameters[pName] || sc.parameters[pName].trim() === '') {
            sc.parameters[pName] = '###';
        }
    }
}

function sendRuntimeMessage(message, callback) {
    const bridge = globalThis.qualiflowBridge;
    const runtime = globalThis.chrome && chrome.runtime;

    const sendThroughRuntime = (onResult) => {
        runtime.sendMessage(message, (response) => {
            const lastError = runtime.lastError;
            if (lastError) {
                onResult({ error: lastError.message });
                return;
            }
            onResult(response);
        });
    };

    if (bridge && typeof bridge.sendRuntimeMessage === 'function') {
        if (typeof callback === 'function') {
            bridge.sendRuntimeMessage(message, callback);
            return;
        }

        return new Promise((resolve, reject) => {
            bridge.sendRuntimeMessage(message, (response) => {
                if (response && response.error) {
                    reject(new Error(response.error));
                    return;
                }
                resolve(response);
            });
        });
    }

    if (!runtime || typeof runtime.sendMessage !== 'function') {
        const error = new Error('API da extensão indisponível neste contexto. Recarregue a página.');
        if (typeof callback === 'function') {
            callback({ error: error.message });
            return;
        }
        return Promise.reject(error);
    }

    if (typeof callback === 'function') {
        try {
            sendThroughRuntime(callback);
        } catch (err) {
            callback({ error: err.message });
        }
        return;
    }

    return new Promise((resolve, reject) => {
        sendThroughRuntime((response) => {
            if (response && response.error) {
                reject(new Error(response.error));
                return;
            }
            resolve(response);
        });
    });
}

globalThis.htmlToPlainText = htmlToPlainText;
globalThis.extractWorkItemId = extractWorkItemId;
globalThis.safeGetElement = safeGetElement;
globalThis.sendRuntimeMessage = sendRuntimeMessage;
globalThis.parseStepsFromText = parseStepsFromText;
globalThis.ensureScenarioParamsDefault = ensureScenarioParamsDefault;
