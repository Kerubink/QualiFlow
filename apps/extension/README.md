# QualiFlow - Extensao Chrome

Extensao Chrome (Manifest V3) para Azure DevOps e Jira, empacotada com Vite + CRXJS. Ela
carrega o contexto do card, avalia cobertura, gera/adapta casos de teste BDD com IA, permite
revisar e salvar cenarios e mostra dashboards/runner. **Toda** comunicacao com IA e boards
passa pelo backend (`apps/api`): a extensao nao chama Gemini, Groq, Copilot, Azure DevOps ou
Jira diretamente.

Documentacao funcional canonica do gerador: `../../docs/DOCUMENTACAO.md`.

## Comandos

Execute dentro de `apps/extension/`.

| Comando | O que faz |
| --- | --- |
| `npm install` | Instala dependencias |
| `npm run dev` | Vite em modo dev |
| `npm run build` | Build de producao (minificado) em `dist/` |
| `npm run build:obf` | Build + ofuscacao dos `.js` de `dist/` (nao e fronteira de seguranca) |
| `npm run lint` | ESLint (flat config em `eslint.config.js`), inclui regras de dependencia entre camadas |
| `npm test` | Testes do dominio com o runner nativo `node --test` (offline, sem dependencias extras) |

## Como carregar no Chrome

1. `npm run build`.
2. Abra `chrome://extensions` e ative o "Modo do desenvolvedor".
3. "Carregar sem compactacao" e selecione `dist/`.

`dist/` e gerado; nunca edite arquivos la. O manifest de origem e `manifest.json`
(service worker em `src/entrypoints/background/index.js`, content scripts em
`src/presentation/content/main.js` e `src/presentation/content/runner/main.js`, options em
`src/presentation/options/options.html`).

O backend padrao da extensao e `http://localhost:3000` (API rodando na maquina do QA, veja `apps/api/README.md`).
Para usar outro backend, informe a URL em Configuracoes -> Geral.

## Arquitetura em camadas

A dependencia aponta para dentro: `presentation`/`entrypoints` -> `application` -> `domain`.
`infrastructure` implementa as portas e so conhece `domain`. O ESLint
(`no-restricted-imports`) barra violacoes e o `domain` roda sem globais de navegador.

```
src/
  contracts/            runtimeActions.js: nomes das actions de runtime e mensagens para a aba
  domain/               logica PURA (sem chrome.*, fetch ou DOM)
    constants.js          provedores de IA, modelos Copilot, URLs padrao, normalizacoes
    backendUrl.js         validacao/normalizacao da URL do backend
    board.js              deteccao de board, assignee Azure, board solicitado
    scenario.js           parametros @campo, texto de passos, preparo para salvar
    scenarioPostProcessing.js  formato minimo dos cenarios devolvidos pelo backend
    savedSession.js / copiedScenario.js / rtm.js / saveResult.js  regras de sessoes locais, copia e RTM
    settingsRules.js      pre-requisitos de configuracao (Azure, Jira, IA, runner)
    supportNotification.js  regras do monitor de chamados de suporte
    optionsSelection.js   regras da pagina de opcoes
  application/          casos de uso (recebem dependencias/portas injetadas)
    cardData.js  coverage.js  scenarioGeneration.js  scenarioSaving.js
    azureReports.js  testRunner.js  aiModels.js  oauthSessions.js  supportMonitor.js
  infrastructure/       adaptadores concretos
    backend/              client.js (HTTP + streaming NDJSON), authClient.js, supportWebhook.js
    ai/                   proxies finos gemini/groq/copilot + scenarioGateway.js
    boards/               azure.js, jira.js, boardClient.js (Bearer da sessao OAuth)
    browser/              runtimeMessaging, callbackBridge (content), storage, tabs, alarms
    persistence/          settingsRepository.js, savedSessions.js (chave qualiflowSavedSessions)
  entrypoints/background/  service worker
    index.js              so wiring: listeners, alarme, router
    container.js          composition root (liga portas a adaptadores)
    router.js             despacho por action + tratamento de erro padrao
    handlers/             um arquivo por grupo de actions
  presentation/
    content/              content script (Azure/Jira)
      main.js               entrypoint; ordem de carga dashboard -> scenarios -> ui
      state.js hooks.js     estado compartilhado e pontos late-bound (evitam ciclos)
      shared/               runtime/storage, DOM, contexto da pagina, html->texto
      ui/ dashboard/ scenarios/   FAB+modal, abas do dashboard, geracao/copia/salvamento
      runner/               content script do test runner (bundle separado, <all_urls>)
    options/              pagina de configuracoes (options.js e so wiring)
  styles/  assets/
tests/domain/           testes `node --test` dos modulos puros
```

### Fluxo de runtime

Content scripts e options page enviam `chrome.runtime.sendMessage({ action, ... })`.
`entrypoints/background/router.js` despacha para o handler da action em
`contracts/runtimeActions.js`; o handler chama um caso de uso em `application/`, que usa
`domain/` e as portas injetadas por `container.js`. Erros nao tratados viram `{ error }`.
Actions novas devem ser declaradas em `runtimeActions.js`.

Fluxos preservados: `GET_DATA`, `EVALUATE_COVERAGE`, `GENERATE_SCENARIOS`,
`ADAPT_COPIED_SCENARIOS`, `SAVE_SCENARIOS`, `GET_TEST_RUNNER_CARDS`,
`GET_TEST_CASES_FOR_WORKITEM` e demais. O progresso de geracao volta ao content script como
mensagem `GENERATION_PROGRESS`.

### Content scripts

Os modulos sao ES modules. Nao ha globais compartilhadas: estado comum vive em
`presentation/content/state.js` (`state.<campo>`) e chamadas entre modulos que formariam ciclo
(ui <-> scenarios <-> dashboard) passam por `hooks.js`, registrado no carregamento.

## Backend-first

- `infrastructure/backend/client.js`: cliente HTTP generico (POST JSON e streaming NDJSON de
  progresso) e montagem de `aiSettings`.
- `infrastructure/ai/*`: proxies que repassam API key (Gemini/Groq) ou a sessao GitHub
  (Copilot) ao backend. `scenarioGateway.js` encaminha `/api/scenarios/generate` e
  `/api/scenarios/adapt`.
- `infrastructure/boards/*`: proxies de Azure DevOps/Jira. Login via OAuth (Microsoft Entra
  ID / Atlassian 3LO) pelo backend; o `sessionToken` fica em `azureSessionToken` /
  `jiraSessionToken` e vai em `Authorization: Bearer`. Nenhum PAT ou e-mail+API token e
  armazenado.

As API keys de Gemini/Groq ficam no storage local da extensao e trafegam apenas na
requisicao para o backend. Somente o provedor Copilot exige sessao GitHub OAuth.

## Persistencia local

- `qualiflowSavedSessions`: sessoes de cenarios salvas localmente (mantenha o formato
  compativel).
- Configuracoes e tokens de sessao em `chrome.storage.local` (ver
  `infrastructure/persistence/settingsRepository.js`).

## Observacoes

- Provedores de IA invalidos/legados (ex.: Grok, removido) sao normalizados para `gemini`.
- A ofuscacao so se aplica aos `.js` de `dist/` e nao protege segredos.
- Mudancas que afetem o fluxo visual devem ser validadas manualmente no Chrome (Azure DevOps
  e Jira) apos `npm run build`.
