# Decisões

## Decidido

| # | Decisão | Quem | Quando |
|---|---|---|---|
| D1 | App desktop, não web. macOS primeiro, Windows depois. | Fernando | 06/10/2026 |
| D2 | ~~Wireframe antes de qualquer código.~~ Substituída por D8. | Fernando | 06/10/2026 |
| D3 | Projetos separados por área: Trabalho, Freela, Pessoal. | Fernando | 06/10/2026 |
| D4 | Dentro de um projeto há dois modos: conversa livre e instância de agente global com tarefa. | Fernando | 06/10/2026 |
| D5 | A experiência de conversa (prompt e resposta) é prioridade de qualidade no produto. | Fernando | 06/10/2026 |
| D6 | A conversa é um chat próprio do app, não um terminal. Colar prints é requisito central. | Fernando | 06/10/2026 |
| D7 | Tudo roda na assinatura do Claude, sem chave de API paga por uso. | Fernando | 06/10/2026 |
| D8 | Sem wireframe em HTML: a interface é montada direto no app e as decisões visuais são tomadas lá. Motivo: duas sessões travaram gerando o wireframe. | Fernando | 06/10/2026 |
| D9 | Stack: Electron + React + TypeScript, com electron-vite, React Flow (`@xyflow/react`) e Tailwind (fecha P6). | Fernando | 06/10/2026 |
| D10 | Agente global = agente do Claude Code em `~/.claude/agents/*.md`. O app só lê e grava esses arquivos (biblioteca com formulário); o mesmo agente vale no terminal e no VS Code. Editar o arquivo muda todas as conversas (fecha P8: vinculada). | Fernando | 06/10/2026 |
| D11 | O agente roda como subagente da conversa: o Claude da conversa delega, o agente trabalha sozinho e devolve um relatório. Chamado com @nome no chat ou escolhido pelo próprio Claude pela descrição. | Fernando | 06/10/2026 |
| D12 | Na listagem da pasta, o subagente aparece recuado embaixo da conversa que o lançou, só enquanto roda (nome do agente, o que está fazendo, tempo). O registro fica no chat: pedido, atividade e o que entregou. | Fernando | 06/10/2026 |
| D13 | Conversa sem projeto: "Nova conversa" no botão direito do canvas e no "Novo bloco". Roda na pasta do usuário (`~`), abre o painel em branco e só entra no canvas no primeiro envio, como card que reabre a conversa. | Fernando | 06/10/2026 |
| D14 | Nome do produto: **Argus** (o gigante de cem olhos da mitologia grega, que via tudo ao mesmo tempo: o app mostra o que cada agente está fazendo). Comando no terminal: `argus .`. Substitui "Canva Agent Editor", que esbarrava na marca Canva. | Fernando | 07/10/2026 |
| D15 | Distribuição: `.dmg` e `.zip` só Apple Silicon, por release no GitHub (workflow manual). Assinado com certificado autoassinado próprio ("Argus Code Signing", backup em `~/Documents/Argus-certificado`), o mesmo em todas as versões, para o macOS lembrar microfone e ditado depois de atualizar. Sem conta paga da Apple, sem notarização: o `.dmg` pede "Abrir Mesmo Assim" na primeira vez; o `install.sh` evita o aviso. | Fernando | 07/10/2026 |
| D16 | Atualização dentro do app com atualizador próprio (`src/main/updater.ts`), não o electron-updater: o Squirrel.Mac dele valida a assinatura e não há garantia de que aceite certificado autoassinado. Procura no release mais recente do GitHub ao abrir e a cada 5 horas, baixa o `.zip`, só aceita se o requisito de assinatura for igual ao do app instalado e troca o `.app` depois que o processo sai. Botão discreto "Atualizar para x.y.z" e a versão em uso no canto direito da barra de título. Depende do repositório público (a API devolve 404 em repositório privado). | Fernando | 07/10/2026 |

## Em aberto

Com a sugestão atual de cada uma. A sugestão não é decisão até ser confirmada.

### Interface (decidir no app)

| # | Pergunta | Sugestão |
|---|---|---|
| P2 | A área é uma região desenhada no canvas ou uma etiqueta com cor na caixa do projeto? | Região, no estilo dos frames do Figma |
| P3 | Onde a conversa acontece: dentro da caixa do projeto no canvas, num painel lateral, ou os dois? | Os dois: bloco compacto no canvas, que expande para um painel lateral ao focar |
| P4 | As 6 telas propostas em [funcionalidades.md](funcionalidades.md) cobrem o que precisa? | Sim |

### Não bloqueiam agora

| # | Pergunta | Sugestão |
|---|---|---|
| P5 | Como o app conversa com o Claude? | Comandar o `claude` em modo sem interface (usa a assinatura) e observar as sessões abertas fora do app, depois da prova técnica (ver [integracao-com-agentes.md](integracao-com-agentes.md)). A SDK fica descartada por D7 |
| P7 | Um canvas só ou um por área? | Um só |
| P9 | O visualizador de código só mostra ou também edita? | Só mostra, com botão "abrir no VS Code" |
| P10 | Projetos entram automaticamente (importar os que o Claude Code já conhece) ou um por um? | Importar com seleção, sugerindo a área pela pasta |
| P11 | Só Claude ou outros agentes no futuro? | Só Claude, sem fechar a porta |

## Alertas

- **Escopo do "igual o VS Code".** Reconstruir uma IDE é um projeto do tamanho do próprio
  app. Proposta: visualizar e navegar pelo código (Monaco) e abrir no VS Code para editar.
- **Risco da integração.** O app depende do formato de saída do `claude`, que pode mudar
  entre versões. Se a prova técnica mostrar que esse caminho não serve, a alternativa é
  a SDK, que exige chave de API e bate de frente com D7. Por isso a prova vem logo depois
  do wireframe, antes do canvas de verdade.
- **Assinatura e uso pessoal.** A documentação proíbe terceiros de oferecer o login do
  claude.ai em produtos; o caso de uso pessoal com o próprio `claude` não aparece de forma
  explícita. Ver [integracao-com-agentes.md](integracao-com-agentes.md).
