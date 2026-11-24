# Validação manual no Azure DevOps (o que o playground não cobre)

Rode uma vez por mudança relevante no runner, num **projeto de teste** do Azure. Marque cada item.
Antes: `npm run build`, recarregue a extensão em `chrome://extensions` e a aba do Azure; backend no ar.

## Sessão e dados
- [ ] Login Microsoft ok e organização/projeto selecionados nas configurações.
- [ ] Abrir um PBI com CTs vinculados e iniciar a execução: a lista de CTs aparece.
- [ ] Painel **Critérios de aceite** mostra os critérios e a descrição reais do PBI (e "Atualizar" funciona).

## Execução e Azure
- [ ] Aprovar/reprovar passos e salvar um CT: o resultado aparece no Test Run (Azure Test Plans > Runs) com `durationMs`.
- [ ] Anexar evidência (print e arquivo): aparece no resultado do teste no Azure.
- [ ] Criar bug a partir de um passo reprovado: bug criado, vinculado ao PBI e ao CT, com anexos.
- [ ] Recarregar a página no meio da execução: o runner oferece retomar.

## Janela e ancoragem
- [ ] Ancorar à direita: a página fica lado a lado; menus/toasts fixos do site não ficam atrás do runner.
- [ ] Desancorar: margens e posições originais voltam (nada fica deslocado).

## Ferramentas de UI/UX
- [ ] Régua, conta-gotas, overlay, acessibilidade, desempenho e fontes/cores funcionam na página testada.
- [ ] Responsivo: cada preset emula a largura na aba (área útil muda; o Chrome mostra a faixa de depuração) e **Restaurar** volta ao normal e some com a faixa.
- [ ] Desempenho com "Registrar a cada carregamento": F5 duas vezes gera entradas no histórico.

Anote aqui qualquer falha com a URL, o passo e o texto do erro.
