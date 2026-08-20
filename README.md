# MAL Sheet

MVP client-side para explorar uma lista do MyAnimeList como uma planilha pesquisável e filtrável.

## Funcionalidades

- Pesquisa por título, gênero e tema
- Filtros por ano, gênero, status, número máximo de episódios e nota do usuário
- Ordenação por ano, episódios, notas e progresso
- Integração client-side com a API v2 do MyAnimeList usando `X-MAL-CLIENT-ID`
- Modo demonstração sem configuração
- Layout responsivo
- Deploy automático no GitHub Pages

## Rodar localmente

```bash
npm install
npm run dev
```

## API do MyAnimeList

Crie uma aplicação no painel de API do MyAnimeList e informe o Client ID na própria interface. O MVP salva o Client ID somente no `localStorage` do navegador; ele não é gravado no repositório.

Como o projeto é 100% estático, não coloque Client Secret, access token privado ou outra credencial sensível no código.

## GitHub Pages

O workflow em `.github/workflows/deploy.yml` gera o projeto e publica a pasta `dist`. Nas configurações do repositório, em **Settings > Pages**, selecione **GitHub Actions** como source caso ainda não esteja selecionado.

A URL esperada é `https://stormyasta.github.io/MALrepo/`.

## Limitação do MVP

A lista oficial fornece gêneros através dos campos solicitados. O campo de temas/subgêneros está preparado no modelo da aplicação, mas o carregamento via API deixa esse campo vazio por enquanto; uma evolução pode enriquecer os itens com detalhes adicionais por anime.
