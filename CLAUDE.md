# QualiFlow - Instrucoes para agentes

## O Problema

Equipes de QA perdem muito tempo criando casos de teste manualmente: ler criterios de aceite, quebrar em passos, nomear resultados esperados — tudo feito à mão, sem reutilizacao. Quando um caso é copiado para outro card, é preciso ajustar tudo de novo. Nao existe visao clara de quais features estao cobertas por testes e quais sao riscos. **QualiFlow resolve isso**: uma extensao que gera casos de teste com IA diretamente na ferramenta que o time ja usa (Azure DevOps ou Jira), permite copiar e adaptar casos entre cards, e mostra uma matriz visual de cobertura.

## Objetivo do projeto

QualiFlow e uma extensao de navegador para Azure DevOps e Jira que ajuda equipes de QA a:

- carregar contexto de work items;
- avaliar cobertura de testes existentes;
- gerar casos de teste BDD com IA;
- revisar, parametrizar e persistir cenarios localmente;
- reaproveitar casos de teste de outro card;
- adaptar casos copiados ao card alvo;
- salvar casos de teste nos boards;
- exibir a matriz de rastreabilidade de requisitos (RTM).

O repositorio e um monorepo pequeno com dois aplicativos independentes:

- `apps/api`: backend Flask/Python, dono da integracao com IA, OAuth, orquestracao e APIs de boards.
- `apps/extension`: extensao Chrome baseada em Vite + CRXJS, dona da UI, estado do fluxo e comunicacao com o backend.

A documentacao funcional canonica do gerador esta em `docs/DOCUMENTACAO.md`.

## Regras de escopo

- Leia o `README.md` do componente antes de alterar `apps/api` ou `apps/extension`.
- Mantenha mudancas focadas no comportamento pedido. Nao faca refatoracoes amplas junto com uma correcao pequena.
- Preserve APIs publicas, nomes de payloads e formatos de resposta, salvo quando a tarefa exigir uma mudanca de contrato.
- Nao altere arquivos gerados ou artefatos de build (`dist/`, caches, bundles minificados) como fonte de verdade.
- Nao adicione dependencias sem necessidade. Se adicionar uma, atualize o manifesto e o lockfile correspondente.
- Nao crie tokens, credenciais, PATs ou chaves ficticias que possam ser confundidos com segredos reais.
- Nao commite `.env`, tokens OAuth, API keys, sessoes ou dados exportados de boards.
- Nao faca commit nem crie branch automaticamente.

## Arquitetura e fronteiras

### Backend-first

Toda a comunicacao com provedores de IA e boards deve passar pelo backend:

- IA: Gemini, Groq e Copilot sao acessados em `apps/api/src/generation/infrastructure/` (`providers/`, `ai_gateway.py`).
- Boards: Azure DevOps e Jira sao acessados em `apps/api/src/boards/infrastructure/` (`azure/`, `jira/`).
- A extensao usa proxies/clientes HTTP em `apps/extension/src/infrastructure/` (`backend/`, `ai/`, `boards/`).

Nao reintroduza chamadas diretas da extensao para:

- `generativelanguage.googleapis.com`;
- `api.groq.com`;
- endpoints internos do Copilot;
- Azure DevOps com PAT;
- Jira com email + API token.

As API keys de Gemini/Groq entram na requisicao, sao usadas pelo backend e nao devem ser persistidas no backend. Os tokens de sessao OAuth sao temporarios e ficam em memoria; reiniciar o processo invalida as sessoes.

### Backend

O backend e organizado por bounded context (`generation`, `boards`, `auth`, mais `shared` e `observability`).
Cada contexto tem as camadas `domain/` (regras puras: sem Flask, requests ou I/O), `application/` (casos de uso
e portas em `ports.py`), `infrastructure/` (clientes HTTP, provedores, prompt_registry) e `interface/` (blueprints
Flask, parse de request, mapeamento de erro). A dependencia aponta para dentro (`interface -> application ->
domain`); `infrastructure` implementa as portas e cada contexto liga tudo em `container.py`. Rotas nao chamam
cliente HTTP direto: passam por um servico de `application/`.

Pontos principais:

- `apps/api/src/server.py`: composition root (`create_app`, hooks HTTP, bootstrap e registro de blueprints).
- `apps/api/src/generation/`: geracao/adaptacao e IA.
  - `domain/`: criterios, plano/lotes, normalizacao BDD, RTM, pos-processamento, classificacao de erros.
  - `application/`: `generation_service.py` (pipeline e streaming), `copilot_service.py`, `ports.py`.
  - `infrastructure/`: `providers/` (Gemini, Groq, Copilot), `ai_gateway.py`, `prompts.py`, `prompt_registry.py`.
  - `interface/`: `routes.py` (`/api/scenarios/*`, `/api/coverage/evaluate`), `copilot_routes.py`.
- `apps/api/src/boards/`: Azure DevOps e Jira (`domain/` com XML de steps e validacao de deploy,
  `application/` com `AzureBoardService`/`JiraBoardService`, `infrastructure/azure|jira/` com os clientes REST,
  `interface/` com `azure_routes.py` e `jira_routes.py`).
- `apps/api/src/auth/`: middleware (`interface/middleware.py`), estado OAuth (`infrastructure/oauth_state.py`),
  clientes GitHub/Microsoft Entra ID/Atlassian 3LO (`infrastructure/*_client.py`), servicos de login e refresh de
  sessao de board (`application/`) e rotas (`interface/github_routes.py`, `interface/board_login_routes.py`).
- `apps/api/src/shared/`: sessoes em memoria, parsing JSON, metricas, helpers de interface.
- `apps/api/src/observability/`: `/health` e `/metrics/*`.
- `apps/api/prompts/system/`: templates Jinja2 dos prompts.
- `apps/api/prompts/fragments/`: regras compartilhadas de prompts.
- `apps/api/prompts/schemas/`: JSON Schemas e exemplos de saida.
- `apps/api/tests/`: testes locais sem chamadas reais aos provedores, espelhando a estrutura de `src/`.

Rotas de alto nivel:

- `/health`: status do processo e do Copilot.
- `/auth/*`: login e polling das sessoes OAuth.
- `/api/scenarios/generate`: geracao orquestrada em streaming NDJSON.
- `/api/scenarios/adapt`: adaptacao de casos copiados em streaming NDJSON.
- `/api/coverage/evaluate`: avaliacao de cobertura.
- `/api/board/azure/*`: operacoes Azure DevOps.
- `/api/board/jira/*`: operacoes Jira.
- `/metrics/*`: metricas de requisicao e runtime.

### Extensao

A base oficial da extensao e `apps/extension/`.

Arquitetura em camadas (dependencia aponta para dentro: `presentation`/`entrypoints` -> `application` -> `domain`; `infrastructure` implementa as portas e so conhece `domain`; o ESLint barra violacoes):

- `src/domain/`: logica pura (sem `chrome.*`, `fetch` ou DOM): constantes, normalizacao de cenarios e parametros `@campo`, regras de board, RTM, sessoes locais, monitor de suporte.
- `src/application/`: casos de uso (cobertura, geracao/adaptacao, salvamento, dados do card, runner, OAuth, monitor de suporte) com dependencias injetadas.
- `src/infrastructure/`: unica implementacao real de `backend/` (cliente HTTP/NDJSON e OAuth), `ai/` (proxies Gemini/Groq/Copilot), `boards/` (Azure/Jira), `browser/` (runtime, storage, tabs, alarms) e `persistence/` (configuracoes e `qualiflowSavedSessions`).
- `src/entrypoints/background/`: service worker; `index.js` so faz wiring, `container.js` liga portas a adaptadores, `router.js` despacha por action e `handlers/` tem um arquivo por grupo.
- `src/presentation/content/`: content scripts injetados em Azure DevOps, Jira e paginas suportadas (`ui/`, `dashboard/`, `scenarios/`, `runner/`, `shared/`; estado em `state.js`, chamadas ciclicas via `hooks.js`).
- `src/presentation/options/`: pagina de configuracoes.
- `src/contracts/`: contratos de actions/runtime (`runtimeActions.js`).
- `src/styles/`: estilos de content/options pages.
- `apps/extension/tests/`: testes `node --test` dos modulos de `domain/`.

O fluxo do background e a ponte de runtime/storage devem continuar centralizando as mensagens entre content scripts, options page e service worker.

## Setup local

### Backend

Requisitos: Python >= 3.11, recomendado Python 3.12.

```bash
cd apps/api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
python -m src.server
```

O servidor local escuta por padrao em `http://localhost:3000`.

Se um ambiente virtual for removido e recriado no mesmo terminal, rode `hash -r` antes de usar novamente `python` ou `pip` caso o shell tenha mantido um caminho antigo em cache.

O arquivo `.env` e local. Para OAuth funcional, configure os valores necessarios do `.env.example`, especialmente `OAUTH_STATE_SECRET` e os dados do provedor que sera usado. Nunca coloque valores reais no git.

### Extensao

Requisitos: Node.js com npm.

```bash
cd apps/extension
npm install
npm run dev
```

Para carregar a extensao no Chrome:

1. execute `npm run build`;
2. abra `chrome://extensions`;
3. habilite o modo do desenvolvedor;
4. use "Carregar sem compactacao";
5. selecione `apps/extension/dist/`.

A extensao aponta por padrao para o backend hospedado. Para desenvolvimento local, use a configuracao de backend local na propria extensao; o endereco esperado e `http://localhost:3000`.

## Comandos de validacao

Execute os comandos a partir da pasta indicada.

### API

```bash
cd apps/api
source .venv/bin/activate
pytest
```

Os testes sao intencionalmente offline: usam mocks e exemplos dos schemas, sem chamar Gemini, Groq, Copilot, Azure DevOps ou Jira.

Para uma verificacao simples do servidor:

```bash
python -m src.server
curl -s http://localhost:3000/health
```

Para producao/Render, o comando definido em `apps/api/render.yaml` e:

```bash
gunicorn --workers 1 --threads 4 --bind 0.0.0.0:$PORT src.server:app
```

### Extensao

```bash
cd apps/extension
npm run build
npm run lint
npm test
npm run build:obf
```

`npm run build:obf` primeiro cria o build normal e depois ofusca os arquivos JavaScript em `dist/`. A ofuscacao nao e uma fronteira de seguranca e nao deve ser tratada como protecao de segredo.

`npm run lint` roda o ESLint (flat config em `eslint.config.js`, inclui as regras de dependencia entre camadas) e `npm test` roda os testes offline de `domain/` com o runner nativo `node --test`, sem dependencias extras.

## Desenvolvimento do backend

### Orquestracao de IA

A geracao principal segue este fluxo:

1. decomposicao dos criterios;
2. geracao de casos em lotes;
3. construcao da RTM;
4. pos-processamento e normalizacao.

Uma falha em um lote nao deve descartar os lotes que ja produziram casos validos. Preserve esse comportamento ao alterar `apps/api/src/generation/application/generation_service.py`.

As funcoes de prompt devem continuar produzindo JSON completo quando esse for o contrato do estagio. Nao misture texto explicativo na resposta esperada do modelo.

### Prompts e schemas

- Edite o texto de um prompt em `apps/api/prompts/system/*.j2`, nao em uma string Python.
- Reutilize fragmentos em `apps/api/prompts/fragments/` quando a regra for compartilhada.
- Mantenha o exemplo `examples` do schema coerente com a resposta que o modelo deve produzir.
- Use `StrictUndefined`: variaveis ausentes devem falhar cedo, antes de uma chamada ao modelo.
- Se alterar o formato de saida, atualize o JSON Schema, o exemplo e os testes golden relacionados.
- Prefira `prompt_registry.render`, `schema_example` e `validate_against_schema` aos parsers ou templates duplicados.
- Preserve os prefixos/codigos de erro classificados pelas rotas, especialmente `invalid_json_response` e `COPILOT_INVALID_JSON_RESPONSE`.

### OAuth e autenticacao

- O cliente da extensao inicia login e faz polling; o backend controla state, callback e sessoes.
- O middleware deve validar o tipo de sessao correto para cada provedor.
- Tokens de acesso nunca devem aparecer em logs, mensagens de erro, snapshots, testes ou respostas desnecessarias.
- O estado OAuth e as sessoes sao armazenados em memoria. Nao trate esse armazenamento como persistencia duravel ou multi-instancia.
- Ao alterar callbacks, atualize tambem as redirect URIs documentadas e o `.env.example`.

### Rotas e payloads

- Valide bodies JSON e retorne o formato de erro ja usado pela API.
- Preserve streaming NDJSON em `/api/scenarios/generate` e `/api/scenarios/adapt`: cada linha e um evento JSON (`progress`, `result` ou `error`).
- Nao transforme silenciosamente uma resposta de streaming em um objeto JSON unico.
- Use os nomes de payload existentes (`selectedAi`, `cardData`, `generationSettings`, `userFocus`, `technicalDetail`, tokens e URLs de board) salvo mudanca explicita de contrato.
- Ao adicionar uma rota protegida, aplique o middleware de sessao adequado e teste o caso nao autenticado.

## Desenvolvimento da extensao

- Mantenha a arquitetura backend-first e os clientes de servico finos.
- Use `src/contracts/runtimeActions.js` para actions de runtime em vez de espalhar strings novas.
- Preserve o fluxo de `GET_DATA`, `EVALUATE_COVERAGE`, `GENERATE_SCENARIOS`, `ADAPT_COPIED_SCENARIOS`, `SAVE_SCENARIOS`, `GET_TEST_RUNNER_CARDS` e `GET_TEST_CASES_FOR_WORKITEM`.
- O estado de copia diferencia o modo manual, sem RTM, do modo adaptado, com RTM.
- Mantenha a chave de persistencia local `qualiflowSavedSessions` compativel com sessoes existentes.
- Valores editaveis e parametros `@campo` devem continuar sendo normalizados antes do salvamento.
- Nao persista PAT do Azure, email/API token do Jira ou API keys do backend como novo mecanismo de autenticacao.
- Preserve os host permissions do `manifest.json` ao alterar a extensao; mudanças de permissao precisam de justificativa.
- Nao edite diretamente `dist/`; gere-o com Vite.

## Boards

Azure DevOps usa OAuth Microsoft Entra ID e Jira usa Atlassian OAuth 2.0 (3LO). O backend recebe `orgUrl`/`project` do cliente para Azure e usa o `cloud_id` associado a sessao para Jira.

Ao alterar integracoes de board:

- trate respostas externas e erros HTTP explicitamente;
- mantenha timeouts nas chamadas de rede;
- preserve escaping XML usado para passos de casos de teste no Azure;
- valide campos opcionais como assignee, tags, area path e iteration path;
- nao inclua credenciais ou respostas completas de boards em logs de producao;
- atualize testes e documentacao quando um endpoint, campo ou contrato mudar.

## Testes

Para novas mudancas no backend, prefira testes unitarios deterministas em `apps/api/tests/`:

- teste renderizacao de prompt e variaveis obrigatorias;
- valide exemplos contra seus JSON Schemas;
- use `monkeypatch` para provedores externos;
- teste caminhos de erro classificaveis;
- cubra regressao de orquestracao por lotes quando o fluxo for tocado;
- nao dependa de rede, OAuth real ou credenciais locais.

Para mudancas na extensao, sempre execute `npm run lint`, `npm test` e `npm run build`; logica nova em `domain/` deve ter teste em `apps/extension/tests/`. Quando o fluxo visual ou de runtime mudar, carregue o build no Chrome e valide manualmente o caminho afetado no Azure DevOps/Jira. Documente qualquer validacao manual que nao possa ser automatizada.

## Documentacao

Atualize a documentacao proxima ao comportamento alterado:

- `apps/api/README.md`: setup, endpoints, OAuth e backend;
- `apps/extension/README.md`: build, carregamento e arquitetura da extensao;
- `docs/DOCUMENTACAO.md`: comportamento funcional do gerador e fluxos de QA;
- `.env.example`: novas configuracoes sem segredos reais.

Nao use a documentacao historica como autoridade quando ela divergir da secao canonica de `docs/DOCUMENTACAO.md` ou da implementacao atual.

## Checklist antes de concluir

- [ ] A mudanca foi feita no componente dono do comportamento.
- [ ] Nenhuma credencial foi adicionada ao codigo, logs ou testes.
- [ ] Contratos de payload, streaming e sessoes foram preservados ou documentados.
- [ ] Prompts, schemas e exemplos permanecem consistentes.
- [ ] `cd apps/api && pytest` passou quando o backend foi tocado.
- [ ] `cd apps/extension && npm run lint && npm test && npm run build` passaram quando a extensao foi tocada.
- [ ] A documentacao ou `.env.example` foi atualizada quando necessario.
- [ ] Nao foram incluidos `dist/`, caches ou artefatos gerados na mudanca.
