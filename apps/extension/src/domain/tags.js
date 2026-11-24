// Tags de um cenario: o Azure guarda "a; b; c" em System.Tags; na UI trabalhamos com lista.

export function parseTags(value) {
    const raw = Array.isArray(value) ? value : String(value || '').split(';');
    return normalizeTagList(raw);
}

// Remove vazios e duplicatas (sem diferenciar maiusculas), preservando a ordem.
export function normalizeTagList(list) {
    const seen = new Set();
    const out = [];
    for (const item of list || []) {
        const tag = String(item ?? '').trim();
        const key = tag.toLowerCase();
        if (!tag || seen.has(key)) continue;
        seen.add(key);
        out.push(tag);
    }
    return out;
}

// Sugestoes para o campo: tags do board ainda nao escolhidas, filtradas pelo texto digitado.
export function suggestTags(available, selected, query = '', limit = 50) {
    const chosen = new Set(parseTags(selected).map((t) => t.toLowerCase()));
    const q = String(query || '').trim().toLowerCase();
    return normalizeTagList(available)
        .filter((t) => !chosen.has(t.toLowerCase()) && (!q || t.toLowerCase().includes(q)))
        .slice(0, limit);
}
