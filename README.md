# QualiFlow

**Gerador de casos de teste com IA para Azure DevOps e Jira.**

QualiFlow é uma extensão de navegador que integra geração de cenários de teste com IA (Gemini, Groq, Copilot) direto na ferramenta de work tracking que sua equipe já usa. Crie, revise, parametrize e reutilize casos de teste sem sair do board.

## O que faz

- **Gera casos de teste BDD** a partir de histórias e critérios de aceite, usando IA
- **Copia e adapta** casos entre cartões, mantendo o contexto atualizado
- **Avalia cobertura** de testes automaticamente
- **Mostra matriz de rastreabilidade** de requisitos vs. testes
- **Funciona nativamente** dentro do Azure DevOps e Jira, sem ferramentas externas

## Setup

Este é um monorepo com backend (Flask) e extensão (Chrome/Vite). Veja os READMEs específicos:

- **[Backend](./apps/api/README.md)**: Python 3.11+, orquestra IA e OAuth
  ```bash
  cd apps/api
  python3 -m venv .venv && source .venv/bin/activate
  pip install -r requirements-dev.txt
  python -m src.server  # http://localhost:3000
  ```

- **[Extensão](./apps/extension/README.md)**: Node.js, UI injetada no navegador
  ```bash
  cd apps/extension
  npm install && npm run dev
  npm run build  # Carregar em chrome://extensions
  ```

## Guia rápido para desenvolvedores

1. Leia [CLAUDE.md](./CLAUDE.md) para entender arquitetura, regras de escopo e padrões
2. Leia o README do componente que vai alterar (`apps/api/` ou `apps/extension/`)
3. Rode testes: `cd apps/api && pytest` ou `cd apps/extension && npm run build`
4. Para mudar prompts/IA: edite `apps/api/prompts/` e valide contra schemas
5. Para mudar UI/fluxo: teste manualmente no Chrome depois do build

Veja [docs/DOCUMENTACAO.md](./docs/DOCUMENTACAO.md) para o comportamento funcional completo.
