// Pontos de extensao late-bound entre modulos do content script que, se importados
// diretamente, criariam ciclos (ui <-> scenarios <-> dashboard). Cada modulo registra
// suas funcoes ao carregar (ver main.js); quem chama deve checar `typeof hooks.x === 'function'`.

export const hooks = {};
