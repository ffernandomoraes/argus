<p align="center">
  <img src="build/icon.png" width="128" alt="Ícone do Argus">
</p>

<h1 align="center">Argus</h1>

<p align="center">
  Um canvas infinito para acompanhar todos os seus projetos e as conversas do Claude Code ao mesmo tempo.
</p>

<p align="center">
  <a href="https://github.com/ffernandomoraes/argus/releases/latest"><b>Baixar para macOS (Apple Silicon)</b></a>
  -
  <a href="https://github.com/ffernandomoraes/argus/releases/latest"><b>Baixar para Windows</b></a>
</p>

![Canvas do Argus com nove projetos nos grupos Trabalho, Freela e Pessoal, agentes rodando em paralelo com seus subagentes e uma conversa aberta no painel lateral mostrando o diff e um pedido de permissão](docs/prints/argus.png)

Na mitologia grega, Argus era o gigante de cem olhos que via tudo ao mesmo tempo. O app faz
o mesmo com os seus agentes: cada pasta de projeto vira um bloco no canvas e, dentro dele,
você vê as conversas do Claude Code, o que cada uma está fazendo agora e quais estão
esperando por você.

No print acima: três grupos com nove projetos, conversas rodando ao mesmo tempo (com os
subagentes que cada uma lançou logo abaixo), outras esperando sua resposta, e o painel
lateral com o diff da edição e o pedido de permissão para o próximo comando.

## Funcionalidades

**Canvas**
- Canvas infinito com zoom e grupos coloridos (Trabalho, Pessoal, o que você quiser).
- Minimapa com cada bloco na cor do seu grupo e a lista dos grupos em ordem alfabética: um clique leva direto a cada um.
- Grupos: arraste blocos para dentro, renomeie com dois cliques no nome, recolha ou oculte o conteúdo.
- Cada pasta de projeto vira um bloco com a branch do git e as conversas mais recentes; as demais ficam em **Ver todas as conversas**. Dá para recolher a lista e deixar só as que estão rodando.
- Botão direito na pasta: nova conversa, abrir o repositório no GitHub (ou no host do remoto) e tirar do canvas, que avisa antes se houver conversa em andamento.
- Blocos se encaixam pela borda ou pelo meio dos vizinhos ao arrastar, e ⌘Z / ⇧⌘Z (Ctrl+Z / Ctrl+Shift+Z no Windows) desfazem e refazem o layout.
- O layout fica salvo e volta igual ao reabrir o app.
- Comando `argus .` no terminal: abre a pasta atual no canvas, como o `code .` do VS Code.
- Barra de comando por texto ou voz: peça "cria um grupo Freela com essas duas pastas" e o Claude organiza o canvas.
- Uma conta do Claude por grupo: a pessoal num grupo, a da empresa em outro. Pastas, terminais e conversas do grupo usam a conta dele.

**Conversas com o Claude Code**
- Chat completo, com respostas em tempo real, onde você preferir: painel lateral, janela própria ou um bloco dentro do canvas.
- Modo foco: o painel ocupa a tela e a conversa fica numa coluna central, mais fácil de ler.
- Enquanto responde, o chat mostra o que o Claude está fazendo (pensando, escrevendo, rodando uma ferramenta) e o tempo total do turno.
- Conversa sem projeto, pelo botão direito do canvas: roda na sua pasta pessoal e vira um card no primeiro envio.
- Cole prints com ⌘V (Ctrl+V no Windows), anexe arquivos e dite em vez de digitar.
- Edições aparecem como diff (o antes e depois de cada arquivo).
- Aprove ou negue permissões e responda às perguntas do Claude direto no chat.
- Troque modelo, nível de esforço, thinking, Ultracode (vários subagentes em paralelo) e modo de permissão por conversa; cada conversa guarda os dela. Thinking e Ultracode começam desligados.
- Comandos de barra (`/`), `@nome` para chamar um agente, painel de servidores MCP e remote control.
- Anel com o quanto da janela de contexto a conversa já ocupa.
- Também enxerga as sessões abertas fora do app (terminal, VS Code) e o status delas.
- Conversa que não serve mais vai para a Lixeira pelo botão direito.

**Acompanhamento**
- Status de cada conversa no canvas: rodando, esperando você, concluída.
- Subagentes aparecem embaixo da conversa que os lançou enquanto trabalham, com o que estão fazendo agora.
- Notificação do sistema quando uma conversa termina ou precisa de resposta.
- Ícone na barra de menus (no Windows, na área de notificação) com o resumo do que está rodando.
- Indicador do limite de uso do Claude, de cada conta.
- Lista dos servidores locais que algum agente deixou rodando ou que rodam dentro das pastas do canvas, com atalho para abrir ou encerrar (só no Mac).
- Fechar ou atualizar o app com conversa ou terminal rodando pede confirmação antes.

**Ferramentas**
- Terminais embutidos (Claude Code ou shell) soltos no canvas.
- Botão acima da pasta para iniciar e encerrar o servidor do projeto (script `dev` ou `start` do `package.json`).
- Explorador de arquivos e editor de código do projeto: criar, renomear, excluir, colar arquivos copiados no Finder ou no Explorador de Arquivos e editar com ⌘S (Ctrl+S no Windows) para salvar. Arquivos não comitados aparecem com a cor do git.
- Biblioteca de agentes (subagentes do Claude Code): criar, editar e deixar o Claude escrever as instruções.
- Editor da memória do Claude: `CLAUDE.md` global, de cada projeto e as anotações da memória automática.

**Visual**
- No estilo do macOS: fonte do sistema (SF Pro no Mac, Segoe UI no Windows), cinzas do sistema e botões em cápsula.
- Usa a cor de destaque escolhida no Mac (Aparência) ou no Windows (Cores) e acompanha quando você troca.
- Menus translúcidos e animação suave ao abrir e fechar blocos, painéis, menus e janelas.
- Bordas do canvas esfumaçadas, para os blocos não brigarem com as barras dos cantos.
- Tema claro, escuro ou o do sistema.

**App**
- Login do Claude Code dentro do app, sem passar pelo terminal.
- Configurações no estilo do Ajustes do macOS (Geral, Conversas, Aparência, Contas), com as Boas-vindas sempre à mão no pé da barra lateral.
- Cada conta do Claude aparece com o nome da pessoa, a organização e o plano.
- Atualização automática, com a versão em uso sempre no canto da barra de título.
- Botão **Me pague um café** na barra de título, com QR Code e chave Pix para apoiar o projeto.

## Requisitos

- Mac com Apple Silicon (M1 ou mais novo), ou PC com Windows 10 ou 11 de 64 bits.
- [Claude Code](https://docs.claude.com/claude-code). O Argus usa o `claude` da sua máquina e a sua assinatura.
  Na primeira vez, as boas-vindas explicam o app em 5 etapas e a última configura tudo: instala o
  Claude Code com um clique (o instalador oficial da Anthropic), confere o Git no Windows e faz o
  login. Outras contas entram por
  **Configurações › Contas**.
- No Windows, também o [Git for Windows](https://git-scm.com/download/win), que o app usa para mostrar os
  arquivos alterados e o diff.

## Instalação

### macOS: pelo terminal (recomendado)

```bash
curl -fsSL https://raw.githubusercontent.com/ffernandomoraes/argus/main/install.sh | sh
```

Baixa a última versão, coloca em `/Applications` e abre. Rodar de novo atualiza.

### Atualizações

O Argus se atualiza sozinho: procura versão nova ao abrir e a cada 5 horas, e baixa em
segundo plano. Quando ela está pronta, aparece **Atualizar para x.y.z** no canto direito da
barra de título. Um clique reinicia o app já atualizado; se preferir não clicar, a versão
nova entra quando você fechar o app. Também dá para procurar na hora em
**Configurações › Geral** (no Mac, também pelo menu **Argus › Procurar atualizações…**).
No Windows, a atualização roda o instalador da versão nova em modo silencioso, sem perguntar nada.

No Mac, as permissões que você der ao app (microfone, ditado, notificações) continuam
valendo nas versões seguintes: todas saem assinadas com o mesmo certificado, e o app só
aceita uma atualização assinada por ele.

### macOS: pelo .dmg

1. Baixe o `Argus-<versão>-arm64.dmg` em [Releases](https://github.com/ffernandomoraes/argus/releases/latest).
2. Arraste o Argus para a pasta Aplicativos.
3. Na primeira vez, o macOS bloqueia a abertura, porque o app não é notarizado pela Apple.
   Vá em **Ajustes do Sistema › Privacidade e Segurança** e clique em **Abrir Mesmo Assim**.

### Windows

1. Baixe o `Argus-Setup-<versão>.exe` em [Releases](https://github.com/ffernandomoraes/argus/releases/latest).
2. Abra o arquivo. Na primeira vez, o Windows mostra **O Windows protegeu o computador**, porque
   o app não tem certificado pago de assinatura: clique em **Mais informações › Executar assim mesmo**.
3. O Argus instala na sua pasta de usuário, sem pedir administrador, cria atalhos no Menu Iniciar e
   na Área de Trabalho e abre.

No Windows o app funciona como no Mac, com duas diferenças: não há a lista de servidores que os
agentes deixaram rodando (o Windows não deixa um programa ler as variáveis de outro), e o ditado
usa só a transcrição do Claude, sem a reserva do reconhecimento de fala do macOS. Os terminais
abrem no PowerShell.

### Comando `argus`

Em **Configurações › Geral**, ative o comando `argus` no terminal. Depois, em qualquer pasta:

```bash
argus .
```

No Windows ele funciona no PowerShell e no Prompt de Comando. Se a pasta
`%USERPROFILE%\.local\bin` não estiver no PATH, o Argus a acrescenta ao ativar o comando.

## Desenvolvimento

```bash
pnpm install   # também compila o ditado (precisa das Command Line Tools da Apple)
pnpm dev       # abre o app com recarga automática
pnpm typecheck
pnpm dist      # gera o .dmg e o .zip em dist/
pnpm dist:win  # gera o instalador do Windows em dist/ (rode num Windows: no Mac falta o ícone do .exe)
```

A versão de desenvolvimento usa uma pasta de dados própria (`Argus Dev`) e um comando
`argus` próprio, então roda ao lado da instalada sem mexer nela.

Rodando de dentro do VS Code ou do Claude Code, a variável `ELECTRON_RUN_AS_NODE` pode
vir ligada e o Electron abre como Node, sem janela. Nesse caso:

```bash
env -u ELECTRON_RUN_AS_NODE pnpm dev
```

Stack: Electron, React, TypeScript, electron-vite, React Flow, Tailwind, CodeMirror,
xterm.js com node-pty e o [Claude Agent SDK](https://docs.claude.com/en/api/agent-sdk/overview)
(rodando o `claude` da máquina, ver [docs/integracao-com-agentes.md](docs/integracao-com-agentes.md)).

### Gerar uma versão

Todo push na `main` vira uma versão: o workflow **Release** sobe o patch no `package.json`,
cria a tag, monta o `.dmg` e o `.zip`, publica o release e usa os títulos dos commits desde
a última versão como notas. Em seguida, numa máquina Windows do GitHub, monta o instalador
`.exe`, abre o app em modo de teste (`--smoke-test`) e, se ele subir, anexa o instalador ao
mesmo release. Pushes que só mexem em `.md` não geram versão. Como os títulos
viram as notas, escreva-os para quem usa o app.

Para subir minor ou major, ou escrever as notas à mão, dispare pela aba
**Actions › Release › Run workflow** ou:

```bash
gh workflow run release.yml -f bump=minor -f notas="- item 1
- item 2"
```

Com `publicar` desmarcado, o workflow só monta o app e guarda o `.dmg` e o `.exe` no run,
sem tag nem release.

A assinatura usa o certificado autoassinado guardado nos secrets do repositório
(`MAC_CERT_P12`, `MAC_CERT_PASSWORD`, `MAC_SIGN_IDENTITY`). Sem eles, o app sai com
assinatura ad-hoc e cada versão conta como um app novo para o macOS, que volta a pedir
microfone e ditado.

## Documentos

| Arquivo | O que tem |
|---|---|
| [docs/visao.md](docs/visao.md) | Problema, ideia, princípios e o pedido original |
| [docs/conceitos.md](docs/conceitos.md) | Vocabulário do produto: grupo, pasta, conversa, terminal, agente, conta |
| [docs/funcionalidades.md](docs/funcionalidades.md) | O que foi planejado por fase, o que já existe e o que falta |
| [docs/integracao-com-agentes.md](docs/integracao-com-agentes.md) | Como o app conversa com o Claude e o que ele lê do Claude Code |
| [docs/decisoes.md](docs/decisoes.md) | O que já foi decidido e o que está em aberto |

---

Projeto pessoal, sem vínculo com a Anthropic. Claude e Claude Code são marcas da Anthropic.
