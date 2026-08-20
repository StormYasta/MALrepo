# MAL Sheet

MVP client-side para explorar uma lista pública do MyAnimeList como uma planilha pesquisável e filtrável.

## Funcionalidades

- Pesquisa por título, gênero e tema
- Filtros por ano, gênero, status, número máximo de episódios e nota do usuário
- Ordenação por ano, episódios, notas e progresso
- Integração client-side com a Jikan API v4
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

A aplicação extrai o username e consulta a lista pública usando a Jikan. Não há credenciais armazenadas no navegador nem no repositório.

## GitHub Pages

O workflow em `.github/workflows/deploy.yml` gera o projeto e publica a pasta `dist`. Nas configurações do repositório, em **Settings > Pages**, selecione **GitHub Actions** como source caso ainda não esteja selecionado.

A URL esperada é `https://stormyasta.github.io/MALrepo/`.

## Limitações

- A lista do usuário precisa estar pública.
- A Jikan é somente leitura e possui limites de requisições.
- Alguns metadados dependem do que estiver disponível no retorno da Jikan para a lista do usuário.
