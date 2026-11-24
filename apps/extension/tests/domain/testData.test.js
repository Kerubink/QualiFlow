import test from 'node:test';
import assert from 'node:assert/strict';
import {
    FIELD_KINDS,
    detectFieldKind,
    formatCnpj,
    formatCpf,
    formatForField,
    generateCep,
    generateCnpj,
    generateCpf,
    generateEmail,
    generateForField,
    generatePhone,
    generateRg,
    isValidCepFormat,
    isValidCnpj,
    isValidCpf,
    isValidEmailFormat,
    isValidPhone,
    isValidRg
} from '../../src/domain/testData.js';

// PRNG determinista (mulberry32) para reproduzir falhas.
function seeded(seed) {
    let a = seed;
    return () => {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

test('CPF gerado e sempre valido (1000 amostras)', () => {
    const rng = seeded(1);
    for (let i = 0; i < 1000; i++) assert.ok(isValidCpf(generateCpf(rng)));
});

test('isValidCpf rejeita invalidos e sequencias repetidas', () => {
    assert.equal(isValidCpf('529.982.247-25'), true);
    assert.equal(isValidCpf('529.982.247-24'), false);
    assert.equal(isValidCpf('111.111.111-11'), false);
    assert.equal(isValidCpf('123'), false);
});

test('CNPJ gerado e sempre valido (1000 amostras)', () => {
    const rng = seeded(2);
    for (let i = 0; i < 1000; i++) assert.ok(isValidCnpj(generateCnpj(rng)));
});

test('isValidCnpj reconhece caso conhecido e rejeita DV errado', () => {
    assert.equal(isValidCnpj('11.222.333/0001-81'), true);
    assert.equal(isValidCnpj('11.222.333/0001-82'), false);
    assert.equal(isValidCnpj('00000000000000'), false);
});

test('RG gerado passa na propria validacao e tem 9 caracteres', () => {
    const rng = seeded(3);
    for (let i = 0; i < 1000; i++) {
        const rg = generateRg(rng);
        assert.equal(rg.length, 9);
        assert.ok(isValidRg(rg), rg);
    }
});

test('CEP gerado tem 8 digitos', () => {
    const rng = seeded(4);
    for (let i = 0; i < 50; i++) assert.ok(isValidCepFormat(generateCep(rng)));
});

test('telefone gerado e celular com DDD valido', () => {
    const rng = seeded(5);
    for (let i = 0; i < 500; i++) assert.ok(isValidPhone(generatePhone(rng)));
});

test('e-mail gerado usa dominio reservado e formato valido', () => {
    const rng = seeded(6);
    for (let i = 0; i < 50; i++) {
        const email = generateEmail(rng);
        assert.ok(isValidEmailFormat(email));
        assert.ok(email.endsWith('@example.com'));
    }
});

test('formatacao de CPF e CNPJ', () => {
    assert.equal(formatCpf('52998224725'), '529.982.247-25');
    assert.equal(formatCnpj('11222333000181'), '11.222.333/0001-81');
});

test('formatForField respeita maxlength e placeholder numerico', () => {
    assert.equal(formatForField(FIELD_KINDS.CPF, '52998224725', {}), '529.982.247-25');
    assert.equal(formatForField(FIELD_KINDS.CPF, '52998224725', { maxLength: 11 }), '52998224725');
    assert.equal(formatForField(FIELD_KINDS.CPF, '52998224725', { maxLength: 14 }), '529.982.247-25');
    assert.equal(formatForField(FIELD_KINDS.CPF, '52998224725', { placeholder: '00000000000' }), '52998224725');
    assert.equal(formatForField(FIELD_KINDS.CPF, '52998224725', { placeholder: '000.000.000-00' }), '529.982.247-25');
    assert.equal(formatForField(FIELD_KINDS.PHONE, '11987654321', { maxLength: 15 }), '(11) 98765-4321');
});

test('generateForField devolve valor ja formatado e valido', () => {
    const rng = seeded(7);
    assert.ok(isValidCpf(generateForField(FIELD_KINDS.CPF, {}, rng)));
    assert.ok(isValidCnpj(generateForField(FIELD_KINDS.CNPJ, { maxLength: 14 }, rng)));
});

test('detectFieldKind por name/id/placeholder/label', () => {
    assert.equal(detectFieldKind({ name: 'cpf' }), FIELD_KINDS.CPF);
    assert.equal(detectFieldKind({ id: 'txtCnpj' }), FIELD_KINDS.CNPJ);
    assert.equal(detectFieldKind({ name: 'numeroCpf' }), FIELD_KINDS.CPF);
    assert.equal(detectFieldKind({ placeholder: 'Digite seu CPF' }), FIELD_KINDS.CPF);
    assert.equal(detectFieldKind({ labelText: 'RG' }), FIELD_KINDS.RG);
    assert.equal(detectFieldKind({ labelText: 'Carteira de Identidade' }), FIELD_KINDS.RG);
    assert.equal(detectFieldKind({ name: 'zip_cep' }), FIELD_KINDS.CEP);
    assert.equal(detectFieldKind({ labelText: 'Código Postal' }), FIELD_KINDS.CEP);
    assert.equal(detectFieldKind({ ariaLabel: 'Celular com DDD' }), FIELD_KINDS.PHONE);
    assert.equal(detectFieldKind({ labelText: 'WhatsApp' }), FIELD_KINDS.PHONE);
    assert.equal(detectFieldKind({ name: 'user_email' }), FIELD_KINDS.EMAIL);
});

test('detectFieldKind por type e autocomplete', () => {
    assert.equal(detectFieldKind({ type: 'email' }), FIELD_KINDS.EMAIL);
    assert.equal(detectFieldKind({ type: 'tel' }), FIELD_KINDS.PHONE);
    assert.equal(detectFieldKind({ autocomplete: 'postal-code' }), FIELD_KINDS.CEP);
});

test('detectFieldKind decide CPF/CNPJ pelo maxlength', () => {
    assert.equal(detectFieldKind({ labelText: 'CPF/CNPJ', maxLength: 18 }), FIELD_KINDS.CNPJ);
    assert.equal(detectFieldKind({ labelText: 'CPF/CNPJ', maxLength: 14 }), FIELD_KINDS.CPF);
    assert.equal(detectFieldKind({ labelText: 'CPF ou CNPJ' }), FIELD_KINDS.CPF);
});

test('detectFieldKind ignora campos que nao sao texto, readonly e falsos positivos', () => {
    assert.equal(detectFieldKind({ type: 'password', name: 'cpf' }), null);
    assert.equal(detectFieldKind({ type: 'hidden', name: 'cpf' }), null);
    assert.equal(detectFieldKind({ name: 'cpf', readOnly: true }), null);
    assert.equal(detectFieldKind({ name: 'cpf', disabled: true }), null);
    assert.equal(detectFieldKind({ name: 'hotel' }), null);
    assert.equal(detectFieldKind({ name: 'nome' }), null);
    assert.equal(detectFieldKind({ name: 'search', placeholder: 'Buscar' }), null);
    assert.equal(detectFieldKind({}), null);
});

// ---------------------------------------------------------------- novos tipos
import {
    FILL_MODES,
    formatBirth,
    generateBirthDate,
    generateCard,
    generateCnh,
    generateInvalidValue,
    generateMaxLengthValue,
    generateName,
    generatePassword,
    generatePis,
    isStrongPassword,
    isValidBirthIso,
    isValidCard,
    isValidCnh,
    isValidPis,
    kindSupportsMax
} from '../../src/domain/testData.js';

test('cartao gerado passa no Luhn e comeca com 4', () => {
    const rng = seeded(11);
    for (let i = 0; i < 500; i++) {
        const c = generateCard(rng);
        assert.equal(c.length, 16);
        assert.ok(c.startsWith('4'));
        assert.ok(isValidCard(c));
    }
    assert.equal(isValidCard('4111 1111 1111 1111'), true);
    assert.equal(isValidCard('4111 1111 1111 1112'), false);
});

test('CNH e PIS gerados sao validos', () => {
    const rng = seeded(12);
    for (let i = 0; i < 500; i++) {
        assert.ok(isValidCnh(generateCnh(rng)));
        assert.ok(isValidPis(generatePis(rng)));
    }
});

test('PIS calculado a mao pelos pesos 3,2,9,8,7,6,5,4,3,2: 120.40356.97-7', () => {
    // soma = 3+4+0+32+0+18+25+24+27+14 = 147; 147 % 11 = 4; DV = 11 - 4 = 7
    assert.equal(isValidPis('12040356977'), true);
    assert.equal(isValidPis('12040356971'), false);
});

test('senha gerada e forte e respeita tamanho minimo', () => {
    const rng = seeded(13);
    for (let i = 0; i < 200; i++) assert.ok(isStrongPassword(generatePassword(rng)));
    assert.equal(generatePassword(seeded(1), 16).length, 16);
    assert.equal(isStrongPassword('123456'), false);
});

test('nome tem nome e dois sobrenomes distintos', () => {
    const rng = seeded(14);
    for (let i = 0; i < 100; i++) {
        const parts = generateName(rng).split(' ');
        assert.equal(parts.length, 3);
        assert.notEqual(parts[1], parts[2]);
    }
});

test('data de nascimento: adulto, valida; formatos por campo', () => {
    const now = new Date('2026-06-15T12:00:00Z');
    const rng = seeded(15);
    for (let i = 0; i < 200; i++) {
        const iso = generateBirthDate(rng, now);
        assert.ok(isValidBirthIso(iso, now), iso);
        const age = now.getFullYear() - Number(iso.slice(0, 4));
        assert.ok(age >= 18 && age <= 70);
    }
    assert.equal(formatBirth('1990-03-07'), '07/03/1990');
    assert.equal(formatBirth('1990-03-07', { inputType: 'date' }), '1990-03-07');
    assert.equal(formatBirth('1990-03-07', { placeholder: 'AAAA-MM-DD' }), '1990-03-07');
    assert.equal(isValidBirthIso('2000-02-31'), false);
});

test('valores invalidos sao realmente invalidos', () => {
    const rng = seeded(16);
    for (let i = 0; i < 200; i++) {
        assert.equal(isValidCpf(generateInvalidValue(FIELD_KINDS.CPF, rng)), false);
        assert.equal(isValidCnpj(generateInvalidValue(FIELD_KINDS.CNPJ, rng)), false);
        assert.equal(isValidRg(generateInvalidValue(FIELD_KINDS.RG, rng)), false);
        assert.equal(isValidCard(generateInvalidValue(FIELD_KINDS.CARD, rng)), false);
        assert.equal(isValidCnh(generateInvalidValue(FIELD_KINDS.CNH, rng)), false);
        assert.equal(isValidPis(generateInvalidValue(FIELD_KINDS.PIS, rng)), false);
    }
    assert.equal(isValidEmailFormat(generateInvalidValue(FIELD_KINDS.EMAIL)), false);
    assert.equal(isValidPhone(generateInvalidValue(FIELD_KINDS.PHONE)), false);
    assert.equal(isValidBirthIso(generateInvalidValue(FIELD_KINDS.BIRTH)), false);
    assert.equal(isStrongPassword(generateInvalidValue(FIELD_KINDS.PASSWORD)), false);
    assert.equal(isValidCepFormat(generateInvalidValue(FIELD_KINDS.CEP)), false);
});

test('generateForField no modo invalido aplica a mascara', () => {
    const v = generateForField(FIELD_KINDS.CPF, {}, seeded(17), FILL_MODES.INVALID);
    assert.match(v, /^\d{3}\.\d{3}\.\d{3}-\d{2}$/);
    assert.equal(isValidCpf(v), false);
});

test('modo max: exatamente maxlength so para texto livre', () => {
    assert.equal(generateMaxLengthValue(FIELD_KINDS.NAME, 40, seeded(1)).length, 40);
    assert.equal(generateMaxLengthValue(FIELD_KINDS.NAME, 5, seeded(1)).length, 5);
    const email = generateMaxLengthValue(FIELD_KINDS.EMAIL, 50, seeded(1));
    assert.equal(email.length, 50);
    assert.ok(email.endsWith('@example.com'));
    assert.equal(generateMaxLengthValue(FIELD_KINDS.PASSWORD, 20, seeded(1)).length, 20);
    assert.equal(generateMaxLengthValue(FIELD_KINDS.CPF, 11), null);
    assert.equal(generateMaxLengthValue(FIELD_KINDS.NAME, undefined), null);
    assert.equal(kindSupportsMax(FIELD_KINDS.NAME, 30), true);
    assert.equal(kindSupportsMax(FIELD_KINDS.CPF, 30), false);
    assert.equal(kindSupportsMax(FIELD_KINDS.NAME, 0), false);
});

test('deteccao dos novos tipos', () => {
    assert.equal(detectFieldKind({ labelText: 'Nome completo' }), FIELD_KINDS.NAME);
    assert.equal(detectFieldKind({ name: 'nomeCliente' }), FIELD_KINDS.NAME);
    assert.equal(detectFieldKind({ autocomplete: 'name' }), FIELD_KINDS.NAME);
    assert.equal(detectFieldKind({ name: 'nome' }), null);
    assert.equal(detectFieldKind({ labelText: 'Data de nascimento' }), FIELD_KINDS.BIRTH);
    assert.equal(detectFieldKind({ type: 'date', name: 'dtNascimento' }), FIELD_KINDS.BIRTH);
    assert.equal(detectFieldKind({ type: 'date', name: 'vencimento' }), null);
    assert.equal(detectFieldKind({ name: 'cartao' }), FIELD_KINDS.CARD);
    assert.equal(detectFieldKind({ autocomplete: 'cc-number' }), FIELD_KINDS.CARD);
    assert.equal(detectFieldKind({ labelText: 'CNH' }), FIELD_KINDS.CNH);
    assert.equal(detectFieldKind({ labelText: 'PIS/PASEP' }), FIELD_KINDS.PIS);
});

test('senha: so em campos de nova senha / confirmacao', () => {
    assert.equal(detectFieldKind({ type: 'password', autocomplete: 'new-password' }), FIELD_KINDS.PASSWORD);
    assert.equal(detectFieldKind({ type: 'password', labelText: 'Confirmar senha' }), FIELD_KINDS.PASSWORD);
    assert.equal(detectFieldKind({ type: 'password', name: 'novaSenha' }), FIELD_KINDS.PASSWORD);
    assert.equal(detectFieldKind({ type: 'password', name: 'senha' }), null);
    assert.equal(detectFieldKind({ type: 'password', name: 'cpf' }), null);
    assert.equal(detectFieldKind({ type: 'password', autocomplete: 'current-password', labelText: 'Senha' }), null);
});
