# PoC - QualiFlow Backend (Python/Flask) com GitHub Copilot + Login GitHub OAuth

Backend Python (Flask) migrado a partir da versao original em Node.js/Express.

Render Free -> Backend Python -> GitHub OAuth (QA) -> Chamada HTTP direta ao GitHub Copilot -> resposta JSON.

## Logs no terminal

Cada acao relevante gera uma linha `[timestamp] [escopo] mensagem chave=valor` (escopos: `servidor`, `auth`, `http`,
`geracao`, `adaptacao`, `cobertura`, `azure`, `jira`, `copilot-sdk`, `erro`): login (solicitacao, redirecionamento,
conclusao com o usuario, falhas, logout), cada requisicao HTTP (com usuario e duracao), etapas da geracao (plano,
lotes, RTM, duracao), operacoes nos boards e erros classificados. Tokens, secrets e chaves nunca sao registrados
(`shared/log.py` oculta campos sensiveis e valores com formato de token). Health checks e polling de login pendente
ficam de fora para nao poluir o terminal.

Em uso local a API escuta apenas em `127.0.0.1` (use `HOST=0.0.0.0` no `.env` para expor na rede).

## Copilot via SDK oficial em Python (modo padrao)

O backend gera os casos de teste com o **SDK oficial do GitHub Copilot para Python** (`github-copilot-sdk`,
`providers/copilot_sdk.py`). Ele controla o runtime do Copilot CLI como processo filho, entao:

- **nao precisa de Node.js, npm nem instalacao global**: o SDK vem do `pip install -r requirements.txt`;
- na primeira execucao a API baixa o runtime nativo (~150 MB, com checagem de checksum) do GitHub Releases para o
  cache do usuario (`%LOCALAPPDATA%\github-copilot-sdk` no Windows, `~/.cache/github-copilot-sdk` no Linux). O
  download roda em segundo plano ao subir a API (acompanhe no log: "Runtime do Copilot pronto").
- o token da sessao OAuth do QualiFlow e entregue ao runtime pelo SDK (`github_token`, sem usar o login da
  maquina), nunca em argumentos, logs ou disco; o runtime roda em diretorio temporario vazio, sem ferramentas;
- `COPILOT_MODE`: `sdk` (padrao) ou `http` (endpoints internos, abaixo);
- `COPILOT_MODEL` e opcional (vazio = modelo padrao do Copilot); modelo indisponivel -> tenta o proximo;
- `GET /health` mostra `copilot.mode` e `copilot.sdkAvailable`.

## Aviso importante sobre a integracao com o Copilot

Esta versao **nao usa** o pacote `@github/copilot-sdk` (que e Node.js only e spawna o
binario do Copilot CLI). Em vez disso, o `src/generation/infrastructure/providers/copilot.py` chama diretamente:

- `GET https://api.github.com/copilot_internal/v2/token` para trocar o token OAuth do
  usuario por um token de sessao do Copilot.
- `POST https://api.githubcopilot.com/chat/completions` (formato compativel com
  OpenAI chat completions) para obter a resposta do modelo.

Esses dois endpoints sao **internos**, usados pelos editores oficiais (VS Code, Neovim,
JetBrains) e **nao sao uma API publica documentada/suportada pelo GitHub**. Eles podem
mudar ou parar de funcionar sem aviso previo, e o uso deve respeitar os Termos de Servico
do GitHub Copilot. Use por sua conta e risco, principalmente em producao.

## Toda a IA e a orquestracao rodam no backend

A extensao Chrome nao chama mais Gemini, Groq ou Copilot diretamente: ela envia a
API Key (Gemini/Groq) ou a sessao GitHub (Copilot) para este backend, que faz a chamada
ao provedor e devolve o resultado. As API keys **nao sao persistidas** no backend -
trafegam apenas na requisicao e sao descartadas ao final do processamento.

A logica de prompt engineering (decomposicao da historia, geracao em lotes, matriz RTM,
pos-processamento de steps BDD) tambem foi movida para `src/generation/` (pipeline em `application/generation_service.py`, regras puras em `domain/`), para nao
ficar exposta no bundle da extensao.

- `POST /api/scenarios/generate`: gera cenarios (decomposicao -> lotes -> RTM), resposta
  em streaming NDJSON (uma linha JSON por evento: `progress`, `result` ou `error`).
- `POST /api/scenarios/adapt`: adapta cenarios copiados para um novo card, mesmo formato
  de streaming.
- `POST /api/coverage/evaluate`: avalia cobertura de testes existentes (resposta simples).
- `POST /api/gemini/models` / `POST /api/groq/models`: lista modelos disponiveis para a
  key informada no corpo da requisicao.

So as chamadas com `selectedAi: "copilot"` exigem sessao GitHub OAuth
(`Authorization: Bearer <sessionToken>`); Gemini e Groq nao exigem login.

## Boards (Azure DevOps e Jira) tambem via OAuth

PAT do Azure DevOps e email+API Token do Jira foram substituidos por login OAuth:

- **Azure DevOps (alternativa por PAT)**: as rotas `/api/board/azure/*` tambem aceitam o header
  `X-Azure-Pat` com o PAT do usuario, que tem prioridade sobre a sessao OAuth. O backend so o repassa
  ao Azure (Basic auth) e nao o guarda nem o registra em log. A descoberta de organizacoes
  (`/organizations`) so funciona com OAuth; com PAT, informe `orgUrl` e `project` manualmente.
- **Azure DevOps**: login com Microsoft Entra ID (`src/auth/infrastructure/microsoft_client.py`).
  Requer um App Registration no Azure Portal com a permissao delegada
  `user_impersonation` da API "Azure DevOps" (App ID `499b84ac-1321-427f-aa17-267ca6975798`)
  e redirect URI `<backend>/auth/microsoft/callback`.
- **Jira**: login com Atlassian OAuth 2.0 (3LO) (`src/auth/infrastructure/atlassian_client.py`).
  Requer um app em https://developer.atlassian.com/console/myapps/ com os escopos
  `read:jira-work write:jira-work read:me offline_access` e callback
  `<backend>/auth/atlassian/callback`.

Fluxo de login (mesmo padrao do Copilot): `POST /auth/board/session/start`
`{"provider": "microsoft"|"atlassian"}` -> abrir `loginPath` numa aba -> `GET pollPath`
ate `status: "completed"` com um `sessionToken`.

Endpoints de board (todos exigem `Authorization: Bearer <sessionToken>` do provedor
correspondente): `/api/board/azure/*` (work-item, dashboard, test-case-analytics,
support-cards, project-iterations, deploy-validation, test-runner-cards,
test-cases-for-work-item, test-points, test-run, run-results, adhoc-results,
test-result, complete-run, bug, work-items-state, attachment, test-case) e
`/api/board/jira/*` (issue, test-case). `org_url`/`project` (Azure) continuam sendo
enviados pelo cliente a cada chamada (nao sao segredo); o `cloud_id` do Jira fica
fixo na sessao, escolhido no momento do login.

## Escopo desta PoC

Incluido:
- API HTTP Python (Flask) com endpoint `POST /api/copilot/test`.
- Login via GitHub OAuth com armazenamento temporario em memoria.
- Sessao temporaria (`sessionToken`) para chamadas autenticadas.
- Prompt QA para gerar 2 casos BDD em portugues brasileiro e retorno JSON valido.
- Logs basicos e tratamento de erros de autenticacao/comunicacao.
- Configuracao de deploy no Render Free.

Nao incluido:
- Integracao com extensao Chrome.
- Azure DevOps.
- Banco de dados.
- OAuth da extensao Chrome.

## Estrutura

O backend segue uma arquitetura em camadas estilo DDD, organizada por bounded context. Cada contexto
tem as camadas `domain/` (regras puras, sem Flask/requests/I-O), `application/` (casos de uso e portas),
`infrastructure/` (clientes HTTP, provedores, prompt_registry) e `interface/` (blueprints Flask). A
dependencia aponta sempre para dentro: `interface -> application -> domain`, com `infrastructure`
implementando as portas de `application`. Cada contexto liga as pecas em `container.py`.

```
src/
  server.py                 # Composition root: create_app(), hooks HTTP, registro de blueprints, gunicorn src.server:app
  shared/                   # Kernel compartilhado, sem dependencia de contexto
    json_utils.py           # Parsing tolerante de JSON vindo de respostas de LLM
    session_store.py        # Sessoes/auth requests em memoria (genericos p/ qualquer provedor)
    request_metrics.py      # Metricas agregadas de requisicoes HTTP
    runtime_metrics.py      # Snapshot de CPU/memoria do processo
    scenario_params.py      # Parametros @campo de um cenario (usado por geracao e boards)
    clock.py                # now_iso() para logs
    interface/              # Helpers Flask: error_response, set_metric_error_code, hooks HTTP globais
  generation/               # Geracao/adaptacao de cenarios e provedores de IA
    domain/                 # Criterios, plano/lotes, normalizacao BDD, RTM, pos-processamento, classificacao de erros
    application/            # GenerationService (pipeline decomposicao->lotes->RTM, streaming), CopilotService, ports.py
    infrastructure/         # ai_gateway.py (Gemini/Groq/Copilot), providers/, prompts.py (PromptCatalog), prompt_registry.py
    interface/              # routes.py (/api/scenarios/*, /api/coverage/evaluate, /api/*/models), copilot_routes.py (/api/copilot/*)
    container.py
  boards/                   # Integracao com Azure DevOps e Jira
    domain/                 # XML de Test Case (escaping), validacao de deploy, iteracoes, assignee, ADF/Jira
    application/            # AzureBoardService, JiraBoardService, ports.py
    infrastructure/azure/   # http, discovery, work_items, reports, test_cases, test_runs, gateway
    infrastructure/jira/    # client, issues, gateway
    interface/              # azure_routes.py, jira_routes.py (/api/board/*), common.py (sessao de board)
    container.py
  auth/                     # Login GitHub (Copilot) + login de boards (Microsoft/Atlassian)
    domain/                 # Extracao de Bearer token, tipo de sessao, escolha do site Jira
    application/            # OAuthLoginService, BoardSessionService (refresh de token), erros
    infrastructure/         # github_client, microsoft_client, atlassian_client, oauth_state (assinatura do state)
    interface/              # middleware.py (require_auth_session), github_routes.py, board_login_routes.py
    container.py
  observability/interface/  # /health e /metrics/*
prompts/                    # Conteudo dos prompts usados por src/generation, carregado via prompt_registry
  system/                   # Um template Jinja2 por prompt (qa_generator, qa_evaluator, qa_test_debug,
                            # decomposition, batch_generation, rtm, adaptation)
  fragments/                # Blocos de instrucao reutilizados entre prompts (_json_only.j2, _gherkin_rules.j2, ...)
  schemas/                  # Um JSON Schema por formato de saida esperado (tambem usado para validar a resposta)
tests/                      # Espelha a estrutura de src/ (offline: sem rede nem credenciais)
  shared/ generation/ boards/ auth/
```

- `render.yaml`: deploy para Render.
- `.env.example`: variaveis de ambiente (sem segredos reais - preencha o seu `.env`).
- Para editar o texto/regras de um prompt de `src/generation/infrastructure/prompts.py`, edite o `.j2`
  correspondente em `prompts/` (nao o Python) e rode `pytest tests/generation/test_prompt_registry.py`.
- Regras puras (domain) novas devem ganhar testes unitarios em `tests/<contexto>/` sem monkeypatch de rede;
  casos de uso se testam injetando gateways falsos nos servicos de `application/`.

## Pre-requisitos

- Python >= 3.11 (recomendado 3.12.x).
- Conta GitHub com acesso ao Copilot.
- GitHub OAuth App criado (Client ID + Client Secret).

## Configurar OAuth App no GitHub

1. Acesse GitHub -> Settings -> Developer settings -> OAuth Apps -> New OAuth App.
2. Preencha:
- Application name: `QualiFlow Copilot PoC`
- Homepage URL: URL do backend (local ou Render)
- Authorization callback URL: `http://localhost:3000/auth/github/callback` (local)
3. Crie o app e copie:
- `Client ID`
- `Client Secret`

Para Render, ajuste callback para:
- `https://SEU-SERVICO.onrender.com/auth/github/callback`

## Instalacao local

1. Entre na pasta da API:

```bash
cd apps/api
```

2. Crie e ative um ambiente virtual:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

3. Instale dependencias:

```bash
pip install -r requirements.txt
```

4. Crie o arquivo de ambiente:

```bash
cp .env.example .env
```

5. Configure `.env`:

```env
PORT=3000
FLASK_ENV=development
GITHUB_OAUTH_CLIENT_ID=seu_client_id
GITHUB_OAUTH_CLIENT_SECRET=seu_client_secret
GITHUB_OAUTH_REDIRECT_URI=http://localhost:3000/auth/github/callback
GITHUB_OAUTH_SCOPES=read:user user:email
# Compartilhado pelos 3 logins OAuth (GitHub, Microsoft, Atlassian) -- sempre obrigatorio,
# mesmo que voce so va usar o login Microsoft/Atlassian e nunca configure o GitHub.
OAUTH_STATE_SECRET=uma-chave-forte-qualquer
AUTH_STATE_TTL_MS=600000
AUTH_SESSION_TTL_MS=28800000
COPILOT_MODEL=claude-sonnet-4.5
COPILOT_MODEL_FALLBACKS=gpt-5-mini,claude-opus-4.5
COPILOT_REQUEST_TIMEOUT_MS=120000
```

Observacoes:
- Nao use `ghp_` (PAT classico) para esse fluxo.
- Esta PoC foi desenhada para token OAuth de usuario (`gho_`/`ghu_`) via login GitHub.
- As sessoes sao armazenadas em memoria e se perdem ao reiniciar o processo.

## Executar localmente

```bash
python -m src.server
```

Servidor padrao: `http://localhost:3000`

### Uso local pelos QAs (sem o Render)

1. Cada QA cria o proprio `.env` a partir de `.env.example` (nunca compartilhe um `.env` preenchido nem o `.venv`/`node_modules`).
2. Cada QA precisa de um OAuth App proprio no GitHub (callback `http://localhost:3000/auth/github/callback`) e, para os boards, dos apps Microsoft Entra ID / Atlassian com callback em `localhost:3000`. Sem isso o login nao funciona.
3. A conta GitHub usada no login precisa ter assinatura ativa do Copilot.
4. Suba a API (`python -m src.server`) antes de usar a extensao e, na extensao, ative o Modo Desenvolvedor (ou informe `http://localhost:3000`) para nao cair no backend do Render.
5. Os timeouts do Copilot em `.env.example` ja estao ajustados para uso local; as sessoes ficam em memoria, entao reiniciar a API exige novo login.

## Testes

Os testes sao offline (mocks/gateways falsos, sem Gemini/Groq/Copilot/Azure DevOps/Jira):

```bash
cd apps/api
.venv/bin/pytest -q   # ou `pytest` com o venv ativado
```

## Fluxo de teste local

1. Verificar status:

```bash
curl -s http://localhost:3000/auth/status
```

2. Abrir login OAuth no navegador:

```bash
xdg-open http://localhost:3000/auth/github/login
```

3. Ao concluir login, a pagina de callback mostra o `sessionToken`.

4. Testar usuario autenticado:

```bash
curl -s http://localhost:3000/auth/me -H "Authorization: Bearer SEU_SESSION_TOKEN"
```

5. Chamar Copilot:

```bash
curl -s -X POST http://localhost:3000/api/copilot/test \
  -H "Authorization: Bearer SEU_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Validar login com usuario e senha validos e invalidos"}'
```

Resposta esperada (exemplo):

```json
{
  "success": true,
  "response": "{\"test_cases\":[{...},{...}]}",
  "user": {
    "login": "seu_usuario",
    "id": 123
  }
}
```

## Deploy no Render Free

### Opcao A - Blueprint com render.yaml

1. Suba o repositorio no GitHub.
2. No Render, clique em New + -> Blueprint.
3. Selecione o repositorio.
4. O Render detecta `apps/api/render.yaml`.
5. Configure env vars obrigatorias no servico:
- `GITHUB_OAUTH_CLIENT_ID`
- `GITHUB_OAUTH_CLIENT_SECRET`
- `GITHUB_OAUTH_REDIRECT_URI=https://SEU-SERVICO.onrender.com/auth/github/callback`
- `OAUTH_STATE_SECRET`
6. Conclua o deploy.

### Opcao B - Web Service manual

1. New + -> Web Service.
2. Root Directory: `apps/api`.
3. Build Command: `pip install -r requirements.txt`.
4. Start Command: `gunicorn --workers 1 --threads 4 --bind 0.0.0.0:$PORT src.server:app`.
5. Runtime: Python 3.12.
6. Variaveis de ambiente:
- `FLASK_ENV=production`
- `GITHUB_OAUTH_CLIENT_ID=<valor>`
- `GITHUB_OAUTH_CLIENT_SECRET=<secret>`
- `GITHUB_OAUTH_REDIRECT_URI=https://SEU-SERVICO.onrender.com/auth/github/callback`
- `GITHUB_OAUTH_SCOPES=read:user user:email`
- `OAUTH_STATE_SECRET=<chave-forte>`
- `AUTH_STATE_TTL_MS=600000`
- `AUTH_SESSION_TTL_MS=28800000`
- `AZURE_AD_CLIENT_ID=<valor>`
- `AZURE_AD_CLIENT_SECRET=<secret>`
- `AZURE_AD_REDIRECT_URI=https://SEU-SERVICO.onrender.com/auth/microsoft/callback`
- `ATLASSIAN_CLIENT_ID=<valor>`
- `ATLASSIAN_CLIENT_SECRET=<secret>`
- `ATLASSIAN_REDIRECT_URI=https://SEU-SERVICO.onrender.com/auth/atlassian/callback`
- `COPILOT_MODEL=claude-sonnet-4.5`
- `COPILOT_MODEL_FALLBACKS=gpt-5-mini,claude-opus-4.5`
- `COPILOT_REQUEST_TIMEOUT_MS=120000`

> Importante: mantenha `--workers 1` (ou compartilhe estado via um backend externo) pois
> as sessoes e metricas ficam em memoria de processo. Com mais de um worker, cada
> processo teria seu proprio estado isolado.

## Endpoints

- `GET /health`: status do backend.
- `GET /auth/status`: status da configuracao OAuth e sessoes ativas.
- `GET /auth/github/login`: inicia login GitHub.
- `GET /auth/github/callback`: callback OAuth e emissao de `sessionToken`.
- `GET /auth/me`: dados do usuario autenticado via `Authorization: Bearer <sessionToken>`.
- `POST /auth/logout`: invalida sessao atual.
- `POST /api/copilot/test`: executa prompt QA autenticado.
- `POST /api/copilot/generate`: gera cenarios de teste BDD a partir de um card.
- `POST /api/copilot/evaluate`: avalia cobertura de testes existentes.
- `GET /api/copilot/models`: lista modelos candidatos configurados.
- `GET /metrics/runtime`: snapshot de CPU/memoria do processo.
- `GET /metrics/report`: relatorio agregado de requisicoes (protegido por `METRICS_ADMIN_KEY`, se definido).
- `POST /metrics/reset`: reseta a janela de metricas.

## Integracao com a extensao Chrome

Quando o provedor selecionado na extensao for `GitHub Copilot`, ela passa a usar este backend Render.

Campos esperados na tela de configuracoes da extensao:
- `Copilot Backend URL`: URL publica do backend (ex.: `https://qualiflow-gerador-de-cts.onrender.com`).
- `Session Token OAuth do Copilot`: token temporario retornado no callback de login.
- `Modelo Copilot`: modelo preferido para a sessao.

Fluxo resumido para o QA:
1. Acessar `GET /auth/github/login` no backend.
2. Concluir login GitHub OAuth.
3. Copiar `sessionToken` exibido no callback.
4. Colar esse token na extensao.
5. Gerar/evaluar cenarios normalmente (a extensao chama este backend internamente).

## Diagnostico rapido

- `401 AUTH_REQUIRED`: faltou `Authorization: Bearer <sessionToken>`.
- `401 AUTH_SESSION_INVALID`: sessao expirada/invalida, refaca login.
  Tambem ocorre ao enviar um token de sessao de board (Microsoft/Atlassian) para uma rota do Copilot.
- `401 BOARD_SESSION_WRONG_PROVIDER`: token de sessao de outro provedor (ex.: GitHub) enviado para uma rota de board.
- `AI_KEY_MISSING` (evento `error` do stream): API key do Gemini/Groq nao informada nas configuracoes.
- `401 COPILOT_AUTH_ERROR`: token OAuth sem permissao para Copilot.
- `401 COPILOT_AUTH_UNSUPPORTED_TOKEN`: token nao suportado (ex.: `ghp_`).
- `500 COPILOT_CLI_INIT_ERROR`: falha ao iniciar runtime CLI.
- `504 COPILOT_TIMEOUT`: tempo limite na resposta do modelo.
