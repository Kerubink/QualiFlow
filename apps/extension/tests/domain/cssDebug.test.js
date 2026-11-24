import test from 'node:test';
import assert from 'node:assert/strict';
import { compactBox, cssSelector, elementLabel, formatSize } from '../../src/domain/cssDebug.js';

test('elementLabel monta tag#id.classes e resume o excesso', () => {
    assert.equal(elementLabel({ tag: 'DIV', id: 'main', classes: ['a', 'b'] }), 'div#main.a.b');
    assert.equal(elementLabel({ tag: 'span', classes: ['a', 'b', 'c', 'd', 'e'] }), 'span.a.b.c+2');
    assert.equal(elementLabel({}), 'div');
});

test('cssSelector para no primeiro id e usa nth-of-type', () => {
    const chain = [
        { tag: 'html' }, { tag: 'body' },
        { tag: 'div', id: 'app', classes: ['x'] },
        { tag: 'ul', classes: ['list', 'big', 'extra'] },
        { tag: 'li', classes: [], nth: 3 }
    ];
    assert.equal(cssSelector(chain), 'div#app > ul.list.big > li:nth-of-type(3)');
    assert.equal(cssSelector([{ tag: 'html' }, { tag: 'body' }]), 'html > body');
    assert.equal(cssSelector([]), '');
});

test('formatSize e compactBox', () => {
    assert.equal(formatSize(320.4, 47.6), '320 x 48');
    assert.equal(compactBox('8px 8px 8px 8px'), '8');
    assert.equal(compactBox('8px 16px 8px 16px'), '8 16');
    assert.equal(compactBox('1px 2px 3px 4px'), '1 2 3 4');
    assert.equal(compactBox('auto'), 'auto');
});
