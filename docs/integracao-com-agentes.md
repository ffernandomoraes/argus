# Integração com agentes

Como o app conversa com o Claude e o que ele lê do Claude Code. Era a parte de maior risco
técnico do projeto; a análise original está no fim deste arquivo, como histórico.

## Requisitos

- **R1. Chat próprio do app**, com colar prints (⌘V) como ação principal (D6).
- **R2. Usar a assinatura do Claude** (o login do `claude`), não chave de API paga por
  uso (D7).
- **R3. Ver subagentes** com o que receberam, o que estão fazendo e o que entregaram, em
  tempo real.

## Como funciona hoje

### Conversas: Claude Agent SDK rodando o `claude` da máquina

Cada conversa é um `query()` do [Claude Agent SDK](https://docs.claude.com/en/api/agent-sdk/overview)
(`src/main/chats/`) com `pathToClaudeCodeExecutable` apontando para o `claude` instalado
(`src/main/claudePath/`). O SDK não chama a API direto: abre esse `claude` e conversa com
ele. Por isso a conversa usa o login e a assinatura que já existem na máquina (R2), e se
comporta como o Claude Code no terminal: `systemPrompt: { preset: 'claude_code' }` carrega
o mesmo prompt, `CLAUDE.md`, configurações e MCPs.

| Requisito | Como |
|---|---|
| R1 Chat e prints | Texto e imagens vão como blocos de conteúdo na entrada da conversa; as respostas chegam aos poucos (`includePartialMessages`) |
| R2 Assinatura | O `claude` da máquina, com o login dele. O binário que vem com o SDK (~200 MB) fica fora do app (`electron-builder.yml`) |
| R3 Subagentes | `agentProgressSummaries` faz cada subagente mandar uma frase do que está fazendo; a lista de quem está rodando vem junto do estado do chat (`src/renderer/src/canvas/runningAgents.ts`) |
| Permissões e perguntas | `canUseTool` devolve cada pedido para o chat, onde a pessoa aprova, nega ou responde |
| Continuar conversa | `resume` com o id da sessão |
| Modelo, esforço, modo | Opções do `query()`, por conversa; trocadas com a conversa aberta pelos controles do SDK |

O mesmo caminho serve para outras duas partes do app:

- **Barra de comando do canvas** (`src/main/canvasAgent/`): conversa com o Haiku, que
  recebe as ações do canvas como ferramentas de um MCP do próprio app
  (`createSdkMcpServer`) e organiza grupos e pastas pelo pedido.
- **Login** (`src/main/auth/`): um `claude` aberto só para o login gera o link, recebe o
  retorno do navegador e grava o login nas Chaves do macOS, como a extensão do VS Code. No
  Windows, o Claude Code guarda o login num arquivo, `~/.claude/.credentials.json`.

### Contas

Cada conta adicionada mora numa pasta própria, passada ao `claude` em `CLAUDE_CONFIG_DIR`
(`src/main/accounts/`). O login dela fica num item separado das Chaves do macOS (no
Windows, num arquivo dentro da pasta da conta), então as contas rodam ao mesmo tempo. Histórico, `CLAUDE.md`, agentes, skills, comandos,
plugins e configurações ficam ligados aos da conta principal por link simbólico; login e
MCPs são de cada conta (D18).

### O que o app lê do Claude Code

Sem passar pelo SDK, só leitura:

| O quê | De onde | Para quê |
|---|---|---|
| Histórico das conversas | `<conta>/projects/<projeto>/*.jsonl` (`sessions/`, `history/`, com a leitura comum em `transcripts/`) | Lista de conversas da pasta, título, uso de contexto e o chat ao reabrir |
| Status de cada Claude Code aberto | `<conta>/sessions/<pid>.json` (`liveSessions.ts`) | Status de sessões abertas no terminal ou no VS Code |
| Mudanças nessas pastas e no git | `sessionWatch/` | Atualizar o canvas na hora, sem esperar a próxima conferência |
| Limite de uso | Pedido de controle `get_usage` a um `claude` em modo `stream-json` aberto por conta (`usageMonitor/`) | Indicador de uso, sem enviar mensagem nem gastar uso |

### Outros

- **Terminais** (`src/main/terminals/`): terminal real com node-pty, rodando o `claude`
  ou o shell, com a conta do grupo.
- **Ditado** (`src/main/speech/`): o microfone (`native/speech`) grava e o áudio vai em
  tempo real para o serviço de voz do Claude, com o login do Claude Code
  (`claudeAuth/`). Sem login ou sem conexão, usa o reconhecimento de fala do macOS. No
  Windows, quem grava o microfone é a própria janela (`src/preload/winMic/`), e não há
  essa reserva: sem o serviço do Claude, o ditado avisa e para.

## Riscos

- **Formato interno.** Os arquivos de sessão, o status em `sessions/<pid>.json`, o
  `get_usage` e o item de login nas Chaves por pasta de conta não são API pública do Claude
  Code. Podem mudar entre versões e quebrar a parte do app que depende deles. Cada um tem
  a versão em que foi conferido anotada no código.
- **Assinatura em produto distribuído.** A documentação do Agent SDK diz:

  > "Unless previously approved, Anthropic does not allow third party developers to offer
  > claude.ai login or rate limits for their products, including agents built on the
  > Claude Agent SDK."
  > ([overview](https://code.claude.com/docs/en/agent-sdk/overview.md))

  Quando a análise foi feita, o app era de uso pessoal e este ponto ficou como "rever se o
  app um dia for distribuído". Hoje ele é distribuído pelo GitHub (D15) e usa o login do
  `claude` de quem instala. **Em aberto**, ver [decisoes.md](decisoes.md).

## Histórico da escolha (06/10/2026)

A análise original comparou quatro caminhos:

- **A. Comandar o `claude -p` em modo `stream-json`** e desenhar o chat em cima da saída.
  Era a recomendação.
- **B. Claude Agent SDK.** Descartado na época por R2, lendo que o SDK exigia chave de
  API. Na construção, o SDK foi usado com `pathToClaudeCodeExecutable`: ele roda o
  `claude` da máquina, que é o caminho A com uma interface tipada por cima, e herda o login
  da assinatura.
- **C. Observar o que o Claude Code grava** (`~/.claude/projects`, status das sessões).
  Virou o complemento descrito em "O que o app lê do Claude Code".
- **D. Terminal embutido.** Não atendia R1 nem R3 como base; entrou depois como recurso
  extra (os terminais do canvas).

A stack também foi decidida nessa análise: Electron + React + TypeScript (D9), por rodar
xterm.js e node-pty sem adaptação e controlar processos em Node. Tauri e Swift ficaram de
fora: o primeiro exigiria o controle de processos em Rust e renderiza diferente em cada
sistema; o segundo não roda no Windows.
