---
name: checklist-pre-commit
description: Roda o checklist "antes de concluir" do CLAUDE.md do QualiFlow contra as mudanças atuais (git diff) — decide se testa o backend (pytest) ou a extensão (npm run lint, test e build) olhando o que mudou, procura credenciais coladas sem querer, confere se contratos de payload/streaming/erro conhecidos foram preservados, e se a documentação foi atualizada. Não faz commit nem edita nada, só reporta. Use quando o usuário pedir pra revisar se uma mudança está pronta pra commitar, abrir PR, ou fechar uma tarefa no QualiFlow.
allowed-tools: Read, Grep, Glob, Bash(git status:*), Bash(git diff:*), Bash(git ls-files:*), Bash(grep:*), Bash(apps/api/.venv/bin/python -m pytest:*), Bash(npm --prefix apps/extension run:*), Bash(npm --prefix apps/extension test:*)
---

# Checklist pré-commit do QualiFlow

## O que ela faz

Aplica, item por item, o checklist "Checklist antes de concluir" do `CLAUDE.md` deste
repositório contra o estado atual do working tree — não uma opinião genérica sobre
qualidade de código, o checklist específico que este projeto já definiu. Reporta cada
item com ✅ / ❌ / N/A e a evidência bruta (comando + saída) que sustenta o veredito.
Nunca commita, nunca cria branch, nunca edita arquivo — só verifica e relata.

## Quando ela dispara (e quando não deveria)

- **Deve disparar:** "confere se essa mudança tá pronta pra eu commitar" / "roda o
  checklist antes de eu abrir o PR" / "posso fechar essa tarefa ou falta alguma coisa?".
- **Não deveria disparar:** "faz o commit pra mim" — isso é executar uma ação que o
  `CLAUDE.md` proíbe fazer automaticamente (`Nao faca commit nem crie branch
  automaticamente`); a skill só verifica, quem decide e comita é o dono do repo. Também
  não deve disparar pra "revisa a qualidade desse código" no sentido genérico (bugs,
  duplicação, nomes) — isso é o `/code-review` do próprio Claude Code, não este
  checklist específico do projeto.

## Passos

Rode um comando por chamada de Bash, sem encadear com `&&`, `;` ou `echo` — as permissões
acima valem por comando, e um encadeamento cai em pedido de aprovação. Só o pipe
`git diff ... | grep ...` do passo 4 é esperado.

1. Rode `git status --short` e `git diff --stat` (working tree + staged) pra descobrir
   quais componentes mudaram: `apps/api`, `apps/extension`, `docs/`, `.env.example`.
2. Se `apps/api/**` mudou: rode, a partir da raiz do repo,
   `apps/api/.venv/bin/python -m pytest apps/api -q` e cole a saída bruta. Se o venv não
   existir nesse caminho, veja [reference.md](reference.md) e avise em vez de improvisar.
3. Se `apps/extension/**` mudou: rode, também da raiz, `npm --prefix apps/extension run
   lint`, `npm --prefix apps/extension test` e `npm --prefix apps/extension run build`
   (os três são exigidos pelo `CLAUDE.md`). Cole a saída final de cada um. Se mudou
   lógica nova em `src/domain/`, confira que há teste correspondente em
   `apps/extension/tests/`.
4. Procure por credenciais coladas sem querer no diff (não em `.env`, que é
   gitignored) — veja os padrões exatos em [reference.md](reference.md).
5. Confira se os nomes de payload e prefixos de erro conhecidos do projeto
   (`selectedAi`, `cardData`, `invalid_json_response`, `COPILOT_INVALID_JSON_RESPONSE`
   etc.) continuam presentes nos arquivos que os usavam — a lista completa está em
   [reference.md](reference.md).
6. Confira se `dist/`, caches ou bundles minificados entraram no diff — não deveriam
   ser fonte de verdade commitada.
7. Confira se a documentação relevante (`apps/api/README.md`,
   `apps/extension/README.md`, `docs/DOCUMENTACAO.md`, `.env.example`) foi tocada
   quando o comportamento que ela descreve mudou.
8. Reporte um checklist final, item por item, cada um com ✅/❌/N-A e a evidência que
   você coletou — nunca "tá tudo certo" sem mostrar o comando.

## Exemplo de invocação

```
confere se essa mudança no backend tá pronta pra eu abrir o PR
```

Resultado esperado: a skill identifica que só `apps/api` mudou, roda `pytest` na pasta
certa, grepa por segredo colado, confere os nomes de payload/erro, e devolve os 8 itens
do checklist com evidência — sem tocar em nenhum arquivo e sem commitar nada.
