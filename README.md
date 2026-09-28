# MAL Sheet

MVP client-side para explorar uma lista pública do MyAnimeList, descobrir novos animes e brincar com o próprio histórico sem criar uma conta adicional.

## Funcionalidades

### Explorer

- Tabela pesquisável e filtrável por título, gênero, status, ano, episódios e nota pessoal
- Nota MAL enriquecida pela Jikan, com cache local
- Coluna Δ para comparar sua nota com a média MAL
- Presets rápidos: curto pra hoje, só pedrada, clássicos e fila
- Favoritos e blacklist locais
- Compartilhamento da visão por URL, incluindo usuário e filtros
- Perfil embutido na URL: `?user=Kerbus` carrega a lista automaticamente
- O último usuário também pode ser lembrado localmente no navegador

### Diversão

- Roleta do próximo anime com filtros
- Recomendação baseada nos gêneros que você costuma avaliar melhor
- **Descoberta personalizada fora da sua lista**, usando AniList e excluindo os MAL IDs já existentes
- Ranking local de compatibilidade com explicações do porquê cada anime apareceu
- Fila local para descobertas e opção de ocultar recomendações
- **AniGuessr** com três modos: Já assisti, Minha fila e Descoberta
- Sistema de pistas, pontos, streak e recordes persistidos no navegador
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

## Perfil pela URL

Depois que uma lista é carregada, o username fica na própria URL:

```text
https://stormyasta.github.io/MALrepo/?user=Kerbus#explorer
```

ou diretamente na aba Diversão:

```text
https://stormyasta.github.io/MALrepo/?user=Kerbus#diversao
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

Os resultados da AniList ficam em cache no navegador por algumas horas para reduzir chamadas externas.

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
