# MAL Sheet

Todos os usernames usados na documentação são exemplos fictícios.

MVP client-side para explorar uma lista pública do MyAnimeList, descobrir novos animes e brincar com o próprio histórico sem criar uma conta adicional.

## Funcionalidades

### Explorer

- Tabela pesquisável e filtrável por título em inglês, romaji ou japonês, além de gênero, status, ano, episódios e nota pessoal
- Nota MAL enriquecida pela Jikan, com cache local
- Coluna Δ para comparar sua nota com a média MAL
- Presets rápidos: curto pra hoje, só pedrada, clássicos e fila
- Favoritos e blacklist locais
- Compartilhamento da visão por URL, incluindo usuário e filtros
- Perfil embutido na URL: `?user=animefan` carrega a lista automaticamente
- O último usuário também pode ser lembrado localmente no navegador

### Estatísticas

- Anime DNA com radar de gêneros, assinatura do gosto e Mainstream Meter
- Hot Takes, Hidden Gems, Hall da Fama e Hall da Vergonha
- Tempo estimado assistido, estatísticas curiosas e mapa por décadas
- Taste Twins para comparar dois históricos
- Conquistas locais
- Card PNG do Anime DNA gerado inteiramente no navegador
- Títulos em Plan to Watch são excluídos das métricas para não distorcer o histórico

### Jogos

- **AniGuessr** com histórico de tentativas, autocomplete multilíngue (inglês, romaji e japonês), pistas, pontos e streak
- Modos Meu histórico, Minha fila e Descoberta
- Blur progressivo mais leve na capa
- **Descoberta personalizada** recolhível, usando AniList e excluindo os MAL IDs já existentes
- Ranking local de compatibilidade com explicações
- Roleta, recomendação da fila e modo surpresa
- Batalha de animes estilo torneio
- Anime Bingo e desafio 3×3 salvo no navegador

## Perfil pela URL

Depois que uma lista é carregada, o username fica na própria URL:

```text
https://seu-usuario.github.io/MALrepo/?user=animefan#explorer
```

ou diretamente nas novas áreas:

```text
https://seu-usuario.github.io/MALrepo/?user=animefan#estatisticas
https://seu-usuario.github.io/MALrepo/?user=animefan#jogos
```

Ao abrir esse endereço, o MAL Sheet carrega a lista automaticamente. Não existe login ou sessão no servidor: o username é apenas uma referência pública na URL.

Se a URL não tiver `user`, o navegador pode reutilizar o último username salvo em `localStorage`.

## Descoberta e AniGuessr

A lista do MAL é usada para montar um perfil de gosto local. Notas altas dão peso positivo aos gêneros; notas baixas e títulos abandonados reduzem esse peso. A AniList é consultada apenas para buscar candidatos que não estejam na lista do usuário.

O ranking considera:

- afinidade de gêneros
- nota média do título
- proximidade com a época em que o usuário costuma assistir
- quantidade de episódios em relação ao histórico
- popularidade como critério secundário

Os resultados da AniList ficam em cache no navegador por algumas horas para reduzir chamadas externas. Os títulos alternativos são enriquecidos em lote e mantidos em cache local por 30 dias, permitindo pesquisar e responder usando inglês, romaji ou japonês.

## Instalação como aplicativo (PWA)

O MAL Sheet pode ser instalado pelo Chrome/Android como um aplicativo, não apenas como atalho. O build gera automaticamente:

- Web App Manifest
- Service Worker
- cache do shell da aplicação
- ícones 192×192, 512×512 e maskable
- modo `standalone`, sem a barra do navegador
- atualização automática do service worker

No Android, depois do deploy, abra o MAL Sheet no Chrome e use **Instalar app** no menu do navegador ou o botão **Instalar app** exibido pela própria interface quando o Chrome disponibilizar o prompt.

O app instalado abre em `/MALrepo/` e reutiliza o último usuário salvo no navegador, então o perfil continua sendo carregado automaticamente.

## Rodar localmente

```bash
npm install
npm run dev
```

## Carregar uma lista

Na interface, informe apenas o username do MyAnimeList:

```text
animefan
```

ou cole a URL completa da lista:

```text
https://myanimelist.net/animelist/animefan
```

A aplicação extrai o username e consulta o endpoint público usado pelo próprio MyAnimeList através do Cloudflare Worker restrito do projeto. Nenhuma credencial do usuário é armazenada.

## GitHub Pages

O workflow em `.github/workflows/deploy.yml` gera o projeto e publica a pasta `dist`. Nas configurações do repositório, em **Settings > Pages**, selecione **GitHub Actions** como source caso ainda não esteja selecionado.

A URL esperada é `https://seu-usuario.github.io/MALrepo/`.

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

- **GitHub Pages**: interface React/Vite, filtros, jogos, estatísticas e ranking de recomendações.
- **Cloudflare Worker**: somente leitura da lista pública do MyAnimeList e CORS.
- **AniList GraphQL**: candidatos de descoberta, metadados e dados usados no AniGuessr Descoberta.
- **Jikan**: enriquecimento da Nota MAL por anime, com cache local.
- **localStorage**: usuário lembrado, fila local, favoritos, blacklist, desafios e recordes.
- Nenhum banco de dados, login próprio, Client Secret ou token do usuário é necessário.

## Limitações

- A lista do usuário precisa estar pública.
- O endpoint `load.json` do MAL não é uma API oficial documentada e pode mudar no futuro.
- A Nota MAL é enriquecida separadamente pela Jikan e pode aparecer alguns instantes depois da tabela.
- A AniList possui rate limit; o MAL Sheet reduz chamadas usando consultas em lote e cache local.
