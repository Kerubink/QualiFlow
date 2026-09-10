# Solic - ajustar detalhes no fluxo de admissão (ID: 16166)
**Tipo:** Product Backlog Item | **Tags:** Frontend; Kauã; Melhoria

## Descrição
<div style="box-sizing:border-box;"><span style="box-sizing:border-box;"><b>Cenário atual:&nbsp;</b>foi observado que durante o fluxo de navegação (ida em volta de etapas) não há uma persistência parcial dos carmpos (uns permanecem preenchidos e outros não), causando em um cenário especifico o bloqueio do fluxo de admissão.</span> </div><div style="box-sizing:border-box;"><span style="box-sizing:border-box;"><br></span> </div><div style="box-sizing:border-box;"><b style="box-sizing:border-box;">Cenário desejado: </b><span style="box-sizing:border-box;">é esperada a persistência dos dados preenchidos durante a navegação entre as etapas mesmo sem salvar no banco (semelhante ao modulo de criação de vaga).</span> </div>

## Critérios de Aceite
<ol><li><span>Deve adicionar a logica de persistência nos campos durante a navegação do fluxo de criação de uma admissão</span> </li><li><span>Se todos os campos estiverem preenchidos o botão de avançar deve ser liberado&nbsp;</span> </li> </ol>

---
## 🎯 FOCO E DETALHES TÉCNICOS DOS TESTES
<!-- ⚠️ AVISO: Abaixo estão os testes que já existem no Azure. Você pode editá-los livremente! A IA vai ler suas adições/cortes, refatorar para o padrão e atualizar o Board correspondente. Não apague as tags [ID] para não perder a referência. -->

### [ID: 16480] REG-validar fluxo completo de admissão
**Passos Atuais:**
1. Ação: acessar pagina de solicitações
   Esperado: 
2. Ação: acessar pagina de criação de solicitação
   Esperado: 
3. Ação: realizar fluxo de criação de uma admissão
   Esperado: deve realizar a criação da admissão sem erros

### [ID: 16485] VALID-validando correção do fix
**Passos Atuais:**
1. Ação: acessar a pagina de solicitações
   Esperado: 
2. Ação: acessar pagina de criação de uma nova solicitação de admissão
   Esperado: 
3. Ação: realizar fluxo até chegar na ultima etapa do projeto (informações da folha)
   Esperado: 
4. Ação: preencher todos os campos da etapa de informações da folha
   Esperado: 
5. Ação: voltar para a etapa anterior
   Esperado: 
6. Ação: avançar novamente para a etapa de informações da folha
   Esperado: 
7. Ação: validar se os campos
   Esperado: todos os campos preenchidos anteriormente devem ter persistido

### [ID: 16478] FUNC - Habilitação do botão 'Avançar' ao preencher todos os campos obrigatórios
**BDD Atual:**
DADO que o usuário está em uma etapa do fluxo de admissãoE existem campos obrigatóriosQUANDO o usuário preenche todos os campos obrigatórios da etapaENTÃO o botão 'Avançar' deve ser habilitado.

**Passos Atuais:**
1. Ação: Acessar a funcionalidade de criação de uma nova admissão.
   Esperado: A tela de criação de admissão é exibida.
2. Ação: Navegar para uma etapa do fluxo de admissão que contenha campos obrigatórios.
   Esperado: A etapa com campos obrigatórios é carregada.
3. Ação: Verificar que o botão 'Avançar' está desabilitado inicialmente.
   Esperado: O botão 'Avançar' não está clicável.
4. Ação: Preencher o primeiro campo obrigatório com dados válidos.
   Esperado: O campo é preenchido.
5. Ação: Preencher o segundo campo obrigatório com dados válidos.
   Esperado: O campo é preenchido.
6. Ação: Continuar preenchendo todos os campos obrigatórios da etapa com dados válidos.
   Esperado: Todos os campos obrigatórios da etapa estão preenchidos.
7. Ação: Verificar que, após o preenchimento do último campo obrigatório, o botão 'Avançar' é habilitado.
   Esperado: O botão 'Avançar' está clicável.
8. Ação: Clicar no botão 'Avançar' para confirmar a navegação.
   Esperado: O sistema avança para a próxima etapa.

### [ID: 16476] UI - Persistência de dados ao avançar etapas no fluxo de admissão
**BDD Atual:**
DADO que o usuário está no fluxo de criação de admissãoE preenche campos em uma etapaQUANDO o usuário avança para a próxima etapa e retornaENTÃO os dados preenchidos na etapa anterior devem estar persistidos.

**Passos Atuais:**
1. Ação: Acessar a funcionalidade de criação de uma nova admissão.
   Esperado: A tela de criação de admissão é exibida.
2. Ação: Navegar para a primeira etapa do fluxo de admissão.
   Esperado: A primeira etapa do fluxo é carregada.
3. Ação: Preencher todos os campos obrigatórios da primeira etapa com dados válidos.
   Esperado: Os campos são preenchidos com os dados inseridos.
4. Ação: Clicar no botão 'Avançar' para ir para a próxima etapa.
   Esperado: O sistema navega para a próxima etapa do fluxo.
5. Ação: Clicar no botão 'Voltar' para retornar à etapa anterior.
   Esperado: O sistema retorna à primeira etapa do fluxo.
6. Ação: Verificar que todos os campos preenchidos na primeira etapa mantêm seus valores.
   Esperado: Os dados preenchidos anteriormente estão visíveis e persistidos nos campos.

### [ID: 16477] UI - Persistência de dados ao retroceder etapas no fluxo de admissão
**BDD Atual:**
DADO que o usuário está no fluxo de criação de admissãoE preenche campos em múltiplas etapasQUANDO o usuário navega entre as etapas preenchidasENTÃO os dados devem persistir em todas as etapas visitadas.

**Passos Atuais:**
1. Ação: Acessar a funcionalidade de criação de uma nova admissão.
   Esperado: A tela de criação de admissão é exibida.
2. Ação: Navegar para a primeira etapa do fluxo de admissão.
   Esperado: A primeira etapa do fluxo é carregada.
3. Ação: Preencher todos os campos obrigatórios da primeira etapa com dados válidos.
   Esperado: Os campos da primeira etapa são preenchidos.
4. Ação: Clicar no botão 'Avançar' para ir para a segunda etapa.
   Esperado: O sistema navega para a segunda etapa.
5. Ação: Preencher todos os campos obrigatórios da segunda etapa com dados válidos.
   Esperado: Os campos da segunda etapa são preenchidos.
6. Ação: Clicar no botão 'Avançar' para ir para a terceira etapa.
   Esperado: O sistema navega para a terceira etapa.
7. Ação: Clicar no botão 'Voltar' para retornar à segunda etapa.
   Esperado: O sistema retorna à segunda etapa.
8. Ação: Verificar que todos os campos preenchidos na segunda etapa mantêm seus valores.
   Esperado: Os dados preenchidos na segunda etapa estão visíveis e persistidos.
9. Ação: Clicar novamente no botão 'Voltar' para retornar à primeira etapa.
   Esperado: O sistema retorna à primeira etapa.
10. Ação: Verificar que todos os campos preenchidos na primeira etapa mantêm seus valores.
   Esperado: Os dados preenchidos na primeira etapa estão visíveis e persistidos.

### [ID: 16479] FUNC - Desabilitação do botão 'Avançar' com campos obrigatórios incompletos
**BDD Atual:**
DADO que o usuário está em uma etapa do fluxo de admissãoE existem campos obrigatóriosQUANDO o usuário deixa um ou mais campos obrigatórios vaziosENTÃO o botão 'Avançar' deve permanecer desabilitado.

**Passos Atuais:**
1. Ação: Acessar a funcionalidade de criação de uma nova admissão.
   Esperado: A tela de criação de admissão é exibida.
2. Ação: Navegar para uma etapa do fluxo de admissão que contenha campos obrigatórios.
   Esperado: A etapa com campos obrigatórios é carregada.
3. Ação: Verificar que o botão 'Avançar' está desabilitado inicialmente.
   Esperado: O botão 'Avançar' não está clicável.
4. Ação: Preencher alguns, mas não todos, os campos obrigatórios da etapa com dados válidos.
   Esperado: Alguns campos obrigatórios estão preenchidos, mas pelo menos um está vazio.
5. Ação: Deixar pelo menos um campo obrigatório vazio.
   Esperado: Um ou mais campos obrigatórios permanecem sem preenchimento.
6. Ação: Tentar interagir com o botão 'Avançar'.
   Esperado: Nenhuma ação ocorre ao tentar clicar no botão.
7. Ação: Verificar que o botão 'Avançar' permanece desabilitado.
   Esperado: O botão 'Avançar' continua não clicável.
8. Ação: Preencher o campo obrigatório que estava vazio.
   Esperado: Todos os campos obrigatórios estão agora preenchidos.
9. Ação: Verificar que o botão 'Avançar' é habilitado.
   Esperado: O botão 'Avançar' está clicável.



---
