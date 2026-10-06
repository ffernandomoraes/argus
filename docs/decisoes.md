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
| P8 | Uma instância é cópia do agente global ou fica vinculada a ele? Se eu editar o agente global, a instância muda junto? | Vinculada, com opção de "desvincular" |
| P9 | O visualizador de código só mostra ou também edita? | Só mostra, com botão "abrir no VS Code" |
| P10 | Projetos entram automaticamente (importar os que o Claude Code já conhece) ou um por um? | Importar com seleção, sugerindo a área pela pasta |
| P11 | Só Claude ou outros agentes no futuro? | Só Claude, sem fechar a porta |
| P12 | Nome do produto. "Canva" é marca registrada da Canva Pty Ltd. | Trocar se um dia o app for distribuído; para uso pessoal, tanto faz |

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
