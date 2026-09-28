# MAL Sheet

MVP client-side para explorar uma lista pública do MyAnimeList como uma planilha pesquisável e filtrável.

## Funcionalidades

### Explorer

- Tabela pesquisável e filtrável por título, gênero, status, ano, episódios e nota pessoal
- Nota MAL enriquecida pela Jikan, com cache local
- Coluna Δ para comparar sua nota com a média MAL
- Presets rápidos: curto pra hoje, só pedrada, clássicos e fila
- Favoritos e blacklist locais
- Compartilhamento da visão por URL, incluindo usuário e filtros

### Diversão

- Roleta do próximo anime com filtros
- Recomendação baseada nos gêneros que você costuma avaliar melhor
- Modo surpresa com capa borrada
- Anime DNA com radar de gêneros, assinatura do gosto e Mainstream Meter
- Hot Takes, Hidden Gems, Hall da Fama e Hall da Vergonha
- Tempo estimado assistido, estatísticas curiosas e mapa por décadas
- Batalha de animes estilo torneio
- Taste Twins para comparar duas listas públicas
- Anime Bingo e desafio 3×3 salvo no navegador
- Conquistas locais
- Card PNG do Anime DNA gerado inteiramente no navegador
- Tema visual dinâmico usando a capa do anime em destaque

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

A aplicação extrai o username e consulta o endpoint público usado pelo próprio MyAnimeList através do Cloudflare Worker restrito do projeto. Nenhuma credencial do usuário é armazenada.

## GitHub Pages

O workflow em `.github/workflows/deploy.yml` gera o projeto e publica a pasta `dist`. Nas configurações do repositório, em **Settings > Pages**, selecione **GitHub Actions** como source caso ainda não esteja selecionado.

A URL esperada é `https://stormyasta.github.io/MALrepo/`.

## Proxy da lista do MAL

O MyAnimeList não libera CORS no endpoint público usado para carregar listas, então o navegador não consegue acessá-lo diretamente. O projeto usa um Cloudflare Worker pequeno e restrito apenas ao endpoint de lista; não é um proxy aberto.

1. Crie um Worker no painel da Cloudflare.
2. Cole o conteúdo de `worker/mal-proxy.js` e faça o deploy.
3. Copie a URL do Worker, por exemplo `https://mal-sheet-proxy.seu-subdominio.workers.dev`.
4. No GitHub, abra **Settings > Secrets and variables > Actions > Variables**.
5. Crie a variável `MAL_PROXY_URL` com a URL do Worker.
6. Rode novamente o workflow **Deploy GitHub Pages**.

Para testar o Worker antes do Pages, abra `SUA_URL_DO_WORKER/health`. O retorno esperado é `{"ok":true}`.

## Arquitetura

- GitHub Pages: interface React/Vite.
- Cloudflare Worker: somente leitura da lista pública do MyAnimeList e CORS.
- Jikan: enriquecimento da Nota MAL por anime, com cache local.
- Nenhum login, Client Secret ou token do usuário é necessário.

## Limitações

- A lista do usuário precisa estar pública.
- O endpoint `load.json` do MAL é não documentado e pode mudar no futuro.
- A Nota MAL é enriquecida separadamente pela Jikan e pode aparecer alguns instantes depois da tabela.


- A lista do usuário precisa estar pública.
- O endpoint de lista do MAL não é uma API oficial documentada, então pode mudar no futuro.
- O projeto depende de um proxy CORS para consultar esse endpoint diretamente de uma página estática.
- Metadados disponíveis dependem do retorno da lista pública do MyAnimeList.
