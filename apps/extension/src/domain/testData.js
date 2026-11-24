/*
 * Dados de teste brasileiros para autopreenchimento de formularios no runner.
 * Modulo PURO: sem DOM, sem chrome.*. O gerador de aleatoriedade e injetavel (rng)
 * para permitir testes deterministas.
 */

export const FIELD_KINDS = Object.freeze({
    CPF: 'cpf',
    CNPJ: 'cnpj',
    RG: 'rg',
    CEP: 'cep',
    EMAIL: 'email',
    PHONE: 'phone',
    NAME: 'name',
    BIRTH: 'birth',
    PASSWORD: 'password',
    CARD: 'card',
    CNH: 'cnh',
    PIS: 'pis'
});

export const FIELD_KIND_LABELS = Object.freeze({
    cpf: 'CPF',
    cnpj: 'CNPJ',
    rg: 'RG',
    cep: 'CEP',
    email: 'E-mail',
    phone: 'Telefone',
    name: 'Nome completo',
    birth: 'Data de nascimento',
    password: 'Senha forte',
    card: 'Cartão de teste',
    cnh: 'CNH',
    pis: 'PIS/NIS'
});

export const FILL_MODES = Object.freeze({ VALID: 'valid', INVALID: 'invalid', MAX: 'max' });

const defaultRng = () => Math.random();

function randInt(rng, max) {
    return Math.floor(rng() * max);
}

function randomDigits(rng, n) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(randInt(rng, 10));
    return out;
}

function allEqual(digits) {
    return digits.every((d) => d === digits[0]);
}

// ---------------------------------------------------------------- CPF

function cpfCheckDigit(base) {
    // base: array de 9 (1o DV) ou 10 (2o DV) digitos; pesos decrescentes de len+1 ate 2.
    let sum = 0;
    for (let i = 0; i < base.length; i++) sum += base[i] * (base.length + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
}

/** Retorna 11 digitos (somente numeros) de um CPF valido. */
export function generateCpf(rng = defaultRng) {
    let base;
    do { base = randomDigits(rng, 9); } while (allEqual(base));
    const d1 = cpfCheckDigit(base);
    const d2 = cpfCheckDigit([...base, d1]);
    return [...base, d1, d2].join('');
}

export function isValidCpf(value) {
    const digits = onlyDigits(value).split('').map(Number);
    if (digits.length !== 11 || allEqual(digits)) return false;
    const d1 = cpfCheckDigit(digits.slice(0, 9));
    const d2 = cpfCheckDigit(digits.slice(0, 10));
    return d1 === digits[9] && d2 === digits[10];
}

export function formatCpf(digits) {
    const d = onlyDigits(digits);
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}

// --------------------------------------------------------------- CNPJ

const CNPJ_W1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const CNPJ_W2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

function cnpjCheckDigit(base, weights) {
    let sum = 0;
    for (let i = 0; i < weights.length; i++) sum += base[i] * weights[i];
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
}

/** Retorna 14 digitos de um CNPJ valido (matriz, filial 0001). */
export function generateCnpj(rng = defaultRng) {
    let root;
    do { root = randomDigits(rng, 8); } while (allEqual(root));
    const base = [...root, 0, 0, 0, 1];
    const d1 = cnpjCheckDigit(base, CNPJ_W1);
    const d2 = cnpjCheckDigit([...base, d1], CNPJ_W2);
    return [...base, d1, d2].join('');
}

export function isValidCnpj(value) {
    const digits = onlyDigits(value).split('').map(Number);
    if (digits.length !== 14 || allEqual(digits)) return false;
    const d1 = cnpjCheckDigit(digits.slice(0, 12), CNPJ_W1);
    const d2 = cnpjCheckDigit(digits.slice(0, 13), CNPJ_W2);
    return d1 === digits[12] && d2 === digits[13];
}

export function formatCnpj(digits) {
    const d = onlyDigits(digits);
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

// ----------------------------------------------------------------- RG

function rgCheckDigit(base) {
    // Padrao SP: pesos 2..9 sobre os 8 digitos; DV = 11 - (soma % 11); 10 -> X, 11 -> 0.
    let sum = 0;
    for (let i = 0; i < base.length; i++) sum += base[i] * (i + 2);
    const dv = 11 - (sum % 11);
    if (dv === 10) return 'X';
    if (dv === 11) return '0';
    return String(dv);
}

/** Retorna RG com 9 caracteres (8 digitos + DV, que pode ser X), sem mascara. */
export function generateRg(rng = defaultRng) {
    let base;
    do { base = randomDigits(rng, 8); } while (allEqual(base) || base[0] === 0);
    return base.join('') + rgCheckDigit(base);
}

export function isValidRg(value) {
    const clean = String(value || '').replace(/[^0-9xX]/g, '').toUpperCase();
    if (!/^\d{8}[\dX]$/.test(clean)) return false;
    const base = clean.slice(0, 8).split('').map(Number);
    return rgCheckDigit(base) === clean[8];
}

export function formatRg(raw) {
    const clean = String(raw || '').replace(/[^0-9xX]/g, '').toUpperCase();
    return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}-${clean.slice(8, 9)}`;
}

// ---------------------------------------------------------------- CEP

// CEPs reais de logradouros conhecidos, para que consultas a ViaCEP e afins retornem endereco.
const REAL_CEPS = [
    '01001000', // Praca da Se, Sao Paulo/SP
    '01310100', // Av. Paulista, Sao Paulo/SP
    '20040020', // Rio de Janeiro/RJ
    '22041001', // Copacabana, Rio de Janeiro/RJ
    '30130010', // Belo Horizonte/MG
    '40020000', // Salvador/BA
    '50010000', // Recife/PE
    '60060440', // Fortaleza/CE
    '70040010', // Brasilia/DF
    '80010000', // Curitiba/PR
    '90010150', // Porto Alegre/RS
    '69005070', // Manaus/AM
    '66010000', // Belem/PA
    '74003010', // Goiania/GO
    '88010400'  // Florianopolis/SC
];

export function generateCep(rng = defaultRng) {
    return REAL_CEPS[randInt(rng, REAL_CEPS.length)];
}

export function isValidCepFormat(value) {
    return /^\d{8}$/.test(onlyDigits(value)) && !allEqual(onlyDigits(value).split(''));
}

export function formatCep(digits) {
    const d = onlyDigits(digits);
    return `${d.slice(0, 5)}-${d.slice(5, 8)}`;
}

// ------------------------------------------------------------ TELEFONE

// DDDs existentes (ANATEL).
const VALID_DDDS = [
    11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38,
    41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69,
    71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99
];

/** Celular brasileiro: DDD valido + 9 + 8 digitos. Retorna 11 digitos. */
export function generatePhone(rng = defaultRng) {
    const ddd = VALID_DDDS[randInt(rng, VALID_DDDS.length)];
    let rest;
    do { rest = randomDigits(rng, 8); } while (allEqual(rest));
    return `${ddd}9${rest.join('')}`;
}

export function isValidPhone(value) {
    const d = onlyDigits(value);
    if (d.length !== 11 || d[2] !== '9') return false;
    return VALID_DDDS.includes(Number(d.slice(0, 2)));
}

export function formatPhone(digits) {
    const d = onlyDigits(digits);
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}

// -------------------------------------------------------------- E-MAIL

const EMAIL_WORDS = ['qa', 'teste', 'usuario', 'cliente', 'demo', 'sandbox', 'validacao'];

/** E-mail unico em dominio reservado (example.com nunca entrega mensagens). */
export function generateEmail(rng = defaultRng) {
    const word = EMAIL_WORDS[randInt(rng, EMAIL_WORDS.length)];
    const suffix = randomDigits(rng, 6).join('');
    return `${word}.${suffix}@example.com`;
}

export function isValidEmailFormat(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || ''));
}

// ------------------------------------------------------ NOME / DATA / SENHA

const FIRST_NAMES = ['Maria', 'João', 'Ana', 'Pedro', 'Camila', 'Lucas', 'Beatriz', 'Rafael', 'Juliana', 'Gabriel', 'Fernanda', 'Thiago'];
const LAST_NAMES = ['Silva', 'Souza', 'Oliveira', 'Santos', 'Lima', 'Pereira', 'Costa', 'Ribeiro', 'Almeida', 'Carvalho', 'Gomes', 'Martins'];

export function generateName(rng = defaultRng) {
    const pick = (list) => list[randInt(rng, list.length)];
    let last2 = pick(LAST_NAMES);
    const last1 = pick(LAST_NAMES);
    if (last2 === last1) last2 = LAST_NAMES[(LAST_NAMES.indexOf(last1) + 1) % LAST_NAMES.length];
    return `${pick(FIRST_NAMES)} ${last1} ${last2}`;
}

const pad2 = (n) => String(n).padStart(2, '0');

/** Data de nascimento de adulto (18 a 70 anos) em ISO (YYYY-MM-DD). */
export function generateBirthDate(rng = defaultRng, now = new Date()) {
    const age = 18 + randInt(rng, 53);
    const year = now.getFullYear() - age;
    const month = 1 + randInt(rng, 12);
    const day = 1 + randInt(rng, 28); // 28 evita datas inexistentes
    return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function isValidBirthIso(value, now = new Date()) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!m) return false;
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const date = new Date(Date.UTC(y, mo - 1, d));
    const real = date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
    const age = now.getFullYear() - y;
    return real && age >= 0 && age <= 120;
}

export function formatBirth(iso, hints = {}) {
    const [y, m, d] = String(iso).split('-');
    const ph = String(hints.placeholder || '').toLowerCase();
    if (hints.inputType === 'date' || /^(yyyy|aaaa|\d{4})-/.test(ph)) return `${y}-${m}-${d}`;
    return `${d}/${m}/${y}`;
}

const PW_UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const PW_LOWER = 'abcdefghijkmnopqrstuvwxyz';
const PW_DIGIT = '23456789';
const PW_SYMBOL = '!@#$%&*?';

export function generatePassword(rng = defaultRng, length = 12) {
    const len = Math.max(8, length);
    const pools = [PW_UPPER, PW_LOWER, PW_DIGIT, PW_SYMBOL];
    const all = pools.join('');
    const chars = pools.map((p) => p[randInt(rng, p.length)]);
    while (chars.length < len) chars.push(all[randInt(rng, all.length)]);
    for (let i = chars.length - 1; i > 0; i--) {
        const j = randInt(rng, i + 1);
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
}

export function isStrongPassword(value) {
    const v = String(value || '');
    return v.length >= 8 && /[A-Z]/.test(v) && /[a-z]/.test(v) && /\d/.test(v) && /[^A-Za-z0-9]/.test(v);
}

// --------------------------------------------------------------- CARTAO

function luhnCheckDigit(base) {
    let sum = 0;
    for (let i = 0; i < base.length; i++) {
        let d = base[base.length - 1 - i];
        if (i % 2 === 0) { d *= 2; if (d > 9) d -= 9; }
        sum += d;
    }
    return (10 - (sum % 10)) % 10;
}

/** Numero de cartao de 16 digitos (prefixo 4) valido no algoritmo de Luhn. Nao e um cartao real. */
export function generateCard(rng = defaultRng) {
    const base = [4, ...randomDigits(rng, 14)];
    return [...base, luhnCheckDigit(base)].join('');
}

export function isValidCard(value) {
    const d = onlyDigits(value).split('').map(Number);
    if (d.length < 13 || d.length > 19) return false;
    return luhnCheckDigit(d.slice(0, -1)) === d[d.length - 1];
}

export function formatCard(digits) {
    return onlyDigits(digits).replace(/(\d{4})(?=\d)/g, '$1 ');
}

// ------------------------------------------------------------------ CNH

function cnhDigits(base) {
    let v = 0;
    for (let i = 0, j = 9; i < 9; i++, j--) v += base[i] * j;
    let dsc = 0;
    let d1 = v % 11;
    if (d1 >= 10) { d1 = 0; dsc = 2; }
    v = 0;
    for (let i = 0, j = 1; i < 9; i++, j++) v += base[i] * j;
    const x = v % 11;
    const d2 = x >= 10 ? 0 : x - dsc;
    return d2 < 0 ? null : `${d1}${d2}`;
}

export function generateCnh(rng = defaultRng) {
    for (;;) {
        const base = randomDigits(rng, 9);
        if (allEqual(base)) continue;
        const dv = cnhDigits(base);
        if (dv) return base.join('') + dv;
    }
}

export function isValidCnh(value) {
    const d = onlyDigits(value);
    if (d.length !== 11 || allEqual(d.split(''))) return false;
    return cnhDigits(d.slice(0, 9).split('').map(Number)) === d.slice(9);
}

// ------------------------------------------------------------------ PIS

const PIS_W = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

function pisCheckDigit(base) {
    let sum = 0;
    for (let i = 0; i < 10; i++) sum += base[i] * PIS_W[i];
    const dv = 11 - (sum % 11);
    return dv >= 10 ? 0 : dv;
}

export function generatePis(rng = defaultRng) {
    let base;
    do { base = randomDigits(rng, 10); } while (allEqual(base));
    return [...base, pisCheckDigit(base)].join('');
}

export function isValidPis(value) {
    const d = onlyDigits(value).split('').map(Number);
    if (d.length !== 11 || allEqual(d)) return false;
    return pisCheckDigit(d.slice(0, 10)) === d[10];
}

export function formatPis(digits) {
    const d = onlyDigits(digits);
    return `${d.slice(0, 3)}.${d.slice(3, 8)}.${d.slice(8, 10)}-${d.slice(10, 11)}`;
}

// --------------------------------------------------------- API PUBLICA

export function onlyDigits(value) {
    return String(value || '').replace(/\D/g, '');
}

const GENERATORS = {
    [FIELD_KINDS.CPF]: generateCpf,
    [FIELD_KINDS.CNPJ]: generateCnpj,
    [FIELD_KINDS.RG]: generateRg,
    [FIELD_KINDS.CEP]: generateCep,
    [FIELD_KINDS.PHONE]: generatePhone,
    [FIELD_KINDS.EMAIL]: generateEmail,
    [FIELD_KINDS.NAME]: generateName,
    [FIELD_KINDS.BIRTH]: generateBirthDate,
    [FIELD_KINDS.PASSWORD]: generatePassword,
    [FIELD_KINDS.CARD]: generateCard,
    [FIELD_KINDS.CNH]: generateCnh,
    [FIELD_KINDS.PIS]: generatePis
};

const FORMATTERS = {
    [FIELD_KINDS.CPF]: formatCpf,
    [FIELD_KINDS.CNPJ]: formatCnpj,
    [FIELD_KINDS.RG]: formatRg,
    [FIELD_KINDS.CEP]: formatCep,
    [FIELD_KINDS.PHONE]: formatPhone,
    [FIELD_KINDS.EMAIL]: (v) => v,
    [FIELD_KINDS.NAME]: (v) => v,
    [FIELD_KINDS.BIRTH]: (v) => v,
    [FIELD_KINDS.PASSWORD]: (v) => v,
    [FIELD_KINDS.CARD]: formatCard,
    [FIELD_KINDS.CNH]: onlyDigits,
    [FIELD_KINDS.PIS]: formatPis
};

const FREE_TEXT_KINDS = [FIELD_KINDS.NAME, FIELD_KINDS.EMAIL, FIELD_KINDS.PASSWORD];

const bumpLastDigit = (digits) => {
    const d = String(digits);
    const last = (Number(d.slice(-1)) + 1) % 10;
    return d.slice(0, -1) + last;
};

/** Valor INVALIDO de proposito (para testes negativos). Bruto, sem mascara. */
export function generateInvalidValue(kind, rng = defaultRng) {
    switch (kind) {
        case FIELD_KINDS.CPF: return bumpLastDigit(generateCpf(rng));
        case FIELD_KINDS.CNPJ: return bumpLastDigit(generateCnpj(rng));
        case FIELD_KINDS.RG: { const v = generateRg(rng); return v.slice(0, 8) + (v[8] === '1' ? '2' : '1'); }
        case FIELD_KINDS.CEP: return '00000000';
        case FIELD_KINDS.EMAIL: return 'qa.teste@';
        case FIELD_KINDS.PHONE: return '00900000000';
        case FIELD_KINDS.NAME: return '12345 @#$%';
        case FIELD_KINDS.BIRTH: return '2000-02-31';
        case FIELD_KINDS.PASSWORD: return '123456';
        case FIELD_KINDS.CARD: return bumpLastDigit(generateCard(rng));
        case FIELD_KINDS.CNH: return bumpLastDigit(generateCnh(rng));
        case FIELD_KINDS.PIS: return bumpLastDigit(generatePis(rng));
        default: throw new Error(`Tipo de campo desconhecido: ${kind}`);
    }
}

/** Valor com exatamente `maxLength` caracteres (so tipos de texto livre); null se nao aplicavel. */
export function generateMaxLengthValue(kind, maxLength, rng = defaultRng) {
    const max = Number(maxLength);
    if (!FREE_TEXT_KINDS.includes(kind) || !Number.isFinite(max) || max < 1) return null;
    if (kind === FIELD_KINDS.EMAIL) {
        const domain = '@example.com';
        if (max <= domain.length + 1) return 'a'.repeat(max);
        return 'a'.repeat(max - domain.length) + domain;
    }
    if (kind === FIELD_KINDS.PASSWORD) return generatePassword(rng, max).slice(0, max).padEnd(max, 'a');
    const base = generateName(rng);
    return base.length >= max ? base.slice(0, max) : base + 'A'.repeat(max - base.length);
}

export function kindSupportsMax(kind, maxLength) {
    return FREE_TEXT_KINDS.includes(kind) && Number(maxLength) > 0;
}

/** Gera o valor bruto (sem mascara) para o tipo informado. */
export function generateValue(kind, rng = defaultRng) {
    const gen = GENERATORS[kind];
    if (!gen) throw new Error(`Tipo de campo desconhecido: ${kind}`);
    return gen(rng);
}

/**
 * Decide entre valor mascarado ou so digitos conforme o campo:
 * - maxlength menor que o valor mascarado => so digitos;
 * - placeholder sem pontuacao e com a mesma quantidade de digitos => so digitos;
 * - caso contrario => mascarado (a maioria dos formularios BR aceita e normaliza).
 */
export function formatForField(kind, raw, hints = {}) {
    if (kind === FIELD_KINDS.BIRTH) return formatBirth(raw, hints);
    const format = FORMATTERS[kind];
    if (!format) return raw;
    if (FREE_TEXT_KINDS.includes(kind)) return raw;
    const masked = format(raw);
    const max = Number(hints.maxLength);
    if (Number.isFinite(max) && max > 0 && max < masked.length) {
        return kind === FIELD_KINDS.RG ? String(raw) : onlyDigits(raw);
    }
    const ph = String(hints.placeholder || '');
    if (ph && /\d/.test(ph) && !/[^\dxX\s]/.test(ph)) {
        return kind === FIELD_KINDS.RG ? String(raw) : onlyDigits(raw);
    }
    return masked;
}

/**
 * Gera o valor ja formatado para o campo.
 * mode: 'valid' (padrao) | 'invalid' (teste negativo) | 'max' (tamanho maximo, so texto livre; retorna null se nao aplicavel).
 */
export function generateForField(kind, hints = {}, rng = defaultRng, mode = FILL_MODES.VALID) {
    if (mode === FILL_MODES.INVALID) return formatForField(kind, generateInvalidValue(kind, rng), hints);
    if (mode === FILL_MODES.MAX) return generateMaxLengthValue(kind, hints.maxLength, rng);
    const raw = kind === FIELD_KINDS.PASSWORD
        ? generatePassword(rng, Math.min(16, Number(hints.maxLength) || 12))
        : generateValue(kind, rng);
    return formatForField(kind, raw, hints);
}

// ------------------------------------------------------ DETECCAO DE CAMPO

function normalize(text) {
    return String(text || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        // separa camelCase / PascalCase antes de minusculizar: "numeroCpf" -> "numero Cpf"
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function tokens(text) {
    const n = normalize(text);
    return n ? n.split(' ') : [];
}

const has = (toks, ...words) => words.some((w) => toks.includes(w));

function matchKindFromTokens(toks, joined) {
    if (has(toks, 'cnpj') || joined.includes('cnpj')) return FIELD_KINDS.CNPJ;
    if (has(toks, 'cpf') || joined.includes('cpf')) return FIELD_KINDS.CPF;
    if (has(toks, 'rg') || /\bregistro geral\b|\bidentidade\b|\bcarteira de identidade\b/.test(joined)) return FIELD_KINDS.RG;
    if (has(toks, 'cnh') || joined.includes('habilitacao')) return FIELD_KINDS.CNH;
    if (has(toks, 'pis', 'pasep', 'nis') || joined.includes('pis pasep')) return FIELD_KINDS.PIS;
    if (has(toks, 'cartao', 'ccnum') || /\b(card number|numero do cartao|cc number)\b/.test(joined)) return FIELD_KINDS.CARD;
    if (has(toks, 'cep') || joined.includes('codigo postal')) return FIELD_KINDS.CEP;
    if (has(toks, 'email', 'mail') || joined.includes('e mail')) return FIELD_KINDS.EMAIL;
    if (has(toks, 'telefone', 'celular', 'fone', 'whatsapp', 'whats', 'phone', 'tel', 'mobile') || /\bwhats ?app\b/.test(joined)) return FIELD_KINDS.PHONE;
    if (has(toks, 'nascimento', 'birth', 'birthday', 'aniversario', 'dtnasc', 'bday') || joined.includes('data de nasc')) return FIELD_KINDS.BIRTH;
    // "nome" sozinho e generico demais (produto, empresa...): so com um qualificador de pessoa.
    if (/\b(nome completo|full name|fullname)\b/.test(joined) ||
        (has(toks, 'nome', 'name') && has(toks, 'completo', 'cliente', 'usuario', 'titular', 'responsavel', 'full'))) return FIELD_KINDS.NAME;
    return null;
}

const SKIP_TYPES = new Set(['hidden', 'checkbox', 'radio', 'file', 'submit', 'button', 'reset', 'image', 'range', 'color', 'number']);
const NEW_PASSWORD_HINT = /\b(nova|novo|confirm|confirmar|confirme|repita|repetir|criar|cadastr\w*|new|retype)\b/;

/**
 * Descobre o tipo de dado de teste que um campo aceita (CPF, CNPJ, RG, CEP, e-mail, telefone,
 * nome completo, nascimento, senha forte, cartao, CNH, PIS) ou null.
 * Entrada: atributos ja lidos do elemento (a camada de presentation extrai do DOM).
 *
 * Ordem de confianca: autocomplete/type > name/id > placeholder/aria-label > label visivel.
 * Senha so aparece em campos de "nova senha"/"confirmar" (autocomplete=new-password), nunca em login.
 * type=date so recebe data de nascimento.
 */
export function detectFieldKind(attrs = {}) {
    const type = String(attrs.type || 'text').toLowerCase();
    if (attrs.readOnly || attrs.disabled) return null;
    if (SKIP_TYPES.has(type)) return null;

    const autocomplete = String(attrs.autocomplete || '').toLowerCase();
    const sources = [attrs.name, attrs.id, attrs.dataTestId, attrs.placeholder, attrs.ariaLabel, attrs.labelText];

    if (type === 'password') {
        if (autocomplete === 'new-password') return FIELD_KINDS.PASSWORD;
        const text = sources.filter(Boolean).map(normalize).join(' ');
        return /\b(senha|password)\b/.test(text) && NEW_PASSWORD_HINT.test(text) ? FIELD_KINDS.PASSWORD : null;
    }
    if (type === 'date') {
        const text = sources.filter(Boolean).map(normalize).join(' ');
        return /nascimento|birth|aniversario|dtnasc|bday/.test(text) || autocomplete === 'bday' ? FIELD_KINDS.BIRTH : null;
    }

    if (type === 'email' || autocomplete === 'email') return FIELD_KINDS.EMAIL;
    if (autocomplete === 'postal-code') return FIELD_KINDS.CEP;
    if (autocomplete === 'cc-number') return FIELD_KINDS.CARD;
    if (autocomplete === 'bday') return FIELD_KINDS.BIRTH;
    if (autocomplete === 'name') return FIELD_KINDS.NAME;
    if (type === 'tel' || autocomplete.startsWith('tel')) return FIELD_KINDS.PHONE;

    for (const src of sources) {
        if (!src) continue;
        const toks = tokens(src);
        const kind = matchKindFromTokens(toks, toks.join(' '));
        if (!kind) continue;
        return refineAmbiguous(kind, attrs, src);
    }
    return null;
}

/** "CPF/CNPJ": decide pelo tamanho maximo do campo quando o texto cita os dois. */
function refineAmbiguous(kind, attrs, src) {
    const joined = normalize(src);
    const both = joined.includes('cpf') && joined.includes('cnpj');
    if (!both) return kind;
    const max = Number(attrs.maxLength);
    return Number.isFinite(max) && max >= 17 ? FIELD_KINDS.CNPJ : FIELD_KINDS.CPF;
}
