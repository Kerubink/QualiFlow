# Referência: checklist-pre-commit

## Padrões de credencial a procurar no diff

Rode contra o diff (working tree + staged), nunca contra `.env` (já é gitignored, não
é o problema — o problema é um valor real colado num arquivo que VAI ser commitado):

```bash
git diff --unified=0 -- . ':(exclude).env' ':(exclude)*.venv/*' \
  | grep -inE '(ghp_|gho_|github_pat_|AIza[0-9A-Za-z_-]{35}|gsk_[0-9A-Za-z]{20,}|xox[baprs]-|-----BEGIN [A-Z ]*PRIVATE KEY-----|client_secret["\x27]?\s*[:=]\s*["\x27][^"\x27]{10,}|api_key["\x27]?\s*[:=]\s*["\x27][^"\x27]{10,})'
```

Padrões cobertos: token GitHub (`ghp_`/`gho_`/`github_pat_`), API key do Gemini
(`AIza...`), API key do Groq (`gsk_...`), token Slack (não deveria existir aqui, mas é
comum vazar de outro projeto copiado), chave privada PEM, e atribuições literais de
`client_secret`/`api_key` com valor longo. Nenhum resultado não significa "seguro" —
significa "nenhum desses padrões específicos apareceu"; leia o diff de qualquer arquivo
novo em `apps/api/src/auth/` ou `apps/api/src/generation/infrastructure/` manualmente também.

## Nomes de contrato a conferir (payload e erro)

Antes de reportar ✅ no item "contratos preservados", confirme com `grep -rn` que estes
nomes continuam nos arquivos onde apareciam antes da mudança (comparar `git diff` do
próprio nome, não só a existência):

- Payload de geração/adaptação: `selectedAi`, `cardData`, `generationSettings`,
  `userFocus`, `technicalDetail`.
- Prefixos de erro classificados: `invalid_json_response`,
  `COPILOT_INVALID_JSON_RESPONSE`.
- Eventos de streaming NDJSON: `progress`, `result`, `error` (cada linha de
  `/api/scenarios/generate` e `/api/scenarios/adapt` deve ser um desses três).
- Chave de persistência local da extensão: `qualiflowSavedSessions`.
- Actions de runtime: `GET_DATA`, `EVALUATE_COVERAGE`, `GENERATE_SCENARIOS`,
  `ADAPT_COPIED_SCENARIOS`, `SAVE_SCENARIOS`, `GET_TEST_RUNNER_CARDS`,
  `GET_TEST_CASES_FOR_WORKITEM` (definidos em `apps/extension/src/contracts/runtimeActions.js`).

Se um desses nomes sumiu ou mudou no diff, isso é um ❌ no item de contrato — a não ser
que o pedido da tarefa explicitamente peça uma mudança de contrato (nesse caso, marque
N/A e explique).

## Achando o virtualenv

O `CLAUDE.md` e a skill assumem `apps/api/.venv`. Se `apps/api/.venv/bin/python` não
existir, use a ferramenta Glob com
`**/.venv/bin/python` e reporte o caminho encontrado ao usuário; não crie um venv novo
nem instale dependências por conta própria.

## Interpretando falha de `npm run build`

Falha em `lint`, `test` ou `build` é sempre ❌ no item correspondente — nunca reporte ✅
com base em "deve ter passado" sem colar a saída final do comando (`built in ...` do
Vite, `# pass N / # fail 0` do `node --test`). Se falhar por dependência ausente
(`node_modules` faltando), reporte e peça ao usuário para rodar `npm install` — esta
skill não tem permissão de instalar nada, e nunca deve alterar o `package.json`.
