# MAL Sheet

MVP client-side para explorar uma lista pública do MyAnimeList como uma planilha pesquisável e filtrável.

## Funcionalidades

- Pesquisa por título, gênero e tag
- Filtros por ano, gênero, status, número máximo de episódios e nota do usuário
- Ordenação por ano, episódios, nota do usuário e progresso
- Aceita username ou URL da lista do MyAnimeList
- Sem login, Client ID ou Client Secret
- Paginação automática para carregar a lista inteira
- Modo demonstração sem configuração
- Layout responsivo
- Deploy automático no GitHub Pages

## Rodar localmente

```bash
npm install
npm run dev
```

## Carregar uma lista

Na interface, informe apenas o username do MyAnimeList:

```text
StormYasta
```

ou cole a URL completa da lista:

```text
https://myanimelist.net/animelist/StormYasta
```

A aplicação extrai o username e consulta o endpoint público usado pelo próprio MyAnimeList para carregar listas. Como o GitHub Pages é executado no navegador e o MAL não é a mesma origem, a requisição passa por um proxy CORS público. Nenhuma credencial do usuário é armazenada.

## GitHub Pages

O workflow em `.github/workflows/deploy.yml` gera o projeto e publica a pasta `dist`. Nas configurações do repositório, em **Settings > Pages**, selecione **GitHub Actions** como source caso ainda não esteja selecionado.

A URL esperada é `https://stormyasta.github.io/MALrepo/`.

## Limitações

- A lista do usuário precisa estar pública.
- O endpoint de lista do MAL não é uma API oficial documentada, então pode mudar no futuro.
- O projeto depende de um proxy CORS para consultar esse endpoint diretamente de uma página estática.
- Metadados disponíveis dependem do retorno da lista pública do MyAnimeList.
