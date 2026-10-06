# Funcionalidades

Separadas por fase. Cada fase tem que funcionar sozinha antes da próxima começar.
A ordem das fases 2 e 3 depende da integração escolhida
(ver [integracao-com-agentes.md](integracao-com-agentes.md)).

## Fase 0: Wireframe (agora)

Telas de baixa fidelidade, sem código de produto. Telas propostas:

1. Canvas, visão geral: as três áreas com os projetos dentro.
2. Projeto aberto: conversas, instâncias de agente e subagentes ligados entre si.
3. Conversa: o chat em si (escrever o prompt, colar prints, ver a resposta chegando, ver
   as ferramentas sendo usadas).
4. Bloco de subagente detalhado: input, atividade e output.
5. Biblioteca global de agentes e o fluxo de "instanciar agente neste projeto".
6. Visualizador de código.

## Fase 1: Canvas e projetos

- Canvas infinito com pan e zoom.
- Caixas de projeto: arrastar, redimensionar, mudar cor.
- Áreas Trabalho, Freela e Pessoal.
- Adicionar projeto a partir de uma pasta. Sugestão: importar os projetos que o Claude
  Code já conhece e sugerir a área pela pasta.
- O layout é salvo e volta igual ao reabrir o app.

## Fase 2: Conversar

- Criar uma conversa dentro de um projeto e conversar com a IA naquela pasta.
- **Colar prints** com Cmd+V, arrastar imagens para o chat, ver as miniaturas antes de
  enviar e remover alguma se precisar.
- Usar a assinatura do Claude já logada na máquina.
- Resposta aparecendo em tempo real (streaming: o texto chega aos poucos, enquanto é
  gerado).
- Ver as ferramentas que a IA está usando, de forma resumida e expansível.
- Aprovar ou negar permissões (ex.: "posso rodar este comando?") direto no bloco.
- Parar a IA no meio.
- Várias conversas em vários projetos ao mesmo tempo.
- Indicador de "esperando você" visível com o canvas afastado (zoom out).

## Fase 3: Agentes e subagentes

- Biblioteca global de agentes: criar, editar, duplicar.
- Instanciar um agente num projeto com uma tarefa.
- Bloco de subagente criado automaticamente, ligado à origem, com input, atividade,
  output e status.
- Ver sessões iniciadas fora do app (terminal, VS Code). Depende da integração.

## Fase 4: Código

- Árvore de arquivos e visualização de arquivo (Monaco, o editor do VS Code).
- Ver o que o agente mudou (diff: comparação lado a lado do antes e depois).
- Botão "abrir no VS Code".

## Depois

- Windows.
- Terminal embutido.
- Conexões entre projetos.
- Notificações do sistema quando um agente termina ou precisa de resposta.
- Custo e uso de tokens por projeto e por área.
- Busca global em conversas.
- Outros agentes além do Claude (Codex, Gemini CLI), se fizer sentido.
