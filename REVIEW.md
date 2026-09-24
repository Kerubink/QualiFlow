# REVIEW — Skills próprias do QualiFlow

Três skills em `.claude/skills/`, cada uma cobrindo uma tarefa que se repete de verdade
neste projeto (backend Flask/Python com prompts de IA versionados, testes offline, e um
checklist de "antes de concluir" já definido no `CLAUDE.md`).

---

# Skill 1 — `gerar-teste-pytest`

## O que é

`.claude/skills/gerar-teste-pytest/` — skill que gera um teste pytest offline e
determinístico para uma função ou módulo do backend Flask em `apps/api/src`, seguindo o
padrão de testes já usado no QualiFlow (`monkeypatch` para tudo que é externo, sem
chamada real a Gemini/Groq/Copilot/Azure/Jira, um teste por comportamento).

**Por que essa e não outra:** é uma tarefa que eu já fiz mais de duas vezes do mesmo
jeito no projeto (existem 4 arquivos de teste manuais em `apps/api/tests/` seguindo o
mesmo estilo). É repetitivo o suficiente pra virar skill, mas específico o bastante ao
domínio do QualiFlow (convenções de `monkeypatch`, proibição de rede real, streaming
NDJSON) pra não ser um "gerador de teste genérico".

### Frontmatter

```yaml
name: gerar-teste-pytest
description: Gera um teste pytest determinístico e offline para uma função ou módulo do backend Flask em apps/api/src, seguindo o padrão de testes já usado no QualiFlow (monkeypatch para dependências externas, sem chamadas reais a Gemini/Groq/Copilot/Azure/Jira, um teste por comportamento). Use quando o usuário pedir para criar, adicionar ou cobrir com teste unitário uma função, arquivo ou módulo Python dentro de apps/api.
allowed-tools: Read, Write, Bash, Glob, Grep
```

`allowed-tools` foi restrito ao mínimo: `Read`/`Glob`/`Grep` pra entender a função-alvo
e o padrão de testes existente, `Write` pra criar o arquivo de teste, `Bash` só pra
rodar `pytest`. Nada de edição livre do código de produção, nada de acesso de rede.

### Progressive disclosure

`SKILL.md` tem o "o quê" e o "quando" (o que faz, os dois exemplos de gatilho,
os passos). O `reference.md` tem o "como, em detalhe": o esqueleto exato do arquivo de
teste e os casos-limite já conhecidos neste projeto (JSON malformado de LLM, streaming
NDJSON, falha parcial de lote, variável de ambiente obrigatória ausente) — conteúdo que
só importa depois que a skill já foi disparada, então não custa token em toda sessão.

## Exemplo de invocação real

Rodei a skill num agente novo (sem o contexto desta conversa), com este prompt — uma
tarefa real do projeto: `apps/api/src/core/json_utils.py` tinha a função
`parse_json_loosely` sem nenhum teste cobrindo.

**Prompt usado:**

```
No backend do QualiFlow, crie um teste pytest para a função parse_json_loosely
(e se fizer sentido, strip_markdown_code_fence) que fica em
apps/api/src/core/json_utils.py, seguindo o padrão de testes já usado no projeto.
Depois rode a suíte pra confirmar que o teste passa.
```

**O que o agente fez** (na ordem, seguindo os passos do `SKILL.md`):
1. Leu `CLAUDE.md`, o `SKILL.md`/`reference.md` da skill, `json_utils.py` (arquivo-alvo),
   dois testes existentes (`test_oauth_state.py`, `test_prompt_registry.py`) pra copiar
   o estilo, e `conftest.py` pro setup de import.
2. Escreveu `apps/api/tests/test_json_utils.py` com 7 testes: JSON limpo, JSON dentro de
   cerca ` ```json `, vírgula sobrando antes de `}`/`]`, aspas curvas do Word, texto sem
   JSON válido nenhum (deve levantar `RuntimeError` com `AI_INVALID_JSON_RESPONSE`), e
   dois testes diretos de `strip_markdown_code_fence`.
3. Rodou a suíte e reportou o resultado bruto.

**Arquivo gerado** (`apps/api/tests/test_json_utils.py`):

```python
import pytest

from src.core import json_utils


def test_parse_json_loosely_parses_clean_json():
    result = json_utils.parse_json_loosely('{"total_criterios": 2}')
    assert result == {"total_criterios": 2}


def test_parse_json_loosely_strips_markdown_code_fence():
    text = '```json\n{"total_criterios": 2}\n```'
    result = json_utils.parse_json_loosely(text)
    assert result == {"total_criterios": 2}


def test_parse_json_loosely_tolerates_trailing_comma():
    text = '{"a": 1, "b": [1, 2,],}'
    result = json_utils.parse_json_loosely(text)
    assert result == {"a": 1, "b": [1, 2]}


def test_parse_json_loosely_normalizes_curly_quotes():
    text = "{“a”: “b”}"
    result = json_utils.parse_json_loosely(text)
    assert result == {"a": "b"}


def test_parse_json_loosely_raises_runtime_error_when_no_valid_json():
    with pytest.raises(RuntimeError, match="AI_INVALID_JSON_RESPONSE"):
        json_utils.parse_json_loosely("desculpe, nao consigo gerar isso agora.")


def test_strip_markdown_code_fence_removes_json_fence():
    text = '```json\n{"a": 1}\n```'
    assert json_utils.strip_markdown_code_fence(text) == '{"a": 1}'


def test_strip_markdown_code_fence_returns_empty_string_for_none():
    assert json_utils.strip_markdown_code_fence(None) == ""
```

**Resultado bruto** (`cd apps/api && source ../../.venv/bin/activate && pytest tests/test_json_utils.py -q`, re-executado por mim para confirmar):

```
.......                                                                  [100%]
7 passed in 0.01s
```

Suíte completa do backend, sem regressão (checklist do `CLAUDE.md`):

```
$ pytest -q
....................................                                     [100%]
36 passed in 0.20s
```

Nenhuma função de produção foi alterada; nenhuma chamada de rede real foi feita.

## Observação honesta (não escondida)

O agente de teste não encontrou a skill listada automaticamente pela ferramenta de
skills do harness — skills em `.claude/skills/` de um repositório são carregadas na
inicialização da sessão, e o agente novo foi instanciado depois que os arquivos já
existiam no disco mas antes de qualquer novo escaneamento. Ele leu o `SKILL.md`/
`reference.md` diretamente do disco e seguiu os passos ao pé da letra — o resultado é
o mesmo, mas isso significa que a prova de disparo automático "por descrição" (o
`/context` antes/depois pedido no Lab 2) ainda precisa ser feita numa sessão nova do
Claude Code, aberta depois que a skill já está no repo. Registro isso para não passar
"funcionou" sem qualificar exatamente o que foi (e o que não foi) testado.

### Pendente (skill 1)

- Rodar `/context` antes e depois de invocar `/gerar-teste-pytest` numa sessão nova
  (prova numérica de progressive disclosure).
- Validação cruzada com um segundo domínio (os 3 cenários: dispara quando deve, não
  dispara quando não deve, falso positivo) — ainda não feita.

---

# Skill 2 — `adicionar-prompt-ia`

## O que é

`.claude/skills/adicionar-prompt-ia/` — monta os três arquivos que todo estágio de
prompt de IA do QualiFlow precisa: template Jinja2 em `prompts/system/`, JSON Schema
com `examples` em `prompts/schemas/`, e a entrada correspondente no teste golden de
`test_prompt_registry.py`. Garante que o schema seja a única fonte de verdade entre o
formato mostrado ao modelo e o formato validado na resposta.

**Por que essa:** já existem 7 pares template+schema no projeto (`qa_generator`,
`qa_evaluator`, `qa_test_debug`, `adaptation`, `batch_generation`, `decomposition`,
`rtm`), todos seguindo a mesma estrutura à mão. É uma tarefa mecânica o suficiente pra
errar por esquecimento (ex.: esquecer de adicionar o schema novo a `SCHEMA_NAMES`) e
específica o bastante ao `prompt_registry.py` deste projeto pra não ser um "gerador de
prompt genérico".

### Frontmatter

```yaml
name: adicionar-prompt-ia
description: Cria um novo estágio de prompt de IA no backend do QualiFlow — template Jinja2 em apps/api/prompts/system/, JSON Schema com "examples" em apps/api/prompts/schemas/, e o teste golden que valida o example contra o próprio schema — seguindo exatamente o padrão de prompt_registry.py (fonte única de verdade entre o formato mostrado ao modelo e o formato validado na resposta). Use quando o usuário pedir para criar ou adicionar um novo prompt/schema de IA no backend do QualiFlow, não para editar o texto de um prompt já existente.
allowed-tools: Read, Write, Bash, Glob, Grep
```

### Progressive disclosure

`SKILL.md` tem os passos gerais. `reference.md` tem a lista dos 4 fragments
reutilizáveis existentes (`_json_only.j2`, `_gherkin_rules.j2`,
`_naming_convention.j2`, `_objective_instruction.j2` — quando usar cada um e quando
não), o esqueleto mínimo de um schema novo, e o prefixo de erro (`invalid_json_response`)
que a validação já reconhece — conteúdo que só importa na hora de escrever o schema,
não em toda invocação.

## Exemplo de invocação real

**Prompt usado** (agente novo, sem contexto desta conversa):

```
crie um novo prompt de IA pra gerar um resumo executivo de até 3 linhas de um work
item, com o schema e o teste golden
```

**O que o agente fez:** leu `prompt_registry.py`, o par `qa_test_debug.j2` +
`qa_test_debug.schema.json` como referência, o bloco `ITEM DE TRABALHO:` de
`qa_generator.j2` pra reaproveitar os campos de `work_item`, e a lista de fragments —
depois escreveu os três arquivos.

**`prompts/system/resumo_executivo.j2`** (novo):
```jinja
Voce e um especialista em QA e gestao de produto.

{% include "fragments/_json_only.j2" %}

TAREFA:
Gere um resumo executivo objetivo do item de trabalho abaixo, com no maximo 3 linhas...

ITEM DE TRABALHO:
- ID: {{ work_item.id }}
- Titulo: {{ work_item.title }}
- Descricao: {{ work_item.description }}
- Criterios de aceite: {{ work_item.acceptance_criteria }}
- Tags: {{ work_item.tags }}

FORMATO JSON ESPERADO (retorne EXATAMENTE UM objeto JSON com esta estrutura):
{{ expected_json_structure | tojson(2) }}
```

**`prompts/schemas/resumo_executivo.schema.json`** (novo):
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Resumo executivo de um work item",
  "type": "object",
  "required": ["resumo_executivo"],
  "properties": {
    "resumo_executivo": {
      "type": "array",
      "minItems": 1,
      "maxItems": 3,
      "items": { "type": "string", "minLength": 1 }
    }
  },
  "examples": [{ "resumo_executivo": ["string", "string", "string"] }]
}
```

**`tests/test_prompt_registry.py`**: `"resumo_executivo.schema.json"` adicionado à
lista `SCHEMA_NAMES` (teste parametrizado já existente cobre a validação automaticamente).

**Resultado bruto** (`pytest tests/test_prompt_registry.py -q`, re-executado por mim):

```
.............                                                            [100%]
13 passed in 0.24s
```

Suíte completa do backend, sem regressão:

```
$ pytest -q
.....................................                                    [100%]
37 passed in 0.31s
```

Nenhum arquivo de `orchestration.py`/`copilot.py` foi tocado — como o `SKILL.md`
explicita, encaixar o estágio no fluxo de orquestração é uma tarefa à parte.

---

# Skill 3 — `checklist-pre-commit`

## O que é

`.claude/skills/checklist-pre-commit/` — aplica, item por item, o "Checklist antes de
concluir" que já existe no `CLAUDE.md` deste repositório contra o estado atual do
working tree. Não é revisão de qualidade genérica: é o checklist específico que este
projeto já definiu (testa o componente certo, procura credencial, confere contratos de
payload/erro/streaming, confere documentação). Só lê e roda comandos — nunca commita,
nunca edita.

### Frontmatter

```yaml
name: checklist-pre-commit
description: Roda o checklist "antes de concluir" do CLAUDE.md do QualiFlow contra as mudanças atuais (git diff) — decide se testa o backend (pytest) ou a extensão (npm run build) olhando o que mudou, procura credenciais coladas sem querer, confere se contratos de payload/streaming/erro conhecidos foram preservados, e se a documentação foi atualizada. Não faz commit nem edita nada, só reporta. Use quando o usuário pedir pra revisar se uma mudança está pronta pra commitar, abrir PR, ou fechar uma tarefa no QualiFlow.
allowed-tools: Bash, Read, Grep, Glob
```

### Progressive disclosure

`SKILL.md` tem os 8 passos do checklist. `reference.md` tem os padrões de regex
exatos pra credencial (token GitHub/Gemini/Groq, chave PEM, `client_secret`/`api_key`),
a lista completa de nomes de contrato a conferir (`selectedAi`, `cardData`,
`invalid_json_response`, `qualiflowSavedSessions`, as 7 actions de runtime), e como
achar o venv do jeito certo (a raiz do repo, não `apps/api/.venv` como o `CLAUDE.md`
documenta) — detalhe que só importa na hora de rodar, não em toda invocação.

## Exemplo de invocação real

Rodada contra o estado **real** do working tree deste repositório (que já tinha uma
mudança grande em andamento: refactor de OAuth/prompts + feature de auto-discovery de
Azure DevOps).

**Prompt usado:**

```
confere se essa mudança tá pronta pra eu abrir o PR
```

**Comandos que a skill rodou e resultado bruto:**

Backend (venv encontrado na raiz do repo, não em `apps/api/.venv`):
```
$ pytest
collected 36 items
tests/test_azure_discovery.py ....                    [11%]
tests/test_json_utils.py .......                       [30%]
tests/test_oauth_state.py ...                          [38%]
tests/test_orchestration_prompts.py ..........         [66%]
tests/test_prompt_registry.py ............             [100%]
36 passed in 0.28s
```

Extensão:
```
$ npm run build
✓ 39 modules transformed
✓ built in 6.44s
```
(único aviso: chunk `analyticsCharts.js` > 500kB, pré-existente)

Grep de credenciais no diff: nenhum resultado (sem falso positivo, sem falso negativo
óbvio).

**Checklist final devolvido pela skill:**

| # | Item | Veredito |
|---|------|----------|
| 1 | Mudança no componente dono | ✅ |
| 2 | Nenhuma credencial adicionada | ✅ |
| 3 | Contratos preservados | ✅ (com observação: 2 actions novas usam string literal em vez de `runtimeActions.js` — mas é o padrão já existente no arquivo, não regressão desta mudança) |
| 4 | Prompts/schemas/exemplos consistentes | ✅ |
| 5 | `pytest` passou | ✅ (36 passed) |
| 6 | `npm run build` passou | ✅ |
| 7 | Documentação atualizada | ⚠️ Parcial — a feature de auto-discovery de Azure (dropdowns novos) não foi documentada em `apps/extension/README.md` nem em `docs/DOCUMENTACAO.md` |
| 8 | Nenhum artefato de build no diff | ✅ |

A skill também sinalizou, fora do checklist formal, dois achados reais que eu não tinha
pedido: um `REVIEW.md` órfão de outra sessão na raiz do repo (que na verdade sou eu
escrevendo este arquivo agora), e que `.gitignore` tinha ganhado duas linhas
(`CLAUDE.md`, `.claude`) fora do escopo da mudança de Azure — o que puxou o achado
crítico descrito abaixo.

## Achado crítico descoberto ao rodar esta skill: `.gitignore` bloqueava `CLAUDE.md` e `.claude/`

Antes desta sessão, o `.gitignore` do repositório já tinha sido editado (sem commit)
para incluir:

```
CLAUDE.md
.claude
```

Isso significa que **as skills recém-criadas (`.claude/skills/`) e o próprio
`CLAUDE.md` nunca apareceriam em `git status`/`git add`** — ambos são exigidos pelo
próprio critério do desafio ("commit feito, com `CLAUDE.md` e a skill dentro do
repositório"). Removi as duas linhas do `.gitignore` (confirmado com o usuário antes de
editar). Como consequência de checar isso, também descobri que **o `CLAUDE.md` deste
repositório nunca teve um commit** (`git log --all -- CLAUDE.md` não retorna nada) —
ele existe só no disco. Isso ainda está pendente de decisão do usuário (commitar ou
não), não resolvi sozinho.

## Pendente (geral)

- Decidir e commitar `CLAUDE.md` (nunca teve commit neste repositório).
- Commit isolado das 3 skills (`.claude/skills/`) + `REVIEW.md`, separado do refactor
  de OAuth/prompts/Azure que já está em andamento na working tree.
- `/context` antes/depois de invocar cada skill numa sessão nova (prova numérica de
  progressive disclosure) — pendente pras 3 skills.
- Validação cruzada nos 3 cenários (dispara quando deve / não dispara quando não deve /
  falso positivo) — pendente pras 3 skills.
- Resolver o item 7 do checklist (documentar a feature de auto-discovery de Azure) —
  achado da própria skill 3, não bloqueia a entrega da skill em si.
