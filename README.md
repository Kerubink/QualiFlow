# Gerador de Casos de Teste (Azure DevOps + Gemini)

Este script automatiza a criação de Casos de Teste no Azure DevOps a partir de Work Items (User Stories, PBIs, etc.), utilizando o poder do Gemini AI para sugerir os passos e resultados esperados.

## Pré-requisitos

- Python 3.8+
- Personal Access Token (PAT) do Azure DevOps com permissões de leitura/escrita em Work Items.
- API Key do Google Gemini.

## Configuração

1. Clone ou baixe este repositório.
2. Instale as dependências:
   ```bash
   pip install -r requirements.txt
   ```
3. Crie um arquivo `.env` na raiz do projeto (use o `.env.example` como base) e preencha suas credenciais:
   ```env
   AZURE_PERSONAL_ACCESS_TOKEN=seu_pat_aqui
   AZURE_ORG_URL=https://dev.azure.com/sua_organizacao
   AZURE_PROJECT=seu_projeto
   GEMINI_API_KEY=sua_chave_gemini_aqui
   GEMINI_MODEL=gemini-1.5-pro
   ```

## Como usar

Execute o script principal:

```bash
python main.py
```

1. O script pedirá o **ID do Work Item** do Azure DevOps.
2. Ele buscará o título, descrição e critérios de aceite.
3. Enviará esses dados para o Gemini, que gerará sugestões de casos de teste em formato Markdown.
4. Você poderá revisar os testes gerados diretamente no terminal.
5. Se você confirmar com `y` (aprovar), o script criará automaticamente os Casos de Teste no Azure DevOps com os passos configurados.

## Estrutura do Projeto

- `main.py`: Script principal e interface de linha de comando.
- `azure_client.py`: Integração com a API do Azure DevOps.
- `gemini_client.py`: Integração com a API do Google Gemini.
- `requirements.txt`: Lista de dependências Python.
