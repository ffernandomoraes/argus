# Servidor da conta do Argus

API em Node (Express 5 + Better Auth + Drizzle + Postgres), no padrão da API do `codes-modules`.
Roda na Railway (workspace pessoal, projeto "Argus") em `https://account.argusterm.com`. O único
cliente é o app do computador (`apps/desktop/src/main/account`).

## O que faz

- Login com GitHub e Google. O mesmo e-mail confirmado nos dois vira uma conta só. Os acessos dos
  provedores não ficam guardados.
- A sessão de cada computador (token no cofre do sistema, enviado como `Authorization: Bearer`).
- As preferências sincronizadas (regras em `packages/shared/src/accountSync.ts`).
- O desenho dos workspaces de cada computador, que outro computador traz como cópia (regras em
  `packages/shared/src/accountWorkspaces.ts`). Uma linha por aparelho; some com a sessão.
- Acesso remoto pela conta: o computador com o acesso ligado publica a sala dele na ponte e um código
  de pareamento sempre aberto; os outros aparelhos da conta pareiam com ele sem digitar (a ligação
  segue cifrada de ponta a ponta). O app do celular entra na conta pelo navegador e chama a API de
  `WEB_APP_URL` (`https://remote.argusterm.com`, única origem com CORS; ver `middlewares/cors.ts`).
- O GitHub conectado (app só de leitura), para clonar os repositórios liberados pela Nova pasta e
  pelo "Clonar…" dos workspaces importados (ver "App do GitHub" abaixo).
- As instruções e skills dos agentes: CLAUDE.md, skills, agentes e comandos (`~/.claude`, caminho
  sem prefixo); AGENTS.md e skills (`codex/`); GEMINI.md e comandos `.toml` (`gemini/`); comandos e
  skills (`cursor/`). Um arquivo por linha com o
  hash; o app compara e importa com conferência (regras em `packages/shared/src/accountClaude.ts`,
  com a conferência do caminho repetida em `src/modules/claude/claude.rules.ts`). Limites: 256 KB
  por arquivo, 10 MB e 1000 arquivos por pessoa.

| Rota | Para quê |
| --- | --- |
| `GET /auth/<github\|google>/start?port&challenge&lang` | O app abre no navegador; vai para o provedor |
| `GET /auth/<provedor>/callback` | Endereço cadastrado no provedor; repassa para `GET /api/auth/callback/<provedor>`, a única rota do Better Auth aberta (o resto ele usa só por dentro) |
| `GET /auth/finish/...`, `/auth/failed/...` | Devolvem o navegador ao app (`127.0.0.1`) com o código ou o erro |
| `GET /auth/done?status&lang` | Página final do login |
| `POST /api/desktop/redeem` | Código + segredo do app viram a sessão do computador |
| `GET/DELETE /api/me` | Perfil; apagar a conta |
| `GET /api/devices`, `DELETE /api/devices/<id>`, `POST /api/logout` | Aparelhos |
| `GET /api/sync?since=N`, `PUT /api/sync` | Preferências |
| `PUT /api/workspaces`, `GET /api/workspaces`, `GET /api/workspaces/<aparelho>` | Workspaces deste computador (até 20 envios por hora por pessoa), o resumo dos outros e o desenho inteiro de um |
| `GET /api/claude`, `PUT /api/claude`, `POST /api/claude/read`, `POST /api/claude/remove` | Arquivos do Claude |
| `PUT/DELETE /api/remote/host`, `GET /api/remote/hosts` | Acesso remoto pela conta: o código de pareamento aberto de cada computador |
| `POST /api/remote/ticket`, `POST /api/remote/claim`, `POST /api/remote/check` | Pareamento pela conta preso à sessão de quem pareou: o bilhete de uso único (10 min, na memória) que vai junto no pareamento, a troca dele pelo computador de casa e a conferência de quais sessões ainda valem. Tirar um aparelho da conta (ou sair dela) manda `device-removed` no fluxo de avisos, e o computador desfaz o pareamento |
| `GET /api/notices/stream`, `POST /api/notices` | Avisos entre os computadores da conta (fluxo SSE; só repassa, não guarda) |
| `GET /auth/<provedor>/web?challenge&lang` | Login do app do celular; volta para `WEB_APP_URL/#account=<código>` |
| `GET /github/start?port&challenge&lang`, `GET /github/callback` | Conectar o GitHub (app só de leitura): vai ao GitHub e volta ao app (`127.0.0.1`) com um código de uso único |
| `GET /github/installed` | "Setup URL" do app do GitHub, depois de escolher os repositórios |
| `GET/DELETE /api/github`, `POST /api/github/link`, `GET /api/github/repos`, `POST /api/github/token` | Estado, terminar a conexão, repositórios liberados, chave para o `git clone` (409 `notConnected` quando a conexão acabou) |
| `GET /api/health` | Healthcheck da Railway |

A API só aceita a sessão de um aparelho, pelo `Authorization: Bearer` (nunca o cookie). A sessão do
navegador existe só no meio do login: vira o código em `/auth/finish` (ou `/auth/web-finish`) e some,
e a de um login largado sai depois de 15 minutos. Por IP: `RATE_LIMIT_PER_MINUTE` pedidos por minuto
(padrão 300) e `STARTS_PER_10_MINUTES` começos de login ou de conexão do GitHub a cada 10 minutos
(padrão 30). O IP vem do `x-real-ip`, que a borda da Railway reescreve.

Endereços de volta cadastrados: `https://account.argusterm.com/auth/github/callback` (GitHub OAuth
App) e `https://account.argusterm.com/auth/google/callback` (cliente Web do Google).

## App do GitHub (clonar pelo Argus)

Não é o OAuth App do login: é um **GitHub App** só de leitura, que a pessoa instala escolhendo os
repositórios. A chave de acesso vence em 8 horas e a de renovação em 6 meses; ficam cifradas no banco
(AES-256-GCM com chave tirada de `BETTER_AUTH_SECRET`; trocar esse segredo obriga todo mundo a
conectar de novo). O app pede a chave só na hora do clone e passa ao git pelo ambiente
(`GIT_CONFIG_*`), sem gravar no `.git/config`. Sem as três variáveis abaixo, o recurso fica desligado
(`GET /api/github` responde `available: false`).

Criar em `github.com/settings/apps/new`:

| Campo | Valor |
| --- | --- |
| Callback URL | `https://account.argusterm.com/github/callback` |
| Expire user authorization tokens | ligado |
| Request user authorization (OAuth) during installation | desligado |
| Setup URL | `https://account.argusterm.com/github/installed` (com "Redirect on update") |
| Webhook | desligado |
| Permissões | Repository > Contents: Read-only (Metadata vem junto) |
| Onde instalar | Any account |

Variáveis: `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_SLUG` (o nome no endereço `github.com/apps/<slug>`) e
`GITHUB_APP_CLIENT_SECRET` (das Chaves do Mac, `argus-account-github-app-secret`, sem aparecer).

## Desenvolvimento

```bash
pnpm --filter @argus/account test        # banco em memória (PGlite), sem rede
pnpm --filter @argus/account typecheck
pnpm --filter @argus/account db:generate  # depois de mudar uma tabela; a API aplica ao subir
```

Para rodar local, crie `apps/account/.env` com `DATABASE_URL=pglite:.data/dev`,
`BETTER_AUTH_SECRET`, `PUBLIC_URL=http://localhost:3000` e as chaves dos provedores, e rode
`pnpm --filter @argus/account dev`. O app aponta para ele com `ARGUS_ACCOUNT_URL=http://localhost:3000`.
O login de verdade só fecha com o endereço de volta cadastrado no provedor.

## Railway

Serviço `account` e um Postgres no projeto "Argus" (workspace "Fernando Moraess"), região US East.
Criado em 2026-11-23. O `railway environment edit` travou esperando confirmação: a configuração do
serviço foi feita pela API GraphQL (`serviceInstanceUpdate`, `variableCollectionUpsert`), com o token
de `~/.railway-profiles/pessoal/.railway/config.json`.

| Campo | Valor |
| --- | --- |
| Build | `pnpm --filter @argus/account build` |
| Start | `node apps/account/dist/server.js` (sem pnpm ao rodar) |
| Healthcheck | `/api/health` |
| Watch | `/apps/account/**`, `/package.json`, `/pnpm-lock.yaml`, `/pnpm-workspace.yaml` |

Variáveis: `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `PUBLIC_URL`, `GITHUB_CLIENT_ID`,
`GOOGLE_CLIENT_ID`, `RAILPACK_NODE_VERSION=24`, `COREPACK_ENABLE_DOWNLOAD_PROMPT=0` e
`RAILPACK_INSTALL_CMD=corepack enable && pnpm install --frozen-lockfile --filter @argus/account...`
(instala só este servidor, sem o Electron do app; o comando próprio troca o do Railpack inteiro, por
isso liga o corepack, que lê o `packageManager` da raiz). Segredos: `BETTER_AUTH_SECRET`
(`openssl rand -base64 32`) e `GITHUB_CLIENT_SECRET`/`GOOGLE_CLIENT_SECRET`, lidos das Chaves do Mac
(`argus-account-github-secret`, `argus-account-google-secret`) direto para a API, sem aparecer.

Domínio: `account.argusterm.com` com CNAME para `cb6o78n7.up.railway.app` e TXT
`_railway-verify.account`, na zona `argusterm.com` da `cf-pessoal`, sem proxy.

Publicar: sozinho, a cada push na `main` que mexe nos caminhos do Watch. O serviço está ligado ao
repositório `ffernandomoraes/argus` (branch `main`) desde 2026-11-25, pela API GraphQL
(`serviceConnect`). Para subir o código local sem commit (teste urgente): `rw-pessoal up -s account
--detach`; o próximo push publica por cima.

Pegadinhas:
- O `packageManager` da raiz fixa o pnpm 11 para a Railway (sem ele, o Railpack usa o pnpm 9 e o
  install quebra). A CI lê a versão de lá (o `pnpm/action-setup` sem `version`).
- `NODE_ENV` e `PORT` não se definem: a Railway põe.
- Em produção, a API não sobe sem as chaves dos dois provedores, sem `BETTER_AUTH_SECRET` de 32+
  caracteres ou com banco PGlite.
