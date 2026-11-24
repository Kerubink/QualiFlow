# QualiFlow - Como a extensao funciona

Ultima atualizacao: 2026-10-28

Guia funcional para quem usa a extensao no dia a dia de QA. Mostra o que acontece em cada etapa,
sem detalhes de codigo.

## O que e

Extensao de navegador para **Azure DevOps** e **Jira** que gera casos de teste (CTs) em BDD com IA
direto no card, permite reaproveitar CTs de outro card e salva o resultado no proprio board.

## Antes de usar

1. **Board**: faca login com Microsoft (Azure DevOps) ou Atlassian (Jira) nas Configuracoes e
   escolha organizacao/projeto (Azure) ou dominio/project key (Jira).
2. **IA**: escolha o provedor e informe o que ele exige:
   - **Gemini** e **Groq**: sua chave de API.
   - **Copilot**: login com sua conta GitHub (e preciso ter acesso ao Copilot). Nao usa chave de API.
3. Opcional: informe o seu e-mail de QA para que os CTs criados no Azure venham atribuidos a voce.

Sem essas configuracoes a extensao avisa e nao abre o card.

## Visao do fluxo

```
Abrir card -> (Avaliar cobertura) -> Gerar CTs  ----------------\
                                  \-> Reaproveitar CTs de outro card
                                       -> (Ajustes automaticos) ---> Revisar e editar
                                                                        -> Salvar localmente (opcional)
                                                                        -> Salvar no board
```

## 1. Abrir o card

Ao abrir um work item (Azure) ou issue (Jira), aparece um botao flutuante do QualiFlow. Ao clicar,
o painel lateral carrega titulo, tipo, tags, criterios de aceite e os testes ja vinculados ao card.

Se voce ja tinha deixado cenarios salvos localmente para esse card, eles aparecem como
"Cenarios pendentes de revisao" e voce pode continuar de onde parou.

## 2. Avaliar a cobertura atual (opcional)

Com **Avaliar Cobertura Atual**, a IA le os criterios de aceite e os CTs que ja existem no card e
responde, em texto, o que esta coberto e o que ficou de fora. Serve para decidir se vale gerar
novos casos. Nada e criado ou alterado.

## 3. Gerar cenarios com IA

1. Ajuste os campos: objetivo do cenario, tipo de validacao, estilo dos passos, nivel de dados,
   detalhamento tecnico (opcional) e foco especifico (opcional).
2. Revise os **criterios de aceite**: eles sao editaveis e o que estiver na tela e o que a IA usa.
3. Clique em **Gerar Cenarios**. Uma barra mostra o andamento: analise dos criterios, geracao dos
   cenarios (por lotes, "Lote 2 de 4"), montagem da matriz de rastreabilidade e consolidacao.
4. Ao terminar, a tela mostra:
   - a **lista de cenarios** em BDD (Dado/Quando/Entao), com passos e resultado esperado;
   - a **matriz RTM**, que liga cada criterio de aceite aos cenarios que o cobrem e indica o que
     ficou sem cobertura.

Se um lote falhar, os cenarios dos demais lotes sao mantidos. Voce pode clicar em **Gerar
Novamente** quantas vezes quiser; cada geracao substitui a anterior na tela.

## 4. Reaproveitar CTs de outro card

Para evitar refazer casos parecidos:

1. Clique em **Reaproveitar CTs de Outro Card** e busque o card de origem por ID ou titulo
   (aparecem so cards que ja tem CTs; o proprio card aberto nao entra na lista).
2. Escolha o card. Os CTs dele sao copiados como cenarios editaveis neste card.
3. Nesse primeiro momento (**modo manual**) nao ha matriz RTM, porque nada foi validado contra os
   criterios do card atual.
4. Opcionalmente clique em **Ajustes Automaticos**: a IA adapta os CTs copiados ao contexto do
   card atual e a matriz RTM passa a ser exibida (**modo adaptado**).
   Se o ajuste falhar, os CTs copiados continuam na tela como estavam.

## 5. Revisar e editar

Antes de salvar, voce pode, em cada cenario:

- editar titulo, contexto BDD e passos (acao e resultado esperado);
- marcar quais passos precisam de evidencia;
- reordenar os passos arrastando;
- preencher os **parametros `@campo`** que aparecem no texto (os que ficarem vazios sao salvos
  com `###`);
- definir um responsavel (opcional).

## 6. Salvar localmente (opcional)

Guarda o trabalho no seu navegador, por card, com cenarios editados, cobertura e o modo de copia.
Serve para parar e continuar depois sem perder alteracoes. A sessao some ao salvar no board com
sucesso, ou quando voce a exclui.

## 7. Salvar no board

1. Marque os cenarios que deseja enviar (so os marcados sao salvos).
2. Clique em **Salvar no Board**. Sao criados Test Cases novos, vinculados ao card, herdando as
   tags do card pai.
3. Resultado:
   - **Sucesso**: aparece a quantidade criada, a sessao local do card e removida e a pagina
     recarrega.
   - **Azure, sucesso parcial**: os CTs que deram certo sao criados e a mensagem lista os que
     falharam, por cenario.
   - **Jira**: se um cenario falhar, o envio para e voce e avisado; os criados antes dele
     permanecem no Jira.

Cenarios salvos nao sao editados depois pela extensao: salvar de novo cria casos novos.

## Outros recursos

- **Dashboard QA** (Azure): abas de analise de casos de teste, cards de suporte e validacao de
  deploy.
- **Runner** (Azure): executar os CTs, registrar resultado, anexar evidencias e abrir bug.

## Privacidade

- As chaves de Gemini/Groq ficam so no navegador e acompanham cada pedido; o servidor nao as
  guarda.
- Nenhum PAT do Azure nem e-mail/token do Jira e usado: o acesso aos boards e por login
  Microsoft/Atlassian.
- Com **Copilot**, o login GitHub dura enquanto o servidor estiver no ar; se ele for reiniciado
  voce precisa entrar de novo.
