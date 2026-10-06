# Integração com agentes e stack

Esta é a parte de maior risco técnico do projeto. O canvas é trabalho conhecido. Fazer o
app **conversar com o Claude e enxergar os subagentes** é o que precisa ser provado antes
de investir no resto.

## Requisitos que definem a escolha

- **R1. Chat próprio do app**, com colar prints (Cmd+V) como ação principal (D6).
- **R2. Usar a assinatura do Claude** (o login do `claude`), não chave de API paga por
  uso (D7).
- **R3. Ver subagentes** com input, atividade e output, em tempo real.

## Opções

### Opção A: o app comanda o `claude` em modo sem interface (recomendada)

O app abre um processo do `claude` por conversa, em modo sem interface (headless) e com
entrada e saída em JSON contínuo. O app desenha o chat e o `claude` faz o trabalho, com o
login que já existe na máquina.

```bash
claude -p \
  --input-format stream-json \
  --output-format stream-json \
  --include-partial-messages \
  --forward-subagent-text
```

| Requisito | Atende? | Base |
|---|---|---|
| R1 Chat e prints | Sim. O app envia texto e imagens como blocos de conteúdo pela entrada JSON | [headless](https://code.claude.com/docs/en/headless.md) |
| R2 Assinatura | Sim. O `claude` usa o login feito com `/login` antes de procurar chave de API | [authentication](https://code.claude.com/docs/en/authentication.md) |
| R3 Subagentes | Sim. Mensagens de subagente chegam com `parent_tool_use_id` apontando para a chamada que as criou; dá para montar a árvore inteira | [headless](https://code.claude.com/docs/en/headless.md) |
| Continuar conversa | `--resume <id-da-sessao>` | `claude --help` |
| Permissões | `--permission-prompts` define quem responde aos pedidos de permissão | `claude --help` |

As opções acima foram conferidas no `claude --help` desta máquina (versão 2.1.284) em
06/10/2026. O formato exato das mensagens ainda precisa ser validado na prova técnica.

- **Contras:** depende do formato de saída do CLI, que pode mudar entre versões. É
  documentado, mas menos estável que uma SDK.

### Opção B: Claude Agent SDK (descartada por R2)

A SDK oficial exige chave de API (ou Bedrock/Vertex). A documentação diz:

> "Unless previously approved, Anthropic does not allow third party developers to offer
> claude.ai login or rate limits for their products, including agents built on the
> Claude Agent SDK."
> ([overview](https://code.claude.com/docs/en/agent-sdk/overview.md))

Fica como plano B caso a opção A não funcione e o custo por uso seja aceitável.

### Opção C: observar o que o Claude Code já grava (complemento)

O app lê em tempo real os arquivos de sessão em `~/.claude/projects/` e recebe eventos
por hooks (scripts que o Claude Code executa em momentos como "usou uma ferramenta" ou
"subagente terminou"). Os eventos trazem `session_id` e `transcript_path`.

- **Uso:** mostrar no canvas as sessões abertas fora do app (terminal, VS Code). Só
  leitura.
- **Contra:** o formato dos arquivos é interno do Claude Code, não uma API pública.

### Opção D: terminal embutido (fica para depois)

Cada conversa como um terminal real rodando o `claude`. Não atende R1 (o chat seria o do
terminal) nem R3 (o app só veria texto). Pode entrar depois como recurso extra.

## Recomendação

**A como base, C como complemento.**

### Ponto de atenção sobre a assinatura

A frase da documentação fala de desenvolvedores que oferecem login do claude.ai **em
produtos para terceiros**. Este app é de uso pessoal e usa o próprio `claude`, logado
pela própria pessoa. Minha leitura é que isso está dentro do permitido, mas **a
documentação não trata desse caso de forma explícita**. Confiança média. Se o app um dia
for distribuído, isso tem que ser revisto.

### Prova técnica

Protótipo descartável, de 1 a 2 dias, logo depois do wireframe. Precisa responder:

1. Uma conversa de várias mensagens funciona pelo modo JSON contínuo, usando a assinatura?
2. Um print colado chega ao Claude e é entendido?
3. Os eventos de subagente chegam com input, atividade e output completos e em tempo real?
4. Dá para aprovar permissões e interromper pelo app?
5. Quantas conversas simultâneas aguentam sem problema (memória, limites da assinatura)?

## Stack

Não é necessária para o wireframe. Registrada aqui para a decisão posterior.

### 1. Electron + React + TypeScript (recomendada)

- É a base do VS Code: Monaco (o editor do VS Code), xterm.js (o terminal do VS Code) e
  node-pty rodam sem adaptação.
- Abrir e controlar processos do `claude` é natural em Node.
- Colar imagem da área de transferência é API padrão do navegador e do Electron.
- Canvas: React Flow (licença MIT, feito para nós e conexões) ou tldraw (mais "quadro
  branco"; a licença para uso comercial precisa ser verificada).
- **Contra:** consome mais memória e disco, porque cada app Electron carrega o próprio
  Chromium. Para uso pessoal, aceitável.

### 2. Tauri 2 + React + TypeScript (backend em Rust)

- App leve, instalador pequeno (usa o navegador embutido do sistema).
- **Contras:** Monaco e xterm.js funcionam, mas node-pty e o controle de processos ficam
  em Rust. O navegador embutido é diferente no macOS (WebKit) e no Windows (Chromium), o
  que gera bugs de renderização diferentes no canvas em cada sistema. Exige lidar com
  Rust.

### 3. Nativo (Swift/SwiftUI)

- Melhor sensação de app de Mac.
- **Contras:** não roda no Windows e não tem Monaco nem xterm.js. Descartaria.
