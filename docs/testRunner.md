Executar testes manuais
Azure DevOps Services | Azure DevOps Server | Azure DevOps Server 2022

Use Microsoft Test Runner para executar testes manuais e registrar resultados para cada etapa de teste. Você pode testar aplicativos Web e desktop, executar todos os testes ativos em um pacote ou selecionar casos de teste específicos e executar testes em um build específico.

Durante uma execução de teste, você pode capturar capturas de tela, registrar ações e criar ou atualizar bugs diretamente do Executor de Teste com etapas de teste, capturas de tela e comentários incluídos automaticamente.

Pontos de teste
Os casos de teste por si só não são executáveis. Ao adicionar um caso de teste a um conjunto de testes, você gera pontos de teste. Um ponto de teste é uma combinação exclusiva de um caso de teste, um conjunto de testes, uma configuração e um testador.

Por exemplo, um caso de teste chamado Test sign in functionality com duas configurações (Microsoft Edge e Chrome) gera dois pontos de teste. Você pode executar cada ponto de teste de forma independente e cada execução produz um resultado de teste. Você pode exibir todas as execuções de um ponto de teste no histórico de execução. A guia Executar mostra o resultado mais recente para cada ponto de teste.

Opções de execução
O executor do navegador da Web é executado em qualquer navegador com suporte e dá suporte a capturas de tela, logs de ação e gravações de tela. Ele funciona para aplicativos Web e desktop.

 Importante

O cliente do Executor de Testes para Windows será descontinuado. Faça a transição para o executor de teste baseado na Web, que fornece a mesma funcionalidade com melhor desempenho e desenvolvimento contínuo. Para obter mais informações, consulte Executar testes manuais em Azure Test Plans.

Para acessar as opções de execução, na guia Executar , selecione um teste e selecione Executar com opções. A caixa de diálogo Executar com opções permite:

Selecione um build específico para testar (consulte Executar testes para um build)
Executar testes automatizados usando uma fase de lançamento (consulte Executar testes automatizados de planos de teste)
Pré-requisitos
Categoria	Requisitos
Acesso ao Project	Membro do projeto.
Níveis de acesso	No mínimo, acesso Básico. Para obter mais informações, consulte Acesso e permissões de teste manual.

Executar testes para aplicativos Web
No portal da Web, abra seu projeto e selecione Planos de teste>Planos de teste. Se você ainda não criou casos de teste, consulte Criar casos de teste.

Selecione Meu ou Tudo, ou use Filtrar por título para encontrar seu plano de teste e selecioná-lo. Selecione a guia Executar.

A captura de tela mostra um conjunto de testes selecionado com a guia Executar selecionada

Selecione um ou mais testes ou todos os testes de um conjunto de testes. Em seguida, selecione Executar para aplicativo Web.

A captura de tela mostra como selecionar e executar um teste específico.

Microsoft Test Runner é aberto em uma nova janela do navegador.

Inicie o aplicativo que você deseja testar.

A captura de tela mostra o Test Runner registrando os resultados do teste.

O aplicativo em teste não precisa ser executado no mesmo computador que o Executor de Teste. Por exemplo, você pode executar o Test Runner em uma área de trabalho enquanto testa um aplicativo móvel ou tablet em um dispositivo separado.

Marque cada etapa de teste como aprovada ou reprovada com base nos resultados esperados.

A captura de tela mostra o Test Runner aberto com um teste com falha, onde você pode inserir um comentário.

Se uma etapa de teste falhar, você poderá inserir um comentário sobre o motivo da falha ou coletar dados de diagnóstico do teste. Você também pode criar ou adicionar algo a um bug.

 Importante

Uma etapa de teste com um resultado esperado é uma etapa de teste de validação. Os testadores devem marcar cada etapa de teste de validação como aprovada ou com falha. O resultado geral do caso de teste falhará se qualquer etapa de teste de validação estiver marcada como com falha ou não for marcada.

Criar ou adicionar a um bug
Quando uma etapa de teste falha, você pode criar um novo bug ou atualizar um bug existente diretamente do Executor de Teste. As etapas de teste, os comentários e os dados de diagnóstico são incluídos automaticamente.

Criar um novo bug
Quando uma etapa falhar, insira um comentário e selecione Criar bug.

A captura de tela mostra o Test Runner com um teste com falha e a opção Criar bug realçada.

Na caixa de diálogo Novo bug, insira um nome para o bug. As etapas e seus comentários são adicionados automaticamente.

A captura de tela mostra o Test Runner com a opção Criar bug selecionada e a caixa de diálogo Novo bug aberta.

Se o Test Runner estiver em execução em um do navegador da Web, você poderá colar uma captura de tela da área de transferência diretamente para o bug.

Opcionalmente, atribua o bug, adicione comentários ou vincule a outros itens de trabalho. Selecione Salvar e Fechar quando terminar.

Você pode ver todos os bugs relatados durante a sessão de teste.

A captura de tela mostra o número de bugs criados durante o teste.

 Observação

Se o botão Criar bug não iniciar um item de trabalho de bug, verifique as configurações da equipe:

Vá para Configurações do Projeto>Equipe e verifique se a equipe correta está definida como padrão.
Selecione o link iterações e caminhos de área para abrir a página de configuração de equipe.
Verifique se as Iterações, Padrão e Iterações do Backlog correspondem com a equipe para o caso de teste.
Selecione Áreas e verifique se a área Padrão corresponde à equipe para o caso de teste.
Adicionar a um bug existente
Em vez de criar um novo bug, atualize um bug existente com os detalhes da falha. Selecione Adicionar ao bug existente no menu suspenso Criar bug.

A captura de tela mostra o Test Runner com a opção Adicionar ao bug existente selecionada.

Salvar e examinar os resultados
Quando terminar de executar testes, selecione Salvar e fechar. Azure Test Plans armazena todos os resultados do teste.

Na guia Executar, visualize o status de teste do seu conjunto de testes. O resultado mais recente para cada teste é mostrado.

A captura de tela mostra o resultado da execução de casos de teste, com os resultados Ativo, Com falha e Aprovado exibidos.

Os testes que você ainda não executou apresentam um estado como Ativo. Para executar um teste novamente, redefina seu estado para Ativo.

Para exibir bugs arquivados durante um teste, abra o item de trabalho do caso de teste e verifique a seção Trabalho Relacionado para links de bug filho.

A captura de tela mostra a seção Trabalho Relacionado de um item de trabalho para exibir bugs arquivados para esse teste.

 Dica

Você também pode executar testes offline e importar os resultados. Para obter mais informações, consulte a extensão Execução de Teste Offline.


Executar testes para aplicativos da área de trabalho
 Importante

O cliente do Executor de Testes para Windows será descontinuado. Faça a transição para o executor de teste baseado na Web, que fornece a mesma funcionalidade com melhor desempenho e desenvolvimento contínuo. Para obter mais informações, consulte Executar testes manuais em Azure Test Plans.

Você pode usar o executador do navegador da Web para testar aplicativos da área de trabalho. Execute o Executor de Testes em uma janela do navegador junto com seu aplicativo de desktop e marque cada passo de teste como aprovado ou com falha.

Siga as etapas em Executar testes para aplicativos Web para abrir seu plano de teste na guia Executar .

Selecione um ou mais testes e selecione Executar para aplicativo Web.

Abra seu aplicativo da área de trabalho e siga as etapas de teste, marcando cada etapa como aprovada ou com falha no Executor de Teste.

O executador web dá suporte a capturas de tela, logs de ação e gravações de tela para aplicativos da área de trabalho. Para obter mais informações, consulte Coletar dados de diagnóstico durante o teste.

 Observação

Quando você utiliza o executor de aplicativos web para aplicativos de desktop, capturas de tela e logs de ação registram a janela do navegador, não o aplicativo de desktop. Use gravações de tela para capturar a tela inteira, incluindo o aplicativo da área de trabalho.

Executar todos os testes
É possível executar todos os testes em um conjunto de testes de uma só vez.

Selecione um conjunto de testes e selecione Executar para aplicativo Web para executar todos os testes ativos.

A captura de tela mostra como selecionar e executar todos os testes ativos em um conjunto de testes.

Executar testes para um build
Para executar testes em um build específico, escolha o build nas opções de execução.

No menu suspenso, selecione Executar com opções.

A captura de tela mostra a execução de um teste para o aplicativo Web com opções.

Na caixa de diálogo Executar com opções, selecione o build desejado.

A captura de tela mostra a caixa de diálogo Executar com opções com um build selecionado.

 Observação

O build selecionado deve ser do mesmo projeto que os testes.

Todos os bugs que você registrar durante a execução são associados ao build selecionado, e o resultado do teste é publicado para esse build.

Modificar uma etapa de teste durante uma execução de teste
Você pode corrigir as etapas de teste enquanto o teste ainda está em execução. Selecione o ícone Editar etapa de teste para inserir, reordenar, excluir ou editar etapas.

A captura de tela mostra a ferramenta para editar as etapas de teste quando você executa um teste.

Capturar dados de diagnóstico
Durante a execução de testes, você pode capturar capturas de tela, logs de ação e gravações de tela. Para obter etapas detalhadas, consulte Coletar dados de diagnóstico.

Executar testes com TCM
Você pode executar testes que fazem parte de um plano de teste usando a ferramenta de linha de comando TCM (Test Case Management). Essa ferramenta permite criar e iniciar uma execução de teste e então gerenciar todas as execuções de teste existentes. Use os comandos tcm documentados aqui para realizar essas tarefas.

Listar execuções de teste | Criar execuções de teste | Realizar execuções de teste | Abortar execuções de teste | Excluir execuções de teste | Exportar execuções de teste | Publicar execuções de teste


Listar execuções de teste
Use tcm run /list para listar as execuções disponíveis em um plano de teste e para mostrar seu ID. A ID corresponde à ID do item de trabalho definida quando você cria a execução.

tcm
tcm run /list /collection:teamprojectcollectionurl /teamproject:project 
           [/planid:id  |  /querytext:query] [/login:username,[password]]
Parâmetro	Descrição
/planid:id	Opcional. Retorna apenas as execuções de teste associadas ao plano de teste especificado.
/querytext:query	Opcional. Especifica a consulta a ser usada para listar um subconjunto de execuções de teste.
Para obter descrições dos parâmetros /collection, /teamproject e /login consulte Trabalhar com a ferramenta de linha de comando TCM.

Exemplo

O comando a seguir lista as execuções de teste definidas para o projeto Fabrikam Fiber hospedado na organização fabrikamprime. O ID e o Título correspondem ao ID do item de trabalho e ao título definidos para a execução do teste. Por exemplo, a execução 1000052 de teste é intitulada Plano de Teste para o Ciclo 1 (Manual).

tcm
tcm run /list /collection:https://fabrikamprime.visualstudio.com /teamproject:"Fabrikam Fiber"

Id        Title                              Owner               Date Completed
--------- ---------------------------------- ------------------- -----------
1000006   Sprint 2 (Manual)                  Jamal Hartnett      1/5/2026
1000032   33 : Change initial view (Manual)  Christie Church     1/11/2026
1000040   Sprint 2 (Manual)                  Jamal Hartnett      1/16/2026
1000042   Sprint 3 (Manual)                  Jamal Hartnett      1/16/2026
1000046   Special testing (Manual)           Francis Totten      1/18/2026
1000052   Test Plan for Cycle 1 (Manual)     Chuck Reinhart      2/1/2026
1000060   Game Shopping (Manual)             Chuck Reinhart      2/6/2026

Criar execuções de teste
Use tcm run /create para criar uma execução de teste associada ao plano de teste especificado. Além do plano de teste, especifique a suíte de teste e a configuração que você deseja usar pela respectiva ID. Use os comandos tcm plans /list, tcm suites /list e tcm configs /list para coletar essas IDs.

tcm
tcm run /create /title:title /planid:id /collection:CollectionURL /teamproject:project 
            (suiteid:id /configid:configid | /querytext:query) 
            [/settingsname:name] [/owner:owner] [/builddir:directory]  
            [/testenvironment:name] [/login:username,[password]] [/include]

Parâmetro	Descrição
/title:title	Especifica o título da execução de teste que você cria.
/planid:id	Especifica o plano de teste no qual você deseja criar a execução de teste.
/suiteid:id	Especifica o conjunto de testes que você deseja usar para sua execução de teste.
/configid:id	Especifica a configuração de teste que você deseja executar para o conjunto de testes.
/querytext:query	Opcional se você especificar suiteid e configid. Especifica a consulta que será usada para selecionar os testes que você deseja executar.

Ponta: Use o /querytest parâmetro para executar mais de um conjunto de testes. Por exemplo: querytext:“SELECT * FROM TestPoint WHERE (ConfigurationId=20 OR ConfigurationId=21) AND (Suiteid=1185 OR Suiteid=1186)”.
/settingsname:name	Opcional. Especifica as configurações de teste que você deseja usar para esta execução de teste. Se você não selecionar as configurações de teste, serão usadas as configurações de teste padrão no plano de teste.
/owner:owner	Opcional. Especifica o proprietário da execução de teste.
/builddir:directory	Opcional. Especifica o diretório do build que será usado para localizar os assemblies de teste para o teste. Se você não especificar esse parâmetro, o local de build será usado com base no build atribuído ao plano de teste no momento.
/testenvironment:name	Opcional. Especifica os ambientes de teste que você deseja usar para esta execução de teste. Se você não selecionar um ambiente de teste, o ambiente de teste padrão no plano de teste será usado.
/include	Opcional. Inclui todos os testes selecionados para a execução de teste, mesmo que os testes não estejam no estado Ativo no momento.
Para obter descrições dos parâmetros /collection, /teamproject e /login consulte Trabalhar com a ferramenta de linha de comando TCM.

Exemplo

O comando a seguir cria uma execução de teste chamada MyTestRun no plano de teste com ID77. A execução usa o conjunto de testes com ID161 e a configuração de teste com ID9. A execução é definida para o projeto Fabrikam Fiber hospedado na organização fabrikamprime.

Neste exemplo, a execução de teste tem uma ID de 1000082.

tcm
tcm run /create /title:MyTestRun /planid:77 /collection:https://fabrikamprime.visualstudio.com /teamproject:"Fabrikam Fiber" /suiteid:161 /configid:9

Run created with ID: 1000082.


Realizar execuções de teste
Use tcm run /execute para iniciar uma execução em seu plano de teste. A ID especificada corresponde à ID do item de trabalho definida ao criar a execução. Para ver uma lista de todos os identificadores de execução de teste, use o comando tcm run /list .

tcm
tcm run /execute /id:id /collection:teamprojectcollectionurl /teamproject:project [/login:username,[password]]
Parâmetro	Descrição
/id:id	Especifica o ID da execução de teste que você deseja executar.
Para obter descrições dos parâmetros /collection, /teamproject e /login consulte Trabalhar com a ferramenta de linha de comando TCM.

Exemplo

O comando a seguir inicia uma execução de teste para o ID1000082 para o projeto Fabrikam Fiber hospedado na organização fabrikamprime. Os resultados aparecem na janela da CLI.

tcm
tcm run /execute /id:1000082 /collection:https://fabrikamprime.visualstudio.com /teamproject:"Fabrikam Fiber"

Executing run: MyTestRun

Results
------------------------
Total:                   2
Passed:                  1
Failed:                  1
Inconclusive:            0

Abortar execuções de teste
Use tcm run /abort para cancelar uma execução de teste em andamento. A ID especificada corresponde à ID do item de trabalho definida ao criar a execução.

tcm
tcm run /abort /id:id /collection:teamprojectcollectionurl /teamproject:project [/login:username,[password]]
Parâmetro	Descrição
/id:id	Especifica o ID da execução de teste que você deseja cancelar.
Para obter descrições dos parâmetros /collection, /teamproject e /login consulte Trabalhar com a ferramenta de linha de comando TCM.

Exemplo

O comando a seguir interrompe a execução de teste com a ID1000082 do projeto Fabrikam Fiber hospedado na organização fabrikamprime . Os resultados confirmam a ID e o título da execução cancelada.

tcm
tcm run /abort /id:1000082 /collection:https://fabrikamprime.visualstudio.com /teamproject:"Fabrikam Fiber"

Run with ID [1000082] and title [MyTestRun] has been aborted.

Excluir execuções de teste
Use tcm run /delete para excluir uma execução de teste do seu plano de teste. O ID que você especifica corresponde ao ID do item de trabalho definido quando a execução de teste foi criada.

tcm
tcm run /delete /id:id [/noprompt] /collection:teamprojectcollectionurl /teamproject:project [/login:username,[password]]
Parâmetro	Descrição
/id:id	Especifica o ID da execução de teste que você deseja excluir.
/noprompt	Opcional. Especifica que o usuário não é solicitado a confirmar a exclusão de uma execução de teste.
Para obter descrições dos parâmetros /collection, /teamproject e /login consulte Trabalhar com a ferramenta de linha de comando TCM.

Exemplo

O comando a seguir exclui a execução de teste com a ID1000082 do projeto Fabrikam Fiber hospedado na organização fabrikamprime . O usuário é solicitado a confirmar que deseja excluir a execução de teste especificada e o resultado é fornecido.

tcm
tcm run /delete /id:1000082 /collection:https://fabrikamprime.visualstudio.com /teamproject:"Fabrikam Fiber"

Are you sure you want to delete run [MyTestRun]? (Yes/No) y

Run [MyTestRun] has been deleted.

Exportar execuções de teste
Use tcm run /export para exportar uma execução de teste para um local especificado. O ID que você especifica corresponde ao ID do item de trabalho definido quando a execução foi criada.

tcm
tcm run /export /id:id /resultsfile:path /collection:teamprojectcollectionurl /teamproject:project [/login:username,[password]]
Parâmetro	Descrição
/id:id	Especifica o ID que você deseja exportar.
/resultsfile:path	Especifica um local e um nome de arquivo para a execução de teste que você deseja exportar.
Para obter descrições dos parâmetros /collection, /teamproject e /login consulte Trabalhar com a ferramenta de linha de comando TCM.

Exemplo

O comando a seguir exporta a execução de teste com a ID1000082 do projeto Fabrikam Fiber hospedado na organização fabrikamprime para c:\temp\ResultsForDeveloper.trx.

tcm
tcm run /export /id:1000082 /resultsfile:"c:\temp\ResultsForDeveloper.trx" /collection:https://fabrikamprime.visualstudio.com /teamproject:"Fabrikam Fiber"

Publicar execuções de teste
Use tcm run /publish para publicar os resultados de um arquivo de resultados de execução de teste Visual Studio para um plano de teste especificado.

tcm
tcm run /publish /suiteid:id /configid:id /resultowner:owner /resultsfile:path 
            /collection:teamprojectcollectionurl /teamproject:project [/title:runtitle] 
            [/runowner:owner] [/build:buildnumber /builddefinition:builddefinition] 
            [/flavor:flavor] [/platform:platform] [/assignfailurestouser:user] 
            [/login:username,[password]] [/buildverification]
Parâmetro	Descrição
/suiteid:id	Especifica o conjunto de testes que será usado ao publicar uma execução de teste.
/configid:id	Especifica qual configuração de teste você deseja usar ao publicar uma execução de teste.
/resultowner:owner	Especifica o proprietário dos resultados do teste.
/resultsfile:path	Especifica o local da execução de teste que você deseja publicar, por exemplo, "c:\temp\ResultsForDeveloper.trx".
/title:runtitle	Opcional. Especifica um título que você deseja usar para a execução de teste publicada.
/runowner:owner	Opcional. Especifica o proprietário da execução de teste.
/build:buildnumber	Opcional. Especifica o número de build que será usado para publicar uma execução de teste. Esse parâmetro deve ser usado com /builddefinition.
/builddefinition:builddefinition	Opcional. Especifica a definição de build que será usado para publicar uma execução de teste. Esse parâmetro deve ser usado com /build.
/flavor:flavor	Opcional. Especifica o tipo de build, como Versão. Esse parâmetro só pode ser usado se o parâmetro /build for usado.
/platform:platform	Opcional. Especifica a plataforma do build, como x86. Esse parâmetro só pode ser usado se o parâmetro /build for usado.
/assignfailurestouser:user	Opcional. Especifica o usuário ao qual todos os testes com falha na execução de teste são atribuídos.
/buildverification	Opcional. Especifica que essa execução de teste contém testes de verificação de build que verificam a funcionalidade básica do build.
Para obter descrições dos parâmetros /collection, /teamproject e /login consulte Trabalhar com a ferramenta de linha de comando TCM.

Exemplo

O seguinte comando publica uma execução de teste para o conjunto de testes com ID161 e configuração de teste com ID9 e reatribui o proprietário. Esse comando atualiza os pontos de teste existentes para os casos de teste no conjunto de testes que emparelha com essa configuração e publica os resultados no arquivo especificado .trx . O comando atribui todos os testes com falha na execução de teste ao usuário especificado.

tcm
tcm run /publish /suiteid:167 /configid:9 /resultowner:"Jamal Hartnett" /resultsfile:"c:\temp\ResultsForDeveloper.trx" /assignfailurestouser:"Chuck Reinhart" /collection:https://fabrikamprime.visualstudio.com /teamproject:"Fabrikam Fiber"
::: moniker-end

Perguntas frequentes
P: Por que não consigo pré-visualizar alguns anexos de execução de teste?
A: Você pode visualizar arquivos somente .txt e .log. Para outros tipos de arquivo, baixe o anexo.

P: Como controlar por quanto tempo mantenho meus dados de teste?
A: Consulte Configurar políticas de retenção de testes.

P: Posso executar testes offline e importar os resultados?
R: Sim, consulte a Extensão Execução de Teste Offline.

Próxima etapa

Conteúdo relacionado
Registrar resultados reais
Perguntas frequentes para testes manuais
Coletar dados de diagnóstico durante testes
Testes exploratórios com a extensão Testes e Feedback no modo Conectado
Executar testes automatizados a partir dos planos de teste
Recursos adicionais
Documentação

Navegar pelos planos de teste no Azure DevOps - Azure Test Plans

Navegação de Planos de Teste: saiba como localizar, organizar e gerenciar planos de teste, conjuntos e casos em Azure DevOps. Comece a otimizar o fluxo de trabalho de teste hoje.

Criar e gerenciar casos de teste manuais - Azure Test Plans

Crie e gerencie casos de teste manuais em Azure Test Plans para validar entregas, atribuir testadores e organizar o processo de teste. Comece a melhorar a qualidade agora.

Criar e gerenciar conjuntos de testes - Azure Test Plans

Saiba como criar e gerenciar conjuntos de testes estáticos, baseados em requisitos e baseados em consulta no Azure Test Plans.

Mostrar mais 5