# checklist-pre-commit

Skill do Claude Code que aplica o "Checklist antes de concluir" do `CLAUDE.md` do QualiFlow
contra o working tree atual: roda `pytest` e/ou `lint` + `test` + `build` da extensão conforme o
que mudou, procura credenciais coladas no diff e confere contratos de payload/streaming. Só
verifica e reporta (✅/❌/N-A com evidência) — nunca edita, commita ou cria branch.

**Como usar em outro projeto:** copie esta pasta para `.claude/skills/checklist-pre-commit/` do
seu repositório, adapte os comandos e nomes de contrato em `SKILL.md`/`reference.md` ao seu
projeto e reinicie o Claude Code. Depois peça, por exemplo: *"confere se essa mudança está pronta
pra commitar"*.
