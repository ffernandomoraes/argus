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
| D15 | Distribuição: `.dmg` e `.zip` só Apple Silicon, por release no GitHub (workflow manual; automático desde D20). Assinado com certificado autoassinado próprio ("Argus Code Signing", backup em `~/Documents/Argus-certificado`), o mesmo em todas as versões, para o macOS lembrar microfone e ditado depois de atualizar. Sem conta paga da Apple, sem notarização: o `.dmg` pede "Abrir Mesmo Assim" na primeira vez; o `install.sh` evita o aviso. | Fernando | 07/10/2026 |
| D16 | Atualização dentro do app com atualizador próprio (`src/main/updater.ts`), não o electron-updater: o Squirrel.Mac dele valida a assinatura e não há garantia de que aceite certificado autoassinado. Procura no release mais recente do GitHub ao abrir e a cada 5 horas, baixa o `.zip`, só aceita se o requisito de assinatura for igual ao do app instalado e troca o `.app` depois que o processo sai. Botão discreto "Atualizar para x.y.z" e a versão em uso no canto direito da barra de título. Depende do repositório público (a API devolve 404 em repositório privado). | Fernando | 07/10/2026 |
| D17 | O painel de código também edita (fecha P9), para não precisar de outra IDE em tarefas simples. Editor CodeMirror 6 com o tema Dark+ do VS Code, salva com ⌘S; o que não foi salvo fica como rascunho em memória ao trocar de arquivo. Na árvore: criar arquivo e pasta, renomear, excluir (vai para a Lixeira, com confirmação), copiar e colar, pelo botão direito, por ícones no cabeçalho e por atalhos (⌘C, ⌘V, Enter, ⌘⌫). ⌘V cola na pasta arquivos copiados no Finder. | Fernando | 07/10/2026 |
| D18 | Várias contas do Claude, uma por grupo (ex.: a pessoal num grupo, a da empresa em outro). A principal é a do `~/.claude`, a mesma do terminal e do VS Code; cada outra mora numa pasta própria passada ao `claude` em `CLAUDE_CONFIG_DIR` (`~/.argus/accounts/<id>`), com login separado nas Chaves do macOS, e roda ao mesmo tempo que as outras. O que é da pessoa fica ligado à principal por link simbólico (histórico das conversas, `CLAUDE.md`, agentes, skills, comandos, plugins e configurações); o login e os MCPs são de cada conta, e os MCPs começam como cópia dos da principal. A conta se escolhe no botão direito do grupo e aparece numa etiqueta ao lado do nome; pasta, terminal e conversa do grupo usam ela, e fora de grupo vale a padrão. Conversa aberta quando a conta do grupo muda termina na conta antiga. O indicador de uso mostra o limite de cada conta num botão só. Configurações › Contas: adicionar, entrar de novo, apelido, padrão e remover. | Fernando | 07/10/2026 |
| D19 | A conversa também pode morar dentro do canvas, como o terminal: botão "Colocar no canvas" no cabeçalho do painel lateral e opção "No canvas" em "Abrir conversas em". O bloco nasce à direita da pasta (ou do card da conversa solta), no mesmo grupo, acompanha o zoom do canvas e volta para o painel ou para uma janela separada pelo cabeçalho. Uma conversa fica em um lugar só: clicar nela com o bloco no canvas leva a câmera até ele. | Fernando | 07/10/2026 |
| D20 | Release automático a cada push na `main`: sobe o patch e usa os títulos dos commits desde a última versão como notas, em tópicos curtos para quem usa o app. Push só de `.md` não vira versão. Minor, major e notas escritas à mão pelo disparo manual do workflow. Motivo: sai melhoria quase todo dia e a pessoa atualiza com um clique. | Fernando | 07/10/2026 |

## Respondidas pelo que foi construído

Perguntas que estavam em aberto e que o app já respondeu na prática, sem registro de
decisão à parte. Se alguma resposta não for a desejada, vira decisão nova.

| # | Pergunta | Resposta no app | Onde |
|---|---|---|---|
| P2 | A área é uma região no canvas ou uma etiqueta na caixa do projeto? | Região colorida, chamada **grupo**, com blocos dentro | `AreaNode.tsx` |
| P3 | Onde a conversa acontece? | Painel lateral, janela própria ou bloco no canvas, à escolha (D19) | `ConversationDrawer.tsx`, `ChatPanelNode.tsx` |
| P4 | As 6 telas do wireframe cobrem o que precisa? | Sem efeito: o wireframe saiu do plano (D8) | |
| P5 | Como o app conversa com o Claude? | Claude Agent SDK rodando o `claude` da máquina, com o login da assinatura. A leitura de que o SDK exigia chave de API (que o descartava por D7) não se confirmou nesse uso | [integracao-com-agentes.md](integracao-com-agentes.md) |
| P7 | Um canvas só ou um por área? | Um só | `canvasStore.ts` |
| P10 | Projetos entram sozinhos ou um por um? | Um por um: **Nova pasta** no canvas ou `argus .` no terminal. Não há importação dos projetos que o Claude Code já conhece | `FolderPicker.tsx`, `cli.ts` |
| - | App de desenvolvimento e instalado juntos? | Separados: o `pnpm dev` usa a pasta de dados `Argus Dev`, `~/.argus-dev` e um comando `argus` próprio | `src/main/index.ts`, commit 91728de |

## Em aberto

| # | Pergunta | Sugestão |
|---|---|---|
| P11 | Só Claude ou outros agentes no futuro? | Só Claude, sem fechar a porta |
| P12 | O app é distribuído e usa o login do claude.ai de quem instala. A documentação do Agent SDK proíbe terceiros de oferecer esse login sem aprovação. Isso vale para um app gratuito que usa o `claude` da própria pessoa? | Ler os termos atuais e, se continuar ambíguo, perguntar à Anthropic antes de divulgar o app (ver [integracao-com-agentes.md](integracao-com-agentes.md#riscos)) |

## Alertas

- **Formato interno do Claude Code.** Histórico das conversas, status das sessões, limite
  de uso e o login por conta dependem de arquivos e pedidos que não são API pública. Uma
  versão nova do Claude Code pode quebrar essas partes. Cada uma tem anotada no código a
  versão em que foi conferida.
- **Backup do certificado.** Todas as versões saem assinadas com o mesmo certificado
  autoassinado (D15); o atualizador só aceita uma versão com a mesma assinatura (D16). Se
  o certificado se perder, quem já instalou não recebe mais atualização sozinho e precisa
  reinstalar pelo `install.sh`. O backup está em `~/Documents/Argus-certificado`.
- **Repositório público.** O atualizador depende dele (D16): a API do GitHub devolve 404
  para release de repositório privado.
