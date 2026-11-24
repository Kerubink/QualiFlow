# Playground de desenvolvimento

Testa as funcionalidades do runner (execução, timers, evidências, editor de capturas e autopreenchimento)
**sem Azure, sem backend e sem carregar a extensão no Chrome**. O código do runner é o real (`../src`);
só o `chrome.storage`/`chrome.runtime` e o background são simulados em `mockChrome.js`.

## Como usar

```bash
cd apps/extension
npm run dev:playground
# abra http://127.0.0.1:5174/dev/
```

Se a porta estiver ocupada: `PORT=5200 npm run dev:playground`. Não precisa de `npm install` nem de build:
os módulos são servidos direto de `src/`. Recarregue a página (F5) após editar qualquer arquivo.

## O que tem na página

| Área | Para que serve |
| --- | --- |
| Campos que devem ter ícone | Casos de detecção: rótulo, `name` camelCase, placeholder, `type`, `maxlength`, máscara em JS, campo dinâmico |
| Campos que NÃO devem ter ícone | Falsos positivos: senha, somente leitura, desabilitado, "hotel" |
| Runner simulado | Abre o runner com uma sessão fictícia (PBI #12345) e ajusta o mock |
| Mensagens ao background | Log de tudo que iria ao Azure (inclui `durationMs` destacado) |

### Controles do mock

- **CTs na run**: quantidade de casos de teste gerados.
- **Latência**: atraso das respostas simuladas.
- **Upload de anexo**: sucesso, erro (para testar *Reenviar*) ou lento (4 s).
- **Falhar ao salvar resultado / criar bug**: força respostas de erro.
- **Reiniciar tudo**: limpa o estado salvo e recarrega.

## Cabeçalho do runner

| Controle | O que faz |
| --- | --- |
| Cronômetro + pausar | Tempo do CT atual; pausar bloqueia a execução e cobre o sistema testado |
| Console | Painel flutuante com erros de console, exceções e requisições com falha capturados (filtros, busca, detalhe, copiar); contador no botão |
| HUB | Painel flutuante: tempos, média e estimativa, resultados, evidências, bugs, ambiente (copiável) e atividade |
| Critérios | Painel flutuante com os critérios de aceite (e descrição) do card pai, para consulta durante o teste; botão Atualizar |
| Ferramentas UI/UX | Barra flutuante (Alt+U) com régua, conta-gotas, overlay de design, acessibilidade, desempenho e depurador CSS |
| Engrenagem | Autopreencher, Depurador CSS, Zerar cronômetro do CT e Encerrar sessão |

## E2E automatizado

`npm run test:e2e` sobe o playground e um Chrome headless e executa os cenarios de `dev/e2e/playground.test.mjs`
(autofill, execucao e selecao de CTs, pausa/bolinha, menu/HUB/depurador/ancoragem, atalhos, bug completo com console/rede,
recorte e retry de upload, persistencia, ferramentas de UI e relatorio/re-execucao). Sem dependencias extras; use
`CHROME_BIN=/caminho/do/chrome` se o binario nao for encontrado. Nao faz parte de `npm test` (que e offline e so de dominio).

## Limites (o que o playground não valida)

- Não fala com o Azure: salvar resultado, anexos e bugs são simulados. Valide isso uma vez num projeto de teste.
- **Aba atual** devolve um print falso (sem dados reais), pois `captureVisibleTab` só existe no service worker.
  **Tela ou janela** e **Gravar tela** usam o seletor real do navegador.
- Não carrega o `manifest.json`, então não testa permissões nem o service worker.

> Não registre `http://127.0.0.1:5174/` como projeto na extensão real ao mesmo tempo, ou o runner
> será injetado duas vezes na mesma página.

Para o que o playground não cobre, use o roteiro em [`VALIDACAO_MANUAL.md`](./VALIDACAO_MANUAL.md).

Este diretório não entra no build (`dist/`) e serve apenas `dev/` e `src/`, em `127.0.0.1`.
