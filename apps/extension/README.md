# QualiFlow - Build da Extensao

Esta pasta agora usa Vite + CRXJS para empacotar a extensao sem alterar a logica atual.

## Escopo oficial

- A base oficial de evolucao da extensao e `apps/extension/`.
- Alteracoes estruturais e funcionais devem ser feitas aqui.

## Documentacao funcional do Gerador de CTs

- A documentacao canonica do fluxo de gerador (incluindo copia de CTs e ajustes automaticos por IA) esta em:
  - `../../docs/DOCUMENTACAO.md`

## Comandos

- Instalar dependencias:
  - `npm install`
- Rodar em modo dev:
  - `npm run dev`
- Build de producao (minificado):
  - `npm run build`
- Build de producao com ofuscacao:
  - `npm run build:obf`

## Como carregar no Chrome

1. Abra `chrome://extensions`.
2. Ative "Modo do desenvolvedor".
3. Clique em "Carregar sem compactacao".
4. Selecione a pasta `dist/` gerada pelo build.

## Observacoes importantes

- A ofuscacao e aplicada somente aos arquivos `.js` em `dist/`.
- Ofuscacao aumenta a protecao, mas nao torna o codigo impossivel de engenharia reversa.

## Arquitetura de IA (backend-first)

Toda a comunicacao com provedores de IA (Gemini, Groq, Copilot) e a orquestracao de
geracao de cenarios (decomposicao, lotes, RTM, pos-processamento) agora vivem no backend
Python (`apps/api`). A extensao **nao chama mais** `generativelanguage.googleapis.com`,
`api.groq.com` ou os endpoints internos do Copilot diretamente.

- `src/services/ai/backendClient.js`: cliente HTTP generico para o backend (streaming
  NDJSON de progresso + chamadas simples).
- `src/services/ai/gemini.js` / `groq.js` / `copilot.js`: proxies finos que repassam a
  API Key (Gemini/Groq) ou a sessao GitHub (Copilot) para o backend.
- `src/services/orchestration/testGeneration.js`: apenas encaminha a requisicao para
  `/api/scenarios/generate` e `/api/scenarios/adapt` no backend, repassando os eventos de
  progresso para a UI.
- `src/services/orchestration/postProcessor.js`: pass-through, pois o backend ja devolve
  os cenarios normalizados.

As API Keys de Gemini/Groq continuam configuradas na extensao (armazenamento local), mas
trafegam apenas na requisicao para o backend - nunca sao persistidas la. Somente chamadas
com provedor Copilot exigem sessao GitHub OAuth ja autenticada.

## Boards (Azure DevOps / Jira) tambem via backend

`src/services/boards/azure.js` e `src/services/boards/jira.js` tambem viraram proxies
finos: nenhum PAT do Azure DevOps ou email+API Token do Jira e mais armazenado/enviado
pela extensao. Em vez disso, a extensao faz login OAuth (Microsoft Entra ID para Azure
DevOps, Atlassian para Jira) atraves do backend - o mesmo fluxo usado para o Copilot
(`auth/board/session/start` -> aba de login -> poll ate `sessionToken`). O
`sessionToken` resultante fica salvo como `azureSessionToken`/`jiraSessionToken` e e
enviado em `Authorization: Bearer` para os endpoints `/api/board/azure/*` e
`/api/board/jira/*` do backend.

## Fase 2 (estrutura interna)

Foi criada uma camada de organizacao modular sem alterar comportamento:

- `src/services/ai/`: reexports para Gemini/Copilot/Groq
- `src/services/boards/`: reexports para Azure/Jira
- `src/services/orchestration/`: reexports para pos-processamento e orquestracao

O `background.js` agora importa por essas camadas modulares.

Observacao: essa fase descreve a transicao inicial por reexports em `src/services/*`.

Beneficio: prepara a migracao fisica futura dos arquivos por dominio com risco baixo.

## Fase 3 (migracao fisica)

Implementacoes principais foram movidas para os novos modulos:

- `src/services/boards/azure.js`
- `src/services/boards/jira.js`
- `src/services/ai/gemini.js`
- `src/services/ai/copilot.js`
- `src/services/ai/groq.js`
- `src/services/orchestration/postProcessor.js`
- `src/services/orchestration/testGeneration.js`

O `background.js` segue funcionando com os caminhos novos.
Os stubs legados de transicao foram removidos apos a migracao completa dos imports internos.

## Ajuste Atual

- Configuracoes antigas de provedor IA invalido sao normalizadas automaticamente para `gemini`.
- Remocao final dos stubs legados concluida.
- Integracao Grok removida do fluxo funcional (UI, orquestracao e runtime).
- Content scripts usam um bridge unico em `src/content/bridge.js` para runtime/storage, com fallback local para robustez.

## Fase A (arquitetura profissional)

Foi iniciada uma estrutura por camadas sem alterar a logica atual:

- `src/core/`
- `src/contracts/`
- `src/application/`
- `src/infrastructure/ai/`
- `src/infrastructure/boards/`
- `src/infrastructure/browser/`
- `src/infrastructure/persistence/`
- `src/entrypoints/background/`

Nesta fase, os novos arquivos usam reexports ou wrappers basicos para preparar a migracao de imports nas proximas fases com risco baixo.

Essa e a arquitetura-alvo ativa do projeto.

## Fase B (migracao incremental de imports)

Progresso atual:

- `src/services/background.js` agora consome:
  - `src/infrastructure/boards/index.js`
  - `src/infrastructure/ai/index.js`
  - `src/application/index.js`
  - `src/core/constants.js`

Tambem foi centralizada a normalizacao de provedor IA para reduzir duplicacao e manter o comportamento existente.
